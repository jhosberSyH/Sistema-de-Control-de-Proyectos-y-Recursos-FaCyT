"""Módulo 4 con el contrato del frontend (F4.1 a F4.6; RN-03, RN-07).

Catálogo (vista 11), solo el Administrador
  GET  /api/equipos?q&estado&ubicacion        equipos con su estado y su próxima reserva
  POST /api/equipos                           alta; nace Disponible; código de activo único (409)
  GET  /api/equipos/{id}/reservas-afectadas   reservas vigentes a futuro, antes de pasar a mantenimiento
  POST /api/equipos/{id}/mantenimiento        {motivo}: En mantenimiento; cancela sus reservas y avisa
  POST /api/equipos/{id}/fin-mantenimiento    vuelve a Disponible
Reservas (vista 12), Coordinador y Aprobador
  GET  /api/reservas?equipo&semana&reserva    el equipo, sus reservas de la semana y los proyectos para pedir
  POST /api/reservas                          {equipoId, proyectoId, inicio, fin}: Pendiente de Aprobación
  POST /api/reservas/{id}/aprobar             F4.5, solo el Aprobador (desde la bandeja)
  POST /api/reservas/{id}/rechazar            F4.5 {motivo}
Uso (vista 13), solo el Coordinador
  GET  /api/usos?equipo                       el equipo, su uso abierto, tu reserva de hoy y tu historial
  POST /api/usos                              {equipoId, proyectoId}: abre el uso; el equipo pasa a En uso
  POST /api/usos/{id}/cerrar                  {observaciones}: cierra el uso; vuelve a Disponible

La especificación son los handlers MSW (frontend/src/testing/mocks/handlers/equipos.ts, reservas.ts,
usos.ts y bandeja.ts). Los proyectos se identifican por UUID (proyectoId); el código solo se muestra.

Decisión 1: pasar un equipo a mantenimiento CANCELA sus reservas vigentes a futuro (estado 'Cancelado')
y avisa una vez a cada coordinador afectado con el motivo.
"""

import re
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request as HttpRequest
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auditoria.service import record_audit_log
from app.autenticacion.dependencies import get_client_ip, require_role
from app.avisos.service import avisar, avisar_a, ids_por_rol
from app.core.api import (
    ADMINISTRADOR,
    APROBADOR,
    COORDINADOR,
    ErrorValidacion,
    ModeloApi,
    conflicto,
    es_id_valido,
    normalizar,
)
from app.core.database import get_db
from app.modulos.equipos import horarios as h
from app.modulos.usuarios.models import (
    Equipment,
    EquipmentReservation,
    EquipmentUsage,
    Location,
    Project,
    User,
)

router = APIRouter(tags=["Módulo 4: Equipos, reservas y uso"])

solo_admin = require_role([ADMINISTRADOR])
solo_coordinador = require_role([COORDINADOR])
solo_aprobador = require_role([APROBADOR])
coordinador_o_aprobador = require_role([COORDINADOR, APROBADOR])

PENDIENTE = "Pendiente de Aprobación"
VIGENTES = (PENDIENTE, "Aprobado")
ESTADOS_EQUIPO = ("Disponible", "En uso", "En mantenimiento")
ESTADO_RESERVA = {
    PENDIENTE: "pendiente",
    "Aprobado": "aprobada",
    "Rechazado": "rechazada",
    "Cancelado": "cancelada",
    "Borrador": "borrador",
    "Ejecutado": "ejecutada",
}
#: Código de activo como el de la placa: letras, números y guiones (UC-FACYT-0457).
CODIGO = re.compile(r"^[A-Z0-9][A-Z0-9-]{2,23}$")
PROYECTO_NO_EXISTE = "Ese proyecto no existe."


# =============================================================================
# Esquemas
# =============================================================================

EstadoEquipo = Literal["Disponible", "En uso", "En mantenimiento"]


class UbicacionEquipo(ModeloApi):
    id: str
    nombre: str


class Mantenimiento(ModeloApi):
    motivo: str
    desde: str


class ProximaReserva(ModeloApi):
    inicio: str
    proyecto: str
    proyecto_id: str
    aprobada: bool


class Equipo(ModeloApi):
    id: str
    nombre: str
    codigo: str
    ubicacion: UbicacionEquipo
    estado: EstadoEquipo
    mantenimiento: Optional[Mantenimiento]
    proxima_reserva: Optional[ProximaReserva]


class ListaEquipos(ModeloApi):
    items: List[Equipo]
    total: int
    ubicaciones_con_equipos: List[UbicacionEquipo]
    ubicaciones: List[UbicacionEquipo]


class DatosEquipo(ModeloApi):
    nombre: str = ""
    codigo: str = ""
    ubicacion_id: str = ""


class ReservaAfectada(ModeloApi):
    id: str
    inicio: str
    fin: str
    proyecto: str
    proyecto_id: str
    coordinador: str


class DatosMantenimiento(ModeloApi):
    motivo: Optional[str] = None


class ResultadoMantenimiento(ModeloApi):
    equipo: Equipo
    avisados: int
    reservas: int


class EquipoSemana(ModeloApi):
    id: str
    nombre: str
    codigo: str
    ubicacion: str
    estado: EstadoEquipo
    mantenimiento: Optional[Mantenimiento]


class EquipoBreve(ModeloApi):
    id: str
    nombre: str
    estado: EstadoEquipo


class ReservaSemana(ModeloApi):
    id: str
    proyecto: str
    proyecto_id: str
    inicio: str
    fin: str
    estado: Literal["pendiente", "aprobada", "cancelada"]
    mia: bool


class ProyectoPropioEquipo(ModeloApi):
    id: str
    codigo: str
    nombre: str


class ReservaRechazada(ModeloApi):
    id: str
    equipo_id: str
    equipo: str
    proyecto: str
    proyecto_id: str
    inicio: str
    fin: str
    decidida_el: str
    motivo: str


class ReservaPendiente(ModeloApi):
    id: str
    proyecto: str
    proyecto_id: str
    inicio: str
    fin: str


class SemanaEquipo(ModeloApi):
    equipo: EquipoSemana
    equipos: List[EquipoBreve]
    semana: str
    reservas: List[ReservaSemana]
    mis_proyectos: List[ProyectoPropioEquipo]
    resaltada: Optional[str]
    rechazadas: List[ReservaRechazada]
    pendientes: List[ReservaPendiente]


class DatosReserva(ModeloApi):
    equipo_id: str = ""
    proyecto_id: str = ""
    inicio: str = ""
    fin: str = ""


class ReservaCreada(ModeloApi):
    id: str
    equipo: str
    proyecto: str
    proyecto_id: str
    inicio: str
    fin: str
    estado: Literal["pendiente"]


class DatosRechazo(ModeloApi):
    motivo: Optional[str] = None


class DecisionReserva(ModeloApi):
    id: str
    estado: Literal["aprobada", "rechazada"]


class UsoAbierto(ModeloApi):
    id: str
    proyecto: str
    proyecto_id: str
    inicio: str
    mio: bool
    usuario: str


class UsoHistorial(ModeloApi):
    id: str
    inicio: str
    proyecto: str
    proyecto_id: str
    horas: float
    observaciones: Optional[str]


class HorasMes(ModeloApi):
    mes: str
    horas: float


class UsoEquipo(ModeloApi):
    equipo: EquipoSemana
    equipos: List[EquipoBreve]
    abierto: Optional[UsoAbierto]
    reserva_hoy: Optional[ReservaPendiente]
    mis_proyectos: List[ProyectoPropioEquipo]
    historial: List[UsoHistorial]
    mes: Optional[HorasMes]


class DatosUsoEquipo(ModeloApi):
    equipo_id: str = ""
    proyecto_id: str = ""


class UsoIniciado(ModeloApi):
    id: str
    proyecto: str
    proyecto_id: str
    inicio: str


class DatosCierre(ModeloApi):
    observaciones: Optional[str] = None


class UsoCerrado(ModeloApi):
    id: str
    proyecto: str
    proyecto_id: str
    horas: float
    equipo: str


# =============================================================================
# Consultas y presentación
# =============================================================================

def _texto(v: Optional[str]) -> str:
    return " ".join((v or "").split())


def _equipo(db: Session, equipo_id: Optional[str], mensaje: str = "No encontramos ese equipo.") -> Equipment:
    e = db.get(Equipment, equipo_id) if equipo_id and es_id_valido(equipo_id, db) else None
    if not e:
        raise HTTPException(status_code=404, detail=mensaje)
    return e


def _proyectos(db: Session) -> Dict[str, Project]:
    return {str(p.id): p for p in db.query(Project).all()}


def _mantenimiento(e: Equipment) -> Optional[Mantenimiento]:
    if e.operational_status != "En mantenimiento":
        return None
    return Mantenimiento(
        motivo=e.maintenance_reason or "Sin motivo registrado.",
        desde=(e.maintenance_since or h.hoy()).isoformat(),
    )


def _vigentes_futuras(db: Session, equipo_id) -> List[EquipmentReservation]:
    """Pendientes y aprobadas que terminan hoy o después (las de hoy cuentan todo el día)."""
    desde = h.hoy()
    return sorted(
        (
            r for r in db.query(EquipmentReservation)
            .filter(EquipmentReservation.equipment_id == equipo_id, EquipmentReservation.status.in_(VIGENTES))
            .all()
            if h.fecha_de(r.end_time) >= desde
        ),
        key=lambda r: h.a_utc(r.start_time),
    )


def _vista(db: Session, e: Equipment, proyectos: Optional[Dict[str, Project]] = None) -> Equipo:
    proyectos = proyectos if proyectos is not None else _proyectos(db)
    proxima = None
    # En mantenimiento no se usa: el mockup muestra "—" en la próxima reserva
    if e.operational_status != "En mantenimiento":
        futuras = _vigentes_futuras(db, e.id)
        if futuras:
            r = futuras[0]
            p = proyectos.get(str(r.project_id))
            proxima = ProximaReserva(inicio=h.iso(r.start_time), proyecto=p.code if p else "",
                                     proyecto_id=str(r.project_id), aprobada=r.status == "Aprobado")
    return Equipo(
        id=str(e.id),
        nombre=e.name,
        codigo=e.asset_code,
        ubicacion=UbicacionEquipo(id=str(e.location_id or ""), nombre=e.location.name if e.location else "Sin ubicación"),
        estado=e.operational_status,
        mantenimiento=_mantenimiento(e),
        proxima_reserva=proxima,
    )


def _equipo_semana(e: Equipment) -> EquipoSemana:
    return EquipoSemana(
        id=str(e.id), nombre=e.name, codigo=e.asset_code,
        ubicacion=e.location.name if e.location else "Sin ubicación",
        estado=e.operational_status, mantenimiento=_mantenimiento(e),
    )


def _equipos_breves(db: Session) -> List[EquipoBreve]:
    todos = sorted(db.query(Equipment).all(), key=lambda e: normalizar(e.name))
    return [EquipoBreve(id=str(e.id), nombre=e.name, estado=e.operational_status) for e in todos]


def _mis_proyectos(db: Session, u: User) -> List[Project]:
    return db.query(Project).filter(Project.coordinator_id == u.id).order_by(Project.code).all()


def _propios(mios: List[Project]) -> List[ProyectoPropioEquipo]:
    # Un proyecto finalizado ya no pide recursos (HU-04)
    return [ProyectoPropioEquipo(id=str(p.id), codigo=p.code, nombre=p.title) for p in mios if p.operational_status != "Finalizado"]


def _proyecto_propio(db: Session, u: User, proyecto_id: str, mensaje: str) -> Project:
    """RN-07: el proyecto del cuerpo existe (404) y es del coordinador (422)."""
    p = db.get(Project, proyecto_id) if proyecto_id and es_id_valido(proyecto_id, db) else None
    if proyecto_id and not p:
        raise HTTPException(status_code=404, detail=PROYECTO_NO_EXISTE)
    if not p or p.coordinator_id != u.id:
        raise ErrorValidacion({"proyectoId": mensaje})
    return p


def _horario(r: EquipmentReservation) -> str:
    """"05/11/2026 de 14:00 a 16:00", para los avisos."""
    return f"{h.fecha_corta(r.start_time)} de {h.hora(r.start_time)} a {h.hora(r.end_time)}"


def choque_aprobado(db: Session, r: EquipmentReservation) -> Optional[EquipmentReservation]:
    """Otra reserva ya aprobada del mismo equipo que se cruza con esta (F4.4). La usa también la bandeja."""
    return (
        db.query(EquipmentReservation)
        .filter(
            EquipmentReservation.equipment_id == r.equipment_id,
            EquipmentReservation.status == "Aprobado",
            EquipmentReservation.id != r.id,
            EquipmentReservation.start_time < r.end_time,
            EquipmentReservation.end_time > r.start_time,
        )
        .order_by(EquipmentReservation.start_time)
        .first()
    )


# =============================================================================
# Catálogo (F4.1, F4.2)
# =============================================================================

@router.get("/equipos", response_model=ListaEquipos)
def listar_equipos(
    q: str = "",
    estado: str = "",
    ubicacion: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(solo_admin),
):
    buscado = normalizar(q.strip())
    todos = db.query(Equipment).all()
    proyectos = _proyectos(db)
    items = [
        e for e in todos
        if (estado not in ESTADOS_EQUIPO or e.operational_status == estado)
        and (not ubicacion or str(e.location_id) == ubicacion)
        and (not buscado or buscado in normalizar(e.name) or buscado in normalizar(e.asset_code))
    ]
    items.sort(key=lambda e: normalizar(e.name))
    lugares = {str(e.location_id): (e.location.name if e.location else str(e.location_id)) for e in todos if e.location_id}
    activas = db.query(Location).filter(Location.is_active.is_(True)).all()
    return ListaEquipos(
        items=[_vista(db, e, proyectos) for e in items],
        total=len(todos),
        # Filtro: los lugares donde hay equipos. Alta: todas las ubicaciones activas del catálogo (F1.4)
        ubicaciones_con_equipos=sorted((UbicacionEquipo(id=i, nombre=n) for i, n in lugares.items()), key=lambda x: normalizar(x.nombre)),
        ubicaciones=sorted((UbicacionEquipo(id=str(l.id), nombre=l.name) for l in activas), key=lambda x: normalizar(x.nombre)),
    )


@router.post("/equipos", response_model=Equipo, status_code=201)
def registrar_equipo(
    datos: DatosEquipo,
    request: HttpRequest,
    db: Session = Depends(get_db),
    quien: User = Depends(solo_admin),
):
    nombre = _texto(datos.nombre)
    codigo = datos.codigo.strip().upper()
    errores: Dict[str, str] = {}
    if len(nombre) < 3:
        errores["nombre"] = "Escribe el nombre del equipo."
    elif len(nombre) > 120:
        errores["nombre"] = "Usa como máximo 120 caracteres."
    if not CODIGO.match(codigo):
        errores["codigo"] = "Escribe el código de la placa del equipo, como UC-FACYT-0457."
    lugar = db.get(Location, datos.ubicacion_id) if datos.ubicacion_id and es_id_valido(datos.ubicacion_id, db) else None
    if not lugar or not lugar.is_active:
        errores["ubicacionId"] = "Elige una ubicación activa del catálogo."
    if errores:
        raise ErrorValidacion(errores)

    repetido = db.query(Equipment).filter(func.upper(Equipment.asset_code) == codigo).first()
    if repetido:
        raise conflicto(f"El código {codigo} ya es de otro equipo.",
                        equipo={"id": str(repetido.id), "nombre": repetido.name})

    e = Equipment(asset_code=codigo, name=nombre, location_id=lugar.id, operational_status="Disponible")
    db.add(e)
    db.flush()
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"EQUIPMENT:{codigo}",
        target_table="equipments", target_id=str(e.id), action_type="EQUIPMENT_CREATE",
        new_value={"asset_code": codigo, "name": nombre, "location_id": str(lugar.id), "operational_status": "Disponible",
                   "descripcion": f"{quien.full_name} registró el equipo {nombre} ({codigo})"},
    )
    db.commit()
    db.refresh(e)
    return _vista(db, e)


def _afectadas(db: Session, e: Equipment) -> List[EquipmentReservation]:
    """Reservas vigentes que todavía no terminan: las que cancela el mantenimiento."""
    momento = h.ahora()
    return sorted(
        (r for r in db.query(EquipmentReservation)
         .filter(EquipmentReservation.equipment_id == e.id, EquipmentReservation.status.in_(VIGENTES)).all()
         if h.a_utc(r.end_time) > momento),
        key=lambda r: h.a_utc(r.start_time),
    )


def _coordinador_de(r: EquipmentReservation) -> Optional[str]:
    return (r.project.coordinator_id if r.project else None) or r.reserved_by_user_id


@router.get("/equipos/{equipo_id}/reservas-afectadas", response_model=List[ReservaAfectada])
def reservas_afectadas(equipo_id: str, db: Session = Depends(get_db), _: User = Depends(solo_admin)):
    e = _equipo(db, equipo_id)
    salida = []
    for r in _afectadas(db, e):
        cid = _coordinador_de(r)
        persona = db.get(User, cid) if cid else None
        salida.append(ReservaAfectada(
            id=str(r.id), inicio=h.iso(r.start_time), fin=h.iso(r.end_time),
            proyecto=r.project.code if r.project else "", proyecto_id=str(r.project_id),
            coordinador=persona.full_name if persona else "—",
        ))
    return salida


@router.post("/equipos/{equipo_id}/mantenimiento", response_model=ResultadoMantenimiento)
def pasar_a_mantenimiento(
    equipo_id: str,
    datos: DatosMantenimiento,
    request: HttpRequest,
    db: Session = Depends(get_db),
    quien: User = Depends(solo_admin),
):
    e = _equipo(db, equipo_id)
    if e.operational_status == "En mantenimiento":
        raise conflicto(f"{e.name} ya está en mantenimiento.")
    motivo = _texto(datos.motivo)
    if len(motivo) < 5:
        raise ErrorValidacion({"motivo": "Escribe el motivo: se incluye en el aviso a los coordinadores."})
    if len(motivo) > 300:
        raise ErrorValidacion({"motivo": "Usa como máximo 300 caracteres."})

    ip = get_client_ip(request)
    momento = h.ahora()
    afectadas = _afectadas(db, e)
    anterior = e.operational_status
    e.operational_status = "En mantenimiento"
    e.maintenance_reason = motivo
    e.maintenance_since = h.hoy()
    e.updated_at = momento
    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=f"EQUIPMENT:{e.asset_code}",
        target_table="equipments", target_id=str(e.id), action_type="EQUIPMENT_STATUS_CHANGE",
        old_value={"operational_status": anterior},
        new_value={"operational_status": "En mantenimiento", "descripcion": f"{quien.full_name} pasó {e.name} a mantenimiento",
                   "detalle": f"{len(afectadas)} reserva(s) cancelada(s)" if afectadas else None},
        justification=motivo,
    )

    # Decisión 1: las reservas vigentes a futuro se cancelan; cada coordinador recibe un aviso con el motivo
    por_coordinador: Dict[str, List[EquipmentReservation]] = {}
    for r in afectadas:
        estado_anterior = r.status
        r.status = "Cancelado"
        r.decided_at = momento
        r.decision_reason = f"El equipo pasó a mantenimiento: {motivo}"
        r.updated_at = momento
        record_audit_log(
            db=db, user_id=quien.id, ip_address=ip, target_object=f"RESERVATION:{r.id}",
            target_table="equipment_reservations", target_id=str(r.id), action_type="RESERVATION_CANCELLED_MAINTENANCE",
            old_value={"status": estado_anterior},
            new_value={"status": "Cancelado", "descripcion": f"Se canceló la reserva de {e.name} para "
                       f"{r.project.code if r.project else ''} ({_horario(r)}) por mantenimiento"},
            justification=motivo,
        )
        cid = _coordinador_de(r)
        if cid:
            por_coordinador.setdefault(str(cid), []).append(r)
    # Un aviso por reserva, con enlace a esa reserva (contrato del frontend)
    for cid, reservas in por_coordinador.items():
        for r in reservas:
            avisar(db, cid, "warn", f"Se canceló tu reserva de {e.name}", f"/reservas?reserva={r.id}",
                   detalle=f"{_horario(r)}. Motivo: {motivo}. Elige otro horario u otro equipo.")
    db.commit()
    db.refresh(e)
    return ResultadoMantenimiento(equipo=_vista(db, e), avisados=len(por_coordinador), reservas=len(afectadas))


@router.post("/equipos/{equipo_id}/fin-mantenimiento", response_model=Equipo)
def fin_mantenimiento(
    equipo_id: str,
    request: HttpRequest,
    db: Session = Depends(get_db),
    quien: User = Depends(solo_admin),
):
    e = _equipo(db, equipo_id)
    if e.operational_status != "En mantenimiento":
        raise conflicto(f"{e.name} no está en mantenimiento.")
    # Si alguien dejó un uso abierto, el equipo sigue En uso hasta que lo cierre
    abierto = db.query(EquipmentUsage).filter(EquipmentUsage.equipment_id == e.id, EquipmentUsage.end_time.is_(None)).first()
    nuevo = "En uso" if abierto else "Disponible"
    e.operational_status = nuevo
    e.maintenance_reason = None
    e.maintenance_since = None
    e.updated_at = h.ahora()
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"EQUIPMENT:{e.asset_code}",
        target_table="equipments", target_id=str(e.id), action_type="EQUIPMENT_STATUS_CHANGE",
        old_value={"operational_status": "En mantenimiento"},
        new_value={"operational_status": nuevo, "descripcion": f"{quien.full_name} registró el fin del mantenimiento de {e.name}"},
    )
    db.commit()
    db.refresh(e)
    return _vista(db, e)


# =============================================================================
# Reservas (F4.3, F4.4, F4.5)
# =============================================================================

def _equipo_inicial(db: Session, u: User, mios: List[Project]) -> Optional[str]:
    """El de la próxima reserva del coordinador o la próxima pendiente del aprobador; si no, el primero."""
    desde = h.hoy()
    consulta = db.query(EquipmentReservation)
    if u.role == COORDINADOR:
        ids = [p.id for p in mios]
        consulta = consulta.filter(EquipmentReservation.status.in_(VIGENTES), EquipmentReservation.project_id.in_(ids or [None]))
    else:
        consulta = consulta.filter(EquipmentReservation.status == PENDIENTE)
    proximas = sorted((r for r in consulta.all() if h.fecha_de(r.end_time) >= desde), key=lambda r: h.a_utc(r.start_time))
    if proximas:
        return str(proximas[0].equipment_id)
    libres = sorted(db.query(Equipment).filter(Equipment.operational_status != "En mantenimiento").all(),
                    key=lambda e: normalizar(e.name))
    return str(libres[0].id) if libres else None


@router.get("/reservas", response_model=SemanaEquipo)
def semana_de_equipo(
    equipo: str = "",
    semana: str = "",
    reserva: str = "",
    db: Session = Depends(get_db),
    u: User = Depends(coordinador_o_aprobador),
):
    mios = _mis_proyectos(db, u) if u.role == COORDINADOR else []
    mios_ids = {str(p.id) for p in mios}
    resaltada = db.get(EquipmentReservation, reserva) if reserva and es_id_valido(reserva, db) else None
    equipo_id = str(resaltada.equipment_id) if resaltada else (equipo or _equipo_inicial(db, u, mios))
    e = _equipo(db, equipo_id, "No encontramos ese equipo. Elige otro de la lista.")

    pedida = h.leer_fecha(semana)
    lunes = h.lunes_de(h.fecha_de(resaltada.start_time)) if resaltada else h.lunes_de(pedida or h.hoy())
    hasta = lunes + timedelta(days=6)
    proyectos = _proyectos(db)

    def codigo(pid) -> str:
        p = proyectos.get(str(pid))
        return p.code if p else ""

    vigentes = (
        db.query(EquipmentReservation)
        .filter(EquipmentReservation.equipment_id == e.id, EquipmentReservation.status.in_(VIGENTES))
        .all()
    )
    de_la_semana = sorted((r for r in vigentes if lunes <= h.fecha_de(r.start_time) < hasta), key=lambda r: h.a_utc(r.start_time))

    rechazadas: List[ReservaRechazada] = []
    if u.role == COORDINADOR and mios:
        limite = h.ahora() - timedelta(days=30)
        filas = (
            db.query(EquipmentReservation)
            .filter(EquipmentReservation.status == "Rechazado", EquipmentReservation.project_id.in_([p.id for p in mios]),
                    EquipmentReservation.decided_at.isnot(None))
            .all()
        )
        filas = sorted((r for r in filas if h.a_utc(r.decided_at) >= limite), key=lambda r: h.a_utc(r.decided_at), reverse=True)[:5]
        nombres = {str(x.id): x.name for x in db.query(Equipment).all()}
        rechazadas = [
            ReservaRechazada(
                id=str(r.id), equipo_id=str(r.equipment_id), equipo=nombres.get(str(r.equipment_id), "Equipo"),
                proyecto=codigo(r.project_id), proyecto_id=str(r.project_id), inicio=h.iso(r.start_time), fin=h.iso(r.end_time),
                decidida_el=h.iso(r.decided_at), motivo=r.decision_reason or "Sin motivo registrado.",
            )
            for r in filas
        ]

    pendientes: List[ReservaPendiente] = []
    if u.role == APROBADOR:
        desde = h.hoy()
        pendientes = [
            ReservaPendiente(id=str(r.id), proyecto=codigo(r.project_id), proyecto_id=str(r.project_id),
                             inicio=h.iso(r.start_time), fin=h.iso(r.end_time))
            for r in sorted(vigentes, key=lambda r: h.a_utc(r.start_time))
            if r.status == PENDIENTE and h.fecha_de(r.end_time) >= desde
        ]

    return SemanaEquipo(
        equipo=_equipo_semana(e),
        equipos=_equipos_breves(db),
        semana=lunes.isoformat(),
        reservas=[
            ReservaSemana(id=str(r.id), proyecto=codigo(r.project_id), proyecto_id=str(r.project_id),
                          inicio=h.iso(r.start_time), fin=h.iso(r.end_time), estado=ESTADO_RESERVA[r.status],
                          # RN-07: el coordinador distingue las suyas; las demás se ven como "Ocupado"
                          mia=str(r.project_id) in mios_ids)
            for r in de_la_semana
        ],
        mis_proyectos=_propios(mios),
        resaltada=str(resaltada.id) if resaltada else None,
        rechazadas=rechazadas,
        pendientes=pendientes,
    )


@router.post("/reservas", response_model=ReservaCreada, status_code=201)
def solicitar_reserva(
    datos: DatosReserva,
    request: HttpRequest,
    db: Session = Depends(get_db),
    quien: User = Depends(solo_coordinador),
):
    e = _equipo(db, datos.equipo_id)
    if e.operational_status == "En mantenimiento":
        raise conflicto(f"{e.name} está en mantenimiento: no admite reservas nuevas hasta que vuelva a Disponible.")
    p = _proyecto_propio(db, quien, datos.proyecto_id, "Elige uno de tus proyectos.")
    if p.operational_status == "Finalizado":
        raise ErrorValidacion({"proyectoId": f"{p.code} está finalizado: ya no pide recursos."})

    inicio = h.leer_instante(datos.inicio)
    fin = h.leer_instante(datos.fin)
    if inicio is None or fin is None:
        raise ErrorValidacion({"inicio": "Elige la fecha y el horario."})
    errores: Dict[str, str] = {}
    if h.fecha_de(inicio).weekday() == 6:
        errores["fecha"] = "Los domingos los laboratorios están cerrados."
    elif inicio <= h.ahora():
        errores["inicio"] = "La reserva tiene que empezar más tarde que ahora."
    elif h.fecha_de(inicio) != h.fecha_de(fin) or h.minutos_de(fin) <= h.minutos_de(inicio):
        errores["fin"] = "La hora de fin tiene que ser después del inicio."
    elif h.minutos_de(inicio) < h.APERTURA or h.minutos_de(fin) > h.CIERRE:
        errores["inicio"] = f"Los laboratorios atienden de {h.hora_de(h.APERTURA)} a {h.hora_de(h.CIERRE)}."
    if errores:
        raise ErrorValidacion(errores)

    def choque_409() -> HTTPException:
        vigentes = (
            db.query(EquipmentReservation)
            .filter(EquipmentReservation.equipment_id == e.id, EquipmentReservation.status.in_(VIGENTES))
            .order_by(EquipmentReservation.start_time)
            .all()
        )
        c = next((r for r in vigentes if h.se_cruzan(r.start_time, r.end_time, inicio, fin)), None)
        if not c:
            return None
        codigo = c.project.code if c.project else ""
        return conflicto(
            f"Choca con la reserva de {codigo} el {h.fecha_corta(c.start_time)}.",
            choque={"proyecto": codigo, "proyectoId": str(c.project_id), "inicio": h.iso(c.start_time), "fin": h.iso(c.end_time)},
            libres=h.libres_del_dia([(r.start_time, r.end_time) for r in vigentes], inicio),
        )

    error = choque_409()
    if error:
        raise error

    r = EquipmentReservation(
        equipment_id=e.id, project_id=p.id, reserved_by_user_id=quien.id,
        start_time=inicio, end_time=fin, status=PENDIENTE,
    )
    try:
        with db.begin_nested():
            db.add(r)
            db.flush()
    except IntegrityError:
        # Otra persona pidió el mismo horario al mismo tiempo: el EXCLUDE de la BD lo frena (decisión 2)
        raise choque_409() or conflicto("Ese horario se acaba de ocupar. Elige otro.")

    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"RESERVATION:{r.id}",
        target_table="equipment_reservations", target_id=str(r.id), action_type="RESERVATION_CREATE",
        new_value={"equipment_id": str(e.id), "project_id": str(p.id), "start_time": h.iso(inicio), "end_time": h.iso(fin),
                   "status": PENDIENTE, "descripcion": f"{quien.full_name} solicitó una reserva de {e.name} para {p.code}",
                   "detalle": _horario(r)},
    )
    avisar_a(db, ids_por_rol(db, APROBADOR), "info", f"Reserva por aprobar: {e.name}", f"/bandeja?pedido={r.id}",
             detalle=f"{p.code}, {h.fecha_corta(inicio)} de {h.hora(inicio)} a {h.hora(fin)}.")
    db.commit()
    return ReservaCreada(id=str(r.id), equipo=e.name, proyecto=p.code, proyecto_id=str(p.id),
                         inicio=h.iso(inicio), fin=h.iso(fin), estado="pendiente")


def _reserva_por_decidir(db: Session, reserva_id: str) -> EquipmentReservation:
    r = db.get(EquipmentReservation, reserva_id) if es_id_valido(reserva_id, db) else None
    if not r:
        raise HTTPException(status_code=404, detail="No encontramos esa reserva.")
    if r.status != PENDIENTE:
        raise conflicto(f"La reserva de {r.project.code if r.project else ''} ya está "
                        f"{ESTADO_RESERVA.get(r.status, r.status)}: no se puede decidir de nuevo.")
    return r


@router.post("/reservas/{reserva_id}/aprobar", response_model=DecisionReserva)
def aprobar_reserva(
    reserva_id: str,
    request: HttpRequest,
    db: Session = Depends(get_db),
    quien: User = Depends(solo_aprobador),
):
    """F4.5: aprobada, ocupa el horario. No se aprueba si ya choca con otra aprobada o el equipo no está."""
    r = _reserva_por_decidir(db, reserva_id)
    e = r.equipment
    codigo = r.project.code if r.project else ""
    if e.operational_status == "En mantenimiento":
        raise conflicto(f"{e.name} está en mantenimiento: rechaza la reserva o espera a que vuelva.")
    if h.a_utc(r.end_time) < h.ahora():
        raise conflicto(f"El horario de la reserva de {codigo} ya pasó: recházala.")
    c = choque_aprobado(db, r)
    if c:
        raise conflicto(f"Choca con la reserva de {c.project.code if c.project else ''} del "
                        f"{h.fecha_corta(c.start_time)}, que ya está aprobada. Recházala.")
    r.status = "Aprobado"
    r.approved_by_user_id = quien.id
    r.decided_at = h.ahora()
    r.updated_at = r.decided_at
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"RESERVATION:{r.id}",
        target_table="equipment_reservations", target_id=str(r.id), action_type="RESERVATION_APPROVE",
        old_value={"status": PENDIENTE},
        new_value={"status": "Aprobado", "descripcion": f"{quien.full_name} aprobó la reserva de {e.name} para {codigo}",
                   "detalle": _horario(r)},
    )
    avisar(db, r.reserved_by_user_id, "ok", f"Reserva aprobada: {e.name}", f"/reservas?reserva={r.id}",
           detalle=f"{codigo}, {_horario(r)}.")
    db.commit()
    return DecisionReserva(id=str(r.id), estado="aprobada")


@router.post("/reservas/{reserva_id}/rechazar", response_model=DecisionReserva)
def rechazar_reserva(
    reserva_id: str,
    datos: DatosRechazo,
    request: HttpRequest,
    db: Session = Depends(get_db),
    quien: User = Depends(solo_aprobador),
):
    r = _reserva_por_decidir(db, reserva_id)
    motivo = (datos.motivo or "").strip()[:500]
    if not motivo:
        raise ErrorValidacion({"motivo": "Escribe el motivo. Sin motivo no se puede rechazar."})
    e = r.equipment
    codigo = r.project.code if r.project else ""
    r.status = "Rechazado"
    r.approved_by_user_id = quien.id
    r.decided_at = h.ahora()
    r.decision_reason = motivo
    r.updated_at = r.decided_at
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"RESERVATION:{r.id}",
        target_table="equipment_reservations", target_id=str(r.id), action_type="RESERVATION_REJECT",
        old_value={"status": PENDIENTE},
        new_value={"status": "Rechazado", "descripcion": f"{quien.full_name} rechazó la reserva de {e.name} para {codigo}",
                   "detalle": _horario(r)},
        justification=motivo,
    )
    avisar(db, r.reserved_by_user_id, "err", f"Reserva rechazada: {e.name}", f"/reservas?equipo={e.id}",
           detalle=f"{codigo}, {_horario(r)}. «{motivo}»")
    db.commit()
    return DecisionReserva(id=str(r.id), estado="rechazada")


# =============================================================================
# Uso de equipos (F4.6)
# =============================================================================

def _abierto(db: Session, equipo_id) -> Optional[EquipmentUsage]:
    return db.query(EquipmentUsage).filter(EquipmentUsage.equipment_id == equipo_id, EquipmentUsage.end_time.is_(None)).first()


def _horas(valor) -> float:
    return float(Decimal(str(valor or 0)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


@router.get("/usos", response_model=UsoEquipo)
def uso_de_equipo(
    equipo: str = "",
    db: Session = Depends(get_db),
    quien: User = Depends(solo_coordinador),
):
    mios = _mis_proyectos(db, quien)
    ids = [p.id for p in mios] or [None]
    codigos = {str(p.id): p.code for p in mios}
    momento = h.ahora()

    equipo_id = equipo
    if not equipo_id:
        # El que estás usando, el de tu próxima reserva aprobada o el primero de la lista
        propio = db.query(EquipmentUsage).filter(EquipmentUsage.registered_by_user_id == quien.id,
                                                 EquipmentUsage.end_time.is_(None)).first()
        if propio:
            equipo_id = str(propio.equipment_id)
        else:
            proximas = sorted(
                (r for r in db.query(EquipmentReservation)
                 .filter(EquipmentReservation.status == "Aprobado", EquipmentReservation.project_id.in_(ids)).all()
                 if h.a_utc(r.end_time) >= momento),
                key=lambda r: h.a_utc(r.start_time),
            )
            if proximas:
                equipo_id = str(proximas[0].equipment_id)
            else:
                primero = sorted(db.query(Equipment).all(), key=lambda e: normalizar(e.name))
                equipo_id = str(primero[0].id) if primero else ""
    e = _equipo(db, equipo_id, "No encontramos ese equipo. Elige otro de la lista.")

    abierto = _abierto(db, e.id)
    hoy = h.hoy()
    reserva = next(iter(sorted(
        (r for r in db.query(EquipmentReservation)
         .filter(EquipmentReservation.equipment_id == e.id, EquipmentReservation.status == "Aprobado",
                 EquipmentReservation.project_id.in_(ids)).all()
         if h.fecha_de(r.start_time) == hoy and h.a_utc(r.end_time) >= momento),
        key=lambda r: h.a_utc(r.start_time),
    )), None)

    # RN-07: solo los usos de los proyectos del coordinador
    cerrados = sorted(
        db.query(EquipmentUsage)
        .filter(EquipmentUsage.equipment_id == e.id, EquipmentUsage.end_time.isnot(None), EquipmentUsage.project_id.in_(ids))
        .all(),
        key=lambda x: h.a_utc(x.start_time), reverse=True,
    )
    historial = [
        UsoHistorial(id=str(x.id), inicio=h.iso(x.start_time), proyecto=codigos.get(str(x.project_id), ""),
                     proyecto_id=str(x.project_id), horas=_horas(x.used_hours), observaciones=x.observations)
        for x in cerrados
    ]
    mes = None
    if cerrados:
        clave = h.en_caracas(cerrados[0].start_time).strftime("%Y-%m")
        total = sum((Decimal(str(x.used_hours or 0)) for x in cerrados if h.en_caracas(x.start_time).strftime("%Y-%m") == clave), Decimal(0))
        mes = HorasMes(mes=clave, horas=_horas(total))

    usuario_abierto = db.get(User, abierto.registered_by_user_id) if abierto else None
    proyecto_abierto = db.get(Project, abierto.project_id) if abierto else None
    return UsoEquipo(
        equipo=_equipo_semana(e),
        equipos=_equipos_breves(db),
        abierto=UsoAbierto(
            id=str(abierto.id), proyecto=proyecto_abierto.code if proyecto_abierto else "", proyecto_id=str(abierto.project_id),
            inicio=h.iso(abierto.start_time), mio=abierto.registered_by_user_id == quien.id,
            usuario=usuario_abierto.full_name if usuario_abierto else "—",
        ) if abierto else None,
        reserva_hoy=ReservaPendiente(
            id=str(reserva.id), proyecto=codigos.get(str(reserva.project_id), ""), proyecto_id=str(reserva.project_id),
            inicio=h.iso(reserva.start_time), fin=h.iso(reserva.end_time),
        ) if reserva else None,
        mis_proyectos=_propios(mios),
        historial=historial,
        mes=mes,
    )


def _ya_en_uso(db: Session, e: Equipment, abierto: EquipmentUsage) -> HTTPException:
    persona = db.get(User, abierto.registered_by_user_id)
    p = db.get(Project, abierto.project_id)
    return conflicto(f"{e.name} ya está en uso por {persona.full_name if persona else 'otra persona'} para "
                     f"{p.code if p else 'otro proyecto'} desde las {h.hora(abierto.start_time)}.")


@router.post("/usos", response_model=UsoIniciado, status_code=201)
def iniciar_uso(
    datos: DatosUsoEquipo,
    request: HttpRequest,
    db: Session = Depends(get_db),
    quien: User = Depends(solo_coordinador),
):
    """F4.6: inicia el uso. Puede no tener reserva; si la tiene, queda asociada."""
    e = _equipo(db, datos.equipo_id)
    if e.operational_status == "En mantenimiento":
        raise conflicto(f"{e.name} está en mantenimiento: no se puede usar.")
    abierto = _abierto(db, e.id)
    if abierto:
        raise _ya_en_uso(db, e, abierto)
    p = _proyecto_propio(db, quien, datos.proyecto_id, "Elige uno de tus proyectos vigentes.")
    if p.operational_status == "Finalizado":
        raise ErrorValidacion({"proyectoId": "Elige uno de tus proyectos vigentes."})

    momento = h.ahora()
    # La reserva aprobada de ese proyecto que cubre este momento, si la hay
    reserva = next((r for r in db.query(EquipmentReservation)
                    .filter(EquipmentReservation.equipment_id == e.id, EquipmentReservation.project_id == p.id,
                            EquipmentReservation.status == "Aprobado").all()
                    if h.se_cruzan(r.start_time, r.end_time, momento, momento + timedelta(minutes=1))), None)
    uso = EquipmentUsage(
        equipment_id=e.id, project_id=p.id, reservation_id=reserva.id if reserva else None,
        registered_by_user_id=quien.id, start_time=momento, end_time=None, used_hours=None,
    )
    try:
        with db.begin_nested():
            db.add(uso)
            db.flush()
    except IntegrityError:
        # Dos personas lo abrieron a la vez: el índice único de la BD deja solo un uso abierto
        db.expire_all()
        otro = _abierto(db, e.id)
        raise _ya_en_uso(db, e, otro) if otro else conflicto(f"{e.name} ya está en uso.")
    anterior = e.operational_status
    e.operational_status = "En uso"
    e.updated_at = momento
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"EQUIPMENT:{e.asset_code}",
        target_table="equipments", target_id=str(e.id), action_type="EQUIPMENT_USAGE_START",
        old_value={"operational_status": anterior},
        new_value={"operational_status": "En uso", "usage_id": str(uso.id), "project_id": str(p.id),
                   "descripcion": f"{quien.full_name} inició el uso de {e.name} para {p.code}"},
    )
    db.commit()
    return UsoIniciado(id=str(uso.id), proyecto=p.code, proyecto_id=str(p.id), inicio=h.iso(momento))


@router.post("/usos/{uso_id}/cerrar", response_model=UsoCerrado)
def cerrar_uso(
    uso_id: str,
    datos: DatosCierre,
    request: HttpRequest,
    db: Session = Depends(get_db),
    quien: User = Depends(solo_coordinador),
):
    """F4.6: cierra el uso con observaciones opcionales; el equipo vuelve a Disponible (HU-14)."""
    uso = db.get(EquipmentUsage, uso_id) if es_id_valido(uso_id, db) else None
    if not uso:
        raise HTTPException(status_code=404, detail="No encontramos ese registro de uso.")
    if uso.end_time is not None:
        raise conflicto("Ese registro de uso ya está cerrado.")
    if uso.registered_by_user_id != quien.id:
        raise HTTPException(status_code=403, detail="Solo quien inició el uso puede cerrarlo.")
    texto = (datos.observaciones or "").strip()[:500]
    fin = h.ahora()
    segundos = Decimal(str(max((fin - h.a_utc(uso.start_time)).total_seconds(), 0)))
    uso.end_time = fin
    uso.used_hours = (segundos / Decimal(3600)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    uso.observations = texto or None
    e = uso.equipment
    p = uso.project
    if e.operational_status == "En uso":
        e.operational_status = "Disponible"
        e.updated_at = fin
    horas = _horas(uso.used_hours)
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"EQUIPMENT:{e.asset_code}",
        target_table="equipments", target_id=str(e.id), action_type="EQUIPMENT_USAGE_CLOSE",
        old_value={"operational_status": "En uso"},
        new_value={"operational_status": e.operational_status, "usage_id": str(uso.id), "used_hours": str(uso.used_hours),
                   "descripcion": f"{quien.full_name} cerró el uso de {e.name} para {p.code if p else ''}",
                   "detalle": f"{str(horas).replace('.', ',')} h"},
    )
    db.commit()
    return UsoCerrado(id=str(uso.id), proyecto=p.code if p else "", proyecto_id=str(uso.project_id), horas=horas, equipo=e.name)
