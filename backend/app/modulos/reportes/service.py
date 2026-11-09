"""Service layer for Module 8: Reports (F8.1 to F8.4)."""

import io
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.auditoria.models import AuditLog
from app.modulos.usuarios.models import (
    User,
    Project,
    Item,
    Batch,
    Dispatch,
    Request,
    Equipment,
    EquipmentUsage,
    EquipmentReservation,
    AccountingPeriod,
    OverheadAllocation,
    SystemParameter,
)
from app.modulos.proyectos.service import recalculate_project_metrics
from app.modulos.reportes.schemas import (
    DashboardResponse,
    DashboardProjectItem,
    LowStockAlertItem,
    NearExpiryAlertItem,
)


# =============================================================================
# Helpers
# =============================================================================

def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _fmt_currency(value: Any) -> str:
    return f"{float(value):,.2f}"


def _fmt_decimal(value: Any, decimals: int = 2) -> str:
    return f"{float(value):,.{decimals}f}"


def _now_date() -> date:
    return datetime.now(timezone.utc).date()


def _filename(prefix: str, ext: str) -> str:
    return f"{prefix}_{_now_date().isoformat()}.{ext}"


def _get_int_param(db: Session, key: str, default: int) -> int:
    param = db.query(SystemParameter).filter(SystemParameter.parameter_key == key).first()
    if param and param.parameter_value is not None and param.parameter_value > 0:
        return int(param.parameter_value)
    return default


def _resolve_date_range(
    db: Session,
    periodo_id: Optional[str],
    fecha_inicio: Optional[date],
    fecha_fin: Optional[date],
) -> Tuple[date, date, Optional[AccountingPeriod]]:
    if periodo_id:
        period = db.query(AccountingPeriod).filter(AccountingPeriod.id == periodo_id).first()
        if not period:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Período contable no encontrado.")
        return period.start_date, period.end_date, period

    if not fecha_inicio or not fecha_fin:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debe indicar 'periodo_id' o el par 'fecha_inicio' y 'fecha_fin'.",
        )
    if fecha_inicio > fecha_fin:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La fecha de inicio debe ser anterior o igual a la fecha de fin.",
        )
    return fecha_inicio, fecha_fin, None


def _filter_subtitle(
    period: Optional[AccountingPeriod],
    start_date: date,
    end_date: date,
) -> str:
    if period:
        return (
            f"Período: {period.period_name} "
            f"({start_date.strftime('%d/%m/%Y')} — {end_date.strftime('%d/%m/%Y')})"
        )
    return f"Período: {start_date.strftime('%d/%m/%Y')} — {end_date.strftime('%d/%m/%Y')}"


# =============================================================================
# PDF generation
# =============================================================================

def _pdf_table(headers: List[str], rows: List[List[str]]) -> Table:
    data = [headers] + rows
    table = Table(data, repeatRows=1)
    table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3F4A5A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CCCCCC")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F5F5")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ])
    )
    return table


def _render_pdf(title: str, sections: List[Dict[str, Any]]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )
    styles = getSampleStyleSheet()
    story: List[Any] = [Paragraph(title, styles["Title"]), Spacer(1, 6 * mm)]

    for sec in sections:
        if sec.get("subtitle"):
            story.append(Paragraph(sec["subtitle"], styles["Heading2"]))
            story.append(Spacer(1, 2 * mm))
        if not sec.get("rows"):
            story.append(Paragraph("Sin datos para los filtros aplicados.", styles["Normal"]))
        else:
            story.append(_pdf_table(sec["headers"], sec["rows"]))
        story.append(Spacer(1, 6 * mm))

    doc.build(story)
    return buf.getvalue()


# =============================================================================
# Excel generation
# =============================================================================

def _render_excel(title: str, sections: List[Dict[str, Any]]) -> bytes:
    wb = Workbook()
    first = True
    for idx, sec in enumerate(sections):
        sheet_name = (sec.get("sheet_name") or f"Hoja{idx + 1}")[:31]
        if first:
            ws = wb.active
            ws.title = sheet_name
            first = False
        else:
            ws = wb.create_sheet(sheet_name)

        ws["A1"] = title
        ws["A1"].font = Font(bold=True, size=14)
        ws["A2"] = sec.get("subtitle", "")
        ws["A2"].font = Font(bold=True, size=11)

        headers = sec["headers"]
        rows = sec.get("rows", [])

        header_fill = PatternFill(start_color="3F4A5A", end_color="3F4A5A", fill_type="solid")
        for col_idx, header in enumerate(headers, start=1):
            cell = ws.cell(row=3, column=col_idx, value=header)
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = header_fill

        for row_idx, row in enumerate(rows, start=4):
            for col_idx, value in enumerate(row, start=1):
                ws.cell(row=row_idx, column=col_idx, value=value)

        for col_idx, header in enumerate(headers, start=1):
            letter = get_column_letter(col_idx)
            max_len = len(str(header))
            for row in rows:
                if col_idx - 1 < len(row):
                    max_len = max(max_len, len(str(row[col_idx - 1])))
            ws.column_dimensions[letter].width = min(max_len + 2, 60)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# =============================================================================
# F8.1 Dashboard
# =============================================================================

def get_dashboard(db: Session) -> DashboardResponse:
    active_projects = (
        db.query(Project)
        .filter(Project.operational_status == "En ejecución")
        .order_by(Project.code.asc())
        .all()
    )

    items: List[DashboardProjectItem] = []
    total_assigned = Decimal("0.00")
    total_executed = Decimal("0.00")

    for project in active_projects:
        _, metrics = recalculate_project_metrics(db, project.id, commit=False)
        assigned = Decimal(str(project.assigned_budget or 0))
        executed = Decimal(str(metrics["executed_budget"]))
        total_assigned += assigned
        total_executed += executed
        items.append(
            DashboardProjectItem(
                id=project.id,
                code=project.code,
                title=project.title,
                priority=project.priority_level,
                assigned_budget=assigned,
                executed_budget=executed,
                execution_pct=metrics["execution_pct"],
                physical_progress_pct=metrics["physical_progress_pct"],
                physical_progress_available=metrics["physical_progress_available"],
            )
        )

    global_pct = (
        _round2((total_executed / total_assigned) * Decimal("100"))
        if total_assigned > 0
        else Decimal("0.00")
    )

    low_stock_items = (
        db.query(Item)
        .filter(
            Item.is_active == True,
            Item.min_stock > 0,
            Item.current_stock < Item.min_stock,
        )
        .order_by(Item.name.asc())
        .all()
    )
    low_alerts = [
        LowStockAlertItem(
            item_id=item.id,
            item_name=item.name,
            unit_of_measure=item.unit_of_measure,
            current_stock=item.current_stock,
            min_stock=item.min_stock,
        )
        for item in low_stock_items
    ]

    alert_days = _get_int_param(db, "batch_expiration_alert_days", 30)
    today = _now_date()
    threshold = today + timedelta(days=alert_days)

    batches = (
        db.query(Batch)
        .options(joinedload(Batch.item))
        .filter(
            Batch.available_quantity > 0,
            Batch.expiration_date != None,
        )
        .all()
    )

    near_alerts: List[NearExpiryAlertItem] = []
    for batch in batches:
        if batch.expiration_date < today:
            label = "Vencido"
            days_remaining = (batch.expiration_date - today).days
        elif batch.expiration_date <= threshold:
            label = "Próximo a vencer"
            days_remaining = (batch.expiration_date - today).days
        else:
            continue
        near_alerts.append(
            NearExpiryAlertItem(
                batch_id=batch.id,
                batch_number=batch.batch_number,
                item_id=batch.item_id,
                item_name=batch.item.name if batch.item else "—",
                expiration_date=batch.expiration_date,
                days_remaining=days_remaining,
                status=label,
            )
        )
    near_alerts.sort(key=lambda x: x.expiration_date)

    return DashboardResponse(
        active_projects_count=len(active_projects),
        global_assigned_budget=_round2(total_assigned),
        global_executed_budget=_round2(total_executed),
        global_execution_pct=global_pct,
        active_projects=items,
        low_stock_alerts=low_alerts,
        near_expiry_alerts=near_alerts,
    )


# =============================================================================
# F8.2 Expenses report
# =============================================================================

def build_expenses_report(
    db: Session,
    current_user: User,
    periodo_id: Optional[str],
    fecha_inicio: Optional[date],
    fecha_fin: Optional[date],
    proyecto_ids: Optional[List[str]],
    formato: str,
) -> Tuple[bytes, str, str]:
    start_date, end_date, period = _resolve_date_range(db, periodo_id, fecha_inicio, fecha_fin)

    query = db.query(Project)
    if current_user.role == "Coordinador de Proyecto":
        query = query.filter(Project.coordinator_id == current_user.id)
    if proyecto_ids:
        query = query.filter(Project.id.in_(proyecto_ids))
    projects = query.order_by(Project.code.asc()).all()

    if not projects:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El filtro no produjo datos para exportar.",
        )

    rows: List[List[str]] = []
    grand_gastos = Decimal("0.00")
    grand_despachos = Decimal("0.00")
    grand_overhead = Decimal("0.00")
    grand_total = Decimal("0.00")
    has_data = False

    for project in projects:
        gastos = (
            db.query(func.coalesce(func.sum(Request.actual_amount), 0))
            .filter(
                Request.project_id == project.id,
                Request.request_type.in_(["Gasto", "Reposición automática"]),
                Request.status == "Ejecutado",
                func.date(Request.updated_at) >= start_date,
                func.date(Request.updated_at) <= end_date,
            )
            .scalar()
            or Decimal("0.00")
        )
        despachos = (
            db.query(
                func.coalesce(
                    func.sum(Dispatch.dispatched_quantity * Dispatch.unit_cost_snapshot), 0
                )
            )
            .filter(
                Dispatch.project_id == project.id,
                func.date(Dispatch.dispatched_at) >= start_date,
                func.date(Dispatch.dispatched_at) <= end_date,
            )
            .scalar()
            or Decimal("0.00")
        )
        if period:
            overhead = (
                db.query(func.coalesce(func.sum(OverheadAllocation.allocated_amount), 0))
                .filter(
                    OverheadAllocation.project_id == project.id,
                    OverheadAllocation.period_id == period.id,
                )
                .scalar()
                or Decimal("0.00")
            )
        else:
            overhead = (
                db.query(func.coalesce(func.sum(OverheadAllocation.allocated_amount), 0))
                .filter(
                    OverheadAllocation.project_id == project.id,
                    func.date(OverheadAllocation.applied_at) >= start_date,
                    func.date(OverheadAllocation.applied_at) <= end_date,
                )
                .scalar()
                or Decimal("0.00")
            )

        g = Decimal(str(gastos))
        d = Decimal(str(despachos))
        o = Decimal(str(overhead))
        if g > 0 or d > 0 or o > 0:
            has_data = True

        total = g + d + o
        grand_gastos += g
        grand_despachos += d
        grand_overhead += o
        grand_total += total

        rows.append(
            [
                project.code,
                project.title,
                _fmt_currency(g),
                _fmt_currency(d),
                _fmt_currency(o),
                _fmt_currency(total),
            ]
        )

    if not has_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El filtro no produjo datos para exportar.",
        )

    rows.append(
        [
            "",
            "TOTAL",
            _fmt_currency(grand_gastos),
            _fmt_currency(grand_despachos),
            _fmt_currency(grand_overhead),
            _fmt_currency(grand_total),
        ]
    )

    headers = [
        "Código",
        "Proyecto",
        "Gastos ejecutados",
        "Despachos valorizados",
        "Overhead prorrateado",
        "Total",
    ]
    subtitle = _filter_subtitle(period, start_date, end_date)
    sections = [
        {
            "subtitle": subtitle,
            "headers": headers,
            "rows": rows,
            "sheet_name": "Análisis de gastos",
        }
    ]
    title = "Análisis de gastos por proyecto"

    if formato == "pdf":
        return _render_pdf(title, sections), _filename("analisis_gastos", "pdf"), "application/pdf"
    return (
        _render_excel(title, sections),
        _filename("analisis_gastos", "xlsx"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# =============================================================================
# F8.3 Proration report
# =============================================================================

def build_proration_report(
    db: Session,
    current_user: User,
    periodo_id: str,
    formato: str,
) -> Tuple[bytes, str, str]:
    period = db.query(AccountingPeriod).filter(AccountingPeriod.id == periodo_id).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Período contable no encontrado.",
        )
    if period.status != "Prorrateado":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"El período está en estado '{period.status}' y no ha sido prorrateado. "
                f"Ejecute el prorrateo antes de exportar este resumen."
            ),
        )

    query = (
        db.query(OverheadAllocation, Project)
        .join(Project, OverheadAllocation.project_id == Project.id)
        .filter(OverheadAllocation.period_id == period.id)
    )
    if current_user.role == "Coordinador de Proyecto":
        query = query.filter(Project.coordinator_id == current_user.id)

    allocations = query.order_by(Project.code.asc()).all()

    if not allocations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El período no tiene asignaciones de prorrateo visibles para exportar.",
        )

    rows: List[List[str]] = []
    for allocation, project in allocations:
        rows.append(
            [
                project.code,
                project.title,
                _fmt_currency(allocation.registered_consumption),
                _fmt_decimal(Decimal(str(allocation.consumption_pct)) * Decimal("100"), 2) + " %",
                _fmt_currency(allocation.allocated_amount),
            ]
        )

    headers = ["Código", "Proyecto", "Consumo registrado", "Porcentaje", "Monto asignado"]
    subtitle = (
        f"Período: {period.period_name} "
        f"({period.start_date.strftime('%d/%m/%Y')} — {period.end_date.strftime('%d/%m/%Y')}) | "
        f"Criterio: {period.proration_criterion} | "
        f"Costo total del overhead: {_fmt_currency(period.total_overhead_cost)}"
    )
    sections = [
        {
            "subtitle": subtitle,
            "headers": headers,
            "rows": rows,
            "sheet_name": "Resumen de prorrateo",
        }
    ]
    title = "Resumen de prorrateo de gastos compartidos"

    if formato == "pdf":
        return _render_pdf(title, sections), _filename("resumen_prorrateo", "pdf"), "application/pdf"
    return (
        _render_excel(title, sections),
        _filename("resumen_prorrateo", "xlsx"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# =============================================================================
# F8.4 Equipment history report
# =============================================================================

def build_equipment_report(
    db: Session,
    current_user: User,
    equipo_id: str,
    fecha_inicio: date,
    fecha_fin: date,
    formato: str,
) -> Tuple[bytes, str, str]:
    if fecha_inicio > fecha_fin:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La fecha de inicio debe ser anterior o igual a la fecha de fin.",
        )

    equipment = db.query(Equipment).options(joinedload(Equipment.location)).filter(
        Equipment.id == equipo_id
    ).first()
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipo no encontrado.",
        )

    equipment_rows: List[List[str]] = [
        ["Código de activo", equipment.asset_code],
        ["Nombre", equipment.name],
        ["Ubicación", equipment.location.name if equipment.location else "—"],
        ["Estado operacional", equipment.operational_status],
        ["Descripción", equipment.description or "—"],
    ]

    status_changes = (
        db.query(AuditLog)
        .filter(
            AuditLog.target_table == "equipments",
            AuditLog.target_id == equipment.id,
            AuditLog.action_type == "EQUIPMENT_STATUS_CHANGE",
            func.date(AuditLog.timestamp) >= fecha_inicio,
            func.date(AuditLog.timestamp) <= fecha_fin,
        )
        .order_by(AuditLog.timestamp.asc())
        .all()
    )
    status_rows: List[List[str]] = []
    for log in status_changes:
        old_status = (log.old_value or {}).get("operational_status", "—")
        new_status = (log.new_value or {}).get("operational_status", "—")
        status_rows.append(
            [
                log.timestamp.strftime("%d/%m/%Y %H:%M"),
                str(old_status),
                str(new_status),
                log.ip_address,
            ]
        )

    start_dt = datetime.combine(fecha_inicio, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(fecha_fin, datetime.max.time()).replace(tzinfo=timezone.utc)

    reservations = (
        db.query(EquipmentReservation)
        .options(joinedload(EquipmentReservation.project))
        .filter(
            EquipmentReservation.equipment_id == equipment.id,
            EquipmentReservation.start_time <= end_dt,
            EquipmentReservation.end_time >= start_dt,
        )
        .order_by(EquipmentReservation.start_time.asc())
        .all()
    )
    reservation_rows: List[List[str]] = [
        [
            r.start_time.strftime("%d/%m/%Y %H:%M"),
            r.end_time.strftime("%d/%m/%Y %H:%M"),
            r.project.code if r.project else "—",
            r.project.title if r.project else "—",
            r.status,
        ]
        for r in reservations
    ]

    usage_query = (
        db.query(EquipmentUsage)
        .options(joinedload(EquipmentUsage.project))
        .filter(
            EquipmentUsage.equipment_id == equipment.id,
            EquipmentUsage.start_time >= start_dt,
            EquipmentUsage.start_time <= end_dt,
        )
    )
    if current_user.role == "Coordinador de Proyecto":
        usage_query = usage_query.join(
            Project, EquipmentUsage.project_id == Project.id
        ).filter(Project.coordinator_id == current_user.id)
    usages = usage_query.order_by(EquipmentUsage.start_time.asc()).all()

    usage_rows: List[List[str]] = []
    totals_by_project: Dict[str, Decimal] = {}
    for usage in usages:
        totals_by_project[usage.project_id] = totals_by_project.get(
            usage.project_id, Decimal("0.00")
        ) + Decimal(str(usage.used_hours))
        usage_rows.append(
            [
                usage.start_time.strftime("%d/%m/%Y %H:%M"),
                usage.end_time.strftime("%d/%m/%Y %H:%M"),
                usage.project.code if usage.project else "—",
                usage.project.title if usage.project else "—",
                _fmt_decimal(usage.used_hours),
                usage.observations or "—",
            ]
        )

    total_rows: List[List[str]] = []
    for project_id, total_hours in totals_by_project.items():
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            total_rows.append([project.code, project.title, _fmt_decimal(total_hours)])

    if not (status_rows or reservation_rows or usage_rows):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El filtro no produjo datos para exportar.",
        )

    sections = [
        {
            "subtitle": "Datos del equipo",
            "headers": ["Atributo", "Valor"],
            "rows": equipment_rows,
            "sheet_name": "Datos",
        },
        {
            "subtitle": f"Cambios de estado operacional ({fecha_inicio.strftime('%d/%m/%Y')} — {fecha_fin.strftime('%d/%m/%Y')})",
            "headers": ["Fecha", "Estado anterior", "Estado nuevo", "IP"],
            "rows": status_rows,
            "sheet_name": "Cambios de estado",
        },
        {
            "subtitle": f"Reservas en el rango ({fecha_inicio.strftime('%d/%m/%Y')} — {fecha_fin.strftime('%d/%m/%Y')})",
            "headers": ["Inicio", "Fin", "Código proyecto", "Proyecto", "Estado"],
            "rows": reservation_rows,
            "sheet_name": "Reservas",
        },
        {
            "subtitle": f"Usos registrados ({fecha_inicio.strftime('%d/%m/%Y')} — {fecha_fin.strftime('%d/%m/%Y')})",
            "headers": ["Inicio", "Fin", "Código proyecto", "Proyecto", "Horas", "Observaciones"],
            "rows": usage_rows,
            "sheet_name": "Usos",
        },
        {
            "subtitle": "Horas totales por proyecto",
            "headers": ["Código proyecto", "Proyecto", "Horas totales"],
            "rows": total_rows,
            "sheet_name": "Totales por proyecto",
        },
    ]
    title = f"Hoja de vida del equipo {equipment.asset_code} — {equipment.name}"

    if formato == "pdf":
        return (
            _render_pdf(title, sections),
            _filename(f"hoja_vida_{equipment.asset_code}", "pdf"),
            "application/pdf",
        )
    return (
        _render_excel(title, sections),
        _filename(f"hoja_vida_{equipment.asset_code}", "xlsx"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )