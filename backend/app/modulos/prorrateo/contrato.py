"""M7 Gastos compartidos con el contrato del frontend (vistas 21, 22 y 23; F7.1 a F7.4).

Especificación: frontend/src/testing/mocks/handlers/prorrateo.ts y frontend/src/modulos/prorrateo.

GET  /api/cierre/cargos?proyectoId          Coordinador: los cargos de sus proyectos en el período en revisión
POST /api/cierre/confirmaciones             Coordinador: { proyectoId } confirma la lista completa (F7.1)
GET  /api/cierre                            Aprobador: tablero de confirmaciones
POST /api/periodos                          Aprobador: { tipo, inicio, fin } abre la revisión (F7.1)
POST /api/periodos/{id}/recordatorios       Aprobador: aviso a los coordinadores que no confirmaron
POST /api/periodos/{id}/cerrar              Aprobador: cierra el período (F7.2; SP-08: sin todas las confirmaciones)
GET  /api/reparto                           Aprobador: el período cerrado por repartir, con los dos criterios
POST /api/periodos/{id}/reparto             Aprobador: { criterio } aplica el reparto (F7.3, F7.4)

GET /api/periodos/actual lo sirve app/navegacion/router.py.

En la API: estados abierto/en_revision/cerrado/prorrateado, tipo mensual/trimestral y criterio
consumo/iguales; en la BD: 'Abierto', 'En revisión'..., 'Mensual', 'Trimestral', 'Proporcional', 'Equitativo'.
Los gastos compartidos del período son los lotes de consumibles de uso general RECIBIDOS en su rango (SP-09).
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Dict, List, Literal, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.auditoria.service import record_audit_log
from app.autenticacion.dependencies import get_client_ip, require_role
from app.avisos.service import avisar
from app.core.api import APROBADOR, COORDINADOR, ErrorValidacion, ModeloApi, conflicto, es_id_valido
from app.core.database import get_db
from app.modulos.inventario.service import recalculate_consumption_forecasts
from app.modulos.reportes.formato import (
    centavos,
    centavos_abajo,
    dia_local,
    dia_y_fecha,
    fecha_corta,
    hoy,
    iso_momento,
    limites,
    moneda,
    monto as texto_monto,
    nombre_mes,
    numero,
    siguiente_mes,
)
from app.modulos.usuarios.models import (
    AccountingPeriod,
    Batch,
    Dispatch,
    DispatchCorrection,
    Item,
    OverheadAllocation,
    PeriodProjectConfirmation,
    Project,
    Request as Solicitud,
    User,
)

router = APIRouter(tags=["Módulo 7: Gastos compartidos"])

ESTADO_API = {"Abierto": "abierto", "En revisión": "en_revision", "Cerrado": "cerrado", "Prorrateado": "prorrateado"}
TIPO_API = {"Mensual": "mensual", "Trimestral": "trimestral"}
TIPO_BD = {v: k for k, v in TIPO_API.items()}
CRITERIO_API = {"Proporcional": "consumo", "Equitativo": "iguales"}
CRITERIO_BD = {v: k for k, v in CRITERIO_API.items()}
CRITERIO_TEXTO = {"consumo": "según el consumo", "iguales": "en partes iguales"}
EN_CURSO = ("En revisión", "Abierto")
CERRADOS = ("Cerrado", "Prorrateado")
PROYECTO_NO_EXISTE = "Ese proyecto no existe."
PERIODO_NO_EXISTE = "Ese período no existe."

solo_coordinador = require_role([COORDINADOR])
solo_aprobador = require_role([APROBADOR])


# =============================================================================
# Esquemas del contrato (camelCase)
# =============================================================================

TipoPeriodo = Literal["mensual", "trimestral"]
EstadoPeriodo = Literal["abierto", "en_revision", "cerrado", "prorrateado"]
EstadoConfirmacion = Literal["confirmado", "por-confirmar", "correccion", "sin-coordinador"]
CriterioReparto = Literal["consumo", "iguales"]


class PeriodoRevision(ModeloApi):
    id: str
    tipo: TipoPeriodo
    inicio: date
    fin: date
    estado: EstadoPeriodo
    abierto_el: Optional[str] = None
    abierto_por: Optional[str] = None


class PeriodoCerrado(PeriodoRevision):
    faltan: int


class ProyectoCierre(ModeloApi):
    id: str
    codigo: str
    estado: EstadoConfirmacion
    confirmado_el: Optional[str] = None
    correcciones: List[str]
    cargos: int
    monto: float


class Cargo(ModeloApi):
    id: str
    fecha: date
    concepto: str
    referencia: Optional[str] = None
    tipo: Literal["gasto", "despacho", "compartido"]
    monto: float


class CargosCierre(ModeloApi):
    periodo: Optional[PeriodoRevision] = None
    cierra: Optional[str] = None
    proyectos: List[ProyectoCierre]
    proyecto: Optional[str] = None
    proyecto_id: Optional[str] = None
    cargos: List[Cargo]


class DatosConfirmacion(ModeloApi):
    proyecto_id: Optional[str] = None


class Confirmacion(ModeloApi):
    proyecto: str
    proyecto_id: str
    confirmado_el: str
    cargos: int
    monto: float


class FilaTablero(ModeloApi):
    proyecto: str
    proyecto_id: str
    coordinador: Optional[str] = None
    estado: EstadoConfirmacion
    confirmado_el: Optional[str] = None
    cargos: int
    monto: float


class RangoPeriodo(ModeloApi):
    id: str
    tipo: TipoPeriodo
    inicio: date
    fin: date


class FechasSugeridas(ModeloApi):
    inicio: date
    fin: date


class TableroCierre(ModeloApi):
    periodo: Optional[PeriodoRevision] = None
    filas: List[FilaTablero]
    coordinadores_pendientes: int
    por_repartir: Optional[RangoPeriodo] = None
    sugerido: Optional[FechasSugeridas] = None


class DatosPeriodo(ModeloApi):
    tipo: Optional[str] = None
    inicio: Optional[str] = None
    fin: Optional[str] = None


class Recordatorio(ModeloApi):
    enviados: int
    sin_coordinador: int


class PeriodoPorRepartir(RangoPeriodo):
    cerrado_el: Optional[str] = None


class UltimoReparto(ModeloApi):
    periodo: RangoPeriodo
    criterio: CriterioReparto
    total: float
    aplicado_el: str
    aplicado_por: str


class GastosCompartidos(ModeloApi):
    total: float
    lotes: int
    insumos: List[str]


class FilaReparto(ModeloApi):
    proyecto: str
    proyecto_id: str
    nombre: str
    consumo: float
    porcentaje: float
    segun_consumo: Optional[float] = None
    en_partes_iguales: float


class Residuo(ModeloApi):
    consumo: float
    iguales: float


class Reparto(ModeloApi):
    periodo: Optional[PeriodoPorRepartir] = None
    ultimo: Optional[UltimoReparto] = None
    excluidos: List[str]
    gastos: Optional[GastosCompartidos] = None
    consumo_total: float
    filas: List[FilaReparto]
    residuo: Optional[Residuo] = None


class DatosReparto(ModeloApi):
    criterio: Optional[str] = None


class FilaRepartoAplicado(ModeloApi):
    proyecto: str
    proyecto_id: str
    consumo: float
    porcentaje: float
    monto: float


class RepartoAplicado(ModeloApi):
    periodo_id: str
    criterio: CriterioReparto
    total: float
    filas: List[FilaRepartoAplicado]


# =============================================================================
# Consultas de dominio (también sirven a otros módulos: inicio, contadores, reportes)
# =============================================================================

def nombre_periodo(p: AccountingPeriod) -> str:
    """'octubre de 2026' o 'el trimestre que empieza el 01/07/2026' (textos de M7)."""
    if p.period_type == "Mensual":
        return f"{nombre_mes(p.start_date)} de {p.start_date.year}"
    return f"el trimestre que empieza el {fecha_corta(p.start_date)}"


def periodo_en_curso(db: Session) -> Optional[AccountingPeriod]:
    """El período en revisión (o abierto): el de las confirmaciones."""
    for estado in EN_CURSO:
        p = (
            db.query(AccountingPeriod)
            .filter(AccountingPeriod.status == estado)
            .order_by(AccountingPeriod.start_date.desc())
            .first()
        )
        if p:
            return p
    return None


def periodo_cerrado_en(db: Session, fecha: date) -> Optional[AccountingPeriod]:
    """Período cerrado (o repartido) que contiene la fecha: ahí no entran movimientos (F7.2)."""
    return (
        db.query(AccountingPeriod)
        .filter(AccountingPeriod.status.in_(CERRADOS), AccountingPeriod.start_date <= fecha,
                AccountingPeriod.end_date >= fecha)
        .first()
    )


def _nombre(db: Session, usuario_id: Optional[str]) -> Optional[str]:
    if not usuario_id:
        return None
    u = db.get(User, usuario_id)
    return u.full_name if u else None


def _cantidad(valor, unidad: str) -> str:
    return f"{numero(valor, 3)} {unidad}".strip()


def cargos_del_periodo(db: Session, inicio: date, fin: date, proyecto_id: str) -> List[Dict]:
    """Cargos directos del proyecto entre dos fechas (F7.1): despachos valorizados y gastos ejecutados.

    Los gastos compartidos no entran: se reparten después del cierre. Las fechas son días en
    APP_TIMEZONE; un despacho cuenta por dispatched_at y un gasto por el momento en que se ejecutó.
    """
    desde, hasta = limites(inicio, fin)
    cargos: List[Dict] = []
    despachos = (
        db.query(Dispatch)
        .filter(Dispatch.project_id == proyecto_id, Dispatch.dispatched_at >= desde, Dispatch.dispatched_at < hasta)
        .all()
    )
    originales = {
        d.id: d.dispatch_number
        for d in db.query(Dispatch).filter(Dispatch.id.in_({x.original_dispatch_id for x in despachos if x.original_dispatch_id})).all()
    } if any(x.original_dispatch_id for x in despachos) else {}
    for d in despachos:
        item = d.batch.item if d.batch is not None else None
        nombre = item.name if item else "Insumo"
        unidad = item.unit_of_measure if item else ""
        if d.direction == "devolucion":
            origen = originales.get(d.original_dispatch_id)
            concepto = f"Corrección{f' de {origen}' if origen else ''}: devolución de {_cantidad(d.dispatched_quantity, unidad)} de {nombre}"
        else:
            concepto = f"{nombre} {_cantidad(d.dispatched_quantity, unidad)}"
        cargos.append({
            "id": str(d.id),
            "fecha": dia_local(d.dispatched_at),
            "concepto": concepto,
            "referencia": d.dispatch_number,
            "tipo": "despacho",
            "monto": float(centavos(Decimal(str(d.signed_quantity or 0)) * Decimal(str(d.unit_cost_snapshot or 0)))),
        })
    gastos = (
        db.query(Solicitud)
        .filter(Solicitud.project_id == proyecto_id, Solicitud.request_type == "Gasto",
                Solicitud.status == "Ejecutado", Solicitud.cost_center == "proyecto",
                Solicitud.updated_at >= desde, Solicitud.updated_at < hasta)
        .all()
    )
    for g in gastos:
        que = getattr(g, "item_or_service", None)
        cuanto = getattr(g, "expense_quantity", None)
        concepto = (f"{que}{f', {cuanto}' if cuanto else ''}" if que else None) or getattr(g, "description", None) \
            or f"Solicitud de gasto {g.request_number}"
        cargos.append({
            "id": str(g.id),
            "fecha": dia_local(g.updated_at),
            "concepto": concepto,
            "referencia": g.request_number,
            "tipo": "gasto",
            "monto": float(centavos(g.actual_amount)),
        })
    cargos.sort(key=lambda c: (c["fecha"], c["id"]))
    return cargos


def resumen_cargos(db: Session, periodo: AccountingPeriod, proyecto_id: str) -> Dict:
    """Número de cargos y monto de un proyecto en el período (lo que confirma su coordinador)."""
    cargos = cargos_del_periodo(db, periodo.start_date, periodo.end_date, proyecto_id)
    return {"cargos": len(cargos), "monto": round(sum(c["monto"] for c in cargos), 2)}


def correcciones_pendientes(db: Session, proyecto_id: str) -> List[str]:
    """Despachos del proyecto con una corrección que espera al aprobador (no se confirma mientras haya una)."""
    filas = (
        db.query(Dispatch.dispatch_number)
        .join(DispatchCorrection, DispatchCorrection.original_dispatch_id == Dispatch.id)
        .filter(Dispatch.project_id == proyecto_id, DispatchCorrection.status == "Pendiente")
        .order_by(DispatchCorrection.created_at)
        .all()
    )
    return [n for (n,) in filas]


def _estado_confirmacion(db: Session, c: PeriodProjectConfirmation, p: Optional[Project]) -> str:
    if c.confirmed:
        return "confirmado"
    if not p or not p.coordinator_id:
        return "sin-coordinador"
    if correcciones_pendientes(db, p.id):
        return "correccion"
    return "por-confirmar"


def _resumen_periodo(db: Session, p: AccountingPeriod) -> PeriodoRevision:
    return PeriodoRevision(
        id=str(p.id),
        tipo=TIPO_API.get(p.period_type, "mensual"),
        inicio=p.start_date,
        fin=p.end_date,
        estado=ESTADO_API.get(p.status, "abierto"),
        abierto_el=iso_momento(p.created_at),
        abierto_por=_nombre(db, getattr(p, "opened_by_user_id", None)),
    )


def _rango(p: AccountingPeriod) -> RangoPeriodo:
    return RangoPeriodo(id=str(p.id), tipo=TIPO_API.get(p.period_type, "mensual"), inicio=p.start_date, fin=p.end_date)


def proyectos_activos(db: Session) -> List[Project]:
    """RN-05: solo los proyectos En ejecución participan, por código."""
    return db.query(Project).filter(Project.operational_status == "En ejecución").order_by(Project.code).all()


def gastos_compartidos(db: Session, inicio: date, fin: date) -> Tuple[Decimal, int, List[str]]:
    """Costo de los lotes de consumibles de uso general recibidos en el rango (RN-02, SP-09)."""
    lotes = (
        db.query(Batch, Item.name)
        .join(Item, Batch.item_id == Item.id)
        .filter(Item.item_type == "Consumible de uso general", Batch.received_date >= inicio, Batch.received_date <= fin)
        .order_by(Batch.received_date, Batch.batch_number)
        .all()
    )
    total = centavos(sum((Decimal(str(b.initial_quantity)) * Decimal(str(b.unit_cost)) for b, _ in lotes), Decimal("0")))
    return total, len(lotes), list(dict.fromkeys(n for _, n in lotes))


def _consumo(db: Session, p: AccountingPeriod, proyecto_id: str) -> Decimal:
    """Materia prima e insumos despachados al proyecto en el período, valorizados (nunca negativo)."""
    total = sum(
        (Decimal(str(c["monto"])) for c in cargos_del_periodo(db, p.start_date, p.end_date, proyecto_id) if c["tipo"] == "despacho"),
        Decimal("0"),
    )
    return max(centavos(total), Decimal("0"))


def repartir(total: Decimal, pesos: List[Decimal]) -> Tuple[List[Decimal], Decimal]:
    """Reparte el total según los pesos, en centavos hacia abajo; el residuo va al primero (código menor, F7.4)."""
    suma = sum(pesos, Decimal("0"))
    if not pesos or suma <= 0:
        return [Decimal("0.00") for _ in pesos], Decimal("0.00")
    montos = [centavos_abajo(total * w / suma) for w in pesos]
    resto = centavos(total - sum(montos, Decimal("0")))
    montos[0] = centavos(montos[0] + resto)
    return montos, resto


def calcular_reparto(db: Session, p: AccountingPeriod) -> Dict:
    """Los dos repartos lado a lado (F7.3, F7.4). Solo participan los proyectos activos (RN-05)."""
    activos = proyectos_activos(db)
    consumos = [_consumo(db, p, pr.id) for pr in activos]
    consumo_total = sum(consumos, Decimal("0"))
    total, lotes, insumos = gastos_compartidos(db, p.start_date, p.end_date)
    segun, resto_consumo = repartir(total, consumos) if consumo_total > 0 else (None, Decimal("0"))
    iguales, resto_iguales = repartir(total, [Decimal("1")] * len(activos))
    filas = [
        {
            "proyecto": pr.code,
            "proyecto_id": str(pr.id),
            "nombre": pr.title,
            "consumo": consumos[i],
            "porcentaje": (consumos[i] / consumo_total * 100) if consumo_total > 0 else Decimal("0"),
            "segun_consumo": segun[i] if segun is not None else None,
            "en_partes_iguales": iguales[i],
        }
        for i, pr in enumerate(activos)
    ]
    return {
        "gastos": {"total": total, "lotes": lotes, "insumos": insumos},
        "consumo_total": consumo_total,
        "filas": filas,
        "residuo": {"consumo": resto_consumo, "iguales": resto_iguales},
    }


def _periodo_o_404(db: Session, periodo_id: str) -> AccountingPeriod:
    p = db.get(AccountingPeriod, periodo_id) if es_id_valido(periodo_id, db) else None
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=PERIODO_NO_EXISTE)
    return p


def _auditar(db: Session, quien: User, ip: str, accion: str, objetivo: str, tabla: str, objetivo_id: str,
             descripcion: str, detalle: Optional[str], anterior: Optional[Dict], nuevo: Dict) -> None:
    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=objetivo[:100], target_table=tabla,
        target_id=str(objetivo_id), action_type=accion, old_value=anterior,
        new_value={**nuevo, "descripcion": descripcion, "detalle": detalle},
    )


# =============================================================================
# F7.1 Coordinador: revisar y confirmar los cargos (vista 21)
# =============================================================================

@router.get("/cierre/cargos", response_model=CargosCierre)
def cargos_cierre(
    proyecto_id: Optional[str] = Query(None, alias="proyectoId"),
    db: Session = Depends(get_db),
    quien: User = Depends(solo_coordinador),
):
    p = periodo_en_curso(db)
    if not p:
        return CargosCierre(periodo=None, cierra=None, proyectos=[], proyecto=None, proyecto_id=None, cargos=[])
    filas = (
        db.query(PeriodProjectConfirmation, Project)
        .join(Project, Project.id == PeriodProjectConfirmation.project_id)
        .filter(PeriodProjectConfirmation.period_id == p.id, Project.coordinator_id == quien.id)
        .order_by(Project.code)
        .all()
    )
    proyectos = [
        ProyectoCierre(
            id=str(pr.id), codigo=pr.code, estado=_estado_confirmacion(db, c, pr),
            confirmado_el=iso_momento(c.confirmed_at), correcciones=correcciones_pendientes(db, pr.id),
            **resumen_cargos(db, p, pr.id),
        )
        for c, pr in filas
    ]
    elegido = (
        next((x for x in proyectos if x.id == proyecto_id), None)
        or next((x for x in proyectos if x.estado != "confirmado"), None)
        or (proyectos[0] if proyectos else None)
    )
    return CargosCierre(
        periodo=_resumen_periodo(db, p),
        # Quien cierra: el aprobador que abrió la revisión
        cierra=_nombre(db, getattr(p, "opened_by_user_id", None)),
        proyectos=proyectos,
        proyecto=elegido.codigo if elegido else None,
        proyecto_id=elegido.id if elegido else None,
        cargos=[Cargo(**c) for c in cargos_del_periodo(db, p.start_date, p.end_date, elegido.id)] if elegido else [],
    )


@router.post("/cierre/confirmaciones", response_model=Confirmacion)
def confirmar_cargos(
    datos: DatosConfirmacion, request: Request,
    db: Session = Depends(get_db), quien: User = Depends(solo_coordinador),
):
    pr = db.get(Project, datos.proyecto_id) if datos.proyecto_id and es_id_valido(datos.proyecto_id, db) else None
    if not pr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=PROYECTO_NO_EXISTE)
    p = periodo_en_curso(db)
    if not p:
        raise conflicto("No hay un período en revisión.")
    if pr.coordinator_id != quien.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ese proyecto no es tuyo.")
    c = (
        db.query(PeriodProjectConfirmation)
        .filter(PeriodProjectConfirmation.period_id == p.id, PeriodProjectConfirmation.project_id == pr.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{pr.code} no tiene cargos que revisar en este período.")
    if c.confirmed:
        raise conflicto(f"Ya confirmaste los cargos de {pr.code}.")
    pendientes = correcciones_pendientes(db, pr.id)
    if pendientes:
        raise conflicto(f"La corrección de {pendientes[0]} espera la decisión del aprobador: confirma cuando la decida.")

    r = resumen_cargos(db, p, pr.id)
    c.confirmed = True
    c.confirmed_at = datetime.now(timezone.utc)
    c.coordinator_user_id = quien.id
    _auditar(
        db, quien, get_client_ip(request), "PROJECT_CHARGES_CONFIRMED", f"PROJECT:{pr.id}", "projects", pr.id,
        f"{quien.full_name} confirmó los cargos de {pr.code} de {nombre_periodo(p)}",
        f"{r['cargos']} cargos · US$ {texto_monto(r['monto'])}",
        {"status": "Por confirmar"},
        {"status": "Confirmado", "period_id": str(p.id), "confirmation_id": str(c.id), **r},
    )
    db.commit()
    return Confirmacion(proyecto=pr.code, proyecto_id=str(pr.id), confirmado_el=iso_momento(c.confirmed_at), **r)


# =============================================================================
# F7.1, F7.2 Aprobador: tablero, apertura, recordatorios y cierre (vista 22)
# =============================================================================

def _coordinadores_pendientes(db: Session, periodo_id: str) -> Tuple[Dict[str, List[Project]], int]:
    """Coordinadores con proyectos sin confirmar (a quienes llega el recordatorio) y cuántos no tienen."""
    coordinadores: Dict[str, List[Project]] = {}
    sin = 0
    filas = (
        db.query(Project)
        .join(PeriodProjectConfirmation, PeriodProjectConfirmation.project_id == Project.id)
        .filter(PeriodProjectConfirmation.period_id == periodo_id, PeriodProjectConfirmation.confirmed.is_(False))
        .order_by(Project.code)
        .all()
    )
    for pr in filas:
        if pr.coordinator_id:
            coordinadores.setdefault(str(pr.coordinator_id), []).append(pr)
        else:
            sin += 1
    return coordinadores, sin


@router.get("/cierre", response_model=TableroCierre)
def tablero_cierre(db: Session = Depends(get_db), quien: User = Depends(solo_aprobador)):
    p = periodo_en_curso(db)
    cerrados = (
        db.query(AccountingPeriod)
        .filter(AccountingPeriod.status.in_(CERRADOS))
        .order_by(AccountingPeriod.end_date.desc())
        .all()
    )
    por_repartir = next((x for x in cerrados if x.status == "Cerrado"), None)
    ultimo = cerrados[0] if cerrados else None
    filas: List[FilaTablero] = []
    if p:
        for c, pr in (
            db.query(PeriodProjectConfirmation, Project)
            .join(Project, Project.id == PeriodProjectConfirmation.project_id)
            .filter(PeriodProjectConfirmation.period_id == p.id)
            .all()
        ):
            filas.append(FilaTablero(
                proyecto=pr.code, proyecto_id=str(pr.id), coordinador=_nombre(db, pr.coordinator_id),
                estado=_estado_confirmacion(db, c, pr), confirmado_el=iso_momento(c.confirmed_at),
                **resumen_cargos(db, p, pr.id),
            ))
        # Primero los confirmados (del más antiguo), después los que faltan
        filas.sort(key=lambda f: (f.estado != "confirmado", f.confirmado_el or "", f.proyecto))
    sugerido = siguiente_mes(ultimo.end_date) if ultimo else None
    return TableroCierre(
        periodo=_resumen_periodo(db, p) if p else None,
        filas=filas,
        coordinadores_pendientes=len(_coordinadores_pendientes(db, p.id)[0]) if p else 0,
        por_repartir=_rango(por_repartir) if por_repartir else None,
        sugerido=FechasSugeridas(inicio=sugerido[0], fin=sugerido[1]) if sugerido else None,
    )


def _fecha(valor: Optional[str]) -> Optional[date]:
    if not valor or len(valor) != 10:
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError:
        return None


@router.post("/periodos", response_model=PeriodoRevision, status_code=status.HTTP_201_CREATED)
def abrir_revision(
    datos: DatosPeriodo, request: Request, db: Session = Depends(get_db), quien: User = Depends(solo_aprobador)
):
    if periodo_en_curso(db):
        raise conflicto("Ya hay un período en revisión: ciérralo antes de abrir otro.")
    tipo = datos.tipo if datos.tipo in TIPO_BD else None
    inicio, fin = _fecha(datos.inicio), _fecha(datos.fin)
    errores: Dict[str, str] = {}
    if not tipo:
        errores["tipo"] = "Elige si el período es mensual o trimestral."
    if not inicio:
        errores["inicio"] = "Elige la fecha de inicio."
    if not fin:
        errores["fin"] = "Elige la fecha de fin."
    elif inicio and fin < inicio:
        errores["fin"] = "El fin tiene que ser después del inicio."
    if errores:
        raise ErrorValidacion(errores)

    cruce = (
        db.query(AccountingPeriod)
        .filter(AccountingPeriod.start_date <= fin, AccountingPeriod.end_date >= inicio)
        .order_by(AccountingPeriod.end_date.desc())
        .first()
    )
    if cruce:
        siguiente = siguiente_mes(cruce.end_date)[0]
        raise conflicto(
            f"Se cruza con el período cerrado de {nombre_periodo(cruce)} ({fecha_corta(cruce.start_date)} al "
            f"{fecha_corta(cruce.end_date)}). Empieza el período el {fecha_corta(siguiente)} o después.",
            periodo={"inicio": cruce.start_date.isoformat(), "fin": cruce.end_date.isoformat()},
        )

    ahora = datetime.now(timezone.utc)
    nuevo = AccountingPeriod(
        period_type=TIPO_BD[tipo], start_date=inicio, end_date=fin, status="En revisión",
        total_overhead_cost=Decimal("0.00"), opened_by_user_id=quien.id, created_at=ahora, updated_at=ahora,
    )
    nuevo.period_name = nombre_periodo(nuevo)[:100]
    db.add(nuevo)
    db.flush()
    for pr in proyectos_activos(db):
        db.add(PeriodProjectConfirmation(period_id=nuevo.id, project_id=pr.id, coordinator_user_id=pr.coordinator_id,
                                         confirmed=False))
        avisar(db, pr.coordinator_id, "warn", f"Revisa los cargos de {pr.code}", f"/cierre/cargos?proyecto={pr.id}",
               detalle=f"Se abrió la revisión de {nombre_periodo(nuevo)}. Confírmalos antes del cierre.")
    _auditar(
        db, quien, get_client_ip(request), "PERIOD_REVIEW_OPENED", f"PERIOD:{nuevo.id}", "accounting_periods", nuevo.id,
        f"{quien.full_name} abrió la revisión de {nombre_periodo(nuevo)}",
        f"{fecha_corta(inicio)} al {fecha_corta(fin)}",
        None,
        {"status": "En revisión", "period_type": nuevo.period_type, "start_date": inicio.isoformat(),
         "end_date": fin.isoformat()},
    )
    db.commit()
    return _resumen_periodo(db, nuevo)


@router.post("/periodos/{periodo_id}/recordatorios", response_model=Recordatorio)
def enviar_recordatorio(periodo_id: str, db: Session = Depends(get_db), quien: User = Depends(solo_aprobador)):
    """Recordatorio a los coordinadores que no confirmaron sus cargos (F7.1, L7): llega a su bandeja de avisos."""
    p = _periodo_o_404(db, periodo_id)
    if p.status not in EN_CURSO:
        raise conflicto("El período ya se cerró: no quedan cargos por confirmar.")
    coordinadores, sin = _coordinadores_pendientes(db, p.id)
    detalle = (
        f"El aprobador cierra {nombre_periodo(p)} en cuanto confirmen todos." if p.end_date < hoy()
        else f"El período cierra el {dia_y_fecha(p.end_date)}."
    )
    for coordinador_id, proyectos in coordinadores.items():
        avisar(db, coordinador_id, "warn",
               f"Recordatorio: confirma los cargos de {', '.join(x.code for x in proyectos)}",
               f"/cierre/cargos?proyecto={proyectos[0].id}", detalle=detalle)
    db.commit()
    return Recordatorio(enviados=len(coordinadores), sin_coordinador=sin)


@router.post("/periodos/{periodo_id}/cerrar", response_model=PeriodoCerrado)
def cerrar_periodo(
    periodo_id: str, request: Request, db: Session = Depends(get_db), quien: User = Depends(solo_aprobador)
):
    """F7.2: el período cerrado ya no admite despachos, gastos ni correcciones con fecha en su rango y
    queda listo para el reparto. Se puede cerrar sin todas las confirmaciones (SP-08); el registro guarda
    cuáles faltaban."""
    p = _periodo_o_404(db, periodo_id)
    if p.status not in EN_CURSO:
        raise conflicto("Ese período ya está cerrado.")
    faltan = (
        db.query(Project)
        .join(PeriodProjectConfirmation, PeriodProjectConfirmation.project_id == Project.id)
        .filter(PeriodProjectConfirmation.period_id == p.id, PeriodProjectConfirmation.confirmed.is_(False))
        .order_by(Project.code)
        .all()
    )
    anterior = p.status
    ahora = datetime.now(timezone.utc)
    p.status = "Cerrado"
    p.closed_by_user_id = quien.id
    p.closed_at = ahora
    p.updated_at = ahora
    # Lo que se repartirá: los lotes de uso general recibidos en el rango (ya no entran más)
    p.total_overhead_cost = gastos_compartidos(db, p.start_date, p.end_date)[0]
    # F3.7: el pronóstico de consumo se recalcula con el período cerrado, sin commit propio (atómico)
    recalculate_consumption_forecasts(db, commit=False)
    # Aviso a los coordinadores de los proyectos del período
    coordinadores = [
        cid for (cid,) in (
            db.query(Project.coordinator_id)
            .join(PeriodProjectConfirmation, PeriodProjectConfirmation.project_id == Project.id)
            .filter(PeriodProjectConfirmation.period_id == p.id, Project.coordinator_id.isnot(None))
            .distinct()
        )
    ]
    for coordinador_id in coordinadores:
        avisar(db, coordinador_id, "info", f"Se cerró el período de {nombre_periodo(p)}", "/cierre/cargos",
               detalle=f"Ya no se registran despachos, gastos ni correcciones del {fecha_corta(p.start_date)} "
                       f"al {fecha_corta(p.end_date)}.")
    _auditar(
        db, quien, get_client_ip(request), "ACCOUNTING_PERIOD_CLOSED", f"PERIOD:{p.id}", "accounting_periods", p.id,
        f"{quien.full_name} cerró el período de {nombre_periodo(p)}",
        f"Sin confirmar: {', '.join(x.code for x in faltan)}" if faltan else "Todos los proyectos confirmaron sus cargos",
        {"status": anterior},
        {"status": "Cerrado", "unconfirmed_projects": [x.code for x in faltan],
         "total_overhead_cost": str(p.total_overhead_cost)},
    )
    db.commit()
    resumen = _resumen_periodo(db, p)
    return PeriodoCerrado(**resumen.model_dump(), faltan=len(faltan))


# =============================================================================
# F7.3, F7.4 Reparto de los gastos compartidos (vista 23)
# =============================================================================

def _filas_reparto(calculo: Dict) -> List[FilaReparto]:
    return [
        FilaReparto(
            proyecto=f["proyecto"], proyecto_id=f["proyecto_id"], nombre=f["nombre"], consumo=float(f["consumo"]),
            porcentaje=round(float(f["porcentaje"]), 2),
            segun_consumo=float(f["segun_consumo"]) if f["segun_consumo"] is not None else None,
            en_partes_iguales=float(f["en_partes_iguales"]),
        )
        for f in calculo["filas"]
    ]


@router.get("/reparto", response_model=Reparto)
def ver_reparto(db: Session = Depends(get_db), quien: User = Depends(solo_aprobador)):
    """El período cerrado más antiguo sin repartir, con los dos criterios calculados."""
    p = (
        db.query(AccountingPeriod)
        .filter(AccountingPeriod.status == "Cerrado")
        .order_by(AccountingPeriod.end_date)
        .first()
    )
    hecho = (
        db.query(AccountingPeriod)
        .filter(AccountingPeriod.status == "Prorrateado")
        .order_by(AccountingPeriod.prorated_at.desc().nulls_last(), AccountingPeriod.end_date.desc())
        .first()
    )
    ultimo = None
    if hecho:
        aplicado = hecho.prorated_at or (
            db.query(OverheadAllocation.applied_at).filter(OverheadAllocation.period_id == hecho.id)
            .order_by(OverheadAllocation.applied_at.desc()).limit(1).scalar()
        ) or hecho.updated_at
        ultimo = UltimoReparto(
            periodo=_rango(hecho), criterio=CRITERIO_API.get(hecho.proration_criterion, "consumo"),
            total=float(hecho.total_overhead_cost or 0), aplicado_el=iso_momento(aplicado),
            aplicado_por=_nombre(db, hecho.prorated_by_user_id) or "El sistema",
        )
    # Los suspendidos no participan (RN-05)
    excluidos = [c for (c,) in db.query(Project.code).filter(Project.operational_status == "Suspendido").order_by(Project.code)]
    if not p:
        return Reparto(periodo=None, ultimo=ultimo, excluidos=excluidos, gastos=None, consumo_total=0, filas=[], residuo=None)
    calculo = calcular_reparto(db, p)
    return Reparto(
        periodo=PeriodoPorRepartir(**_rango(p).model_dump(), cerrado_el=iso_momento(p.closed_at)),
        ultimo=ultimo,
        excluidos=excluidos,
        gastos=GastosCompartidos(total=float(calculo["gastos"]["total"]), lotes=calculo["gastos"]["lotes"],
                                 insumos=calculo["gastos"]["insumos"]),
        consumo_total=float(calculo["consumo_total"]),
        filas=_filas_reparto(calculo),
        residuo=Residuo(consumo=float(calculo["residuo"]["consumo"]), iguales=float(calculo["residuo"]["iguales"])),
    )


@router.post("/periodos/{periodo_id}/reparto", response_model=RepartoAplicado)
def aplicar_reparto(
    periodo_id: str, datos: DatosReparto, request: Request,
    db: Session = Depends(get_db), quien: User = Depends(solo_aprobador),
):
    """Aplica el criterio elegido: cada monto entra al gasto ejecutado de su proyecto (F2.7, vista
    app.v_project_spend) y el período no se reparte dos veces."""
    p = _periodo_o_404(db, periodo_id)
    if p.status == "Prorrateado":
        raise conflicto(f"Los gastos compartidos de {nombre_periodo(p)} ya se repartieron.")
    if p.status != "Cerrado":
        raise conflicto(f"Cierra {nombre_periodo(p)} antes de repartir sus gastos.")
    criterio = datos.criterio
    if criterio not in CRITERIO_BD:
        raise ErrorValidacion({"criterio": "Elige cómo repartir los gastos compartidos."})
    calculo = calcular_reparto(db, p)
    if not calculo["filas"]:
        raise conflicto("No hay proyectos activos entre los que repartir los gastos compartidos.")
    if criterio == "consumo" and calculo["consumo_total"] <= 0:
        raise conflicto("Ningún proyecto activo consumió en el período: repártelo en partes iguales.")

    total = calculo["gastos"]["total"]
    ahora = datetime.now(timezone.utc)
    mes = nombre_mes(p.start_date) if p.period_type == "Mensual" else f"el trimestre que terminó el {fecha_corta(p.end_date)}"
    filas: List[FilaRepartoAplicado] = []
    for f in calculo["filas"]:
        monto = f["segun_consumo"] if criterio == "consumo" else f["en_partes_iguales"]
        porcentaje = round(float(f["porcentaje"]), 1)
        db.add(OverheadAllocation(
            period_id=p.id, project_id=f["proyecto_id"], registered_consumption=f["consumo"],
            consumption_pct=(f["porcentaje"] / 100).quantize(Decimal("0.0001")), allocated_amount=monto, applied_at=ahora,
        ))
        filas.append(FilaRepartoAplicado(proyecto=f["proyecto"], proyecto_id=f["proyecto_id"], consumo=float(f["consumo"]),
                                         porcentaje=porcentaje, monto=float(monto)))
        if monto > 0:
            pr = db.get(Project, f["proyecto_id"])
            avisar(db, pr.coordinator_id if pr else None, "info",
                   f"Se cargaron {moneda(monto)} de gastos compartidos a {f['proyecto']}", f"/proyectos/{f['proyecto_id']}",
                   detalle=f"Reparto de {nombre_periodo(p)}, {CRITERIO_TEXTO[criterio]}. Concepto: gastos compartidos de {mes}.")
    p.status = "Prorrateado"
    p.proration_criterion = CRITERIO_BD[criterio]
    p.total_overhead_cost = total
    p.prorated_by_user_id = quien.id
    p.prorated_at = ahora
    p.updated_at = ahora
    _auditar(
        db, quien, get_client_ip(request), "OVERHEAD_PRORATION_APPLIED", f"PERIOD:{p.id}", "accounting_periods", p.id,
        f"{quien.full_name} repartió los gastos compartidos de {nombre_periodo(p)} {CRITERIO_TEXTO[criterio]}",
        f"{moneda(total)} entre {len(filas)} proyectos activos",
        {"status": "Cerrado"},
        {"status": "Prorrateado", "proration_criterion": CRITERIO_BD[criterio], "total_overhead_cost": str(total)},
    )
    db.commit()
    return RepartoAplicado(periodo_id=str(p.id), criterio=criterio, total=float(total), filas=filas)
