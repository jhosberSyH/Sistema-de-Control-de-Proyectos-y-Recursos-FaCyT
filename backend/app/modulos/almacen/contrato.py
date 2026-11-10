"""Módulo 6 (Almacén) con el contrato del frontend (pasos 17 a 20; F6.1 a F6.6, F3.3; RN-02, RN-06, RN-07).

Almacén y recepción (handlers/almacen.ts)
  GET  /api/almacen                    tareas del día: despachos por entregar, reposiciones por recibir,
                                       lotes por vencer o vencidos y las últimas recepciones
  GET  /api/recepciones/opciones       insumos, ubicaciones activas y reposiciones aprobadas
  POST /api/lotes                      registra la recepción: el stock sube en la misma operación (RNF-10)
Despachos y bitácora (handlers/despachos.ts)
  GET  /api/despachos/nuevo?solicitud  el retiro aprobado con los lotes de cada insumo (FEFO)
  POST /api/despachos                  {solicitud, lotes: {insumoId: lote}, retiro, observacion}
  GET  /api/bitacora?proyectoId&desde&hasta&q&despacho
  POST /api/correcciones               {lineaId, campo, cantidadNueva | proyectoNuevoId, motivo}
  POST /api/correcciones/{id}/aprobar  (handlers/bandeja.ts) F6.6
  POST /api/correcciones/{id}/denegar  {nota}
Uso de materia prima (handlers/usos-materia.ts)
  GET  /api/usos-materia?proyectoId&insumo&fecha
  POST /api/usos-materia               {proyectoId, insumoId, cantidad, fecha, observaciones}

Los proyectos se identifican por su UUID (proyectoId); "proyecto" es el código, para mostrarlo. Las
solicitudes, por su número (SOL-…, REP-…). La bitácora no tiene PUT ni DELETE (RN-06): un error se
corrige con un movimiento nuevo.
"""

from collections import OrderedDict, defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auditoria.service import record_audit_log
from app.autenticacion.dependencies import get_client_ip, require_role
from app.avisos.service import avisar, avisar_a, ids_por_rol
from app.core.api import APROBADOR, COORDINADOR, ErrorValidacion, ModeloApi, conflicto, es_id_valido, iso, normalizar
from app.core.database import get_db
from app.modulos.almacen.reglas import (
    aprobar_correccion,
    buscar_solicitud,
    codigo_correccion,
    correccion_o_404,
    correccion_pendiente,
    denegar_correccion,
    movimiento_que_corrige,
    numero_linea,
    siguiente_codigo_correccion,
    siguiente_codigo_despacho,
    siguiente_codigo_lote,
)
from app.modulos.inventario.reglas import (
    _minuscula,
    anticipacion,
    cantidad,
    dias_hasta,
    dinero,
    fecha_local,
    hoy,
    inicio_del_dia,
    legible,
    leer_fecha,
    mes_de,
    num,
    numero_valido,
    periodo_cerrado_en,
    periodo_en_curso,
    revisar_reposicion,
    texto,
)
from app.modulos.usuarios.models import (
    Batch,
    Dispatch,
    DispatchCorrection,
    Item,
    Location,
    Project,
    RawMaterialUsage,
    Request as Solicitud,
    RequestItem,
    User,
)

router = APIRouter(tags=["Módulo 6: Almacén"])

solo_aprobador = require_role([APROBADOR])
solo_coordinador = require_role([COORDINADOR])
coordinador_o_aprobador = require_role([COORDINADOR, APROBADOR])

PROYECTO_NO_EXISTE = "Ese proyecto no existe."
REPOSICION = "Reposición automática"


# =============================================================================
# Esquemas
# =============================================================================

class Opcion(ModeloApi):
    id: str
    nombre: str


class ProyectoOpcion(ModeloApi):
    id: str
    codigo: str
    nombre: str


class DespachoPorEntregar(ModeloApi):
    solicitud: str  # número (SOL-…), se muestra
    solicitud_id: str  # UUID, para enlazar y despachar
    proyecto: str
    proyecto_id: str
    prioridad: Literal["Crítica", "Alta", "Media", "Baja"]
    items: List[str]
    aprobada_el: str


class PorRecibir(ModeloApi):
    id: str
    numero: str
    insumo_id: str
    insumo: str
    cantidad: float
    unidad: str
    aprobada_el: str


class Reciente(ModeloApi):
    codigo: str
    insumo_id: str
    insumo: str
    cantidad: float
    unidad: str
    ingreso: str
    proveedor: str


class Almacen(ModeloApi):
    lotes_por_vencer: int
    lotes_vencidos: int
    despachos: List[DespachoPorEntregar]
    por_recibir: List[PorRecibir]
    recientes: List[Reciente]


class InsumoRecepcion(ModeloApi):
    id: str
    nombre: str
    unidad: str
    stock: float
    stock_minimo: float
    vence: Optional[bool]
    ubicacion_id: Optional[str]


class ReposicionAprobada(ModeloApi):
    id: str
    numero: str
    insumo_id: str
    cantidad: float


class OpcionesRecepcion(ModeloApi):
    insumos: List[InsumoRecepcion]
    ubicaciones: List[Opcion]
    reposiciones: List[ReposicionAprobada]


class DatosLote(ModeloApi):
    solicitud: Any = None
    insumo_id: Any = None
    lote_proveedor: Any = None
    cantidad: Any = None
    costo_unitario: Any = None
    proveedor: Any = None
    ingreso: Any = None
    vence: Any = None
    ubicacion_id: Any = None


class LoteRegistrado(ModeloApi):
    codigo: str
    insumo_id: str
    insumo: str
    unidad: str
    stock_antes: float
    stock_despues: float
    stock_minimo: float
    reposicion: Optional[str]
    nueva_reposicion: Optional[str]


class LoteDespacho(ModeloApi):
    codigo: str
    vence: Optional[str]
    ingreso: str
    cantidad: float
    ubicacion: str
    vencido: bool
    sugerido: bool


class SolicitudDespacho(ModeloApi):
    id: str
    numero: str
    proyecto: str
    proyecto_id: str
    coordinador: Optional[str]
    aprobada_el: str
    proposito: Optional[str]


class LineaNuevoDespacho(ModeloApi):
    insumo_id: str
    insumo: str
    unidad: str
    cantidad: float
    stock: float
    vence: bool
    lotes: List[LoteDespacho]


class NuevoDespacho(ModeloApi):
    solicitud: Optional[SolicitudDespacho]
    lineas: List[LineaNuevoDespacho]
    personas: List[str]
    siguiente: Optional[str]
    siguiente_id: Optional[str] = None


class DatosDespacho(ModeloApi):
    solicitud: Any = None
    lotes: Any = None
    retiro: Any = None
    observacion: Any = None


class LineaDespachada(ModeloApi):
    insumo: str
    unidad: str
    cantidad: float
    lote: str


class DespachoRegistrado(ModeloApi):
    codigo: str
    fecha: str
    solicitud: str
    solicitud_id: str
    proyecto: str
    proyecto_id: str
    coordinador: Optional[str]
    aprobada_el: str
    retiro: str
    monto: float
    lineas: List[LineaDespachada]
    siguiente: Optional[str]
    siguiente_id: Optional[str] = None


class LineaBitacora(ModeloApi):
    id: str
    codigo: str
    fecha: str
    proyecto: Optional[str]
    proyecto_id: Optional[str]
    insumo_id: str
    insumo: str
    unidad: str
    lote: str
    cantidad: float
    retiro: Optional[str]
    corrige: Optional[str]
    aprobada_por: Optional[str]
    corregido_por: Optional[str]
    correccion_pendiente: Optional[str]
    puede_corregir: bool


class Bitacora(ModeloApi):
    desde: str
    hasta: str
    resaltado: Optional[str]
    proyectos: List[ProyectoOpcion]
    filas: List[LineaBitacora]


class DatosCorreccion(ModeloApi):
    linea_id: Any = None
    campo: Any = None
    cantidad_nueva: Any = None
    proyecto_nuevo_id: Any = None
    motivo: Any = None


class EstadoPedido(ModeloApi):
    id: str
    estado: str


class DatosDenegar(ModeloApi):
    nota: Any = None


class Rango(ModeloApi):
    inicio: str
    fin: str


class UsoRegistrado(ModeloApi):
    id: str
    fecha: str
    cantidad: float
    observaciones: Optional[str]


class InsumoOpcion(ModeloApi):
    id: str
    nombre: str
    unidad: str


class UsoMateria(ModeloApi):
    proyectos: List[ProyectoOpcion]
    proyecto: Optional[str]
    proyecto_id: Optional[str]
    insumos: List[InsumoOpcion]
    insumo: Optional[str]
    mes: Rango
    despachado: float
    usado: float
    usos: List[UsoRegistrado]


class DatosUso(ModeloApi):
    proyecto_id: Any = None
    insumo_id: Any = None
    cantidad: Any = None
    fecha: Any = None
    observaciones: Any = None


class UsoCreado(ModeloApi):
    id: str
    mes: Rango
    despachado: float
    usado: float
    usos: List[UsoRegistrado]


# =============================================================================
# Consultas comunes
# =============================================================================

def _fecha_solicitud(s: Solicitud) -> str:
    return iso(s.decided_at or s.updated_at or s.created_at)


def _pedida(linea: RequestItem) -> Decimal:
    return linea.approved_quantity if linea.approved_quantity is not None else linea.requested_quantity


def _retiros_por_entregar(db: Session) -> List[Solicitud]:
    """Retiros aprobados que el almacén todavía no despachó (F6.2), del más antiguo al más reciente."""
    lista = db.query(Solicitud).filter(Solicitud.request_type == "Retiro", Solicitud.status == "Aprobado").all()
    return sorted(lista, key=_fecha_solicitud)


def _reposiciones_aprobadas(db: Session) -> List[Solicitud]:
    lista = db.query(Solicitud).filter(Solicitud.request_type == REPOSICION, Solicitud.status == "Aprobado").all()
    return sorted(lista, key=_fecha_solicitud)


def _nombre(db: Session, usuario_id) -> Optional[str]:
    u = db.get(User, usuario_id) if usuario_id else None
    return u.full_name if u else None


def _vence(db: Session, item_id) -> Optional[bool]:
    """True si sus lotes traen vencimiento, False si no, None si todavía no tiene lotes."""
    lotes = db.query(Batch.expiration_date).filter(Batch.item_id == item_id).all()
    if not lotes:
        return None
    return any(v is not None for (v,) in lotes)


def _proyecto_por_id(db: Session, proyecto_id) -> Optional[Project]:
    if not isinstance(proyecto_id, str) or not proyecto_id or not es_id_valido(proyecto_id, db):
        return None
    return db.get(Project, proyecto_id)


def _opcion_proyecto(p: Project) -> ProyectoOpcion:
    return ProyectoOpcion(id=str(p.id), codigo=p.code, nombre=p.title)


def _proyectos_de(db: Session, usuario_id) -> List[Project]:
    return db.query(Project).filter(Project.coordinator_id == usuario_id).order_by(Project.code).all()


# =============================================================================
# Almacén y recepción (F6.1)
# =============================================================================

@router.get("/almacen", response_model=Almacen)
def tareas_del_almacen(db: Session = Depends(get_db), quien: User = Depends(solo_aprobador)):
    dias_alerta = anticipacion(db)
    con_fecha = db.query(Batch).filter(Batch.available_quantity > 0, Batch.expiration_date.isnot(None)).all()
    dias = [dias_hasta(b.expiration_date) for b in con_fecha]

    despachos = []
    for s in _retiros_por_entregar(db):
        p = db.get(Project, s.project_id) if s.project_id else None
        if not p:
            continue
        despachos.append(DespachoPorEntregar(
            solicitud=s.request_number, solicitud_id=str(s.id), proyecto=p.code, proyecto_id=str(p.id), prioridad=p.priority_level,
            items=[f"{l.item.name} {num(_pedida(l))} {l.item.unit_of_measure}" for l in s.items],
            aprobada_el=_fecha_solicitud(s),
        ))

    por_recibir = []
    for r in _reposiciones_aprobadas(db):
        linea = r.items[0] if r.items else None
        if not linea:
            continue
        por_recibir.append(PorRecibir(
            id=str(r.id), numero=r.request_number, insumo_id=str(linea.item_id), insumo=linea.item.name,
            cantidad=cantidad(_pedida(linea)), unidad=linea.item.unit_of_measure, aprobada_el=_fecha_solicitud(r),
        ))

    recientes = (
        db.query(Batch).filter(Batch.item_id.isnot(None))
        .order_by(Batch.received_date.desc(), Batch.created_at.desc(), Batch.batch_number.desc()).limit(3).all()
    )
    return Almacen(
        lotes_por_vencer=sum(1 for d in dias if 0 <= d <= dias_alerta),
        lotes_vencidos=sum(1 for d in dias if d < 0),
        despachos=despachos,
        por_recibir=por_recibir,
        recientes=[
            Reciente(codigo=b.batch_number, insumo_id=str(b.item_id), insumo=b.item.name,
                     cantidad=cantidad(b.initial_quantity), unidad=b.item.unit_of_measure,
                     ingreso=b.received_date.isoformat(), proveedor=b.supplier or "")
            for b in recientes
        ],
    )


@router.get("/recepciones/opciones", response_model=OpcionesRecepcion)
def opciones_de_recepcion(db: Session = Depends(get_db), quien: User = Depends(solo_aprobador)):
    lotes: Dict[str, List[Batch]] = defaultdict(list)
    for b in db.query(Batch).all():
        lotes[str(b.item_id)].append(b)
    insumos = []
    for i in sorted(db.query(Item).filter(Item.is_active.is_(True)).all(), key=lambda i: normalizar(i.name)):
        propios = lotes.get(str(i.id), [])
        ultimo = max(propios, key=lambda b: (b.received_date, b.created_at or datetime.min.replace(tzinfo=timezone.utc)), default=None)
        insumos.append(InsumoRecepcion(
            id=str(i.id), nombre=i.name, unidad=i.unit_of_measure, stock=cantidad(i.current_stock),
            stock_minimo=cantidad(i.min_stock),
            vence=(any(b.expiration_date is not None for b in propios) if propios else None),
            ubicacion_id=str(ultimo.location_id) if ultimo else None,
        ))
    ubicaciones = db.query(Location).filter(Location.is_active.is_(True)).all()
    return OpcionesRecepcion(
        insumos=insumos,
        ubicaciones=[Opcion(id=str(u.id), nombre=u.name) for u in sorted(ubicaciones, key=lambda u: normalizar(u.name))],
        reposiciones=[
            ReposicionAprobada(id=str(r.id), numero=r.request_number, insumo_id=str(r.items[0].item_id), cantidad=cantidad(_pedida(r.items[0])))
            for r in _reposiciones_aprobadas(db) if r.items
        ],
    )


@router.post("/lotes", response_model=LoteRegistrado, status_code=status.HTTP_201_CREATED)
def registrar_lote(datos: DatosLote, request: Request, db: Session = Depends(get_db), quien: User = Depends(solo_aprobador)):
    """F6.1 y HU-18: un lote vencido (o que vence antes de ingresar) no se registra."""
    dia = hoy()
    errores: Dict[str, str] = {}

    insumo_id = texto(datos.insumo_id, 64)
    i = db.get(Item, insumo_id) if insumo_id and es_id_valido(insumo_id, db) else None
    if i is not None and not i.is_active:
        i = None
    if not i:
        errores["insumoId"] = "Elige el insumo."
    lote_proveedor = texto(datos.lote_proveedor, 40)
    if not lote_proveedor:
        errores["loteProveedor"] = "Escribe el número de lote que trae el proveedor."
    cant = numero_valido(datos.cantidad)
    if cant is None or not cant > 0:
        errores["cantidad"] = "Escribe la cantidad recibida, mayor que cero."
    costo = numero_valido(datos.costo_unitario)
    if costo is None or not costo > 0:
        errores["costoUnitario"] = "Escribe el costo unitario, mayor que cero."
    proveedor = texto(datos.proveedor, 120)
    if not proveedor:
        errores["proveedor"] = "Escribe el proveedor."
    ingreso = leer_fecha(datos.ingreso)
    if not ingreso:
        errores["ingreso"] = "Elige la fecha de ingreso."
    elif ingreso > dia:
        errores["ingreso"] = "La fecha de ingreso no puede ser posterior a hoy."
    vence = None if datos.vence in (None, "") else leer_fecha(datos.vence)
    if datos.vence not in (None, "") and not vence:
        errores["vence"] = "Escribe una fecha de vencimiento válida."
    elif vence and vence < dia:
        errores["vence"] = "La fecha de vencimiento ya pasó. Un lote vencido no se registra: devuélvelo al proveedor."
    elif vence and ingreso and vence < ingreso:
        errores["vence"] = "El vencimiento no puede ser anterior a la fecha de ingreso."
    elif not vence and i and _vence(db, i.id) is True:
        errores["vence"] = f"{i.name} vence: escribe la fecha de vencimiento del lote."
    ubicacion_id = texto(datos.ubicacion_id, 64)
    ubicacion = db.get(Location, ubicacion_id) if ubicacion_id and es_id_valido(ubicacion_id, db) else None
    if not ubicacion or not ubicacion.is_active:
        errores["ubicacionId"] = "Elige dónde se guarda el lote."
    solicitud_id = texto(datos.solicitud, 64) or None
    reposicion = buscar_solicitud(db, solicitud_id) if solicitud_id else None
    if reposicion is not None and (reposicion.request_type != REPOSICION or reposicion.status != "Aprobado"):
        reposicion = None
    linea_rep = reposicion.items[0] if reposicion is not None and reposicion.items else None
    if solicitud_id and not reposicion:
        errores["solicitud"] = f"{solicitud_id} ya no está aprobada por recibir."
    elif reposicion is not None and i and linea_rep and str(linea_rep.item_id) != str(i.id):
        errores["insumoId"] = f"{reposicion.request_number} es de {linea_rep.item.name}: elige ese insumo."
    if errores:
        raise ErrorValidacion(errores)

    repetido = (
        db.query(Batch)
        .filter(Batch.item_id == i.id, Batch.supplier_lot_code == lote_proveedor)
        .all()
    )
    repetido = next((b for b in repetido if (b.supplier or "").lower() == proveedor.lower()), None)
    if repetido:
        raise conflicto(f"El lote {lote_proveedor} de {proveedor} ya se registró como {repetido.batch_number}.")

    ip = get_client_ip(request)
    item = db.query(Item).filter(Item.id == i.id).with_for_update().one()
    codigo = siguiente_codigo_lote(db)
    cantidad_lote = Decimal(str(round(cant, 3)))
    alerta = anticipacion(db)
    estado_venc = "Vigente"
    if vence and (vence - dia).days <= alerta:
        estado_venc = "Próximo a vencer"
    lote = Batch(
        item_id=item.id, location_id=ubicacion.id, batch_number=codigo, supplier_lot_code=lote_proveedor,
        initial_quantity=cantidad_lote, available_quantity=cantidad_lote, unit_cost=Decimal(str(round(costo, 2))),
        supplier=proveedor, received_date=ingreso, expiration_date=vence, expiration_status=estado_venc,
        request_id=reposicion.id if reposicion is not None else None,
    )
    db.add(lote)
    stock_antes = cantidad(item.current_stock)
    item.current_stock = Decimal(str(item.current_stock)) + cantidad_lote
    item.updated_at = datetime.now(timezone.utc)
    db.flush()
    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=f"LOTE:{codigo}", target_table="batches",
        target_id=str(lote.id), action_type="BATCH_RECEIVED",
        old_value={"item_current_stock": str(stock_antes)},
        new_value={"batch_number": codigo, "supplier_lot_code": lote_proveedor, "quantity": str(cantidad_lote),
                   "unit_cost": str(lote.unit_cost), "supplier": proveedor,
                   "expiration_date": vence.isoformat() if vence else None, "item_current_stock": str(item.current_stock),
                   "descripcion": f"{quien.full_name} registró la recepción del lote {codigo}",
                   "detalle": f"{item.name}, {num(cantidad_lote)} {item.unit_of_measure} · {proveedor} · lote {lote_proveedor}"},
    )
    if reposicion is not None:
        reposicion.status = "Ejecutado"
        reposicion.actual_amount = (cantidad_lote * lote.unit_cost).quantize(Decimal("0.01"))
        reposicion.updated_at = datetime.now(timezone.utc)
        record_audit_log(
            db=db, user_id=quien.id, ip_address=ip, target_object=f"REQUEST:{reposicion.request_number}",
            target_table="requests", target_id=str(reposicion.id), action_type="REQUEST_EXECUTED",
            old_value={"status": "Aprobado"},
            new_value={"status": "Ejecutado", "batch_number": codigo,
                       "descripcion": f"{quien.full_name} recibió la reposición {reposicion.request_number} con el lote {codigo}"},
        )
        # Aviso a quien aprobó la compra (si no es quien la recibe)
        if reposicion.decided_by_user_id and str(reposicion.decided_by_user_id) != str(quien.id):
            avisar(db, reposicion.decided_by_user_id, "ok", f"Recibida: {reposicion.request_number}",
                   f"/inventario/{item.id}",
                   detalle=f"Llegó el lote {codigo}: {num(cantidad_lote)} {item.unit_of_measure} de {_minuscula(item.name)}.")
    # Si sigue bajo el mínimo y ya no hay una reposición abierta, el sistema crea otra (F3.5)
    nueva = revisar_reposicion(db, item, quien.id, ip)
    db.commit()
    return LoteRegistrado(
        codigo=codigo, insumo_id=str(item.id), insumo=item.name, unidad=item.unit_of_measure, stock_antes=stock_antes,
        stock_despues=cantidad(item.current_stock), stock_minimo=cantidad(item.min_stock),
        reposicion=reposicion.request_number if reposicion is not None else None, nueva_reposicion=nueva,
    )


# =============================================================================
# Despachos (F6.2, F6.3)
# =============================================================================

def _lotes_fefo(db: Session, item_id, pedida: float) -> List[Dict[str, Any]]:
    """Lotes con stock: los que vencen, del que vence primero (FEFO); los que no, del más antiguo."""
    dia = hoy()
    lotes = db.query(Batch).filter(Batch.item_id == item_id, Batch.available_quantity > 0).all()
    filas = [(b, b.expiration_date is not None and b.expiration_date < dia) for b in lotes]
    filas.sort(key=lambda x: (x[1], x[0].expiration_date or date.max, x[0].received_date))
    sugerido = next((b for b, venc in filas if not venc and float(b.available_quantity) >= pedida), None) or next(
        (b for b, venc in filas if not venc), None
    )
    return [
        {"codigo": b.batch_number, "vence": b.expiration_date.isoformat() if b.expiration_date else None,
         "ingreso": b.received_date.isoformat(), "cantidad": cantidad(b.available_quantity),
         "ubicacion": b.location.name if b.location else "—", "vencido": venc, "sugerido": b is sugerido}
        for b, venc in filas
    ]


def _coordinador(db: Session, p: Optional[Project]) -> Optional[str]:
    return _nombre(db, p.coordinator_id) if p and p.coordinator_id else None


@router.get("/despachos/nuevo", response_model=NuevoDespacho)
def preparar_despacho(solicitud: Optional[str] = None, db: Session = Depends(get_db), quien: User = Depends(solo_aprobador)):
    pendientes = _retiros_por_entregar(db)
    if solicitud:
        s = buscar_solicitud(db, solicitud)
        if not s or s.request_type != "Retiro":
            raise HTTPException(status_code=404, detail=f"No encontramos el retiro {solicitud}.")
        if s.status == "Ejecutado":
            hecho = db.query(Dispatch).filter(Dispatch.request_id == s.id, Dispatch.is_compensatory.is_(False)).first()
            raise conflicto(f"{s.request_number} ya se despachó{f' con {hecho.codigo}' if hecho else ''}.")
        if s.status != "Aprobado":
            raise conflicto(f"{s.request_number} está {s.status}: solo se despacha un retiro aprobado.")
    else:
        s = pendientes[0] if pendientes else None
    if not s:
        return NuevoDespacho(solicitud=None, lineas=[], personas=[], siguiente=None)

    p = db.get(Project, s.project_id)
    coordinador = _coordinador(db, p)
    # Quienes ya retiraron para este proyecto: el personal de laboratorio no tiene cuenta (F6.3)
    anteriores = [
        n for (n,) in db.query(Dispatch.received_by_name)
        .filter(Dispatch.project_id == p.id, Dispatch.is_compensatory.is_(False))
        .order_by(Dispatch.dispatched_at).all()
    ]
    personas = list(OrderedDict.fromkeys(x for x in [coordinador, *anteriores] if x))
    lineas = []
    for l in s.items:
        pedida = float(_pedida(l))
        lineas.append(LineaNuevoDespacho(
            insumo_id=str(l.item_id), insumo=l.item.name, unidad=l.item.unit_of_measure, cantidad=cantidad(pedida),
            stock=cantidad(l.item.current_stock), vence=bool(_vence(db, l.item_id)),
            lotes=[LoteDespacho(**x) for x in _lotes_fefo(db, l.item_id, pedida)],
        ))
    return NuevoDespacho(
        solicitud=SolicitudDespacho(
            id=str(s.id), numero=s.request_number, proyecto=p.code, proyecto_id=str(p.id), coordinador=coordinador,
            aprobada_el=_fecha_solicitud(s), proposito=getattr(s, "purpose", None),
        ),
        lineas=lineas,
        personas=personas,
        siguiente=next((x.request_number for x in pendientes if x.id != s.id), None),
        siguiente_id=next((str(x.id) for x in pendientes if x.id != s.id), None),
    )


@router.post("/despachos", response_model=DespachoRegistrado, status_code=status.HTTP_201_CREATED)
def registrar_despacho(datos: DatosDespacho, request: Request, db: Session = Depends(get_db), quien: User = Depends(solo_aprobador)):
    """F6.2 y F6.3: en una sola operación se registra el despacho en la bitácora, se descuenta el stock de
    cada lote (F3.3), el retiro pasa a Ejecutado y el costo queda cargado al proyecto (F2.7, decisión 5)."""
    s = buscar_solicitud(db, datos.solicitud if isinstance(datos.solicitud, str) else None)
    if not s or s.request_type != "Retiro":
        raise HTTPException(status_code=404, detail="No encontramos ese retiro.")
    if s.status != "Aprobado":
        raise conflicto(f"{s.request_number} está {s.status}: ya no se puede despachar.")
    if periodo_cerrado_en(db, hoy()):
        raise conflicto("El período de hoy está cerrado: no admite despachos.")

    errores: Dict[str, str] = {}
    retiro = texto(datos.retiro, 120)
    if not retiro:
        errores["retiro"] = "Escribe quién retira los insumos."
    elegidos_por_insumo = datos.lotes if isinstance(datos.lotes, dict) else {}
    dia = hoy()
    elegidos = []
    for l in s.items:
        item = l.item
        pedida = _pedida(l)
        codigo_lote = elegidos_por_insumo.get(str(item.id))
        lote = (
            db.query(Batch).filter(Batch.item_id == item.id, Batch.batch_number == codigo_lote).with_for_update().first()
            if isinstance(codigo_lote, str) and codigo_lote else None
        )
        campo = f"lotes.{item.id}"
        if not lote:
            errores[campo] = f"Elige el lote de {_minuscula(item.name)}."
        elif lote.expiration_date and lote.expiration_date < dia:
            errores[campo] = f"{lote.batch_number} está vencido: no se despacha."
        elif lote.available_quantity < pedida:
            errores[campo] = (f"{lote.batch_number} tiene {legible(lote.available_quantity, item.unit_of_measure)}; "
                              f"se piden {legible(pedida, item.unit_of_measure)}.")
        elegidos.append((l, item, lote, pedida))
    if errores:
        raise ErrorValidacion(errores)

    ip = get_client_ip(request)
    p = db.get(Project, s.project_id)
    codigo = siguiente_codigo_despacho(db)
    ahora = datetime.now(timezone.utc)
    aprobada_el = _fecha_solicitud(s)
    observacion = texto(datos.observacion, 300) or None
    monto = Decimal("0")
    for n, (l, item, lote, pedida) in enumerate(elegidos, start=1):
        db.add(Dispatch(
            dispatch_number=numero_linea(codigo, n), movement_code=codigo, batch_id=lote.id, project_id=p.id,
            dispatched_quantity=pedida, direction="salida", unit_cost_snapshot=lote.unit_cost, dispatched_by=quien.id,
            received_by_name=retiro, request_id=s.id, is_compensatory=False, notes=observacion, dispatched_at=ahora,
        ))
        lote.available_quantity = lote.available_quantity - pedida
        item.current_stock = item.current_stock - pedida
        item.updated_at = ahora
        monto += pedida * lote.unit_cost
    monto = monto.quantize(Decimal("0.01"))
    detalle = ", ".join(f"{item.name} {legible(pedida, item.unit_of_measure)}" for _, item, _, pedida in elegidos)
    s.status = "Ejecutado"
    s.actual_amount = monto
    s.updated_at = ahora
    db.flush()
    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=f"DESPACHO:{codigo}", target_table="dispatches",
        target_id=codigo, action_type="DISPATCH_CREATED",
        new_value={"codigo": codigo, "solicitud": s.request_number, "proyecto": p.code, "monto": str(monto),
                   "descripcion": f"{quien.full_name} registró el despacho {codigo} de {s.request_number}",
                   "detalle": f"{detalle} · retiró {retiro}"},
    )
    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=f"REQUEST:{s.request_number}", target_table="requests",
        target_id=str(s.id), action_type="REQUEST_EXECUTED", old_value={"status": "Aprobado"},
        new_value={"status": "Ejecutado", "despacho": codigo,
                   "descripcion": f"{quien.full_name} ejecutó la solicitud {s.request_number} con el despacho {codigo}"},
    )
    avisar(db, s.requester_user_id or (p.coordinator_id if p else None), "ok", f"Despachado: {s.request_number}",
           f"/proyectos/bitacora?despacho={codigo}", detalle=f"{detalle}. Lo retiró {retiro}.")
    # Lo que bajó del mínimo puede crear su reposición (F3.4, F3.5)
    for _, item, _, _ in elegidos:
        revisar_reposicion(db, item, quien.id, ip)
    db.commit()
    return DespachoRegistrado(
        codigo=codigo, fecha=iso(ahora), solicitud=s.request_number, solicitud_id=str(s.id), proyecto=p.code, proyecto_id=str(p.id),
        coordinador=_coordinador(db, p), aprobada_el=aprobada_el, retiro=retiro, monto=float(monto),
        lineas=[LineaDespachada(insumo=item.name, unidad=item.unit_of_measure, cantidad=cantidad(pedida), lote=lote.batch_number)
                for _, item, lote, pedida in elegidos],
        siguiente=next((x.request_number for x in _retiros_por_entregar(db)), None),
        siguiente_id=next((str(x.id) for x in _retiros_por_entregar(db)), None),
    )


# =============================================================================
# Bitácora y correcciones (F6.3, F6.5, F6.6)
# =============================================================================

@router.get("/bitacora", response_model=Bitacora)
def bitacora(
    proyectoId: Optional[str] = None,
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    q: str = "",
    despacho: Optional[str] = None,
    db: Session = Depends(get_db),
    quien: User = Depends(coordinador_o_aprobador),
):
    """F6.3: la bitácora de los proyectos del coordinador (RN-07); el aprobador la ve completa."""
    es_coordinador = quien.role == COORDINADOR
    periodo = periodo_en_curso(db)
    linea = (
        db.query(Dispatch).filter(or_(Dispatch.movement_code == despacho, Dispatch.dispatch_number == despacho)).first()
        if despacho else None
    )
    inicio = leer_fecha(desde) or (periodo.start_date if periodo else hoy() - timedelta(days=30))
    fin = leer_fecha(hasta) or hoy()
    # Un enlace a un despacho anterior al rango lo incluye
    if linea and fecha_local(linea.dispatched_at) < inicio:
        inicio = fecha_local(linea.dispatched_at)
    filtro = None
    if proyectoId:
        filtro = _proyecto_por_id(db, proyectoId)
        if not filtro:
            raise HTTPException(status_code=404, detail=PROYECTO_NO_EXISTE)

    consulta = (
        db.query(Dispatch).join(Project, Dispatch.project_id == Project.id)
        .filter(Dispatch.dispatched_at >= inicio_del_dia(inicio), Dispatch.dispatched_at < inicio_del_dia(fin + timedelta(days=1)))
    )
    if es_coordinador:
        consulta = consulta.filter(Project.coordinator_id == quien.id)
    if filtro:
        consulta = consulta.filter(Dispatch.project_id == filtro.id)
    buscado = normalizar(q.strip())
    lineas = [d for d in consulta.all() if not buscado or buscado in normalizar(d.batch.item.name)]
    lineas.sort(key=lambda d: d.id)
    lineas.sort(key=lambda d: (d.dispatched_at, d.codigo), reverse=True)

    ids = [d.id for d in lineas]
    originales = {d.id: d for d in db.query(Dispatch).filter(Dispatch.id.in_({d.original_dispatch_id for d in lineas if d.original_dispatch_id})).all()} if lineas else {}
    corregidas: Dict[Any, str] = {}
    pendientes: Dict[Any, str] = {}
    if ids:
        for m in db.query(Dispatch).filter(Dispatch.original_dispatch_id.in_(ids), Dispatch.is_compensatory.is_(True)).order_by(Dispatch.dispatched_at).all():
            corregidas.setdefault(m.original_dispatch_id, m.codigo)
        for c in db.query(DispatchCorrection).filter(DispatchCorrection.original_dispatch_id.in_(ids), DispatchCorrection.status == "Pendiente").all():
            pendientes[c.original_dispatch_id] = codigo_correccion(c)
    cerrados: Dict[date, bool] = {}

    def cerrado(dia: date) -> bool:
        if dia not in cerrados:
            cerrados[dia] = periodo_cerrado_en(db, dia) is not None
        return cerrados[dia]

    filas = []
    for d in lineas:
        item = d.batch.item
        original = originales.get(d.original_dispatch_id) if d.is_compensatory else None
        corrige = original.codigo if original else None
        corregido_por = corregidas.get(d.id)
        pendiente = None if d.is_compensatory else pendientes.get(d.id)
        signo = cantidad(d.signed_quantity if d.signed_quantity is not None else d.dispatched_quantity)
        filas.append(LineaBitacora(
            id=str(d.id), codigo=d.codigo, fecha=iso(d.dispatched_at), proyecto=d.project.code, proyecto_id=str(d.project_id),
            insumo_id=str(item.id), insumo=item.name, unidad=item.unit_of_measure, lote=d.batch.batch_number,
            cantidad=signo, retiro=None if d.is_compensatory else d.received_by_name, corrige=corrige,
            aprobada_por=_nombre(db, d.dispatched_by) if d.is_compensatory else None,
            corregido_por=corregido_por, correccion_pendiente=pendiente,
            puede_corregir=(es_coordinador and not d.is_compensatory and not corregido_por and not pendiente
                            and signo > 0 and not cerrado(fecha_local(d.dispatched_at))),
        ))

    proyectos = _proyectos_de(db, quien.id) if es_coordinador else db.query(Project).order_by(Project.code).all()
    return Bitacora(
        desde=inicio.isoformat(), hasta=fin.isoformat(), resaltado=despacho if linea else None,
        proyectos=[_opcion_proyecto(p) for p in proyectos], filas=filas,
    )


@router.post("/correcciones", response_model=EstadoPedido, status_code=status.HTTP_201_CREATED)
def pedir_correccion(datos: DatosCorreccion, request: Request, db: Session = Depends(get_db), quien: User = Depends(solo_coordinador)):
    """F6.5: el pedido queda pendiente en la bandeja del aprobador; el despacho original no cambia (RN-06)."""
    linea_id = datos.linea_id if isinstance(datos.linea_id, str) else ""
    l = db.get(Dispatch, linea_id) if linea_id and es_id_valido(linea_id, db) else None
    proyecto = db.get(Project, l.project_id) if l else None
    if not l or not proyecto or str(proyecto.coordinator_id) != str(quien.id):
        raise HTTPException(status_code=404, detail="No encontramos ese despacho en tus proyectos.")
    if l.is_compensatory:
        raise conflicto(f"{l.codigo} es un movimiento de corrección: no se corrige otra vez.")
    pendiente = correccion_pendiente(db, l.id)
    if pendiente:
        raise conflicto(f"{l.codigo} ya tiene la corrección {codigo_correccion(pendiente)} esperando al aprobador.")
    hecha = movimiento_que_corrige(db, l.id)
    if hecha:
        raise conflicto(f"{l.codigo} ya se corrigió con {hecha.codigo}.")
    if periodo_cerrado_en(db, fecha_local(l.dispatched_at)):
        raise conflicto(f"{l.codigo} es de un período cerrado: ya no se corrige.")

    item = l.batch.item
    errores: Dict[str, str] = {}
    campo = datos.campo if datos.campo in ("cantidad", "proyecto") else None
    if not campo:
        errores["campo"] = "Elige qué está mal: la cantidad o el proyecto."
    nueva = numero_valido(datos.cantidad_nueva)
    if campo == "cantidad":
        if nueva is None or not nueva >= 0:
            errores["cantidadNueva"] = "Escribe la cantidad correcta, 0 o más."
        elif round(nueva, 3) == cantidad(l.dispatched_quantity):
            errores["cantidadNueva"] = "Es la misma cantidad registrada."
    destino = None
    if campo == "proyecto":
        destino = _proyecto_por_id(db, datos.proyecto_nuevo_id)
        if not destino or str(destino.coordinator_id) != str(quien.id):
            errores["proyectoNuevoId"] = "Elige otro de tus proyectos."
        elif destino.id == l.project_id:
            errores["proyectoNuevoId"] = "Es el mismo proyecto registrado."
    motivo = texto(datos.motivo, 500)
    if not motivo:
        errores["motivo"] = "Escribe el motivo de la corrección. Sin motivo no se puede enviar."
    if errores:
        raise ErrorValidacion(errores)

    por_cantidad = campo == "cantidad"
    numero = siguiente_codigo_correccion(db)
    c = DispatchCorrection(
        correction_number=numero, original_dispatch_id=l.id, requested_by_user_id=quien.id, status="Pendiente",
        justification=motivo, corrected_field=campo,
        correct_quantity=Decimal(str(round(nueva, 3))) if por_cantidad else l.dispatched_quantity,
        new_project_id=None if por_cantidad else destino.id,
    )
    db.add(c)
    db.flush()
    anterior = legible(l.dispatched_quantity, item.unit_of_measure) if por_cantidad else proyecto.code
    nuevo = legible(nueva, item.unit_of_measure) if por_cantidad else destino.code
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"CORRECCION:{numero}",
        target_table="dispatch_corrections", target_id=str(c.id), action_type="DISPATCH_CORRECTION_REQUESTED",
        old_value={"valorAnterior": anterior},
        new_value={"valorNuevo": nuevo, "status": "Pendiente",
                   "descripcion": f"{quien.full_name} pidió la corrección {numero} de {l.codigo}"},
        justification=motivo,
    )
    avisar_a(db, ids_por_rol(db, APROBADOR), "info", f"Corrección por decidir: {numero}", f"/bandeja?pedido={numero}",
             detalle=f"{l.codigo} de {proyecto.code}: {item.name}.")
    db.commit()
    return EstadoPedido(id=numero, estado="Pendiente")


@router.post("/correcciones/{correccion_id}/aprobar", response_model=EstadoPedido)
def aprobar(correccion_id: str, request: Request, db: Session = Depends(get_db), quien: User = Depends(solo_aprobador)):
    resultado = aprobar_correccion(db, correccion_o_404(db, correccion_id), quien, get_client_ip(request))
    db.commit()
    return EstadoPedido(**resultado)


@router.post("/correcciones/{correccion_id}/denegar", response_model=EstadoPedido)
def denegar(
    correccion_id: str, request: Request, datos: Optional[DatosDenegar] = None,
    db: Session = Depends(get_db), quien: User = Depends(solo_aprobador),
):
    c = correccion_o_404(db, correccion_id)
    resultado = denegar_correccion(db, c, datos.nota if datos else None, quien, get_client_ip(request))
    db.commit()
    return EstadoPedido(**resultado)


# =============================================================================
# Uso de materia prima (F6.4)
# =============================================================================

def _ventana(db: Session, dia: date):
    """El mes de la fecha, empezando antes si el período en revisión empezó antes (su consumo cuenta)."""
    inicio, fin = mes_de(dia)
    p = periodo_en_curso(db)
    if p and p.start_date < inicio and dia >= p.start_date:
        inicio = p.start_date
    return inicio, fin


def _insumos_despachados(db: Session, proyecto: Project) -> List[Item]:
    """Materia prima despachada alguna vez al proyecto (descontadas las correcciones)."""
    neto: Dict[str, Decimal] = defaultdict(Decimal)
    items: Dict[str, Item] = {}
    for d in db.query(Dispatch).filter(Dispatch.project_id == proyecto.id).all():
        it = d.batch.item
        neto[str(it.id)] += d.signed_quantity if d.signed_quantity is not None else d.dispatched_quantity
        items[str(it.id)] = it
    return sorted(
        (items[k] for k, n in neto.items() if n > 0 and items[k].item_type == "Materia prima"),
        key=lambda i: normalizar(i.name),
    )


def _balance(db: Session, proyecto: Project, item: Item, dia: date) -> Dict[str, Any]:
    inicio, fin = _ventana(db, dia)
    despachos = (
        db.query(Dispatch).join(Batch, Dispatch.batch_id == Batch.id)
        .filter(Dispatch.project_id == proyecto.id, Batch.item_id == item.id,
                Dispatch.dispatched_at >= inicio_del_dia(inicio), Dispatch.dispatched_at < inicio_del_dia(fin + timedelta(days=1)))
        .all()
    )
    despachado = sum((d.signed_quantity if d.signed_quantity is not None else d.dispatched_quantity) for d in despachos)
    usos = (
        db.query(RawMaterialUsage)
        .outerjoin(Dispatch, RawMaterialUsage.dispatch_id == Dispatch.id)
        .outerjoin(Batch, Dispatch.batch_id == Batch.id)
        .filter(RawMaterialUsage.project_id == proyecto.id,
                or_(RawMaterialUsage.item_id == item.id, Batch.item_id == item.id),
                RawMaterialUsage.usage_date >= inicio, RawMaterialUsage.usage_date <= fin)
        .all()
    )
    usos.sort(key=lambda u: (u.usage_date, u.created_at or datetime.min.replace(tzinfo=timezone.utc), str(u.id)), reverse=True)
    return {
        "mes": Rango(inicio=inicio.isoformat(), fin=fin.isoformat()),
        "despachado": cantidad(despachado),
        "usado": cantidad(sum(u.quantity_used for u in usos)),
        "usos": [UsoRegistrado(id=str(u.id), fecha=u.usage_date.isoformat(), cantidad=cantidad(u.quantity_used),
                               observaciones=u.notes) for u in usos],
    }


@router.get("/usos-materia", response_model=UsoMateria)
def uso_de_materia(
    proyectoId: Optional[str] = None,
    insumo: Optional[str] = None,
    fecha: Optional[str] = None,
    db: Session = Depends(get_db),
    quien: User = Depends(solo_coordinador),
):
    mios = [p for p in _proyectos_de(db, quien.id) if p.operational_status != "Finalizado"]
    pedido = None
    if proyectoId:
        pedido = _proyecto_por_id(db, proyectoId)
        if not pedido:
            raise HTTPException(status_code=404, detail=PROYECTO_NO_EXISTE)
    p = next((x for x in mios if pedido and x.id == pedido.id), None) or (mios[0] if mios else None)
    if pedido and (not p or p.id != pedido.id):
        raise HTTPException(status_code=404, detail=f"{pedido.code} no es uno de tus proyectos.")
    insumos = _insumos_despachados(db, p) if p else []
    i = next((x for x in insumos if str(x.id) == insumo), None) or (insumos[0] if insumos else None)
    dia = leer_fecha(fecha) or hoy()
    if p and i:
        balance = _balance(db, p, i, dia)
    else:
        inicio, fin = _ventana(db, dia)
        balance = {"mes": Rango(inicio=inicio.isoformat(), fin=fin.isoformat()), "despachado": 0, "usado": 0, "usos": []}
    return UsoMateria(
        proyectos=[_opcion_proyecto(x) for x in mios],
        proyecto=p.code if p else None,
        proyecto_id=str(p.id) if p else None,
        insumos=[InsumoOpcion(id=str(x.id), nombre=x.name, unidad=x.unit_of_measure) for x in insumos],
        insumo=str(i.id) if i else None,
        **balance,
    )


@router.post("/usos-materia", response_model=UsoCreado, status_code=status.HTTP_201_CREATED)
def registrar_uso(datos: DatosUso, request: Request, db: Session = Depends(get_db), quien: User = Depends(solo_coordinador)):
    """F6.4: si el uso supera lo despachado, se guarda igual; el aprobador verá la diferencia. El registro
    solo documenta el consumo: el stock ya bajó con el despacho (F6.2)."""
    proyecto_id = datos.proyecto_id if isinstance(datos.proyecto_id, str) else ""
    if proyecto_id and not _proyecto_por_id(db, proyecto_id):
        raise HTTPException(status_code=404, detail=PROYECTO_NO_EXISTE)
    p = next((x for x in _proyectos_de(db, quien.id) if str(x.id) == proyecto_id and x.operational_status != "Finalizado"), None)
    if not p:
        raise ErrorValidacion({"proyectoId": "Elige uno de tus proyectos."})
    errores: Dict[str, str] = {}
    i = next((x for x in _insumos_despachados(db, p) if str(x.id) == datos.insumo_id), None)
    if not i:
        errores["insumoId"] = "Elige un insumo despachado a este proyecto."
    cant = numero_valido(datos.cantidad)
    if cant is None or not cant > 0:
        errores["cantidad"] = "Escribe la cantidad usada, mayor que cero."
    dia = leer_fecha(datos.fecha)
    if not dia:
        errores["fecha"] = "Elige la fecha."
    elif dia > hoy():
        errores["fecha"] = "La fecha no puede ser posterior a hoy."
    if errores:
        raise ErrorValidacion(errores)

    observaciones = texto(datos.observaciones, 300) or None
    uso = RawMaterialUsage(
        project_id=p.id, item_id=i.id, dispatch_id=None, reported_by_user_id=quien.id,
        quantity_used=Decimal(str(round(cant, 3))), waste_quantity=Decimal("0"), usage_date=dia, notes=observaciones,
    )
    db.add(uso)
    db.flush()
    b = _balance(db, p, i, dia)
    exceso = (f" · supera lo despachado del mes en {num(b['usado'] - b['despachado'])} {i.unit_of_measure}"
              if b["usado"] > b["despachado"] else "")
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"PROYECTO:{p.code}",
        target_table="raw_material_usages", target_id=str(uso.id), action_type="RAW_MATERIAL_USAGE_REPORTED",
        new_value={"item": i.name, "quantity_used": str(uso.quantity_used), "usage_date": dia.isoformat(),
                   "descripcion": f"{quien.full_name} registró el uso de {i.name} en {p.code}",
                   "detalle": f"{num(cant)} {i.unit_of_measure}{exceso}"},
    )
    db.commit()
    return UsoCreado(id=str(uso.id), **b)
