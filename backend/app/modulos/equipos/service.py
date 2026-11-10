"""Service layer for Module 4: Equipment and Reservations (F4.1 to F4.6, RN-03, RN-07)."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Tuple, Dict, Any

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.auditoria.service import record_audit_log
from app.avisos.service import avisar, avisar_a, ids_por_rol
from app.modulos.usuarios.models import (
    User,
    Location,
    Project,
    Equipment,
    EquipmentReservation,
    EquipmentUsage,
)
from app.modulos.equipos.schemas import (
    EquipmentCreate,
    EquipmentUpdate,
    EquipmentStatusUpdate,
    EquipmentResponse,
    EquipmentDetailResponse,
    EquipmentStatusChangeResponse,
    ReservationCreate,
    ReservationResponse,
    ReservationDecisionRequest,
    CalendarResponse,
    CalendarConflict,
    UsageCreate,
    UsageResponse,
    UserSummary,
    LocationSummary,
    ProjectSummary,
)


# =============================================================================
# Helpers
# =============================================================================

def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_equipment_or_404(db: Session, equipment_id: str) -> Equipment:
    equipment = (
        db.query(Equipment)
        .options(joinedload(Equipment.location))
        .filter(Equipment.id == equipment_id)
        .first()
    )
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipo no encontrado.",
        )
    return equipment


def _get_reservation_or_404(db: Session, reservation_id: str) -> EquipmentReservation:
    reservation = (
        db.query(EquipmentReservation)
        .options(
            joinedload(EquipmentReservation.equipment).joinedload(Equipment.location),
            joinedload(EquipmentReservation.project),
            joinedload(EquipmentReservation.reserved_by),
            joinedload(EquipmentReservation.approved_by),
        )
        .filter(EquipmentReservation.id == reservation_id)
        .first()
    )
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reserva no encontrada.",
        )
    return reservation


def _get_project_or_404(db: Session, project_id: str) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proyecto no encontrado.",
        )
    return project


def _assert_coordinator_owns_project(project: Project, current_user: User) -> None:
    if current_user.role != "Coordinador de Proyecto":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el coordinador asignado puede realizar esta acción.",
        )
    if project.coordinator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No es el coordinador asignado a este proyecto.",
        )
    if project.operational_status == "Finalizado":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El proyecto está finalizado y no admite reservas ni usos nuevos.",
        )


def _assert_equipment_available(equipment: Equipment) -> None:
    if equipment.operational_status == "En mantenimiento":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El equipo está En mantenimiento y no admite reservas ni usos.",
        )


def _validate_active_location(db: Session, location_id: str) -> Location:
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La ubicación no existe.",
        )
    if not location.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La ubicación está desactivada. Elija una ubicación activa.",
        )
    return location


# =============================================================================
# Overlap detection (F4.4, D17, D19)
# =============================================================================

def _blocking_reservations_query(db: Session, equipment_id: str):
    return db.query(EquipmentReservation).filter(
        EquipmentReservation.equipment_id == equipment_id,
        EquipmentReservation.status.in_(["Pendiente de Aprobación", "Aprobado"]),
    )


def _find_overlapping_reservations(
    db: Session,
    equipment_id: str,
    start: datetime,
    end: datetime,
    exclude_reservation_id: Optional[str] = None,
) -> List[EquipmentReservation]:
    query = _blocking_reservations_query(db, equipment_id).filter(
        EquipmentReservation.start_time < end,
        EquipmentReservation.end_time > start,
    )
    if exclude_reservation_id:
        query = query.filter(EquipmentReservation.id != exclude_reservation_id)
    return query.order_by(EquipmentReservation.start_time.asc()).all()


def _build_overlap_error(
    overlapping: List[EquipmentReservation],
    desired_start: datetime,
    desired_end: datetime,
) -> HTTPException:
    first = overlapping[0]
    conflict = CalendarConflict(
        reservation_id=first.id,
        project=ProjectSummary(
            id=first.project.id,
            code=first.project.code,
            title=first.project.title,
        ),
        start_time=first.start_time,
        end_time=first.end_time,
        status=first.status,
    )

    # Nearest free slot before the requested range: end of the last blocking
    # reservation that finishes before desired_start.
    before_candidates = [r for r in overlapping if r.end_time <= desired_start]
    next_free_before = (
        max((r.end_time for r in before_candidates), default=None)
    )

    # Nearest free slot after the requested range: start of the first blocking
    # reservation that begins after desired_end.
    after_candidates = [r for r in overlapping if r.start_time >= desired_end]
    next_free_after = (
        min((r.start_time for r in after_candidates), default=None)
    )

    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "message": "El horario se cruza con una reserva existente del mismo equipo.",
            "conflict": conflict.model_dump(mode="json"),
            "next_free_before": next_free_before.isoformat() if next_free_before else None,
            "next_free_after": next_free_after.isoformat() if next_free_after else None,
            "occupied_ranges": [
                CalendarConflict(
                    reservation_id=r.id,
                    project=ProjectSummary(
                        id=r.project.id,
                        code=r.project.code,
                        title=r.project.title,
                    ),
                    start_time=r.start_time,
                    end_time=r.end_time,
                    status=r.status,
                ).model_dump(mode="json")
                for r in overlapping
            ],
        },
    )


def _assert_no_overlap(
    db: Session,
    equipment_id: str,
    start: datetime,
    end: datetime,
    exclude_reservation_id: Optional[str] = None,
) -> None:
    overlapping = _find_overlapping_reservations(
        db, equipment_id, start, end, exclude_reservation_id
    )
    if overlapping:
        raise _build_overlap_error(overlapping, start, end)


# =============================================================================
# Builders
# =============================================================================

def _build_equipment_response(equipment: Equipment) -> EquipmentResponse:
    return EquipmentResponse(
        id=equipment.id,
        asset_code=equipment.asset_code,
        name=equipment.name,
        location=LocationSummary(
            id=equipment.location.id,
            name=equipment.location.name,
        ) if equipment.location else None,
        operational_status=equipment.operational_status,
        description=equipment.description,
        created_at=equipment.created_at,
        updated_at=equipment.updated_at,
    )


def _build_reservation_response(
    reservation: EquipmentReservation,
) -> ReservationResponse:
    return ReservationResponse(
        id=reservation.id,
        equipment=_build_equipment_response(reservation.equipment),
        project=ProjectSummary(
            id=reservation.project.id,
            code=reservation.project.code,
            title=reservation.project.title,
        ),
        reserved_by=UserSummary(
            id=reservation.reserved_by.id,
            full_name=reservation.reserved_by.full_name,
            email=reservation.reserved_by.email,
        ),
        approved_by=UserSummary(
            id=reservation.approved_by.id,
            full_name=reservation.approved_by.full_name,
            email=reservation.approved_by.email,
        ) if reservation.approved_by else None,
        start_time=reservation.start_time,
        end_time=reservation.end_time,
        status=reservation.status,
        notes=reservation.notes,
        created_at=reservation.created_at,
        updated_at=reservation.updated_at,
    )


def _build_usage_response(usage: EquipmentUsage) -> UsageResponse:
    return UsageResponse(
        id=usage.id,
        equipment_id=usage.equipment_id,
        project=ProjectSummary(
            id=usage.project.id,
            code=usage.project.code,
            title=usage.project.title,
        ),
        reservation_id=usage.reservation_id,
        registered_by=UserSummary(
            id=usage.registered_by.id,
            full_name=usage.registered_by.full_name,
            email=usage.registered_by.email,
        ),
        start_time=usage.start_time,
        end_time=usage.end_time,
        used_hours=usage.used_hours,
        observations=usage.observations,
        created_at=usage.created_at,
    )


# =============================================================================
# Equipment catalog (F4.1, F4.2)
# =============================================================================

def list_equipments(
    db: Session,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    location_id: Optional[str] = None,
) -> List[EquipmentResponse]:
    query = db.query(Equipment).options(joinedload(Equipment.location))

    if search:
        s = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Equipment.asset_code).like(s),
                func.lower(Equipment.name).like(s),
            )
        )
    if status_filter and status_filter != "Todos":
        query = query.filter(Equipment.operational_status == status_filter)
    if location_id and location_id != "Todas":
        query = query.filter(Equipment.location_id == location_id)

    equipments = query.order_by(Equipment.asset_code.asc()).all()
    return [_build_equipment_response(e) for e in equipments]


def create_equipment(
    db: Session,
    payload: EquipmentCreate,
    current_user: User,
    ip_address: str,
) -> EquipmentResponse:
    existing = (
        db.query(Equipment)
        .filter(func.lower(Equipment.asset_code) == payload.asset_code.lower())
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un equipo con el código de activo '{existing.asset_code}'.",
        )

    _validate_active_location(db, payload.location_id)

    equipment = Equipment(
        id=str(uuid.uuid4()),
        asset_code=payload.asset_code,
        name=payload.name,
        location_id=payload.location_id,
        operational_status="Disponible",
        description=payload.description,
    )
    db.add(equipment)
    db.flush()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"EQUIPMENT:{equipment.asset_code}",
        action_type="EQUIPMENT_CREATE",
        old_value=None,
        new_value={
            "id": equipment.id,
            "asset_code": equipment.asset_code,
            "name": equipment.name,
            "location_id": equipment.location_id,
            "operational_status": equipment.operational_status,
        },
        target_table="equipments",
        target_id=equipment.id,
        justification="Registro de equipo en catálogo de activos (F4.1)",
    )

    db.commit()
    db.refresh(equipment)
    return _build_equipment_response(equipment)


def get_equipment_detail(
    db: Session,
    equipment_id: str,
) -> EquipmentDetailResponse:
    equipment = _get_equipment_or_404(db, equipment_id)

    active_res_count = (
        db.query(func.count(EquipmentReservation.id))
        .filter(
            EquipmentReservation.equipment_id == equipment_id,
            EquipmentReservation.status.in_(["Pendiente de Aprobación", "Aprobado"]),
        )
        .scalar()
        or 0
    )
    total_usages = (
        db.query(func.count(EquipmentUsage.id))
        .filter(EquipmentUsage.equipment_id == equipment_id)
        .scalar()
        or 0
    )

    base = _build_equipment_response(equipment)
    return EquipmentDetailResponse(
        **base.model_dump(),
        active_reservations_count=int(active_res_count),
        total_usages=int(total_usages),
    )


def update_equipment(
    db: Session,
    equipment_id: str,
    payload: EquipmentUpdate,
    current_user: User,
    ip_address: str,
) -> EquipmentResponse:
    equipment = _get_equipment_or_404(db, equipment_id)

    old_state = {
        "name": equipment.name,
        "location_id": equipment.location_id,
        "description": equipment.description,
    }

    if payload.name is not None:
        equipment.name = payload.name
    if payload.location_id is not None:
        _validate_active_location(db, payload.location_id)
        equipment.location_id = payload.location_id
    if payload.description is not None:
        equipment.description = payload.description

    equipment.updated_at = _now()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"EQUIPMENT:{equipment.asset_code}",
        action_type="EQUIPMENT_UPDATE",
        old_value=old_state,
        new_value={
            "name": equipment.name,
            "location_id": equipment.location_id,
            "description": equipment.description,
        },
        target_table="equipments",
        target_id=equipment.id,
        justification="Actualización de datos del equipo (F4.1)",
    )

    db.commit()
    db.refresh(equipment)
    return _build_equipment_response(equipment)


def _cancel_future_blocking_reservations(
    db: Session,
    equipment: Equipment,
    current_user: User,
    ip_address: str,
    reason: str,
) -> List[EquipmentReservation]:
    """D21: cancel future Pendiente/Aprobado reservations when equipment goes to maintenance."""
    now = _now()
    reservations = (
        db.query(EquipmentReservation)
        .options(
            joinedload(EquipmentReservation.equipment).joinedload(Equipment.location),
            joinedload(EquipmentReservation.project),
            joinedload(EquipmentReservation.reserved_by),
            joinedload(EquipmentReservation.approved_by),
        )
        .filter(
            EquipmentReservation.equipment_id == equipment.id,
            EquipmentReservation.status.in_(["Pendiente de Aprobación", "Aprobado"]),
            EquipmentReservation.start_time > now,
        )
        .all()
    )

    for reservation in reservations:
        old_status = reservation.status
        reservation.status = "Cancelado"
        reservation.updated_at = now
        avisar(db, reservation.reserved_by_user_id, "warn",
               f"Se canceló tu reserva de {reservation.equipment.name}", "/reservas",
               detalle="El equipo pasó a mantenimiento. Elige otro horario o equipo.")
        record_audit_log(
            db=db,
            user_id=current_user.id,
            ip_address=ip_address,
            target_object=f"RESERVATION:{reservation.id}",
            action_type="RESERVATION_CANCELLED_MAINTENANCE",
            old_value={"status": old_status},
            new_value={
                "status": "Cancelado",
                "equipment_id": equipment.id,
                "reason": reason,
            },
            target_table="equipment_reservations",
            target_id=reservation.id,
            justification=reason,
        )

    return reservations


def change_equipment_status(
    db: Session,
    equipment_id: str,
    payload: EquipmentStatusUpdate,
    current_user: User,
    ip_address: str,
) -> EquipmentStatusChangeResponse:
    equipment = _get_equipment_or_404(db, equipment_id)
    old_status = equipment.operational_status
    new_status = payload.status

    if old_status == new_status:
        return EquipmentStatusChangeResponse(
            equipment=_build_equipment_response(equipment),
            cancelled_reservations=[],
            warning_message=None,
        )

    if new_status == "En mantenimiento" and old_status == "En uso":
        # Con opción B, "En uso" no se activa automáticamente. Si por datos
        # heredados está en ese estado, se permite el paso a mantenimiento.
        pass

    equipment.operational_status = new_status
    equipment.updated_at = _now()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"EQUIPMENT:{equipment.asset_code}",
        action_type="EQUIPMENT_STATUS_CHANGE",
        old_value={"operational_status": old_status},
        new_value={"operational_status": new_status},
        target_table="equipments",
        target_id=equipment.id,
        justification=f"Cambio de estado operacional (F4.2): {old_status} -> {new_status}",
    )

    cancelled: List[EquipmentReservation] = []
    warning_message: Optional[str] = None

    if new_status == "En mantenimiento":
        cancelled = _cancel_future_blocking_reservations(
            db=db,
            equipment=equipment,
            current_user=current_user,
            ip_address=ip_address,
            reason="Equipo enviado a mantenimiento; reserva futura cancelada automáticamente (F4.2).",
        )
        if cancelled:
            warning_message = (
                f"Se cancelaron automáticamente {len(cancelled)} reserva(s) futura(s) "
                f"del equipo '{equipment.asset_code}' por el paso a mantenimiento."
            )

    db.commit()
    db.refresh(equipment)

    return EquipmentStatusChangeResponse(
        equipment=_build_equipment_response(equipment),
        cancelled_reservations=[_build_reservation_response(r) for r in cancelled],
        warning_message=warning_message,
    )


# =============================================================================
# Reservations (F4.3, F4.4, F4.5)
# =============================================================================

def list_equipment_reservations(
    db: Session,
    equipment_id: str,
    current_user: User,
    status_filter: Optional[str] = None,
) -> List[ReservationResponse]:
    _get_equipment_or_404(db, equipment_id)

    query = (
        db.query(EquipmentReservation)
        .options(
            joinedload(EquipmentReservation.equipment).joinedload(Equipment.location),
            joinedload(EquipmentReservation.project),
            joinedload(EquipmentReservation.reserved_by),
            joinedload(EquipmentReservation.approved_by),
        )
        .filter(EquipmentReservation.equipment_id == equipment_id)
    )

    if current_user.role == "Coordinador de Proyecto":
        # RN-07: el coordinador solo ve las reservas de sus proyectos
        query = query.join(Project).filter(Project.coordinator_id == current_user.id)

    if status_filter and status_filter != "Todos":
        query = query.filter(EquipmentReservation.status == status_filter)

    reservations = query.order_by(EquipmentReservation.start_time.asc()).all()
    return [_build_reservation_response(r) for r in reservations]


def get_equipment_calendar(
    db: Session,
    equipment_id: str,
) -> CalendarResponse:
    _get_equipment_or_404(db, equipment_id)

    occupied = (
        _blocking_reservations_query(db, equipment_id)
        .options(
            joinedload(EquipmentReservation.project),
        )
        .order_by(EquipmentReservation.start_time.asc())
        .all()
    )

    conflicts = [
        CalendarConflict(
            reservation_id=r.id,
            project=ProjectSummary(
                id=r.project.id,
                code=r.project.code,
                title=r.project.title,
            ),
            start_time=r.start_time,
            end_time=r.end_time,
            status=r.status,
        )
        for r in occupied
    ]

    return CalendarResponse(
        equipment_id=equipment_id,
        occupied_ranges=conflicts,
        next_free_before=None,
        next_free_after=None,
    )


def create_reservation(
    db: Session,
    equipment_id: str,
    payload: ReservationCreate,
    current_user: User,
    ip_address: str,
) -> ReservationResponse:
    equipment = _get_equipment_or_404(db, equipment_id)
    _assert_equipment_available(equipment)

    project = _get_project_or_404(db, payload.project_id)
    _assert_coordinator_owns_project(project, current_user)

    if payload.start_time <= _now():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La reserva debe comenzar en el futuro.",
        )

    _assert_no_overlap(db, equipment_id, payload.start_time, payload.end_time)

    reservation = EquipmentReservation(
        id=str(uuid.uuid4()),
        equipment_id=equipment_id,
        project_id=project.id,
        reserved_by_user_id=current_user.id,
        approved_by_user_id=None,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status="Borrador",
        notes=payload.notes,
    )
    db.add(reservation)
    db.flush()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"RESERVATION:{reservation.id}",
        action_type="RESERVATION_CREATE",
        old_value=None,
        new_value={
            "id": reservation.id,
            "equipment_id": equipment_id,
            "project_id": project.id,
            "start_time": reservation.start_time.isoformat(),
            "end_time": reservation.end_time.isoformat(),
            "status": reservation.status,
        },
        target_table="equipment_reservations",
        target_id=reservation.id,
        justification="Creación de borrador de reserva de equipo (F4.3)",
    )

    db.commit()
    db.refresh(reservation)
    return _build_reservation_response(reservation)


def submit_reservation(
    db: Session,
    reservation_id: str,
    current_user: User,
    ip_address: str,
) -> ReservationResponse:
    reservation = _get_reservation_or_404(db, reservation_id)

    if reservation.status != "Borrador":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La reserva está en estado '{reservation.status}' y no puede enviarse.",
        )

    if reservation.reserved_by_user_id != current_user.id and current_user.role != "Administrador del Sistema":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el autor de la reserva puede enviarla a aprobación.",
        )

    _assert_equipment_available(reservation.equipment)
    _assert_no_overlap(
        db,
        reservation.equipment_id,
        reservation.start_time,
        reservation.end_time,
        exclude_reservation_id=reservation.id,
    )

    old_status = reservation.status
    reservation.status = "Pendiente de Aprobación"
    reservation.updated_at = _now()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"RESERVATION:{reservation.id}",
        action_type="RESERVATION_SUBMIT",
        old_value={"status": old_status},
        new_value={"status": reservation.status},
        target_table="equipment_reservations",
        target_id=reservation.id,
        justification="Envío de reserva a aprobación (F4.3, RN-03)",
    )

    db.commit()
    db.refresh(reservation)
    return _build_reservation_response(reservation)


def approve_reservation(
    db: Session,
    reservation_id: str,
    payload: ReservationDecisionRequest,
    current_user: User,
    ip_address: str,
) -> ReservationResponse:
    reservation = _get_reservation_or_404(db, reservation_id)

    if reservation.status != "Pendiente de Aprobación":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Solo se pueden aprobar reservas Pendientes. Estado actual: '{reservation.status}'.",
        )

    _assert_equipment_available(reservation.equipment)
    _assert_no_overlap(
        db,
        reservation.equipment_id,
        reservation.start_time,
        reservation.end_time,
        exclude_reservation_id=reservation.id,
    )

    old_status = reservation.status
    reservation.status = "Aprobado"
    reservation.approved_by_user_id = current_user.id
    avisar(db, reservation.reserved_by_user_id, "ok",
           f"Aprobaron tu reserva de {reservation.equipment.name}", "/reservas", detalle=payload.reason)
    reservation.updated_at = _now()
    if payload.reason:
        reservation.notes = (reservation.notes or "") + f"\n[Aprobación] {payload.reason}"

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"RESERVATION:{reservation.id}",
        action_type="RESERVATION_APPROVE",
        old_value={"status": old_status},
        new_value={"status": reservation.status, "reason": payload.reason},
        target_table="equipment_reservations",
        target_id=reservation.id,
        justification="Aprobación de reserva de equipo (F4.5)",
    )

    db.commit()
    db.refresh(reservation)
    return _build_reservation_response(reservation)


def reject_reservation(
    db: Session,
    reservation_id: str,
    payload: ReservationDecisionRequest,
    current_user: User,
    ip_address: str,
) -> ReservationResponse:
    reservation = _get_reservation_or_404(db, reservation_id)

    if reservation.status != "Pendiente de Aprobación":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Solo se pueden rechazar reservas Pendientes. Estado actual: '{reservation.status}'.",
        )

    old_status = reservation.status
    reservation.status = "Rechazado"
    reservation.approved_by_user_id = current_user.id
    avisar(db, reservation.reserved_by_user_id, "err",
           f"Rechazaron tu reserva de {reservation.equipment.name}", "/reservas", detalle=payload.reason)
    reservation.updated_at = _now()
    if payload.reason:
        reservation.notes = (reservation.notes or "") + f"\n[Rechazo] {payload.reason}"

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"RESERVATION:{reservation.id}",
        action_type="RESERVATION_REJECT",
        old_value={"status": old_status},
        new_value={"status": reservation.status, "reason": payload.reason},
        target_table="equipment_reservations",
        target_id=reservation.id,
        justification="Rechazo de reserva de equipo (F4.5)",
    )

    db.commit()
    db.refresh(reservation)
    return _build_reservation_response(reservation)


# =============================================================================
# Equipment usage (F4.6, D25, D26)
# =============================================================================

def list_equipment_usages(
    db: Session,
    equipment_id: str,
    current_user: User,
) -> List[UsageResponse]:
    _get_equipment_or_404(db, equipment_id)

    query = (
        db.query(EquipmentUsage)
        .options(
            joinedload(EquipmentUsage.project),
            joinedload(EquipmentUsage.registered_by),
        )
        .filter(EquipmentUsage.equipment_id == equipment_id)
    )

    if current_user.role == "Coordinador de Proyecto":
        query = query.join(Project).filter(Project.coordinator_id == current_user.id)

    usages = query.order_by(EquipmentUsage.start_time.desc()).all()
    return [_build_usage_response(u) for u in usages]


def register_usage(
    db: Session,
    equipment_id: str,
    payload: UsageCreate,
    current_user: User,
    ip_address: str,
) -> UsageResponse:
    equipment = _get_equipment_or_404(db, equipment_id)
    _assert_equipment_available(equipment)

    project = _get_project_or_404(db, payload.project_id)
    _assert_coordinator_owns_project(project, current_user)

    reservation = None
    if payload.reservation_id:
        reservation = _get_reservation_or_404(db, payload.reservation_id)
        if reservation.equipment_id != equipment.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La reserva no pertenece a este equipo.",
            )
        if reservation.project_id != project.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La reserva no pertenece a este proyecto.",
            )
        if reservation.status != "Aprobado":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Solo se puede asociar una reserva en estado 'Aprobado'.",
            )
        # D26: el uso debe estar contenido dentro del rango de la reserva
        if payload.start_time < reservation.start_time or payload.end_time > reservation.end_time:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "El rango de uso debe estar contenido dentro del rango de la reserva "
                    f"({reservation.start_time.isoformat()} — {reservation.end_time.isoformat()})."
                ),
            )

    delta_seconds = (payload.end_time - payload.start_time).total_seconds()
    used_hours = _round2(Decimal(delta_seconds) / Decimal("3600"))

    usage = EquipmentUsage(
        id=str(uuid.uuid4()),
        equipment_id=equipment.id,
        project_id=project.id,
        reservation_id=reservation.id if reservation else None,
        registered_by_user_id=current_user.id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        used_hours=used_hours,
        observations=payload.observations,
    )
    db.add(usage)
    db.flush()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"EQUIPMENT_USAGE:{usage.id}",
        action_type="EQUIPMENT_USAGE_CREATE",
        old_value=None,
        new_value={
            "id": usage.id,
            "equipment_id": equipment.id,
            "project_id": project.id,
            "reservation_id": usage.reservation_id,
            "start_time": usage.start_time.isoformat(),
            "end_time": usage.end_time.isoformat(),
            "used_hours": str(usage.used_hours),
        },
        target_table="equipment_usages",
        target_id=usage.id,
        justification="Registro de uso de equipo (F4.6)",
    )

    db.commit()
    db.refresh(usage)
    return _build_usage_response(usage)