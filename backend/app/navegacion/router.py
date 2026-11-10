"""Datos del "shell" de la aplicación que pide cada página (contrato de frontend/src/app).

GET  /api/inicio                  resumen para el rol de quien pide (vista 02)
GET  /api/navegacion/contadores   números del menú lateral (sondeo cada 60 s)
GET  /api/avisos                  bandeja interna de avisos
POST /api/avisos/{id}/leido       marca un aviso como leído
POST /api/avisos/leidos           marca todos como leídos
GET  /api/periodos/actual         período contable en revisión o abierto (encabezado), o null

Los avisos viven en app.notifications (decisión 6); cada módulo los crea con app.avisos.service.avisar
dentro de la transacción del evento.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auditoria.models import AuditLog
from app.autenticacion.dependencies import get_current_user
from app.core.api import APROBADOR, COORDINADOR, es_id_valido, iso
from app.core.database import get_db
from app.modulos.usuarios.models import (
    AccountingPeriod,
    Batch,
    Dispatch,
    DispatchCorrection,
    Equipment,
    EquipmentReservation,
    Item,
    Notification,
    PeriodProjectConfirmation,
    Project,
    Request as Solicitud,
    SystemParameter,
    User,
)

router = APIRouter(tags=["Navegación e inicio"])

ORDEN_PRIORIDAD = {"Crítica": 0, "Alta": 1, "Media": 2, "Baja": 3}
RECIENTE = timedelta(days=3)
ESTADO_PERIODO = {"Abierto": "abierto", "En revisión": "en_revision", "Cerrado": "cerrado", "Prorrateado": "prorrateado"}
TIPO_SOLICITUD = {"Gasto": "gasto", "Retiro": "retiro", "Reposición automática": "reposicion"}
ESTADO_RESERVA = {"Pendiente de Aprobación": "pendiente", "Aprobado": "aprobada", "Rechazado": "rechazada"}
ACCIONES_SESION = ("LOGIN_SUCCESS", "LOGIN_FAILED", "LOGIN_BLOCKED_DEACTIVATED", "LOGOUT", "PASSWORD_CREATED")


# =============================================================================
# Consultas compartidas
# =============================================================================

def periodo_en_curso(db: Session) -> Optional[AccountingPeriod]:
    return (
        db.query(AccountingPeriod).filter(AccountingPeriod.status == "En revisión").order_by(AccountingPeriod.start_date.desc()).first()
        or db.query(AccountingPeriod).filter(AccountingPeriod.status == "Abierto").order_by(AccountingPeriod.start_date.desc()).first()
    )


def _parametro(db: Session, clave: str, defecto: int) -> int:
    p = db.query(SystemParameter).filter(SystemParameter.parameter_key == clave).first()
    return p.parameter_value if p else defecto


def _f(valor) -> float:
    return float(valor or 0)


def _nombre_pila(nombre: str) -> str:
    return (nombre or "").split(" ")[0]


def _reciente(momento: Optional[datetime]) -> bool:
    if momento is None:
        return False
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - momento <= RECIENTE


def _proyectos_sin_coordinador(db: Session) -> List[Project]:
    return (
        db.query(Project)
        .filter(Project.coordinator_id.is_(None), Project.operational_status != "Finalizado")
        .order_by(Project.code)
        .all()
    )


def _alertas_inventario(db: Session) -> Dict[str, list]:
    anticipacion = _parametro(db, "batch_expiration_alert_days", 30)
    hoy = date.today()
    bajo_minimo = (
        db.query(Item)
        .filter(Item.is_active.is_(True), Item.min_stock.isnot(None), Item.current_stock < Item.min_stock)
        .order_by(Item.name)
        .all()
    )
    lotes = (
        db.query(Batch)
        .filter(Batch.expiration_date.isnot(None), Batch.available_quantity > 0)
        .order_by(Batch.expiration_date)
        .all()
    )
    por_vencer = [(l, (l.expiration_date - hoy).days) for l in lotes if 0 <= (l.expiration_date - hoy).days <= anticipacion]
    vencidos = [l for l in lotes if (l.expiration_date - hoy).days < 0]
    return {"bajo_minimo": bajo_minimo, "por_vencer": por_vencer, "vencidos": vencidos, "anticipacion": anticipacion}


def _pedidos_pendientes(db: Session) -> Dict[str, list]:
    return {
        "solicitudes": (
            db.query(Solicitud)
            .filter(Solicitud.status == "Pendiente de Aprobación", Solicitud.request_type.in_(["Gasto", "Retiro"]))
            .order_by(Solicitud.created_at)
            .all()
        ),
        "reposiciones": (
            db.query(Solicitud)
            # Como la bandeja de M5: la reposición nace en Borrador y el aprobador la decide desde ahí
            .filter(Solicitud.status.in_(["Borrador", "Pendiente de Aprobación"]), Solicitud.request_type == "Reposición automática")
            .order_by(Solicitud.created_at)
            .all()
        ),
        "reservas": (
            db.query(EquipmentReservation)
            .filter(EquipmentReservation.status == "Pendiente de Aprobación")
            .order_by(EquipmentReservation.created_at)
            .all()
        ),
        "correcciones": (
            db.query(DispatchCorrection)
            .filter(DispatchCorrection.status == "Pendiente")
            .order_by(DispatchCorrection.created_at)
            .all()
        ),
    }


def _gastos_por_ejecutar(db: Session) -> List[Solicitud]:
    return db.query(Solicitud).filter(Solicitud.request_type == "Gasto", Solicitud.status == "Aprobado").all()


def _despachos_por_entregar(db: Session) -> List[Solicitud]:
    """Retiros aprobados que aún no tienen despacho en la bitácora."""
    despachadas = {rid for (rid,) in db.query(Dispatch.request_id).filter(Dispatch.request_id.isnot(None)).distinct()}
    retiros = db.query(Solicitud).filter(Solicitud.request_type == "Retiro", Solicitud.status == "Aprobado").all()
    return [s for s in retiros if s.id not in despachadas]


# =============================================================================
# Inicio por rol
# =============================================================================

def _resumen_proyecto(p: Project) -> Dict[str, Any]:
    presupuesto = _f(p.assigned_budget)
    gasto = _f(p.executed_budget)
    return {
        "id": str(p.id),
        "codigo": p.code,
        "nombre": p.title,
        "estatus": p.operational_status,
        "prioridad": p.priority_level,
        # Sin plan confirmado no hay avance físico (F2.4)
        "avance": _f(p.physical_progress_pct) if p.plan_confirmed else None,
        "ejecucion": round(gasto / presupuesto * 100) if presupuesto else 0,
        "gastoEjecutado": gasto,
        "presupuesto": presupuesto,
    }


def _motivo_sin_coordinador(db: Session, p: Project) -> Dict[str, str]:
    log = (
        db.query(AuditLog)
        .filter(AuditLog.target_object == f"PROJECT:{p.id}", AuditLog.action_type == "COORDINATOR_UNASSIGNED")
        .order_by(AuditLog.timestamp.desc())
        .first()
    )
    if not log:
        return {"motivo": "", "fecha": ""}
    return {"motivo": (log.new_value or {}).get("motivo", ""), "fecha": log.timestamp.date().isoformat()}


def _actividad(db: Session) -> List[Dict[str, Any]]:
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.action_type.notin_(ACCIONES_SESION), AuditLog.user_id.isnot(None))
        .order_by(AuditLog.timestamp.desc())
        .limit(3)
        .all()
    )
    return [
        {
            "id": str(l.id),
            "descripcion": (l.new_value or {}).get("descripcion") or f"{l.action_type} · {l.target_object or ''}".strip(" ·"),
            "detalle": (l.new_value or {}).get("detalle"),
            "justificacion": l.justification,
            "fecha": iso(l.timestamp),
            "ip": l.ip_address,
        }
        for l in logs
    ]


def inicio_administrador(db: Session, u: User) -> Dict[str, Any]:
    pendientes = [
        {"clase": "sin-coordinador", "proyecto": p.code, "proyectoId": str(p.id), **_motivo_sin_coordinador(db, p)}
        for p in _proyectos_sin_coordinador(db)
    ]
    # Plan confirmado en un proyecto que sigue en Propuesta: el administrador decide si lo pasa a ejecución
    pendientes += [
        {"clase": "plan-confirmado", "proyecto": p.code, "proyectoId": str(p.id)}
        for p in db.query(Project).filter(Project.operational_status == "Propuesta", Project.plan_confirmed.is_(True)).order_by(Project.code)
    ]
    activos = db.query(Project).filter(Project.operational_status == "En ejecución").all()
    presupuesto = sum(_f(p.assigned_budget) for p in activos)
    gasto = sum(_f(p.executed_budget) for p in activos)
    alertas = _alertas_inventario(db)
    return {
        "rol": "administrador",
        "nombre": _nombre_pila(u.full_name),
        "pendientes": pendientes,
        "contadores": {
            "proyectosActivos": len(activos),
            "ejecucionGlobal": round(gasto / presupuesto * 100) if presupuesto else 0,
            "alertasStock": len(alertas["bajo_minimo"]),
            "lotesPorVencer": len(alertas["por_vencer"]),
        },
        "actividad": _actividad(db),
        "prioridades": [
            {"id": str(p.id), "codigo": p.code, "nombre": p.title, "prioridad": p.priority_level}
            for p in sorted(activos, key=lambda p: (ORDEN_PRIORIDAD.get(p.priority_level, 9), p.code))[:4]
        ],
        "accesos": {
            "cuentasActivas": db.query(User).filter(User.is_active.is_(True)).count(),
            "anticipacionVencimiento": alertas["anticipacion"],
        },
    }


def _cargos_periodo(db: Session, periodo: AccountingPeriod, proyecto: Project) -> Dict[str, Any]:
    """Cargos directos del proyecto en el período (F7.1): el mismo cálculo que la pantalla de cierre (M7)."""
    from app.modulos.prorrateo.contrato import resumen_cargos
    return resumen_cargos(db, periodo, str(proyecto.id))


def inicio_coordinador(db: Session, u: User) -> Dict[str, Any]:
    mios = db.query(Project).filter(Project.coordinator_id == u.id).all()
    ids = [p.id for p in mios]
    por_id = {p.id: p for p in mios}
    periodo = periodo_en_curso(db)
    pendientes: List[Dict[str, Any]] = []

    if periodo and ids:
        for c in db.query(PeriodProjectConfirmation).filter(
            PeriodProjectConfirmation.period_id == periodo.id,
            PeriodProjectConfirmation.confirmed.is_(False),
            PeriodProjectConfirmation.project_id.in_(ids),
        ):
            p = por_id[c.project_id]
            pendientes.append({"clase": "confirmar-cargos", "proyecto": p.code, "proyectoId": str(p.id),
                               **_cargos_periodo(db, periodo, p),
                               "cierre": periodo.end_date.isoformat()})

    solicitudes_mias = (
        db.query(Solicitud).filter(Solicitud.project_id.in_(ids)).order_by(Solicitud.created_at.desc()).all() if ids else []
    )
    for s in solicitudes_mias:
        if s.status == "Rechazado" and _reciente(s.decided_at):
            decidio = db.query(User).filter(User.id == s.decided_by_user_id).first() if s.decided_by_user_id else None
            pendientes.append({"clase": "solicitud-rechazada", "solicitud": s.request_number, "solicitudId": str(s.id),
                               "decididaPor": decidio.full_name if decidio else "", "motivo": s.decision_reason or ""})

    ahora = datetime.now(timezone.utc)
    reservas = (
        db.query(EquipmentReservation)
        .filter(EquipmentReservation.project_id.in_(ids),
                EquipmentReservation.status.in_(["Pendiente de Aprobación", "Aprobado"]),
                EquipmentReservation.end_time >= ahora)
        .order_by(EquipmentReservation.start_time)
        .all() if ids else []
    )
    equipos = {e.id: e.name for e in db.query(Equipment).all()}
    for r in reservas:
        if r.status == "Aprobado" and _reciente(r.updated_at):
            pendientes.append({"clase": "reserva-aprobada", "reserva": str(r.id), "equipo": equipos.get(r.equipment_id, ""),
                               "proyecto": por_id[r.project_id].code, "proyectoId": str(r.project_id),
                               "inicio": iso(r.start_time), "fin": iso(r.end_time)})

    en_ejecucion = sorted(
        [p for p in mios if p.operational_status == "En ejecución"],
        key=lambda p: (ORDEN_PRIORIDAD.get(p.priority_level, 9), p.code),
    )
    return {
        "rol": "coordinador",
        "nombre": _nombre_pila(u.full_name),
        "cierrePeriodo": periodo.end_date.isoformat() if periodo else None,
        "pendientes": pendientes,
        "proyectos": [_resumen_proyecto(p) for p in en_ejecucion],
        "reservas": [
            {"id": str(r.id), "equipo": equipos.get(r.equipment_id, ""), "proyecto": por_id[r.project_id].code,
             "proyectoId": str(r.project_id), "inicio": iso(r.start_time), "fin": iso(r.end_time), "estado": ESTADO_RESERVA[r.status]}
            for r in reservas[:4]
        ],
        "solicitudes": [
            {"id": str(s.id), "numero": s.request_number, "tipo": TIPO_SOLICITUD.get(s.request_type, "gasto"), "descripcion": s.description or "",
             "monto": _f(s.estimated_amount) if s.request_type == "Gasto" else None, "estado": s.status}
            for s in solicitudes_mias[:4]
        ],
    }


def inicio_aprobador(db: Session, u: User) -> Dict[str, Any]:
    p = _pedidos_pendientes(db)
    proyectos = {x.id: x for x in db.query(Project).all()}
    equipos = {e.id: e.name for e in db.query(Equipment).all()}

    def prioridad(project_id) -> str:
        pr = proyectos.get(project_id)
        return pr.priority_level if pr else "Media"

    def codigo(project_id) -> str:
        pr = proyectos.get(project_id)
        return pr.code if pr else ""

    con_prioridad: List[Dict[str, Any]] = []
    for s in p["solicitudes"]:
        base = {"id": str(s.id), "numero": s.request_number, "proyecto": codigo(s.project_id), "proyectoId": str(s.project_id),
                "prioridad": prioridad(s.project_id),
                "fecha": iso(s.updated_at or s.created_at)}
        if s.request_type == "Retiro":
            con_prioridad.append({"clase": "retiro", **base, "items": len(s.items)})
        else:
            con_prioridad.append({"clase": "gasto", **base, "monto": _f(s.estimated_amount)})
    for r in p["reservas"]:
        con_prioridad.append({"clase": "reserva", "id": str(r.id), "proyecto": codigo(r.project_id),
                              "proyectoId": str(r.project_id),
                              "prioridad": prioridad(r.project_id), "equipo": equipos.get(r.equipment_id, ""),
                              "inicio": iso(r.start_time), "fin": iso(r.end_time), "fecha": iso(r.created_at)})
    for c in p["correcciones"]:
        d = db.query(Dispatch).filter(Dispatch.id == c.original_dispatch_id).first()
        con_prioridad.append({"clase": "correccion", "id": str(c.id), "proyecto": codigo(d.project_id) if d else "",
                              "proyectoId": str(d.project_id) if d else "",
                              "prioridad": prioridad(d.project_id) if d else "Media",
                              "despacho": d.dispatch_number if d else "",
                              "valorOriginal": str(_f(d.dispatched_quantity)) if d else "",
                              "valorNuevo": str(_f(c.correct_quantity)), "fecha": iso(c.created_at)})
    con_prioridad.sort(key=lambda x: (ORDEN_PRIORIDAD.get(x["prioridad"], 9), x["fecha"] or ""))

    reposiciones = []
    for s in p["reposiciones"]:
        item = s.items[0].item if s.items else None
        if item:
            reposiciones.append({"clase": "reposicion", "id": str(s.id), "numero": s.request_number, "insumo": item.name,
                                 "stock": _f(item.current_stock), "minimo": _f(item.min_stock), "unidad": item.unit_of_measure})
    bandeja = [*con_prioridad[:4], reposiciones[0]] if reposiciones else con_prioridad[:5]

    periodo = periodo_en_curso(db)
    confirmaciones = (
        db.query(PeriodProjectConfirmation).filter(PeriodProjectConfirmation.period_id == periodo.id).all() if periodo else []
    )
    a = _alertas_inventario(db)
    alertas = [
        *[{"clase": "bajo-minimo", "insumoId": str(i.id), "insumo": i.name, "stock": _f(i.current_stock),
           "minimo": _f(i.min_stock), "unidad": i.unit_of_measure} for i in a["bajo_minimo"][:2]],
        *[{"clase": "por-vencer", "insumoId": str(l.item_id), "insumo": l.item.name if l.item else "", "lote": l.batch_number,
           "vence": l.expiration_date.isoformat(), "dias": dias} for l, dias in a["por_vencer"][:1]],
        *[{"clase": "vencido", "insumoId": str(l.item_id), "insumo": l.item.name if l.item else "", "lote": l.batch_number,
           "vence": l.expiration_date.isoformat()} for l in a["vencidos"][:1]],
    ]
    despachos = _despachos_por_entregar(db)
    return {
        "rol": "aprobador",
        "nombre": _nombre_pila(u.full_name),
        "decisiones": sum(len(v) for v in p.values()),
        "contadores": {"solicitudes": len(p["solicitudes"]), "reservas": len(p["reservas"]),
                       "correcciones": len(p["correcciones"]), "despachos": len(despachos)},
        "bandeja": bandeja,
        "cierre": {"periodoId": str(periodo.id), "inicio": periodo.start_date.isoformat(),
                   "confirmados": sum(1 for c in confirmaciones if c.confirmed), "total": len(confirmaciones)} if periodo else None,
        "alertas": alertas,
        "despachos": [
            {"solicitud": s.request_number, "solicitudId": str(s.id), "proyecto": codigo(s.project_id), "proyectoId": str(s.project_id),
             "items": [ri.item.name for ri in s.items if ri.item]}
            for s in despachos
        ],
    }


@router.get("/inicio")
def inicio(db: Session = Depends(get_db), u: User = Depends(get_current_user)):
    if u.role == COORDINADOR:
        return inicio_coordinador(db, u)
    if u.role == APROBADOR:
        return inicio_aprobador(db, u)
    return inicio_administrador(db, u)


# =============================================================================
# Menú, avisos y período
# =============================================================================

@router.get("/navegacion/contadores", response_model=Dict[str, int])
def contadores(db: Session = Depends(get_db), u: User = Depends(get_current_user)):
    if u.role == APROBADOR:
        p = _pedidos_pendientes(db)
        por_ejecutar = len(_gastos_por_ejecutar(db))
        return {
            "bandeja": sum(len(v) for v in p.values()) + por_ejecutar,
            "bandejaPorEjecutar": por_ejecutar,
            "almacen": len(_despachos_por_entregar(db)),
        }
    if u.role == COORDINADOR:
        ids = [p.id for p in db.query(Project).filter(Project.coordinator_id == u.id)]
        rechazadas = [
            s for s in (db.query(Solicitud).filter(Solicitud.project_id.in_(ids), Solicitud.status == "Rechazado").all() if ids else [])
            if _reciente(s.decided_at)
        ]
        periodo = periodo_en_curso(db)
        cierre = (
            db.query(func.count(PeriodProjectConfirmation.id))
            .filter(PeriodProjectConfirmation.period_id == periodo.id, PeriodProjectConfirmation.confirmed.is_(False),
                    PeriodProjectConfirmation.project_id.in_(ids))
            .scalar() if periodo and ids else 0
        )
        return {"solicitudes": len(rechazadas), "cierre": cierre or 0}
    return {"proyectos": len(_proyectos_sin_coordinador(db))}


@router.get("/avisos")
def avisos(db: Session = Depends(get_db), u: User = Depends(get_current_user)) -> List[Dict[str, Any]]:
    """Los avisos de quien pide, del más reciente al más antiguo (los últimos 50)."""
    filas = (
        db.query(Notification)
        .filter(Notification.user_id == u.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {"id": str(a.id), "tipo": a.kind, "titulo": a.title, "detalle": a.detail, "enlace": a.link,
         "fecha": iso(a.created_at), "leido": a.is_read}
        for a in filas
    ]


@router.post("/avisos/leidos", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def marcar_todos_leidos(db: Session = Depends(get_db), u: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.user_id == u.id, Notification.is_read.is_(False)).update(
        {Notification.is_read: True}, synchronize_session=False
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/avisos/{aviso_id}/leido", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def marcar_leido(aviso_id: str, db: Session = Depends(get_db), u: User = Depends(get_current_user)):
    aviso = (
        db.query(Notification).filter(Notification.id == aviso_id, Notification.user_id == u.id).first()
        if es_id_valido(aviso_id, db) else None
    )
    if not aviso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ese aviso ya no existe.")
    aviso.is_read = True
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/periodos/actual")
def periodo_actual(db: Session = Depends(get_db), u: User = Depends(get_current_user)) -> Optional[Dict[str, Any]]:
    p = periodo_en_curso(db)
    if not p:
        return None
    return {
        "id": str(p.id),
        "tipo": (p.period_type or "").lower(),
        "inicio": p.start_date.isoformat(),
        "fin": p.end_date.isoformat(),
        "estado": ESTADO_PERIODO.get(p.status, p.status),
    }
