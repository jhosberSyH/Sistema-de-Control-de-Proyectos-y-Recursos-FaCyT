"""M8 Reportes y dashboard con el contrato del frontend (vistas 03 y 24; F8.1 a F8.4).

Especificación: frontend/src/testing/mocks/handlers/{reportes,dashboard}.ts y frontend/src/modulos/reportes.

GET /api/reportes/opciones                        proyectos, períodos cerrados y equipos del alcance (RN-07)
GET /api/reportes/vista-previa?tipo&...           primera página del reporte, o por qué no hay datos
GET /api/reportes/{tipo}?formato=pdf|xlsx&...     el archivo (409 si no hay datos: no se genera vacío)
GET /api/dashboard?periodo&prioridad              tablero del Administrador (F8.1)

tipo: gastos (F8.2), reparto (F8.3) u hoja-de-vida (F8.4). Filtros: desde, hasta, proyectoIds
("todos", "activos" o UUIDs separados por comas), periodo y equipo. El Coordinador ve y exporta solo
sus proyectos; el Aprobador y el Administrador, todos.
"""

import io
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional, Tuple
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from openpyxl import Workbook
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas as lienzo_rl
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import false, func
from sqlalchemy.orm import Session

from app.auditoria.contrato import Traductor, clasificar
from app.auditoria.models import AuditLog
from app.autenticacion.dependencies import get_current_user, require_admin
from app.core.api import COORDINADOR, ErrorValidacion, ModeloApi, conflicto, es_id_valido
from app.core.database import get_db
from app.modulos.reportes.formato import (
    ahora,
    dia_local,
    fecha_corta,
    hora,
    hoy,
    iso_momento,
    limites,
    mayuscula,
    mes_atras,
    moneda,
    monto as texto_monto,
    nombre_mes,
    numero,
    porcentaje_fijo,
)
from app.modulos.usuarios.models import (
    AccountingPeriod,
    Dispatch,
    Equipment,
    EquipmentReservation,
    EquipmentUsage,
    Location,
    OverheadAllocation,
    Project,
    Request as Solicitud,
    RequestItem,
    SystemParameter,
    User,
)

router = APIRouter(tags=["Módulo 8: Reportes y dashboard"])

TIPOS = ("gastos", "reparto", "hoja-de-vida")
SIN_ARCHIVO_VACIO = "no generamos un archivo vacío."
PROYECTO_NO_EXISTE = "Ese proyecto no existe."
MIME = {"pdf": "application/pdf", "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
ESTADO_RESERVA = {"Borrador": "en borrador", "Pendiente de Aprobación": "pendiente", "Aprobado": "aprobada",
                  "Rechazado": "rechazada", "Cancelado": "cancelada", "Ejecutado": "ejecutada"}


# =============================================================================
# Esquemas
# =============================================================================

class ProyectoReporte(ModeloApi):
    id: str
    codigo: str
    nombre: str
    estatus: str


class PeriodoOpcion(ModeloApi):
    id: str
    nombre: str
    repartido: bool


class EquipoOpcion(ModeloApi):
    id: str
    nombre: str
    codigo: str


class RangoSugerido(ModeloApi):
    desde: date
    hasta: date


class OpcionesReporte(ModeloApi):
    alcance: Literal["propios", "todos"]
    proyectos: List[ProyectoReporte]
    periodos: List[PeriodoOpcion]
    equipos: List[EquipoOpcion]
    sugerido: RangoSugerido


class ColumnaPrevia(ModeloApi):
    titulo: str
    numerica: bool


class Vacio(ModeloApi):
    titulo: str
    detalle: str


class VistaPrevia(ModeloApi):
    titulo: str
    lineas: List[str]
    columnas: List[ColumnaPrevia]
    filas: List[List[str]]
    nota: Optional[str] = None
    paginas: int
    vacio: Optional[Vacio] = None


class OpcionPeriodo(ModeloApi):
    valor: str
    etiqueta: str


class ProyectoDashboard(ModeloApi):
    id: str
    codigo: str
    nombre: str
    prioridad: Literal["Crítica", "Alta", "Media", "Baja"]
    presupuesto: float
    gasto: float


class MesDashboard(ModeloApi):
    clave: str
    etiqueta: str
    etiqueta_larga: str
    valor: float
    hasta: Optional[date] = None


class Reposicion(ModeloApi):
    id: str
    numero: str
    estado: str


class StockDashboard(ModeloApi):
    id: str
    nombre: str
    unidad: str
    stock: float
    minimo: float
    reposicion: Optional[Reposicion] = None


class VencimientoDashboard(ModeloApi):
    lote: str
    insumo_id: str
    insumo: str
    vence: date
    dias: int


class Dashboard(ModeloApi):
    periodos: List[OpcionPeriodo]
    periodo: str
    proyectos: List[ProyectoDashboard]
    meses: List[MesDashboard]
    stock: List[StockDashboard]
    vencimientos: List[VencimientoDashboard]
    anticipacion: int
    actualizado: str


# =============================================================================
# Datos comunes
# =============================================================================

def _f(v) -> float:
    return float(v or 0)


def _r2(v) -> float:
    return round(float(v or 0) + 0.0, 2)


def nombre_periodo(p: AccountingPeriod) -> str:
    """'octubre de 2026' o 'el trimestre del 01/07/2026 al 30/09/2026' (textos de M8)."""
    if p.period_type == "Mensual":
        return f"{nombre_mes(p.start_date)} de {p.start_date.year}"
    return f"el trimestre del {fecha_corta(p.start_date)} al {fecha_corta(p.end_date)}"


def suma_cargos(db: Session, ids: List[str], inicio: date, fin: date) -> Dict[str, Decimal]:
    """Lo que suma el gasto ejecutado de esos proyectos entre dos días (F2.7): gastos ejecutados,
    despachos valorizados (con signo) y su parte de los gastos compartidos (por la fecha del reparto)."""
    if not ids:
        return {"gasto": Decimal("0"), "despacho": Decimal("0"), "compartido": Decimal("0")}
    desde, hasta = limites(inicio, fin)
    despacho = (
        db.query(func.coalesce(func.sum(Dispatch.signed_quantity * Dispatch.unit_cost_snapshot), 0))
        .filter(Dispatch.project_id.in_(ids), Dispatch.dispatched_at >= desde, Dispatch.dispatched_at < hasta)
        .scalar()
    )
    gasto = (
        db.query(func.coalesce(func.sum(Solicitud.actual_amount), 0))
        .filter(Solicitud.project_id.in_(ids), Solicitud.request_type == "Gasto", Solicitud.status == "Ejecutado",
                Solicitud.cost_center == "proyecto", Solicitud.updated_at >= desde, Solicitud.updated_at < hasta)
        .scalar()
    )
    compartido = (
        db.query(func.coalesce(func.sum(OverheadAllocation.allocated_amount), 0))
        .filter(OverheadAllocation.project_id.in_(ids), OverheadAllocation.applied_at >= desde,
                OverheadAllocation.applied_at < hasta)
        .scalar()
    )
    a2 = lambda v: Decimal(str(v or 0)).quantize(Decimal("0.01"))  # noqa: E731
    return {"gasto": a2(gasto), "despacho": a2(despacho), "compartido": a2(compartido)}


def alcance(db: Session, u: User) -> List[Project]:
    """Proyectos que el usuario puede incluir en un reporte (RN-07)."""
    q = db.query(Project)
    if u.role == COORDINADOR:
        q = q.filter(Project.coordinator_id == u.id)
    return q.order_by(Project.code).all()


# =============================================================================
# Hoja: lo que lleva un reporte (título, líneas de filtros, tablas y nota) y sus archivos
# =============================================================================

def texto_celda(v: Any, formato: str) -> str:
    """Un valor como se lee en el PDF y en la vista previa: '3.150,00', '32,6 %'."""
    if isinstance(v, str):
        return v
    if formato == "moneda":
        return texto_monto(v)
    if formato == "porcentaje":
        return porcentaje_fijo(v)
    return numero(v, 1)


AZUL = colors.HexColor("#003A6A")
ACENTO = colors.HexColor("#0092D0")


class _Lienzo(lienzo_rl.Canvas):
    """Encabezado institucional y 'Página i de n' en cada página (dos pasadas)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._paginas: List[dict] = []

    def showPage(self):
        self._paginas.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._paginas)
        for i, estado in enumerate(self._paginas, start=1):
            self.__dict__.update(estado)
            self.setFont("Helvetica-Bold", 11)
            self.drawString(50, 752, "Universidad de Carabobo · FaCyT")
            self.setFont("Helvetica", 8.5)
            self.drawString(50, 740, "Facultad Experimental de Ciencias y Tecnología · Control de Proyectos y Recursos")
            self.setStrokeColor(AZUL)
            self.setLineWidth(2)
            self.line(50, 730, 562, 730)
            self.setStrokeColor(ACENTO)
            self.setLineWidth(1)
            self.line(50, 727, 562, 727)
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.black)
            self.drawString(50, 40, f"Documento generado por el sistema. Página {i} de {total}.")
            super().showPage()
        super().save()


def pdf(hoja: Dict) -> Tuple[bytes, int]:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, leftMargin=44, rightMargin=44, topMargin=74, bottomMargin=54,
                            title=hoja["titulo"], author="Sistema de Control de Proyectos FaCyT")
    titulo = ParagraphStyle("titulo", fontName="Helvetica-Bold", fontSize=16, leading=20, spaceAfter=6)
    linea = ParagraphStyle("linea", fontName="Helvetica", fontSize=9.5, leading=13)
    subtitulo = ParagraphStyle("subtitulo", fontName="Helvetica-Bold", fontSize=11, leading=14, spaceBefore=6, spaceAfter=4)
    celda = ParagraphStyle("celda", fontName="Helvetica", fontSize=9, leading=11)
    celda_n = ParagraphStyle("celdaN", parent=celda, fontName="Helvetica-Bold")
    nota = ParagraphStyle("nota", fontName="Helvetica", fontSize=8.5, leading=11, textColor=colors.HexColor("#444444"))

    historia: List[Any] = [Paragraph(escape(hoja["titulo"]), titulo)]
    historia += [Paragraph(escape(l), linea) for l in hoja["lineas"]]
    historia.append(Spacer(1, 12))
    for tabla in hoja["tablas"]:
        if tabla.get("titulo"):
            historia.append(Paragraph(escape(tabla["titulo"]), subtitulo))
        columnas = tabla["columnas"]
        total_ancho = sum(c["ancho"] for c in columnas)
        anchos = [512 * c["ancho"] / total_ancho for c in columnas]
        datos = [[Paragraph(f"<b>{escape(c['titulo'])}</b>", celda) if c["formato"] == "texto" else c["titulo"] for c in columnas]]
        for fila in tabla["filas"]:
            negrita = fila and fila[0] == "Total"
            datos.append([
                Paragraph(escape(texto_celda(v, c["formato"])), celda_n if negrita else celda) if c["formato"] == "texto"
                else texto_celda(v, c["formato"])
                for v, c in zip(fila, columnas)
            ])
        estilo = [
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, 0), 0.6, colors.HexColor("#BBBBBB")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
        ]
        for i, c in enumerate(columnas):
            if c["formato"] != "texto":
                estilo.append(("ALIGN", (i, 0), (i, -1), "RIGHT"))
        if tabla["filas"] and tabla["filas"][-1] and tabla["filas"][-1][0] == "Total":
            estilo += [("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                       ("LINEABOVE", (0, -1), (-1, -1), 0.6, colors.HexColor("#BBBBBB"))]
        t = Table(datos, colWidths=anchos, repeatRows=1)
        t.setStyle(TableStyle(estilo))
        historia += [t, Spacer(1, 14)]
    if hoja.get("nota"):
        historia.append(Paragraph(escape(hoja["nota"]), nota))
    doc.build(historia, canvasmaker=_Lienzo)
    contenido = buf.getvalue()
    return contenido, len(re.findall(rb"/Type\s*/Page(?![a-zA-Z])", contenido))


def xlsx(hoja: Dict) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = re.sub(r"[\[\]:*?/\\]", "", hoja["titulo"])[:31] or "Reporte"
    negrita = Font(bold=True)
    ws.append([hoja["titulo"]])
    ws["A1"].font = Font(bold=True, size=13)
    for l in hoja["lineas"]:
        ws.append([l])
    for tabla in hoja["tablas"]:
        ws.append([])
        if tabla.get("titulo"):
            ws.append([tabla["titulo"]])
            ws.cell(row=ws.max_row, column=1).font = negrita
        ws.append([c["titulo"] for c in tabla["columnas"]])
        for celda in ws[ws.max_row]:
            celda.font = negrita
        for fila in tabla["filas"]:
            # Los números van como número para que el Excel los sume
            ws.append(list(fila))
            for i, c in enumerate(tabla["columnas"], start=1):
                celda = ws.cell(row=ws.max_row, column=i)
                if c["formato"] == "moneda" and isinstance(celda.value, (int, float)):
                    celda.number_format = "#,##0.00"
                elif c["formato"] == "porcentaje" and isinstance(celda.value, (int, float)):
                    celda.number_format = '0.0" %"'
                if fila and fila[0] == "Total":
                    celda.font = negrita
    if hoja.get("nota"):
        ws.append([])
        ws.append([hoja["nota"]])
    for i, c in enumerate(hoja["tablas"][0]["columnas"], start=1):
        ws.column_dimensions[get_column_letter(i)].width = max(12, c["ancho"] / 2 + 6)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# =============================================================================
# Filtros y armado de cada reporte
# =============================================================================

def _fecha(valor: Optional[str]) -> Optional[date]:
    if not valor or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", valor):
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError:
        return None


def leer_filtros(db: Session, u: User, tipo: str, q: Dict[str, Optional[str]]) -> Dict:
    if tipo not in TIPOS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ese reporte no existe.")
    desde, hasta = _fecha(q.get("desde")), _fecha(q.get("hasta"))
    errores: Dict[str, str] = {}
    if tipo != "reparto":
        if not desde:
            errores["desde"] = "Elige la fecha de inicio."
        if not hasta:
            errores["hasta"] = "Elige la fecha de fin."
        elif desde and hasta < desde:
            errores["hasta"] = "El fin tiene que ser después del inicio."
    if tipo == "reparto" and not q.get("periodo"):
        errores["periodo"] = "Elige el período repartido."
    if tipo == "hoja-de-vida" and not q.get("equipo"):
        errores["equipo"] = "Elige el equipo."
    if errores:
        raise ErrorValidacion(errores)

    coordinador = u.role == COORDINADOR
    propios = alcance(db, u)
    pedido = q.get("proyectoIds") or "todos"
    proyectos = propios
    etiqueta = ", ".join(p.code for p in propios) if coordinador else f"todos ({len(propios)})"
    sujeto = "tus proyectos" if coordinador else "ningún proyecto"
    if pedido == "activos":
        proyectos = [p for p in propios if p.operational_status == "En ejecución"]
        etiqueta = ", ".join(p.code for p in proyectos) if coordinador else f"activos ({len(proyectos)})"
        sujeto = "los proyectos activos"
    elif pedido != "todos":
        ids = list(dict.fromkeys(x.strip() for x in pedido.split(",") if x.strip()))
        if any(not es_id_valido(i, db) or db.get(Project, i) is None for i in ids):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=PROYECTO_NO_EXISTE)
        elegidos = [p for p in propios if str(p.id) in ids]
        if len(elegidos) != len(ids):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ese proyecto no es tuyo.")
        proyectos = elegidos
        etiqueta = ", ".join(p.code for p in elegidos)
        sujeto = etiqueta
    return {"tipo": tipo, "desde": desde, "hasta": hasta, "proyectos": proyectos, "etiqueta": etiqueta,
            "sujeto": sujeto, "periodo": q.get("periodo"), "equipo": q.get("equipo")}


def _generado(u: User) -> str:
    m = ahora()
    return f"Generado el {fecha_corta(m.date())} a las {hora(m)} por {u.full_name}"


def analisis_de_gastos(db: Session, u: User, f: Dict) -> Dict:
    """F8.2: gastos ejecutados, despachos valorizados y gastos compartidos de cada proyecto en el rango."""
    filas: List[List[Any]] = []
    for p in f["proyectos"]:
        s = suma_cargos(db, [p.id], f["desde"], f["hasta"])
        g, d, c = float(s["gasto"]), float(s["despacho"]), float(s["compartido"])
        if g or d or c:
            filas.append([p.code, g, d, c, round(g + d + c, 2)])
    if len(filas) > 1:
        filas.append(["Total", *[round(sum(x[i] for x in filas), 2) for i in (1, 2, 3, 4)]])
    uno = f["proyectos"][0] if len(f["proyectos"]) == 1 else None
    registrado = dia_local(uno.created_at) if uno else None
    vacio = None
    if not filas:
        vacio = {
            "titulo": f"No hay gastos de {f['sujeto']} entre el {fecha_corta(f['desde'])} y el {fecha_corta(f['hasta'])}.",
            "detalle": (f"El proyecto se registró el {fecha_corta(registrado)}. Cambia el período; {SIN_ARCHIVO_VACIO}"
                        if registrado and f["desde"] < registrado else f"Cambia el período o los proyectos; {SIN_ARCHIVO_VACIO}"),
        }
    return {
        "archivo": f"analisis-de-gastos-{hoy().isoformat()}",
        "hoja": {
            "titulo": "Análisis de gastos",
            "lineas": [f"Período: {fecha_corta(f['desde'])} al {fecha_corta(f['hasta'])} · Proyectos: {f['etiqueta']}",
                       _generado(u)],
            "tablas": [{
                "columnas": [
                    {"titulo": "Proyecto", "formato": "texto", "ancho": 18},
                    {"titulo": "Gastos", "formato": "moneda", "ancho": 16},
                    {"titulo": "Despachos", "formato": "moneda", "ancho": 16},
                    {"titulo": "Gastos compartidos", "formato": "moneda", "ancho": 22},
                    {"titulo": "Total", "formato": "moneda", "ancho": 16},
                ],
                "filas": filas,
            }],
            "nota": "Montos en US$. Solo incluye solicitudes de gasto en estado Ejecutado. Los despachos se "
                    "valorizan al costo unitario de cada lote.",
        },
        "vacio": vacio,
    }


def resumen_del_reparto(db: Session, u: User, f: Dict) -> Dict:
    """F8.3: el reparto aplicado de un período, con el criterio, el total y la parte de cada proyecto."""
    p = db.get(AccountingPeriod, f["periodo"]) if es_id_valido(f["periodo"], db) else None
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ese período no existe.")
    asignaciones = (
        db.query(OverheadAllocation, Project)
        .join(Project, Project.id == OverheadAllocation.project_id)
        .filter(OverheadAllocation.period_id == p.id)
        .order_by(Project.code)
        .all()
    )
    if p.status != "Prorrateado" or not asignaciones:
        raise conflicto(f"Los gastos compartidos de {nombre_periodo(p)} todavía no se repartieron.")
    codigos = {x.code for x in f["proyectos"]}
    filas: List[List[Any]] = [
        [pr.code, _r2(a.registered_consumption), round(_f(a.consumption_pct) * 100, 1), _r2(a.allocated_amount)]
        for a, pr in asignaciones if pr.code in codigos
    ]
    if len(filas) > 1:
        s = lambda i: round(sum(x[i] for x in filas), 2)  # noqa: E731
        filas.append(["Total", s(1), round(s(2), 1), s(3)])
    criterio = "según el consumo de cada proyecto" if p.proration_criterion == "Proporcional" else "en partes iguales"
    vacio = None
    if not filas:
        quien = "Tus proyectos no participaron" if f["sujeto"] == "tus proyectos" else f"{mayuscula(f['sujeto'])} no participó"
        vacio = {
            "titulo": f"{quien} en el reparto de {nombre_periodo(p)}.",
            "detalle": f"Solo participan los proyectos En ejecución durante el período. Elige otro período; {SIN_ARCHIVO_VACIO}",
        }
    return {
        "archivo": f"resumen-reparto-{p.start_date.isoformat()[:7]}",
        "hoja": {
            "titulo": "Resumen del reparto de gastos compartidos",
            "lineas": [
                f"Período: {nombre_periodo(p)} ({fecha_corta(p.start_date)} al {fecha_corta(p.end_date)}) · Criterio: {criterio}",
                f"Total repartido: {moneda(p.total_overhead_cost)} entre {len(asignaciones)} proyectos activos · "
                f"Proyectos: {f['etiqueta']}",
                _generado(u),
            ],
            "tablas": [{
                "columnas": [
                    {"titulo": "Proyecto", "formato": "texto", "ancho": 22},
                    {"titulo": "Consumo", "formato": "moneda", "ancho": 20},
                    {"titulo": "Porcentaje", "formato": "porcentaje", "ancho": 16},
                    {"titulo": "Monto", "formato": "moneda", "ancho": 20},
                ],
                "filas": filas,
            }],
            "nota": "Montos en US$. El consumo suma la materia prima y los insumos despachados al proyecto en el período.",
        },
        "vacio": vacio,
    }


def _horas(uso: EquipmentUsage) -> float:
    if uso.used_hours is not None:
        return _f(uso.used_hours)
    return max(0.0, (uso.end_time - uso.start_time).total_seconds() / 3600)


def _cambios_de_estado(db: Session, e: Equipment, desde: Optional[datetime] = None,
                       hasta: Optional[datetime] = None) -> List[AuditLog]:
    q = db.query(AuditLog).filter(
        ((AuditLog.target_table.in_(["equipments", "equipment"])) & (AuditLog.target_id == str(e.id)))
        | (AuditLog.target_object == f"EQUIPMENT:{e.asset_code}")
    )
    if desde is not None:
        q = q.filter(AuditLog.timestamp >= desde, AuditLog.timestamp < hasta)
    logs = q.order_by(AuditLog.timestamp).all()
    return [l for l in logs if clasificar(l.action_type, l.new_value if isinstance(l.new_value, dict) else None) == "cambio-estado"]


def hoja_de_vida(db: Session, u: User, f: Dict) -> Dict:
    """F8.4: datos del equipo, cambios de estado, reservas y horas de uso por proyecto en el rango."""
    e = db.get(Equipment, f["equipo"]) if es_id_valido(f["equipo"], db) else None
    if not e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ese equipo no existe.")
    desde, hasta = limites(f["desde"], f["hasta"])
    codigos = {str(p.id): p.code for p in f["proyectos"]}
    ids = list(codigos)
    # RN-07: el Coordinador ve solo los usos y las reservas de sus proyectos
    usos = (
        db.query(EquipmentUsage)
        .filter(EquipmentUsage.equipment_id == e.id, EquipmentUsage.project_id.in_(ids),
                EquipmentUsage.start_time >= desde, EquipmentUsage.start_time < hasta)
        .all() if ids else []
    )
    reservas = (
        db.query(EquipmentReservation)
        .filter(EquipmentReservation.equipment_id == e.id, EquipmentReservation.project_id.in_(ids),
                EquipmentReservation.start_time >= desde, EquipmentReservation.start_time < hasta)
        .all() if ids else []
    )
    cambios = _cambios_de_estado(db, e, desde, hasta)
    ubicacion = db.get(Location, e.location_id).name if e.location_id and db.get(Location, e.location_id) else "—"

    por_proyecto = []
    for pid in sorted({str(x.project_id) for x in [*usos, *reservas]}, key=lambda i: codigos.get(i, "")):
        suyos = [x for x in usos if str(x.project_id) == pid]
        por_proyecto.append([
            codigos.get(pid, "—"), len(suyos), round(sum(_horas(x) for x in suyos), 1),
            sum(1 for r in reservas if str(r.project_id) == pid and r.status == "Aprobado"),
        ])
    t = Traductor(db)
    eventos = [
        *[(c.timestamp, t.registro(c).descripcion, "—") for c in cambios],
        *[(r.start_time, f"Reserva {ESTADO_RESERVA.get(r.status, r.status.lower())}", codigos.get(str(r.project_id), "—"))
          for r in reservas],
        *[(x.start_time, f"Uso de {numero(round(_horas(x), 1), 1)} h", codigos.get(str(x.project_id), "—")) for x in usos],
    ]
    eventos.sort(key=lambda x: iso_momento(x[0]))
    historial = [[f"{fecha_corta(m)} {hora(m)}", ev, pr] for m, ev, pr in eventos]

    nota = None
    if e.operational_status == "En mantenimiento":
        ultimo = next((c for c in reversed(_cambios_de_estado(db, e))
                       if isinstance(c.new_value, dict) and "mantenimiento" in str(c.new_value).lower()), None)
        if ultimo:
            motivo = (ultimo.new_value or {}).get("detalle") or (ultimo.new_value or {}).get("motivo") or ultimo.justification
            nota = f"En mantenimiento desde el {fecha_corta(ultimo.timestamp)}{f': {motivo}' if motivo else '.'}"
        else:
            nota = "El equipo está en mantenimiento."
    vacio = None
    if not historial:
        vacio = {
            "titulo": f"No hay usos, reservas ni cambios de estado de {e.name} entre el {fecha_corta(f['desde'])} y el "
                      f"{fecha_corta(f['hasta'])}.",
            "detalle": f"Cambia el período; {SIN_ARCHIVO_VACIO}",
        }
    return {
        "archivo": f"hoja-de-vida-{e.asset_code}",
        "hoja": {
            "titulo": f"Hoja de vida: {e.name}",
            "lineas": [
                f"Equipo: {e.asset_code} · {ubicacion} · Estado: {e.operational_status}",
                f"Período: {fecha_corta(f['desde'])} al {fecha_corta(f['hasta'])} · Proyectos: {f['etiqueta']}",
                _generado(u),
            ],
            "tablas": [
                {
                    "columnas": [
                        {"titulo": "Proyecto", "formato": "texto", "ancho": 22},
                        {"titulo": "Usos", "formato": "numero", "ancho": 12},
                        {"titulo": "Horas de uso", "formato": "numero", "ancho": 16},
                        {"titulo": "Reservas aprobadas", "formato": "numero", "ancho": 20},
                    ],
                    "filas": por_proyecto,
                },
                {
                    "titulo": "Historial",
                    "columnas": [
                        {"titulo": "Fecha", "formato": "texto", "ancho": 18},
                        {"titulo": "Evento", "formato": "texto", "ancho": 56},
                        {"titulo": "Proyecto", "formato": "texto", "ancho": 14},
                    ],
                    "filas": historial,
                },
            ],
            "nota": nota,
        },
        "vacio": vacio,
    }


def armar(db: Session, u: User, tipo: str, q: Dict[str, Optional[str]]) -> Dict:
    f = leer_filtros(db, u, tipo, q)
    if f["tipo"] == "gastos":
        return analisis_de_gastos(db, u, f)
    if f["tipo"] == "reparto":
        return resumen_del_reparto(db, u, f)
    return hoja_de_vida(db, u, f)


def _consulta(request: Request) -> Dict[str, Optional[str]]:
    return {k: request.query_params.get(k) for k in ("desde", "hasta", "proyectoIds", "periodo", "equipo")}


# =============================================================================
# Rutas de reportes (las fijas antes que /reportes/{tipo})
# =============================================================================

@router.get("/reportes/opciones", response_model=OpcionesReporte)
def opciones_reporte(db: Session = Depends(get_db), u: User = Depends(get_current_user)):
    periodos = (
        db.query(AccountingPeriod)
        .filter(AccountingPeriod.status.in_(["Cerrado", "Prorrateado"]))
        .order_by(AccountingPeriod.start_date.desc())
        .all()
    )
    return OpcionesReporte(
        alcance="propios" if u.role == COORDINADOR else "todos",
        proyectos=[ProyectoReporte(id=str(p.id), codigo=p.code, nombre=p.title, estatus=p.operational_status) for p in alcance(db, u)],
        # Los cerrados sin repartir también salen, marcados: el resumen existe solo después del reparto (HU-25)
        periodos=[PeriodoOpcion(id=str(p.id), nombre=nombre_periodo(p), repartido=p.status == "Prorrateado") for p in periodos],
        equipos=[EquipoOpcion(id=str(e.id), nombre=e.name, codigo=e.asset_code)
                 for e in db.query(Equipment).order_by(Equipment.name).all()],
        # Los últimos cinco meses hasta hoy
        sugerido=RangoSugerido(desde=mes_atras(4)[0], hasta=hoy()),
    )


@router.get("/reportes/vista-previa", response_model=VistaPrevia)
def vista_previa(
    request: Request, tipo: Optional[str] = Query(None),
    db: Session = Depends(get_db), u: User = Depends(get_current_user),
):
    r = armar(db, u, tipo or "", _consulta(request))
    tabla = r["hoja"]["tablas"][0]
    return VistaPrevia(
        titulo=r["hoja"]["titulo"],
        lineas=r["hoja"]["lineas"],
        columnas=[ColumnaPrevia(titulo=c["titulo"], numerica=c["formato"] != "texto") for c in tabla["columnas"]],
        filas=[[texto_celda(v, tabla["columnas"][i]["formato"]) for i, v in enumerate(x)] for x in tabla["filas"][:8]],
        nota=r["hoja"]["nota"],
        paginas=0 if r["vacio"] else pdf(r["hoja"])[1],
        vacio=Vacio(**r["vacio"]) if r["vacio"] else None,
    )


@router.get(
    "/reportes/{tipo}",
    response_class=Response,
    responses={200: {"content": {MIME["pdf"]: {}, MIME["xlsx"]: {}}, "description": "El reporte en PDF o Excel"}},
)
def descargar_reporte(
    tipo: str, request: Request, formato: Optional[str] = Query(None),
    db: Session = Depends(get_db), u: User = Depends(get_current_user),
):
    if formato not in ("pdf", "xlsx"):
        raise ErrorValidacion({"formato": "Elige PDF o Excel."})
    r = armar(db, u, tipo, _consulta(request))
    if r["vacio"]:
        raise conflicto(f"{r['vacio']['titulo']} {r['vacio']['detalle']}")
    contenido = pdf(r["hoja"])[0] if formato == "pdf" else xlsx(r["hoja"])
    return Response(
        content=contenido,
        media_type=MIME[formato],
        headers={"Content-Disposition": f'attachment; filename="{r["archivo"]}.{formato}"'},
    )


# =============================================================================
# Dashboard (F8.1, vista 03): solo el Administrador
# =============================================================================

TRIMESTRE = ("Primer", "Segundo", "Tercer", "Cuarto")


def _opciones_dashboard() -> List[Dict]:
    h = hoy()
    cinco = [mes_atras(n) for n in (4, 3, 2, 1, 0)]
    pasado = mes_atras(1)
    q = (h.month - 1) // 3  # trimestre en curso (0 a 3)
    anio = h.year - (1 if q == 0 else 0)
    tq = (q + 3) % 4  # el último trimestre completo
    trimestre = [mes_atras(0, date(anio, tq * 3 + i + 1, 1)) for i in range(3)]
    de = lambda r: f"{nombre_mes(r[0])} de {r[0].year}"  # noqa: E731
    return [
        {"valor": "ultimos-5", "etiqueta": f"{mayuscula(nombre_mes(cinco[0][0]))} a {de(cinco[4])}", "meses": cinco},
        {"valor": f"mes-{pasado[0].isoformat()[:7]}", "etiqueta": mayuscula(de(pasado)), "meses": [pasado]},
        {"valor": f"trimestre-{anio}-{tq + 1}", "etiqueta": f"{TRIMESTRE[tq]} trimestre de {anio}", "meses": trimestre},
    ]


def _parametro(db: Session, clave: str, defecto: int) -> int:
    p = db.query(SystemParameter).filter(SystemParameter.parameter_key == clave).first()
    return int(p.parameter_value) if p and p.parameter_value is not None else defecto


def _reposicion_abierta(db: Session, item_id: str) -> Optional[Solicitud]:
    return (
        db.query(Solicitud)
        .join(RequestItem, RequestItem.request_id == Solicitud.id)
        .filter(RequestItem.item_id == item_id, Solicitud.request_type == "Reposición automática",
                Solicitud.status.in_(["Borrador", "Pendiente de Aprobación", "Aprobado"]))
        .order_by(Solicitud.created_at.desc())
        .first()
    )


@router.get("/dashboard", response_model=Dashboard)
def dashboard(
    periodo: Optional[str] = Query(None), prioridad: Optional[str] = Query(None),
    db: Session = Depends(get_db), u: User = Depends(require_admin),
):
    from app.navegacion.router import _alertas_inventario  # las mismas alertas que el inicio

    todas = _opciones_dashboard()
    elegida = next((o for o in todas if o["valor"] == periodo), todas[0])
    h = hoy()
    q = db.query(Project).filter(Project.operational_status == "En ejecución")
    if prioridad:
        q = q.filter(Project.priority_level == prioridad) if prioridad in ("Crítica", "Alta", "Media", "Baja") else q.filter(false())
    activos = q.all()
    proyectos = sorted(
        [ProyectoDashboard(id=str(p.id), codigo=p.code, nombre=p.title, prioridad=p.priority_level,
                           presupuesto=_f(p.assigned_budget), gasto=_f(p.executed_budget)) for p in activos],
        # Del que más ejecutó al que menos
        key=lambda p: -(p.gasto / p.presupuesto if p.presupuesto else 0),
    )
    ids = [str(p.id) for p in activos]
    meses = []
    for inicio, fin in elegida["meses"]:
        s = suma_cargos(db, ids, inicio, fin)
        meses.append(MesDashboard(
            clave=inicio.isoformat()[:7],
            etiqueta=mayuscula(nombre_mes(inicio)[:3]),
            etiqueta_larga=f"{mayuscula(nombre_mes(inicio))} de {inicio.year}",
            valor=float(s["gasto"] + s["despacho"] + s["compartido"]),
            # El mes en curso va hasta hoy
            hasta=h if inicio <= h <= fin else None,
        ))
    a = _alertas_inventario(db)
    stock = []
    for i in a["bajo_minimo"]:
        r = _reposicion_abierta(db, i.id)
        stock.append(StockDashboard(id=str(i.id), nombre=i.name, unidad=i.unit_of_measure, stock=_f(i.current_stock),
                                    minimo=_f(i.min_stock), reposicion=Reposicion(id=str(r.id), numero=r.request_number, estado=r.status) if r else None))
    vencidos = sorted(((l, (l.expiration_date - h).days) for l in a["vencidos"]), key=lambda x: x[1])
    vencimientos = [
        VencimientoDashboard(lote=l.batch_number, insumo_id=str(l.item_id), insumo=l.item.name if l.item else "",
                             vence=l.expiration_date, dias=dias)
        for l, dias in [*vencidos, *a["por_vencer"]]
    ]
    return Dashboard(
        periodos=[OpcionPeriodo(valor=o["valor"], etiqueta=o["etiqueta"]) for o in todas],
        periodo=elegida["valor"],
        proyectos=proyectos,
        meses=meses,
        stock=stock,
        vencimientos=vencimientos,
        anticipacion=a.get("anticipacion", _parametro(db, "batch_expiration_alert_days", 30)),
        actualizado=iso_momento(ahora()),
    )
