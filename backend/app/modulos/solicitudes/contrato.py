"""Módulo 5 con el contrato del frontend (F5.1 a F5.7; F3.5, F4.5 y F6.6 desde la bandeja; RN-03, RN-04, RN-07).

Mis solicitudes (vista 14), solo el Coordinador
  GET    /api/solicitudes?estado          las de sus proyectos, con conteos, sus proyectos y los insumos
  GET    /api/solicitudes/{id}            el detalle (para editar un borrador o verla)
  POST   /api/solicitudes                 {tipo, proyectoId, …}: crea un borrador con lo que tenga escrito
  PATCH  /api/solicitudes/{id}            guarda el borrador; enviada, ya no se edita
  POST   /api/solicitudes/{id}/enviar     valida lo obligatorio y la pasa a Pendiente de Aprobación
  DELETE /api/solicitudes/{id}            descarta un borrador
Bandeja (vista 15), solo el Aprobador
  GET  /api/bandeja                       pedidos por decidir y gastos aprobados por ejecutar
  POST /api/solicitudes/{id}/aprobar      gasto o retiro; reposición {cantidad} (Borrador → Aprobado en un paso)
  POST /api/solicitudes/{id}/rechazar     gasto o retiro {motivo}; reposición {motivo?} (se descarta)
  POST /api/solicitudes/{id}/ejecutar     {montoReal}: el gasto aprobado se carga al proyecto (F5.5)
Priorización (vista 16)
  GET   /api/priorizacion?estatus=todos   todos los roles (el Coordinador, solo sus proyectos)
  PATCH /api/proyectos/{id}/prioridad     {prioridad, justificacion}: solo el Aprobador (RN-04)

Las decisiones sobre reservas (POST /api/reservas/{id}/aprobar|rechazar) están en equipos/contrato.py y
la cotización (POST/GET /api/solicitudes/{id}/cotizacion) en solicitudes/cotizacion.py.

Identificadores: "id" es el UUID; "numero" es el correlativo humano (SOL-2026-0001), que es lo que se
muestra. Las rutas aceptan cualquiera de los dos (los enlaces del inicio usan el número).

La especificación son los handlers MSW (frontend/src/testing/mocks/handlers/mis-solicitudes.ts,
solicitudes.ts, bandeja.ts y priorizacion.ts).
"""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import Field
from fastapi import APIRouter, Depends, HTTPException, Request as HttpRequest, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auditoria.models import AuditLog
from app.auditoria.service import record_audit_log
from app.autenticacion.dependencies import get_client_ip, get_current_user, require_role
from app.avisos.service import avisar, avisar_a, ids_por_rol
from app.core.api import APROBADOR, COORDINADOR, ErrorValidacion, ModeloApi, conflicto, es_id_valido, normalizar
from app.core.database import get_db
from app.modulos.equipos import horarios as h
from app.modulos.equipos.contrato import choque_aprobado
from app.modulos.usuarios.models import (
    AccountingPeriod,
    Batch,
    Dispatch,
    DispatchCorrection,
    EquipmentReservation,
    Item,
    Project,
    Request,
    RequestItem,
    User,
)

router = APIRouter(tags=["Módulo 5: Solicitudes y Priorización"])

solo_coordinador = require_role([COORDINADOR])
solo_aprobador = require_role([APROBADOR])

PENDIENTE = "Pendiente de Aprobación"
ESTADOS = ("Borrador", PENDIENTE, "Aprobado", "Rechazado", "Ejecutado")
REPOSICION = "Reposición automática"
TIPO_API = {"Gasto": "gasto", "Retiro": "retiro", REPOSICION: "reposicion"}
TIPO_BD = {"gasto": "Gasto", "retiro": "Retiro"}
PRIORIDADES = ("Crítica", "Alta", "Media", "Baja")
ORDEN_GRUPO = {"Crítica": 0, "Alta": 1, "Media": 2, "Baja": 3, "auto": 4}
PROYECTO_NO_EXISTE = "Ese proyecto no existe."
NBSP = " "


# =============================================================================
# Esquemas
# =============================================================================

TipoSolicitud = Literal["gasto", "retiro"]
Prioridad = Literal["Crítica", "Alta", "Media", "Baja"]


class LineaRetiro(ModeloApi):
    insumo_id: str
    cantidad: float


class FilaSolicitud(ModeloApi):
    id: str
    numero: str
    tipo: TipoSolicitud
    proyecto: str
    proyecto_id: str
    detalle: str
    estado: Literal["Borrador", "Pendiente de Aprobación", "Aprobado", "Rechazado", "Ejecutado"]
    fecha: str
    motivo_rechazo: Optional[str]
    despacho: Optional[str]


class ProyectoPropio(ModeloApi):
    id: str
    codigo: str
    nombre: str
    ejecucion: int


class InsumoPedido(ModeloApi):
    id: str
    nombre: str
    unidad: str
    disponible: float
    reposicion_en_curso: bool


class ConteosSolicitudes(ModeloApi):
    pendiente: int = Field(alias="Pendiente de Aprobación")
    aprobado: int = Field(alias="Aprobado")
    borrador: int = Field(alias="Borrador")
    rechazado: int = Field(alias="Rechazado")
    ejecutado: int = Field(alias="Ejecutado")
    todas: int = Field(alias="Todas")


class ListaSolicitudes(ModeloApi):
    items: List[FilaSolicitud]
    conteos: ConteosSolicitudes
    mis_proyectos: List[ProyectoPropio]
    insumos: List[InsumoPedido]


class Solicitud(ModeloApi):
    id: str
    numero: str
    tipo: TipoSolicitud
    proyecto: str
    proyecto_id: str
    estado: Literal["Borrador", "Pendiente de Aprobación", "Aprobado", "Rechazado", "Ejecutado"]
    fecha: str
    resumen: str
    lineas: List[LineaRetiro]
    proposito: Optional[str]
    insumo_servicio: Optional[str]
    cantidad_gasto: Optional[str]
    monto: Optional[float]
    justificacion: Optional[str]
    cotizacion: Optional[str]
    motivo_rechazo: Optional[str]
    decidida_por: Optional[str]
    despacho: Optional[str]


class LineaEntrada(ModeloApi):
    insumo_id: Optional[str] = None
    cantidad: Optional[float] = None


class DatosBorrador(ModeloApi):
    """Lo que guarda el borrador: nada es obligatorio todavía (F5.1)."""
    tipo: Optional[str] = None
    proyecto_id: Optional[str] = None
    lineas: Optional[List[LineaEntrada]] = None
    proposito: Optional[str] = None
    insumo_servicio: Optional[str] = None
    cantidad_gasto: Optional[str] = None
    monto: Optional[float] = None
    justificacion: Optional[str] = None


class DatosAprobacion(ModeloApi):
    cantidad: Optional[float] = None


class DatosRechazo(ModeloApi):
    motivo: Optional[str] = None


class DatosEjecucion(ModeloApi):
    monto_real: Optional[float] = None


class DatosDenegacion(ModeloApi):
    nota: Optional[str] = None


class Decision(ModeloApi):
    id: str
    estado: str


class DecisionConCantidad(Decision):
    """La reposición devuelve además la cantidad aprobada (F3.5)."""
    cantidad: Optional[float] = None


class Ejecucion(ModeloApi):
    id: str
    estado: Literal["Ejecutado"]
    monto_real: float


class ProyectoPedido(ModeloApi):
    id: str
    codigo: str
    nombre: str


class PedidoBase(ModeloApi):
    id: str
    grupo: Literal["Crítica", "Alta", "Media", "Baja", "auto"]
    fecha: str
    pedida_por: Optional[str]
    proyecto: Optional[ProyectoPedido]


class PedidoGasto(PedidoBase):
    numero: str  # SOL-… / REP-…: lo que se muestra; id es el UUID
    clase: Literal["gasto"] = "gasto"
    estado: Literal["Pendiente de Aprobación", "Aprobado"]
    insumo_servicio: str
    cantidad: Optional[str]
    monto: float
    descripcion: Optional[str]
    cotizacion: Optional[str]
    presupuesto: float
    gasto_ejecutado: float
    decidida_por: Optional[str]


class LineaPedido(ModeloApi):
    insumo: str
    unidad: str
    cantidad: float
    disponible: float
    reposicion: Optional[str]


class PedidoRetiro(PedidoBase):
    numero: str  # SOL-… / REP-…: lo que se muestra; id es el UUID
    clase: Literal["retiro"] = "retiro"
    lineas: List[LineaPedido]
    proposito: Optional[str]
    valor: float


class EquipoPedido(ModeloApi):
    id: str
    nombre: str
    estado: Literal["Disponible", "En uso", "En mantenimiento"]


class ChoquePedido(ModeloApi):
    id: str
    proyecto: str
    proyecto_id: str
    inicio: str
    fin: str


class PedidoReserva(PedidoBase):
    clase: Literal["reserva"] = "reserva"
    equipo: EquipoPedido
    inicio: str
    fin: str
    choque: Optional[ChoquePedido]


class DespachoPedido(ModeloApi):
    codigo: str
    fecha: Optional[str]


class EfectoCorreccion(ModeloApi):
    tipo: Literal["devolucion", "descuento", "traslado"]
    cantidad: Optional[str]
    monto: float


class PedidoCorreccion(PedidoBase):
    clase: Literal["correccion"] = "correccion"
    despacho: DespachoPedido
    insumo: str
    lote: str
    campo: Literal["cantidad", "proyecto"]
    valor_original: str
    valor_nuevo: str
    motivo: str
    efecto: Optional[EfectoCorreccion]


class InsumoReposicion(ModeloApi):
    id: str
    nombre: str
    unidad: str
    stock: float
    minimo: float


class PedidoReposicion(PedidoBase):
    numero: str  # SOL-… / REP-…: lo que se muestra; id es el UUID
    clase: Literal["reposicion"] = "reposicion"
    insumo: InsumoReposicion
    sugerida: float
    consumo_previsto: Optional[float]


Pedido = Union[PedidoGasto, PedidoRetiro, PedidoReserva, PedidoCorreccion, PedidoReposicion]


class Bandeja(ModeloApi):
    pendientes: List[Pedido]
    por_ejecutar: List[PedidoGasto]


class UltimoCambioPrioridad(ModeloApi):
    fecha: str
    desde: Optional[Prioridad]


class ProyectoPriorizado(ModeloApi):
    id: str
    codigo: str
    nombre: str
    coordinador: Optional[str]
    estatus: Literal["Propuesta", "En ejecución", "Suspendido", "Finalizado"]
    prioridad: Prioridad
    ultimo_cambio: UltimoCambioPrioridad


class ListaPriorizacion(ModeloApi):
    proyectos: List[ProyectoPriorizado]


class DatosPrioridad(ModeloApi):
    prioridad: Optional[str] = None
    justificacion: Optional[str] = None


class PrioridadCambiada(ModeloApi):
    id: str
    codigo: str
    prioridad: Prioridad
    anterior: Prioridad


# =============================================================================
# Utilidades
# =============================================================================

def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _f(valor) -> float:
    return float(valor or 0)


def _num(valor) -> str:
    """6.2 → "6,2"; 12.0 → "12" (hasta 3 decimales)."""
    d = Decimal(str(valor or 0)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP).normalize()
    texto = format(d, "f")
    return texto.replace(".", ",")


def _moneda(valor) -> str:
    """1284.5 → "US$ 1.284,50"."""
    texto = f"{Decimal(str(valor or 0)).quantize(Decimal('0.01')):,.2f}"
    return "US$ " + texto.replace(",", "_").replace(".", ",").replace("_", ".")


def _legible(valor, unidad: str) -> str:
    """"450 g" en lugar de "0,45 kg": las fracciones de kilo y de litro se leen mejor en g y mL."""
    v = abs(Decimal(str(valor or 0)))
    if unidad == "kg" and v < 1:
        return f"{_num(v * 1000)}{NBSP}g"
    if unidad == "L" and v < 1:
        return f"{_num(v * 1000)}{NBSP}mL"
    return f"{_num(v)}{NBSP}{unidad}"


def _minuscula(t: str) -> str:
    return t[:1].lower() + t[1:]


def _texto(v: Optional[str], maximo: int) -> Optional[str]:
    return (v or "").strip()[:maximo] or None


def _nombre(db: Session, user_id) -> Optional[str]:
    u = db.get(User, user_id) if user_id else None
    return u.full_name if u else None


def _buscar(db: Session, ref: str) -> Optional[Request]:
    """Por UUID o por número (los enlaces del inicio y los avisos viejos usan el número)."""
    if not ref:
        return None
    if es_id_valido(ref, db):
        s = db.query(Request).filter(Request.id == ref).first()
        if s or db.get_bind().dialect.name == "postgresql":
            return s
    return db.query(Request).filter(Request.request_number == ref).first()


def _disponible(db: Session, item_id) -> float:
    """Stock que se puede despachar: sin los lotes vencidos (F3.6, F6.2)."""
    hoy = h.hoy()
    lotes = db.query(Batch).filter(Batch.item_id == item_id, Batch.available_quantity > 0).all()
    total = sum((Decimal(str(l.available_quantity)) for l in lotes if not l.expiration_date or l.expiration_date >= hoy), Decimal(0))
    return float(total.quantize(Decimal("0.001")))


def _costo_fefo(db: Session, item_id) -> Decimal:
    """Costo del lote que sale primero (FEFO, F6.2): con él se estima el valor de un retiro."""
    hoy = h.hoy()
    lotes = [l for l in db.query(Batch).filter(Batch.item_id == item_id, Batch.available_quantity > 0).all()
             if not l.expiration_date or l.expiration_date >= hoy]
    lotes.sort(key=lambda l: (l.expiration_date is None, l.expiration_date or hoy))
    lote = lotes[0] if lotes else db.query(Batch).filter(Batch.item_id == item_id).first()
    return Decimal(str(lote.unit_cost)) if lote else Decimal("0")


def _reposicion_abierta(db: Session, item_id, estados=("Borrador", PENDIENTE, "Aprobado")) -> Optional[Request]:
    return (
        db.query(Request).join(RequestItem, RequestItem.request_id == Request.id)
        .filter(Request.request_type == REPOSICION, RequestItem.item_id == item_id, Request.status.in_(estados))
        .first()
    )


def _despacho(db: Session, s: Request) -> Optional[str]:
    if s.request_type != "Retiro":
        return None
    d = (
        db.query(Dispatch)
        .filter(Dispatch.request_id == s.id, Dispatch.is_compensatory.is_(False))
        .order_by(Dispatch.dispatched_at)
        .first()
    )
    return d.dispatch_number if d else None


def _resumen(s: Request) -> str:
    """Texto corto para las listas (inicio, bandeja): los insumos pedidos o el insumo o servicio."""
    if s.request_type == "Gasto":
        return s.item_or_service or "Solicitud de gasto"
    nombres = [ri.item.name for ri in s.items if ri.item]
    if not nombres:
        return "Retiro de insumos"
    dos = ", ".join([nombres[0], *[_minuscula(n) for n in nombres[1:2]]])
    return f"{dos} y {len(nombres) - 2} más" if len(nombres) > 2 else dos


def _monto(s: Request) -> Optional[float]:
    return _f(s.estimated_amount) if s.estimated_amount and s.estimated_amount > 0 else None


def _motivo_rechazo(s: Request) -> Optional[str]:
    return s.decision_reason if s.status == "Rechazado" else None


def _fecha(s: Request) -> str:
    return h.iso(s.updated_at or s.created_at)


def _detalle(db: Session, s: Request) -> Solicitud:
    return Solicitud(
        id=str(s.id),
        numero=s.request_number,
        tipo=TIPO_API[s.request_type],
        proyecto=s.project.code if s.project else "",
        proyecto_id=str(s.project_id or ""),
        estado=s.status,
        fecha=_fecha(s),
        resumen=s.description or _resumen(s),
        lineas=[LineaRetiro(insumo_id=str(ri.item_id), cantidad=_f(ri.requested_quantity)) for ri in s.items]
        if s.request_type == "Retiro" else [],
        proposito=s.purpose,
        insumo_servicio=s.item_or_service,
        cantidad_gasto=s.expense_quantity,
        monto=_monto(s),
        justificacion=s.justification,
        cotizacion=s.quote_filename,
        motivo_rechazo=_motivo_rechazo(s),
        decidida_por=_nombre(db, s.decided_by_user_id),
        despacho=_despacho(db, s),
    )


def _suya(db: Session, quien: User, ref: str) -> Request:
    """RN-07: la solicitud tiene que ser de un proyecto del coordinador; si no, no existe para él."""
    s = _buscar(db, ref)
    if not s or s.request_type not in ("Gasto", "Retiro") or not s.project or s.project.coordinator_id != quien.id:
        raise HTTPException(status_code=404, detail=f"No encontramos la solicitud {ref}.")
    return s


def _ejecucion(p: Project) -> int:
    presupuesto = _f(p.assigned_budget)
    return round(_f(p.executed_budget) / presupuesto * 100) if presupuesto > 0 else 0


def _siguiente_numero(db: Session) -> str:
    prefijo = f"SOL-{h.hoy().year}-"
    numeros = [n for (n,) in db.query(Request.request_number).filter(Request.request_number.like(f"{prefijo}%")).all()]
    mayor = max((int(n[len(prefijo):]) for n in numeros if n[len(prefijo):].isdigit()), default=0)
    return f"{prefijo}{mayor + 1:04d}"


def _periodo_cerrado_hoy(db: Session) -> Optional[AccountingPeriod]:
    """Período cerrado (o ya repartido) que contiene la fecha: ahí no entran movimientos (F7.2)."""
    return _periodo_cerrado_en(db, h.hoy())


def _periodo_cerrado_en(db: Session, fecha) -> Optional[AccountingPeriod]:
    return (
        db.query(AccountingPeriod)
        .filter(AccountingPeriod.status.in_(["Cerrado", "Prorrateado"]),
                AccountingPeriod.start_date <= fecha, AccountingPeriod.end_date >= fecha)
        .first()
    )


# =============================================================================
# Mis solicitudes (F5.1 a F5.3)
# =============================================================================

@router.get("/solicitudes", response_model=ListaSolicitudes)
def mis_solicitudes(estado: str = "", db: Session = Depends(get_db), quien: User = Depends(solo_coordinador)):
    mios = db.query(Project).filter(Project.coordinator_id == quien.id).order_by(Project.code).all()
    ids = [p.id for p in mios] or [None]
    todas = sorted(
        db.query(Request).filter(Request.request_type.in_(["Gasto", "Retiro"]), Request.project_id.in_(ids)).all(),
        key=lambda s: h.a_utc(s.updated_at or s.created_at), reverse=True,
    )
    items = []
    for s in todas:
        if estado and s.status != estado:
            continue
        resumen = s.description or _resumen(s)
        monto = _monto(s)
        items.append(FilaSolicitud(
            id=str(s.id), numero=s.request_number, tipo=TIPO_API[s.request_type],
            proyecto=s.project.code if s.project else "", proyecto_id=str(s.project_id),
            detalle=f"{resumen}, {_moneda(monto)}" if s.request_type == "Gasto" and monto else resumen,
            estado=s.status, fecha=_fecha(s), motivo_rechazo=_motivo_rechazo(s), despacho=_despacho(db, s),
        ))
    insumos = sorted(db.query(Item).filter(Item.is_active.is_(True)).all(), key=lambda i: normalizar(i.name))
    en_curso = {
        str(i) for (i,) in db.query(RequestItem.item_id).join(Request, RequestItem.request_id == Request.id)
        .filter(Request.request_type == REPOSICION, Request.status.notin_(["Rechazado", "Ejecutado"])).all()
    }
    return ListaSolicitudes(
        items=items,
        conteos={"Todas": len(todas), **{e: sum(1 for s in todas if s.status == e) for e in ESTADOS}},
        # Un proyecto finalizado ya no pide recursos (HU-04)
        mis_proyectos=[ProyectoPropio(id=str(p.id), codigo=p.code, nombre=p.title, ejecucion=_ejecucion(p))
                       for p in mios if p.operational_status != "Finalizado"],
        insumos=[InsumoPedido(id=str(i.id), nombre=i.name, unidad=i.unit_of_measure, disponible=_disponible(db, i.id),
                              reposicion_en_curso=str(i.id) in en_curso) for i in insumos],
    )


@router.get("/solicitudes/{ref}", response_model=Solicitud)
def ver_solicitud(ref: str, db: Session = Depends(get_db), quien: User = Depends(solo_coordinador)):
    return _detalle(db, _suya(db, quien, ref))


def _aplicar(db: Session, quien: User, s: Request, datos: DatosBorrador) -> None:
    """Copia al borrador lo que trae el cuerpo: textos recortados y líneas limpias. No exige nada (F5.1)."""
    puestos = datos.model_fields_set
    if "proyecto_id" in puestos:
        pid = datos.proyecto_id or ""
        p = db.get(Project, pid) if pid and es_id_valido(pid, db) else None
        if pid and not p:
            raise HTTPException(status_code=404, detail=PROYECTO_NO_EXISTE)
        if not p or p.coordinator_id != quien.id:
            raise ErrorValidacion({"proyectoId": "Elige uno de tus proyectos."})
        if p.operational_status == "Finalizado":
            raise ErrorValidacion({"proyectoId": f"{p.code} está finalizado: ya no pide recursos."})
        s.project_id = p.id
    if s.request_type == "Retiro" and datos.lineas is not None:
        for viejo in list(s.items):
            s.items.remove(viejo)
        if s in db:
            db.flush()
        for l in datos.lineas:
            item = db.get(Item, l.insumo_id) if l.insumo_id and es_id_valido(l.insumo_id, db) else None
            if not item:
                continue
            cantidad = Decimal(str(l.cantidad)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP) \
                if l.cantidad is not None and l.cantidad > 0 else Decimal("0")
            s.items.append(RequestItem(item_id=item.id, item=item, requested_quantity=cantidad,
                                       unit_cost_estimate=_costo_fefo(db, item.id)))
        total = sum((Decimal(str(ri.requested_quantity)) * Decimal(str(ri.unit_cost_estimate)) for ri in s.items), Decimal(0))
        s.estimated_amount = total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if "proposito" in puestos:
        s.purpose = _texto(datos.proposito, 200)
    if s.request_type == "Gasto":
        if "insumo_servicio" in puestos:
            s.item_or_service = _texto(datos.insumo_servicio, 160)
        if "cantidad_gasto" in puestos:
            s.expense_quantity = _texto(datos.cantidad_gasto, 60)
        if "monto" in puestos:
            monto = datos.monto
            s.estimated_amount = Decimal(str(monto)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) \
                if monto is not None and monto > 0 else Decimal("0")
        if "justificacion" in puestos:
            s.justification = _texto(datos.justificacion, 600)
    # "cotizacion" no se acepta aquí: la pone el servidor al subir el archivo
    s.description = _resumen(s)
    s.updated_at = _ahora()


@router.post("/solicitudes", response_model=Solicitud, status_code=201)
def crear_borrador(datos: DatosBorrador, db: Session = Depends(get_db), quien: User = Depends(solo_coordinador)):
    """F5.1, F5.2: nace en Borrador, solo para un proyecto propio y vigente (RN-07, HU-04)."""
    tipo = TIPO_BD.get(datos.tipo or "")
    if not tipo:
        raise ErrorValidacion({"tipo": "Elige si es un gasto o un retiro."})
    if "proyecto_id" not in datos.model_fields_set:
        raise ErrorValidacion({"proyectoId": "Elige uno de tus proyectos."})
    s = Request(request_number=_siguiente_numero(db), request_type=tipo, cost_center="proyecto",
                requester_user_id=quien.id, status="Borrador", estimated_amount=Decimal("0"),
                actual_amount=Decimal("0"), created_at=_ahora())
    _aplicar(db, quien, s, datos)
    db.add(s)
    db.commit()
    db.refresh(s)
    return _detalle(db, s)


@router.patch("/solicitudes/{ref}", response_model=Solicitud)
def guardar_borrador(ref: str, datos: DatosBorrador, db: Session = Depends(get_db), quien: User = Depends(solo_coordinador)):
    """El borrador se guarda mientras se escribe (F5.1). Enviada, ya no se edita (F5.3, HU-15)."""
    s = _suya(db, quien, ref)
    if s.status != "Borrador":
        raise conflicto(f"{s.request_number} ya se envió a aprobación: no se puede editar.")
    _aplicar(db, quien, s, datos)
    db.commit()
    db.refresh(s)
    return _detalle(db, s)


def _faltantes(s: Request) -> Dict[str, str]:
    """F5.3: los datos obligatorios para enviar, junto a su campo."""
    e: Dict[str, str] = {}
    if s.request_type == "Gasto":
        if not s.item_or_service:
            e["insumoServicio"] = "Escribe qué insumo o servicio necesitas."
        if not s.expense_quantity:
            e["cantidadGasto"] = "Escribe la cantidad, por ejemplo 1 frasco."
        if not _monto(s):
            e["monto"] = "Escribe el monto estimado. Si tienes cotización, usa ese valor."
        if not s.justification:
            e["justificacion"] = "Escribe para qué se necesita: el aprobador decide con esto."
    else:
        if not s.items:
            e["lineas"] = "Agrega al menos un insumo."
        for i, ri in enumerate(s.items):
            if not ri.requested_quantity or ri.requested_quantity <= 0:
                e[f"lineas.{i}.cantidad"] = "Escribe una cantidad mayor que cero."
    return e


@router.post("/solicitudes/{ref}/enviar", response_model=Solicitud)
def enviar_solicitud(ref: str, request: HttpRequest, db: Session = Depends(get_db), quien: User = Depends(solo_coordinador)):
    """F5.3: pasa a Pendiente de Aprobación si tiene los datos obligatorios, y llega a la bandeja."""
    s = _suya(db, quien, ref)
    if s.status != "Borrador":
        raise conflicto(f"{s.request_number} ya se envió a aprobación.")
    if s.project.operational_status == "Finalizado":
        raise conflicto(f"{s.project.code} está finalizado: ya no pide recursos.")
    errores = _faltantes(s)
    if errores:
        raise ErrorValidacion(errores)
    s.status = PENDIENTE
    s.updated_at = _ahora()
    clase = "Gasto" if s.request_type == "Gasto" else "Retiro de insumos"
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"REQUEST:{s.request_number}",
        target_table="requests", target_id=str(s.id), action_type="REQUEST_SUBMIT",
        old_value={"status": "Borrador"},
        new_value={"status": PENDIENTE, "descripcion": f"{quien.full_name} envió la solicitud {s.request_number} a aprobación",
                   "detalle": f"{clase} de {s.project.code}: {s.description}"},
    )
    avisar_a(db, ids_por_rol(db, APROBADOR), "info", f"Solicitud por aprobar: {s.request_number}", f"/bandeja?pedido={s.id}",
             detalle=f"{clase} de {s.project.code}: {s.description}.")
    db.commit()
    db.refresh(s)
    return _detalle(db, s)


@router.delete("/solicitudes/{ref}", status_code=204, response_class=Response)
def descartar_borrador(ref: str, db: Session = Depends(get_db), quien: User = Depends(solo_coordinador)):
    s = _suya(db, quien, ref)
    if s.status != "Borrador":
        raise conflicto(f"{s.request_number} ya se envió: no se puede descartar.")
    db.delete(s)
    db.commit()
    return Response(status_code=204)


# =============================================================================
# Decisiones del aprobador (F5.4, F5.5, F3.5)
# =============================================================================

def _por_decidir(db: Session, ref: str) -> Request:
    s = _buscar(db, ref)
    if not s:
        raise HTTPException(status_code=404, detail=f"No encontramos la solicitud {ref}.")
    abierta = s.status in ("Borrador", PENDIENTE) if s.request_type == REPOSICION else s.status == PENDIENTE
    if not abierta:
        raise conflicto(f"{s.request_number} ya está en estado {s.status}: no se puede decidir de nuevo.")
    return s


def _clase(s: Request) -> str:
    return "de gasto" if s.request_type == "Gasto" else "de retiro"


@router.post("/solicitudes/{ref}/aprobar", response_model=DecisionConCantidad, response_model_exclude_none=True)
def aprobar_solicitud(
    ref: str,
    request: HttpRequest,
    datos: Optional[DatosAprobacion] = None,
    db: Session = Depends(get_db),
    quien: User = Depends(solo_aprobador),
):
    s = _por_decidir(db, ref)
    ip = get_client_ip(request)
    ahora = _ahora()
    if s.request_type != REPOSICION:
        for ri in s.items:
            if ri.approved_quantity is None:
                ri.approved_quantity = ri.requested_quantity
        s.status = "Aprobado"
        s.decided_by_user_id = quien.id
        s.decided_at = ahora
        s.updated_at = ahora
        record_audit_log(
            db=db, user_id=quien.id, ip_address=ip, target_object=f"REQUEST:{s.request_number}",
            target_table="requests", target_id=str(s.id), action_type="REQUEST_APPROVE",
            old_value={"status": PENDIENTE},
            new_value={"status": "Aprobado", "descripcion": f"{quien.full_name} aprobó la solicitud {_clase(s)} {s.request_number}"},
        )
        avisar(db, s.requester_user_id, "ok", f"Solicitud aprobada: {s.request_number}", f"/solicitudes?id={s.id}",
               detalle="Queda por ejecutar: se carga al proyecto cuando se registre el pago." if s.request_type == "Gasto"
               else "Almacén prepara el despacho.")
        db.commit()
        return DecisionConCantidad(id=str(s.id), estado="Aprobado")

    # F3.5: la reposición se aprueba en un paso. La creó el sistema, no el aprobador, así que no es una
    # autoaprobación; el audit log guarda las dos transiciones de RN-03 (HU-09).
    cantidad = datos.cantidad if datos else None
    if cantidad is None or not cantidad > 0:
        raise ErrorValidacion({"cantidad": "Escribe una cantidad mayor que cero."})
    valor = Decimal(str(cantidad)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    if s.status == "Borrador":
        # M3 hace el paso Borrador → Pendiente con la cantidad ajustada (y su registro de auditoría)
        from app.modulos.inventario.service import decide_replenishment_request
        decide_replenishment_request(db, str(s.id), "submit", valor, quien, ip)
        db.refresh(s)
    ri = s.items[0] if s.items else None
    if ri:
        ri.requested_quantity = valor
        ri.approved_quantity = valor
        s.estimated_amount = (valor * Decimal(str(ri.unit_cost_estimate or 0))).quantize(Decimal("0.01"))
    nombre = ri.item.name if ri and ri.item else "insumo"
    unidad = ri.item.unit_of_measure if ri and ri.item else ""
    s.status = "Aprobado"
    s.decided_by_user_id = quien.id
    s.decided_at = _ahora()
    s.updated_at = s.decided_at
    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=f"REQUEST:{s.request_number}",
        target_table="requests", target_id=str(s.id), action_type="REPLENISHMENT_APPROVE",
        old_value={"status": PENDIENTE},
        new_value={"status": "Aprobado", "approved_quantity": str(valor),
                   "descripcion": f"{quien.full_name} aprobó la reposición {s.request_number} de {_minuscula(nombre)} "
                                  f"por {_num(valor)} {unidad}".strip()},
    )
    db.commit()
    return DecisionConCantidad(id=str(s.id), estado="Aprobado", cantidad=float(valor))


@router.post("/solicitudes/{ref}/rechazar", response_model=Decision)
def rechazar_solicitud(
    ref: str,
    request: HttpRequest,
    datos: Optional[DatosRechazo] = None,
    db: Session = Depends(get_db),
    quien: User = Depends(solo_aprobador),
):
    """RN-03: Rechazado es final. HU-09: descartar una reposición no compra nada; la alerta sigue visible."""
    s = _por_decidir(db, ref)
    motivo = _texto(datos.motivo if datos else None, 300)
    reposicion = s.request_type == REPOSICION
    if not reposicion and not motivo:
        raise ErrorValidacion({"motivo": "Escribe el motivo. Sin motivo no se puede rechazar."})
    ip = get_client_ip(request)
    antes = s.status
    if reposicion and antes == "Borrador":
        # M3 descarta el borrador (y deja su registro de auditoría)
        from app.modulos.inventario.service import decide_replenishment_request
        decide_replenishment_request(db, str(s.id), "discard", None, quien, ip)
        db.refresh(s)
    s.status = "Rechazado"
    s.decided_by_user_id = quien.id
    s.decided_at = _ahora()
    s.updated_at = s.decided_at
    s.decision_reason = motivo or "Descartada por el aprobador"
    if not (reposicion and antes == "Borrador"):
        record_audit_log(
            db=db, user_id=quien.id, ip_address=ip, target_object=f"REQUEST:{s.request_number}",
            target_table="requests", target_id=str(s.id), action_type="REQUEST_REJECT",
            old_value={"status": antes},
            new_value={"status": "Rechazado", "descripcion":
                       f"{quien.full_name} descartó la reposición {s.request_number}" if reposicion
                       else f"{quien.full_name} rechazó la solicitud {_clase(s)} {s.request_number}"},
            justification=motivo,
        )
    if not reposicion:
        avisar(db, s.requester_user_id, "err", f"Solicitud rechazada: {s.request_number}", f"/solicitudes?id={s.id}",
               detalle=f"«{motivo}» Puedes crear una nueva con sus datos.")
    db.commit()
    return Decision(id=str(s.id), estado="Rechazado")


@router.post("/solicitudes/{ref}/ejecutar", response_model=Ejecucion)
def ejecutar_gasto(
    ref: str,
    request: HttpRequest,
    datos: Optional[DatosEjecucion] = None,
    db: Session = Depends(get_db),
    quien: User = Depends(solo_aprobador),
):
    """F5.5: el gasto aprobado ya se pagó. Ejecutado es final (RN-03) y el monto real se carga al proyecto."""
    s = _buscar(db, ref)
    if not s:
        raise HTTPException(status_code=404, detail=f"No encontramos la solicitud {ref}.")
    if s.request_type == "Retiro":
        raise conflicto(f"{s.request_number} es un retiro: se ejecuta con su despacho en Almacén.")
    if s.request_type != "Gasto":
        raise conflicto(f"{s.request_number} es una reposición: se completa con su recepción en Almacén.")
    if s.status != "Aprobado":
        raise conflicto(f"{s.request_number} está {s.status}: solo un gasto aprobado se marca como ejecutado.")
    if _periodo_cerrado_hoy(db):
        raise conflicto("El período de hoy está cerrado: no admite gastos nuevos.")
    monto = datos.monto_real if datos else None
    if monto is None or not monto > 0:
        raise ErrorValidacion({"montoReal": "Escribe el monto real pagado, mayor que cero."})
    real = Decimal(str(monto)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    s.status = "Ejecutado"
    s.actual_amount = real
    s.updated_at = _ahora()
    texto = _moneda(real)
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"REQUEST:{s.request_number}",
        target_table="requests", target_id=str(s.id), action_type="REQUEST_EXECUTE",
        old_value={"status": "Aprobado"},
        new_value={"status": "Ejecutado", "actual_amount": str(real),
                   "descripcion": f"{quien.full_name} marcó la solicitud {s.request_number} como ejecutada",
                   "detalle": f"Monto real {texto}; estimado {_moneda(s.estimated_amount)}"},
    )
    # El gasto ejecutado del proyecto sale solo de los movimientos (decisión 5): no se escribe nada más
    avisar(db, s.requester_user_id, "ok", f"Gasto ejecutado: {s.request_number}", f"/solicitudes?id={s.id}",
           detalle=f"Se cargaron {texto} a {s.project.code if s.project else 'el proyecto'}.")
    db.commit()
    return Ejecucion(id=str(s.id), estado="Ejecutado", monto_real=float(real))


# =============================================================================
# Bandeja del aprobador (vista 15)
# =============================================================================

class _Contexto:
    """Cachés de la bandeja para no repetir consultas por cada pedido."""

    def __init__(self, db: Session):
        self.db = db
        self.proyectos = {str(p.id): p for p in db.query(Project).all()}
        self.usuarios: Dict[str, Optional[str]] = {}

    def nombre(self, uid) -> Optional[str]:
        if not uid:
            return None
        clave = str(uid)
        if clave not in self.usuarios:
            self.usuarios[clave] = _nombre(self.db, uid)
        return self.usuarios[clave]

    def base(self, id_, grupo, fecha, pedida_por, proyecto_id, numero=None) -> Dict[str, Any]:
        p = self.proyectos.get(str(proyecto_id)) if proyecto_id else None
        return {
            "id": str(id_),
            "numero": numero,
            "grupo": grupo if grupo else (p.priority_level if p else "Baja"),
            "fecha": h.iso(fecha),
            "pedida_por": self.nombre(pedida_por),
            "proyecto": ProyectoPedido(id=str(p.id), codigo=p.code, nombre=p.title) if p else None,
        }

    def prioridad(self, proyecto_id) -> str:
        p = self.proyectos.get(str(proyecto_id))
        return p.priority_level if p else "Baja"


def _pedido_gasto(c: _Contexto, s: Request) -> PedidoGasto:
    p = c.proyectos.get(str(s.project_id))
    return PedidoGasto(
        **c.base(s.id, c.prioridad(s.project_id), s.updated_at or s.created_at, s.requester_user_id, s.project_id, s.request_number),
        estado=s.status,
        insumo_servicio=s.item_or_service or s.description or "Solicitud de gasto",
        cantidad=s.expense_quantity,
        monto=_f(s.estimated_amount),
        descripcion=s.justification,
        cotizacion=s.quote_filename,
        presupuesto=_f(p.assigned_budget) if p else 0.0,
        gasto_ejecutado=_f(p.executed_budget) if p else 0.0,
        decidida_por=c.nombre(s.decided_by_user_id),
    )


def _pedido_retiro(c: _Contexto, s: Request) -> PedidoRetiro:
    lineas = []
    valor = Decimal(0)
    for ri in s.items:
        item = ri.item
        repo = _reposicion_abierta(c.db, ri.item_id)
        lineas.append(LineaPedido(
            insumo=item.name if item else "Insumo", unidad=item.unit_of_measure if item else "",
            cantidad=_f(ri.requested_quantity), disponible=_disponible(c.db, ri.item_id),
            reposicion=repo.request_number if repo else None,
        ))
        valor += Decimal(str(ri.requested_quantity)) * _costo_fefo(c.db, ri.item_id)
    return PedidoRetiro(
        **c.base(s.id, c.prioridad(s.project_id), s.updated_at or s.created_at, s.requester_user_id, s.project_id, s.request_number),
        lineas=lineas,
        proposito=s.purpose,
        valor=float(valor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
    )


def _pedido_reposicion(c: _Contexto, s: Request) -> Optional[PedidoReposicion]:
    ri = s.items[0] if s.items else None
    item = ri.item if ri else None
    if not item:
        return None
    previsto = None
    if item.forecasted_consumption is not None:
        # Consumo de las próximas 8 semanas: el pronóstico mensual (F3.7) por 56 días
        previsto = float((Decimal(str(item.forecasted_consumption)) * 56 / 30).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
    return PedidoReposicion(
        **c.base(s.id, "auto", s.created_at, None, None, s.request_number),
        insumo=InsumoReposicion(id=str(item.id), nombre=item.name, unidad=item.unit_of_measure,
                                stock=_f(item.current_stock), minimo=_f(item.min_stock)),
        sugerida=_f(ri.requested_quantity),
        consumo_previsto=previsto,
    )


def _pedido_reserva(c: _Contexto, r: EquipmentReservation) -> PedidoReserva:
    choque = choque_aprobado(c.db, r)
    e = r.equipment
    return PedidoReserva(
        **c.base(r.id, c.prioridad(r.project_id), r.created_at, r.reserved_by_user_id, r.project_id),
        equipo=EquipoPedido(id=str(e.id), nombre=e.name, estado=e.operational_status),
        inicio=h.iso(r.start_time),
        fin=h.iso(r.end_time),
        choque=ChoquePedido(
            id=str(choque.id), proyecto=choque.project.code if choque.project else "", proyecto_id=str(choque.project_id),
            inicio=h.iso(choque.start_time), fin=h.iso(choque.end_time),
        ) if choque else None,
    )


def _pedido_correccion(c: _Contexto, x: DispatchCorrection) -> Optional[PedidoCorreccion]:
    """Los datos los arma M6 (almacen/reglas.py): código COR-, código visible del despacho y campo corregido."""
    from app.modulos.almacen.reglas import resumen_correccion
    try:
        r = resumen_correccion(c.db, x)
    except Exception:  # despacho original inexistente: no se muestra en la bandeja
        return None
    return PedidoCorreccion(
        **c.base(r["id"], c.prioridad(r["proyectoId"]), x.created_at, x.requested_by_user_id, r["proyectoId"]),
        despacho=DespachoPedido(codigo=r["despacho"]["codigo"], fecha=r["despacho"]["fecha"]),
        insumo=r["insumo"],
        lote=r["lote"],
        campo=r["campo"],
        valor_original=r["valorOriginal"],
        valor_nuevo=r["valorNuevo"],
        motivo=r["motivo"],
        efecto=EfectoCorreccion(**r["efecto"]),
    )


def _orden(p: PedidoBase):
    return (ORDEN_GRUPO.get(p.grupo, 9), p.fecha or "")


@router.get("/bandeja", response_model=Bandeja)
def bandeja(db: Session = Depends(get_db), _: User = Depends(solo_aprobador)):
    """Por prioridad del proyecto y, dentro de cada una, el más antiguo primero; las reposiciones al final."""
    c = _Contexto(db)
    solicitudes = db.query(Request).filter(Request.status == PENDIENTE, Request.request_type.in_(["Gasto", "Retiro"])).all()
    # outer: las reposiciones son de centro de costo general y no tienen proyecto (decisión 4)
    reposiciones = db.query(Request).filter(Request.request_type == REPOSICION, Request.status.in_(["Borrador", PENDIENTE])).all()
    reservas = db.query(EquipmentReservation).filter(EquipmentReservation.status == PENDIENTE).all()
    correcciones = db.query(DispatchCorrection).filter(DispatchCorrection.status == "Pendiente").all()
    pendientes: List[PedidoBase] = [
        *(_pedido_gasto(c, s) if s.request_type == "Gasto" else _pedido_retiro(c, s) for s in solicitudes),
        *(_pedido_reserva(c, r) for r in reservas),
        *filter(None, (_pedido_correccion(c, x) for x in correcciones)),
        *filter(None, (_pedido_reposicion(c, s) for s in reposiciones)),
    ]
    por_ejecutar = [_pedido_gasto(c, s) for s in
                    db.query(Request).filter(Request.request_type == "Gasto", Request.status == "Aprobado").all()]
    return Bandeja(pendientes=sorted(pendientes, key=_orden), por_ejecutar=sorted(por_ejecutar, key=_orden))


# Las decisiones sobre correcciones (POST /api/correcciones/{id}/aprobar|denegar) viven en
# app/modulos/almacen/contrato.py (M6), que es dueño de esa lógica.


# =============================================================================
# Priorización (F5.6, F5.7; RN-04)
# =============================================================================

@router.get("/priorizacion", response_model=ListaPriorizacion)
def priorizacion(estatus: str = "", db: Session = Depends(get_db), quien: User = Depends(get_current_user)):
    consulta = db.query(Project)
    if quien.role == COORDINADOR:
        consulta = consulta.filter(Project.coordinator_id == quien.id)
    if estatus != "todos":
        consulta = consulta.filter(Project.operational_status == "En ejecución")
    proyectos = consulta.order_by(Project.code).all()
    # El cambio de prioridad más reciente en la auditoría; si no hay, la fecha del registro del proyecto
    ultimos: Dict[str, AuditLog] = {}
    if proyectos:
        for log in (db.query(AuditLog)
                    .filter(AuditLog.action_type == "PROJECT_PRIORITY_CHANGE",
                            AuditLog.target_id.in_([str(p.id) for p in proyectos]))
                    .order_by(AuditLog.timestamp.desc()).all()):
            ultimos.setdefault(str(log.target_id), log)
    salida = []
    for p in proyectos:
        log = ultimos.get(str(p.id))
        desde = (log.old_value or {}).get("priority") if log else None
        salida.append(ProyectoPriorizado(
            id=str(p.id), codigo=p.code, nombre=p.title,
            coordinador=p.coordinator.full_name if p.coordinator else None,
            estatus=p.operational_status, prioridad=p.priority_level,
            ultimo_cambio=UltimoCambioPrioridad(fecha=h.iso(log.timestamp if log else p.created_at),
                                       desde=desde if desde in PRIORIDADES else None),
        ))
    return ListaPriorizacion(proyectos=salida)


@router.patch("/proyectos/{proyecto_id}/prioridad", response_model=PrioridadCambiada)
def cambiar_prioridad(
    proyecto_id: str,
    datos: DatosPrioridad,
    request: HttpRequest,
    db: Session = Depends(get_db),
    quien: User = Depends(solo_aprobador),
):
    """F5.7 y RN-04: sin justificación no se guarda; la auditoría guarda el nivel anterior y el nuevo."""
    p = db.get(Project, proyecto_id) if es_id_valido(proyecto_id, db) else None
    if not p:
        raise HTTPException(status_code=404, detail=PROYECTO_NO_EXISTE)
    if p.operational_status == "Finalizado":
        raise conflicto(f"{p.code} está finalizado: su prioridad ya no cambia nada.")
    justificacion = (datos.justificacion or "").strip()
    errores: Dict[str, str] = {}
    if datos.prioridad not in PRIORIDADES:
        errores["prioridad"] = "Elige la nueva prioridad."
    elif datos.prioridad == p.priority_level:
        errores["prioridad"] = f"{p.code} ya es {p.priority_level}: elige otra prioridad."
    if not justificacion:
        errores["justificacion"] = "Escribe por qué cambias la prioridad. Sin justificación el cambio no se guarda."
    if errores:
        raise ErrorValidacion(errores)

    anterior = p.priority_level
    nueva = datos.prioridad
    p.priority_level = nueva
    p.updated_at = _ahora()
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"PROJECT:{p.code}",
        target_table="projects", target_id=str(p.id), action_type="PROJECT_PRIORITY_CHANGE",
        old_value={"priority": anterior},
        new_value={"priority": nueva, "descripcion": f"{quien.full_name} cambió la prioridad de {p.code} de {anterior} a {nueva}"},
        justification=justificacion[:500],
    )
    avisar(db, p.coordinator_id, "info", f"{p.code} ahora es prioridad {nueva}", f"/proyectos/{p.id}",
           detalle=f"Antes era {anterior}. «{justificacion[:160]}»")
    db.commit()
    return PrioridadCambiada(id=str(p.id), codigo=p.code, prioridad=nueva, anterior=anterior)
