"""Módulo 2 con el contrato del frontend (F2.1 a F2.7; RN-05, RN-07).

Proyectos
  GET   /api/proyectos?q&area&prioridad&estatus&pagina   Administrador: todos. Coordinador: solo los suyos (RN-07)
  GET   /api/proyectos/exportar?…                         la misma lista en CSV
  GET   /api/proyectos/coordinadores                      cuentas activas con rol Coordinador (F2.2), Administrador
  POST  /api/proyectos                                    nace en Propuesta; código único (409 con el que choca)
  GET   /api/proyectos/{id}                               ficha (vista 07)
  GET   /api/proyectos/{id}/gastos|reservas|historial     pestañas de la ficha
  PATCH /api/proyectos/{id}/estatus                       {estatus, comentario} (F2.3), Administrador
  PATCH /api/proyectos/{id}/coordinador                   {coordinadorId} (F2.2), Administrador
Plan de hitos y avance (vista 08)
  GET   /api/proyectos/{id}/plan                          hitos con su última carga
  PUT   /api/proyectos/{id}/hitos                         plan completo: borrador, o confirmado si suma 100 (F2.4)
  GET   /api/proyectos/{id}/hitos/{hitoId}/avances        cargas anteriores de un hito
  POST  /api/proyectos/{id}/hitos/{hitoId}/avances        carga nueva de 0 a 100 (F2.5); no borra las anteriores

La API identifica cada proyecto por su UUID (decisión 8); el código (QUI-024) va en las respuestas.
Las reglas replican el mock (frontend/src/testing/mocks/handlers/proyectos.ts y hitos.ts), que es la
especificación acordada con las pantallas aprobadas.

El gasto ejecutado sale de Project.executed_budget y su desglose (dispatch_cost, expense_cost,
shared_cost): columnas calculadas desde los movimientos (decisión 5). Aquí nunca se escriben y los GET
no hacen commit.
"""

import math
import re
from collections import defaultdict
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, Iterable, List, Literal, Optional
from zoneinfo import ZoneInfo

from pydantic import Field
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session, joinedload

from app.auditoria.models import AuditLog
from app.auditoria.service import record_audit_log
from app.autenticacion.dependencies import get_client_ip, require_role
from app.avisos.service import avisar, avisar_a, ids_por_rol
from app.core.api import (
    ADMINISTRADOR,
    COORDINADOR,
    ErrorValidacion,
    ModeloApi,
    conflicto,
    es_id_valido,
    iso,
    normalizar,
)
from app.core.config import settings
from app.core.database import get_db
from app.modulos.usuarios.models import (
    AccountingPeriod,
    Batch,
    Dispatch,
    EquipmentReservation,
    MilestoneProgressLog,
    OverheadAllocation,
    Project,
    ProjectMilestone,
    Request as Solicitud,
    RequestItem,
    User,
)

router = APIRouter(tags=["Módulo 2: Proyectos y avance"])

solo_admin = require_role([ADMINISTRADOR])
admin_o_coordinador = require_role([ADMINISTRADOR, COORDINADOR])
solo_coordinador = require_role([COORDINADOR])

POR_PAGINA = 20
AREAS = ("Física", "Química", "Biología")
PREFIJO_AREA = {"FIS": "Física", "QUI": "Química", "BIO": "Biología"}
PRIORIDADES = ("Crítica", "Alta", "Media", "Baja")
# Orden del mockup 06: dentro de cada prioridad, primero los que están en ejecución
ESTATUS = ("En ejecución", "Propuesta", "Suspendido", "Finalizado")
CODIGO = re.compile(r"^[A-Z]{3}-\d{3}$")
FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MAX_NOMBRE_HITO = 120
MAX_COMENTARIO = 300
MAX_PRESUPUESTO = 10 ** 13  # NUMERIC(15, 2)

PROYECTO_NO_EXISTE = "Ese proyecto no existe."
HITO_NO_EXISTE = "No encontramos ese hito. Recarga la página."

# F2.3: Finalizado es el final; Suspendido puede volver a En ejecución (mockup 07, SP-13)
TRANSICIONES: Dict[str, List[str]] = {
    "Propuesta": ["En ejecución"],
    "En ejecución": ["Suspendido", "Finalizado"],
    "Suspendido": ["En ejecución", "Finalizado"],
    "Finalizado": [],
}

ESTADO_RESERVA = {
    "Pendiente de Aprobación": "pendiente",
    "Aprobado": "aprobada",
    "Ejecutado": "aprobada",
    "Rechazado": "rechazada",
    # El contrato todavía no tiene "cancelada": una reserva cancelada por mantenimiento no se hará
    "Cancelado": "cancelada",
}


# =============================================================================
# Esquemas
# =============================================================================

Area = Literal["Física", "Química", "Biología"]
Estatus = Literal["Propuesta", "En ejecución", "Suspendido", "Finalizado"]
Prioridad = Literal["Crítica", "Alta", "Media", "Baja"]


class CoordinadorRef(ModeloApi):
    id: str
    nombre: str


class ResumenProyecto(ModeloApi):
    id: str
    codigo: str
    nombre: str
    area: Area
    estatus: Estatus
    prioridad: Prioridad
    presupuesto: float
    gasto_ejecutado: float
    avance: Optional[float]
    ejecucion: int
    plan_confirmado: bool
    coordinador: Optional[CoordinadorRef]


class ConteosProyectos(ModeloApi):
    propuesta: int = Field(alias="Propuesta")
    en_ejecucion: int = Field(alias="En ejecución")
    suspendido: int = Field(alias="Suspendido")
    finalizado: int = Field(alias="Finalizado")
    todos: int = Field(alias="Todos")


class PaginaProyectos(ModeloApi):
    items: List[ResumenProyecto]
    total: int
    pagina: int
    paginas: int
    por_pagina: int
    conteos: ConteosProyectos


class Coordinador(ModeloApi):
    id: str
    nombre: str
    proyectos: int


class Hito(ModeloApi):
    id: str
    numero: int
    nombre: str
    peso: float
    fecha_prevista: str
    avance: float


class ProximoHito(ModeloApi):
    numero: int
    nombre: str
    peso: float
    avance: float
    fecha_prevista: str


class Desglose(ModeloApi):
    gastos: float
    despachos: float
    compartidos: float


class Movimiento(ModeloApi):
    id: str
    fecha: str
    texto: str
    referencia: Optional[str]
    monto: Optional[float]
    nota: Optional[str]
    tipo: str


class Transicion(ModeloApi):
    estatus: Estatus
    bloqueo: Optional[str]


class FichaProyecto(ResumenProyecto):
    registrado_el: str
    hitos: List[Hito]
    suma_pesos: float
    proximo_hito: Optional[ProximoHito]
    desglose: Desglose
    movimientos: List[Movimiento]
    transiciones: List[Transicion]


class CargoProyecto(ModeloApi):
    id: str
    fecha: str
    tipo: Literal["gasto", "despacho", "compartido"]
    concepto: str
    referencia: Optional[str]
    monto: float


class ReservaProyecto(ModeloApi):
    id: str
    equipo: str
    inicio: str
    fin: str
    estado: Literal["pendiente", "aprobada", "rechazada", "cancelada"]


class EventoProyecto(ModeloApi):
    id: str
    fecha: str
    descripcion: str
    justificacion: Optional[str]
    ip: str


class HitoPlan(Hito):
    ultima_carga: Optional[str]
    cargas: int


class PlanProyecto(ModeloApi):
    id: str
    codigo: str
    nombre: str
    estatus: Estatus
    plan_confirmado: bool
    avance: Optional[float]
    hitos: List[HitoPlan]


class CargaAvance(ModeloApi):
    id: str
    fecha: str
    porcentaje: float
    comentario: Optional[str]
    usuario: str


class ResultadoCarga(ModeloApi):
    hito: int
    antes: Optional[float]
    despues: Optional[float]
    completo: bool


# Los cuerpos se validan a mano para responder los mensajes del contrato (como el mock)

class DatosProyecto(ModeloApi):
    codigo: Any = None
    nombre: Any = None
    area: Any = None
    presupuesto: Any = None
    prioridad: Any = None
    coordinador_id: Any = None


class DatosEstatus(ModeloApi):
    estatus: Any = None
    comentario: Any = None


class DatosCoordinador(ModeloApi):
    coordinador_id: Any = None


class DatosPlan(ModeloApi):
    hitos: Any = None
    confirmar: Any = None


class DatosAvance(ModeloApi):
    porcentaje: Any = None
    fecha: Any = None
    comentario: Any = None


# =============================================================================
# Utilidades
# =============================================================================

def _zona() -> ZoneInfo:
    return ZoneInfo(settings.APP_TIMEZONE)


def _hoy() -> date:
    return datetime.now(_zona()).date()


def _dia(momento: Optional[datetime]) -> str:
    """Día AAAA-MM-DD en la zona de la facultad (las fechas sin zona de SQLite se toman como UTC)."""
    if momento is None:
        return ""
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    return momento.astimezone(_zona()).date().isoformat()


def _redondear(valor: Decimal, decimales: int = 0) -> Decimal:
    """Como Math.round del frontend: la mitad sube."""
    return Decimal(valor).quantize(Decimal(1).scaleb(-decimales), rounding=ROUND_HALF_UP)


def _numero(valor) -> str:
    """Número como lo escribe String() de JavaScript: 45, 66.5."""
    d = Decimal(str(valor)).normalize()
    return str(int(d)) if d == d.to_integral_value() else format(d, "f")


def _porcentaje(valor) -> str:
    """"66,5 %" para los textos del audit log."""
    return f"{_numero(valor).replace('.', ',')} %"


def _cantidad(valor) -> str:
    """"0,5" para los conceptos (coma decimal, sin ceros de más)."""
    return _numero(valor).replace(".", ",")


def _minuscula(texto: str) -> str:
    return texto[:1].lower() + texto[1:]


def _es_entero(valor: Any) -> bool:
    if isinstance(valor, bool):
        return False
    if isinstance(valor, int):
        return True
    return isinstance(valor, float) and math.isfinite(valor) and valor.is_integer()


def _fecha(valor: Any) -> Optional[date]:
    """AAAA-MM-DD válida, o None."""
    if not isinstance(valor, str) or not FECHA.match(valor):
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError:
        return None


def _texto(valor: Any) -> str:
    return valor if isinstance(valor, str) else ""


def _hitos_de(db: Session, proyecto_ids: Iterable[str]) -> Dict[str, List[ProjectMilestone]]:
    ids = list(proyecto_ids)
    por_proyecto: Dict[str, List[ProjectMilestone]] = defaultdict(list)
    if not ids:
        return por_proyecto
    for h in (
        db.query(ProjectMilestone)
        .filter(ProjectMilestone.project_id.in_(ids))
        .order_by(ProjectMilestone.position, ProjectMilestone.created_at)
        .all()
    ):
        por_proyecto[str(h.project_id)].append(h)
    return por_proyecto


def _avance(p: Project, hitos: List[ProjectMilestone]) -> Optional[float]:
    """F2.6: suma de avance × peso entre 100, con un decimal. None mientras el plan no esté confirmado."""
    if not p.plan_confirmed:
        return None
    total = sum((Decimal(h.weight) * Decimal(h.current_progress_pct) for h in hitos), Decimal(0))
    return float(_redondear(total / 100, 1))


def _ejecucion(p: Project) -> int:
    """F2.7: gasto ejecutado / presupuesto en %, sin recortar si pasa de 100."""
    presupuesto = Decimal(p.assigned_budget or 0)
    if presupuesto <= 0:
        return 0
    return int(_redondear(Decimal(p.executed_budget or 0) / presupuesto * 100))


def _vista(p: Project, hitos: List[ProjectMilestone]) -> ResumenProyecto:
    return ResumenProyecto(
        id=str(p.id),
        codigo=p.code,
        nombre=p.title,
        area=p.area,
        estatus=p.operational_status,
        prioridad=p.priority_level,
        presupuesto=float(p.assigned_budget or 0),
        gasto_ejecutado=float(p.executed_budget or 0),
        avance=_avance(p, hitos),
        ejecucion=_ejecucion(p),
        plan_confirmado=bool(p.plan_confirmed),
        coordinador=CoordinadorRef(id=str(p.coordinator.id), nombre=p.coordinator.full_name) if p.coordinator else None,
    )


def _vista_de(db: Session, p: Project) -> ResumenProyecto:
    db.flush()
    db.refresh(p)  # el gasto ejecutado es una columna calculada: se lee de nuevo
    return _vista(p, _hitos_de(db, [str(p.id)])[str(p.id)])


def _proyecto(db: Session, proyecto_id: str) -> Project:
    p = (
        db.query(Project).options(joinedload(Project.coordinator)).filter(Project.id == proyecto_id).first()
        if es_id_valido(proyecto_id, db) else None
    )
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=PROYECTO_NO_EXISTE)
    return p


def _acceso(db: Session, quien: User, proyecto_id: str) -> Project:
    """Administrador: cualquier proyecto. Coordinador: solo los suyos (RN-07)."""
    p = _proyecto(db, proyecto_id)
    if quien.role == COORDINADOR and str(p.coordinator_id or "") != str(quien.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{p.code} no está asignado a ti: solo ves los proyectos que coordinas.",
        )
    return p


def _bloqueo(p: Project, estatus: str) -> Optional[str]:
    """Por qué no se puede pasar a ese estatus todavía, o None si se puede."""
    if p.operational_status == "Propuesta" and estatus == "En ejecución":
        if not p.coordinator_id:
            return "Primero asígnale un coordinador."
        if not p.plan_confirmed:
            return "Su coordinador todavía no confirma el plan de hitos (los pesos tienen que sumar 100)."
    return None


def _guardar_avance_fisico(p: Project, hitos: List[ProjectMilestone]) -> None:
    """El inicio y los reportes leen physical_progress_pct: queda igual al avance del contrato."""
    avance = _avance(p, hitos)
    p.physical_progress_pct = Decimal(str(avance)) if avance is not None else Decimal("0.00")


def _auditar(db: Session, quien: User, ip: str, p: Project, accion: str, descripcion: str, *,
             anterior: Optional[dict] = None, nuevo: Optional[dict] = None,
             justificacion: Optional[str] = None, detalle: Optional[str] = None) -> None:
    """Todo lo que cambia un proyecto queda en el audit log con su descripción legible (RF-04, RN-06).

    La ficha (pestaña Historial) lee los registros con target_table = 'projects' y el id del proyecto.
    """
    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=f"PROJECT:{p.code}",
        target_table="projects", target_id=str(p.id), action_type=accion,
        old_value=anterior,
        new_value={**(nuevo or {}), "descripcion": descripcion, "detalle": detalle},
        justification=justificacion,
    )


# =============================================================================
# Lista, exportación y coordinadores
# =============================================================================

def _filtrados(db: Session, quien: User, q: str, area: Optional[str], prioridad: Optional[str]) -> List[Project]:
    """Proyectos visibles para quien pregunta (RN-07) con la búsqueda, el área y la prioridad."""
    consulta = db.query(Project).options(joinedload(Project.coordinator))
    if quien.role == COORDINADOR:
        consulta = consulta.filter(Project.coordinator_id == quien.id)
    texto = normalizar(q.strip())
    resultado = []
    for p in consulta.all():
        if area and p.area != area:
            continue
        if prioridad and p.priority_level != prioridad:
            continue
        if texto:
            campos = [p.code, p.title, p.coordinator.full_name if p.coordinator else ""]
            if not any(texto in normalizar(c) for c in campos):
                continue
        resultado.append(p)
    return resultado


def _orden(p: Project):
    """Como el mockup 06: por prioridad; dentro de cada una, primero los que están en ejecución; luego por código."""
    return (
        PRIORIDADES.index(p.priority_level) if p.priority_level in PRIORIDADES else 9,
        ESTATUS.index(p.operational_status) if p.operational_status in ESTATUS else 9,
        p.code,
    )


@router.get("/proyectos", response_model=PaginaProyectos)
def listar_proyectos(
    q: str = "",
    area: Optional[str] = None,
    prioridad: Optional[str] = None,
    estatus: Optional[str] = None,
    pagina: Optional[str] = None,
    db: Session = Depends(get_db),
    quien: User = Depends(admin_o_coordinador),
):
    base = _filtrados(db, quien, q, area, prioridad)
    # Los conteos por estatus respetan los demás filtros: cada botón dice cuántos va a mostrar
    conteos = {"Todos": len(base), **{e: sum(1 for p in base if p.operational_status == e) for e in ESTATUS}}
    lista = sorted((p for p in base if not estatus or p.operational_status == estatus), key=_orden)
    paginas = max(1, math.ceil(len(lista) / POR_PAGINA))
    try:
        pedida = int(pagina) if pagina else 1
    except ValueError:
        pedida = 1
    pagina_ok = min(max(1, pedida), paginas)
    tramo = lista[(pagina_ok - 1) * POR_PAGINA: pagina_ok * POR_PAGINA]
    hitos = _hitos_de(db, [str(p.id) for p in tramo])
    return PaginaProyectos(
        items=[_vista(p, hitos[str(p.id)]) for p in tramo],
        total=len(lista), pagina=pagina_ok, paginas=paginas, por_pagina=POR_PAGINA, conteos=conteos,
    )


@router.get("/proyectos/exportar")
def exportar_proyectos(
    q: str = "",
    area: Optional[str] = None,
    prioridad: Optional[str] = None,
    estatus: Optional[str] = None,
    db: Session = Depends(get_db),
    quien: User = Depends(admin_o_coordinador),
):
    lista = sorted(
        (p for p in _filtrados(db, quien, q, area, prioridad) if not estatus or p.operational_status == estatus),
        key=_orden,
    )
    hitos = _hitos_de(db, [str(p.id) for p in lista])
    filas = [_vista(p, hitos[str(p.id)]) for p in lista]

    def celda(valor) -> str:
        texto = "" if valor is None else str(valor)
        return '"' + texto.replace('"', '""') + '"'

    def dinero(valor: float) -> str:
        return f"{valor:.2f}".replace(".", ",")

    encabezado = [
        "Código", "Nombre", "Área", "Coordinador", "Estatus", "Prioridad", "Presupuesto (US$)",
        "Gasto ejecutado (US$)", "Avance físico (%)", "Ejecución (%)",
    ]
    cuerpo = [
        [
            p.codigo, p.nombre, p.area, p.coordinador.nombre if p.coordinador else "Sin coordinador",
            p.estatus, p.prioridad, dinero(p.presupuesto), dinero(p.gasto_ejecutado),
            _numero(p.avance) if p.avance is not None else "", p.ejecucion,
        ]
        for p in filas
    ]
    csv = "\r\n".join(";".join(celda(v) for v in fila) for fila in [encabezado, *cuerpo])
    # BOM para que Excel abra bien las tildes; punto y coma, como espera Excel en español
    return Response(
        content="﻿" + csv,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="proyectos-{_hoy().isoformat()}.csv"'},
    )


@router.get("/proyectos/coordinadores", response_model=List[Coordinador])
def listar_coordinadores(db: Session = Depends(get_db), quien: User = Depends(solo_admin)):
    cuentas = db.query(User).filter(User.role == COORDINADOR, User.is_active.is_(True)).all()
    vigentes: Dict[str, int] = defaultdict(int)
    for (cid,) in db.query(Project.coordinator_id).filter(
        Project.coordinator_id.isnot(None), Project.operational_status != "Finalizado"
    ).all():
        vigentes[str(cid)] += 1
    return sorted(
        (Coordinador(id=str(u.id), nombre=u.full_name, proyectos=vigentes[str(u.id)]) for u in cuentas),
        key=lambda c: (normalizar(c.nombre), c.nombre),
    )


def _coordinador_activo(db: Session, usuario_id: Any) -> Optional[User]:
    if not isinstance(usuario_id, str) or not es_id_valido(usuario_id, db):
        return None
    return (
        db.query(User)
        .filter(User.id == usuario_id, User.role == COORDINADOR, User.is_active.is_(True))
        .first()
    )


@router.post("/proyectos", response_model=ResumenProyecto, status_code=status.HTTP_201_CREATED)
def registrar_proyecto(
    datos: DatosProyecto, request: Request, db: Session = Depends(get_db), quien: User = Depends(solo_admin)
):
    codigo = _texto(datos.codigo).strip().upper()
    nombre = " ".join(_texto(datos.nombre).split())
    area = datos.area
    presupuesto = datos.presupuesto
    prioridad = datos.prioridad

    errores: Dict[str, str] = {}
    if not CODIGO.match(codigo):
        errores["codigo"] = "Usa el formato del código institucional: área y número, como QUI-032."
    if area not in AREAS:
        errores["area"] = "Elige el área del proyecto."
    elif PREFIJO_AREA.get(codigo[:3]) and PREFIJO_AREA[codigo[:3]] != area:
        errores["area"] = f"El código {codigo} es de {PREFIJO_AREA[codigo[:3]]}. Cambia el área o el código."
    if len(nombre) < 5:
        errores["nombre"] = "Escribe el nombre del proyecto."
    elif len(nombre) > 255:
        errores["nombre"] = "Usa como máximo 255 caracteres."
    if isinstance(presupuesto, bool) or not isinstance(presupuesto, (int, float)) or not presupuesto > 0 \
            or not math.isfinite(presupuesto):
        errores["presupuesto"] = "Escribe un monto mayor que cero, por ejemplo 9.500,00."
    elif presupuesto >= MAX_PRESUPUESTO:
        errores["presupuesto"] = "El monto es demasiado grande."
    if prioridad not in PRIORIDADES:
        errores["prioridad"] = "Elige la prioridad del proyecto."
    coordinador = _coordinador_activo(db, datos.coordinador_id) if datos.coordinador_id else None
    if datos.coordinador_id and not coordinador:
        errores["coordinadorId"] = "Esa cuenta ya no es un coordinador activo."
    if errores:
        raise ErrorValidacion(errores)

    existente = db.query(Project).filter(Project.code == codigo).first()
    if existente:
        # F2.1: se muestra el proyecto que ya tiene el código
        raise conflicto(
            "Ya existe un proyecto con ese código.",
            proyecto={"id": str(existente.id), "codigo": existente.code, "nombre": existente.title},
        )

    monto = _redondear(Decimal(str(presupuesto)), 2)
    p = Project(
        code=codigo, title=nombre, area=area, operational_status="Propuesta", priority_level=prioridad,
        assigned_budget=monto, physical_progress_pct=Decimal("0.00"), plan_confirmed=False,
        coordinator_id=coordinador.id if coordinador else None,
    )
    db.add(p)
    db.flush()
    _auditar(
        db, quien, get_client_ip(request), p, "PROJECT_CREATED", f"{quien.full_name} registró el proyecto {codigo}",
        nuevo={"code": codigo, "title": nombre, "area": area, "priority": prioridad,
               "assigned_budget": str(monto), "coordinator_id": str(coordinador.id) if coordinador else None},
        detalle=f"{nombre} · {prioridad} · US$ {monto:.2f}" + (f" · coordina {coordinador.full_name}" if coordinador else ""),
    )
    if coordinador:
        # F2.2: el proyecto aparece en la bandeja del coordinador
        avisar(db, coordinador.id, "info", f"Te asignaron el proyecto {codigo}", f"/proyectos/{p.id}",
               f"{nombre}. Está en Propuesta: carga su plan de hitos para que pueda pasar a En ejecución.")
    vista = _vista_de(db, p)
    db.commit()
    return vista


# =============================================================================
# Ficha (vista 07)
# =============================================================================

def _cargos(db: Session, p: Project) -> List[Dict[str, Any]]:
    """Lo que forma el gasto ejecutado (F2.7): gastos ejecutados, despachos (con signo) y el reparto."""
    cargos: List[Dict[str, Any]] = []

    gastos = (
        db.query(Solicitud)
        .options(joinedload(Solicitud.items).joinedload(RequestItem.item))
        .filter(
            Solicitud.project_id == p.id, Solicitud.request_type == "Gasto",
            Solicitud.status == "Ejecutado", Solicitud.cost_center == "proyecto",
        )
        .all()
    )
    for s in gastos:
        concepto = (
            getattr(s, "description", None)
            or ", ".join(i.item.name for i in s.items if i.item is not None)
            or f"Solicitud de gasto {s.request_number}"
        )
        momento = s.updated_at or s.created_at
        cargos.append({
            "id": f"gasto-{s.id}", "fecha": _dia(momento), "momento": momento, "tipo": "gasto",
            "concepto": concepto, "referencia": s.request_number,
            "monto": float(_redondear(Decimal(s.actual_amount or 0), 2)),
        })

    despachos = (
        db.query(Dispatch)
        .options(joinedload(Dispatch.batch).joinedload(Batch.item))
        .filter(Dispatch.project_id == p.id)
        .all()
    )
    for d in despachos:
        item = d.batch.item if d.batch is not None else None
        cantidad = Decimal(d.dispatched_quantity or 0)
        concepto = f"{item.name} {_cantidad(cantidad)} {item.unit_of_measure}" if item else f"Insumos {d.dispatch_number}"
        if d.direction == "devolucion":
            concepto = f"Devolución: {_minuscula(concepto)}"
        signo = Decimal(-1) if d.direction == "devolucion" else Decimal(1)
        cargos.append({
            "id": f"despacho-{d.id}", "fecha": _dia(d.dispatched_at), "momento": d.dispatched_at, "tipo": "despacho",
            "concepto": concepto, "referencia": d.dispatch_number,
            "monto": float(_redondear(signo * cantidad * Decimal(d.unit_cost_snapshot or 0), 2)),
        })

    repartos = (
        db.query(OverheadAllocation, AccountingPeriod)
        .outerjoin(AccountingPeriod, AccountingPeriod.id == OverheadAllocation.period_id)
        .filter(OverheadAllocation.project_id == p.id)
        .all()
    )
    for a, periodo in repartos:
        concepto = (
            f"Gastos compartidos de {MESES[periodo.start_date.month - 1]}" if periodo is not None else "Gastos compartidos"
        )
        cargos.append({
            "id": f"compartido-{a.id}", "fecha": _dia(a.applied_at), "momento": a.applied_at, "tipo": "compartido",
            "concepto": concepto, "referencia": None,
            "monto": float(_redondear(Decimal(a.allocated_amount or 0), 2)),
        })

    return sorted(cargos, key=lambda c: (c["fecha"], _marca(c["momento"])), reverse=True)


MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre")
TIPO_CARGO = {"gasto": "Gasto", "despacho": "Despacho", "compartido": "Gastos compartidos"}


def _marca(momento: Optional[datetime]) -> float:
    if momento is None:
        return 0.0
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    return momento.timestamp()


def _cargas_por_hito(db: Session, hito_ids: Iterable[str]) -> Dict[str, List[MilestoneProgressLog]]:
    """Cargas de cada hito, la más reciente primero (a igual fecha, la última registrada)."""
    ids = list(hito_ids)
    por_hito: Dict[str, List[MilestoneProgressLog]] = defaultdict(list)
    if not ids:
        return por_hito
    for c in (
        db.query(MilestoneProgressLog)
        .options(joinedload(MilestoneProgressLog.reported_by))
        .filter(MilestoneProgressLog.milestone_id.in_(ids))
        .order_by(MilestoneProgressLog.progress_date.desc(), MilestoneProgressLog.reported_at.desc())
        .all()
    ):
        por_hito[str(c.milestone_id)].append(c)
    return por_hito


def _movimientos(cargos: List[Dict[str, Any]], hitos: List[ProjectMilestone],
                 cargas: Dict[str, List[MilestoneProgressLog]]) -> List[Movimiento]:
    """Lo último que pasó en el proyecto: cargos y cargas de avance, como la lista del mockup 07."""
    todos = []
    for c in cargos:
        if c["tipo"] == "despacho":
            texto = f"Despacho de {_minuscula(c['concepto'])}"
        elif c["tipo"] == "gasto":
            texto = f"Solicitud de gasto ejecutada, {_minuscula(c['concepto'])}"
        else:
            texto = c["concepto"]
        todos.append((c["fecha"], _marca(c["momento"]), Movimiento(
            id=c["id"], fecha=c["fecha"], texto=texto, referencia=c["referencia"], monto=c["monto"],
            nota=None, tipo=TIPO_CARGO[c["tipo"]],
        )))
    numero = {str(h.id): h.position for h in hitos}
    for hito_id, lista in cargas.items():
        for a in lista:
            fecha = a.progress_date.isoformat()
            todos.append((fecha, _marca(a.reported_at), Movimiento(
                id=str(a.id), fecha=fecha,
                texto=f"Avance del hito {numero.get(hito_id, '?')} cargado: {_numero(a.new_progress_pct)} %",
                referencia=None, monto=None, nota=a.notes, tipo="Avance",
            )))
    todos.sort(key=lambda t: (t[0], t[1]), reverse=True)
    lista = [m for _, _, m in todos]
    primeros = lista[:4]
    # Si entre los 4 más recientes no hay una carga de avance o unos gastos compartidos, entra la más
    # reciente de cada una en lugar de los cargos más viejos (nunca sale un especial que ya estaba)
    especiales = ("Avance", "Gastos compartidos")
    faltan = [
        m for t in especiales if not any(x.tipo == t for x in primeros)
        for m in [x for x in lista if x.tipo == t][:1]
    ]
    cargos_en_lista = [m for m in primeros if m.tipo not in especiales]
    salen = {id(m) for m in cargos_en_lista[len(cargos_en_lista) - len(faltan):]} if faltan else set()
    elegidos = [m for m in primeros if id(m) not in salen] + faltan
    return sorted(elegidos, key=lambda m: m.fecha, reverse=True)


@router.get("/proyectos/{proyecto_id}", response_model=FichaProyecto)
def ficha_proyecto(proyecto_id: str, db: Session = Depends(get_db), quien: User = Depends(admin_o_coordinador)):
    p = _acceso(db, quien, proyecto_id)
    hitos = _hitos_de(db, [str(p.id)])[str(p.id)]
    cargas = _cargas_por_hito(db, [str(h.id) for h in hitos])
    proximo = next((h for h in hitos if Decimal(h.current_progress_pct) < 100), None)
    return FichaProyecto(
        **_vista(p, hitos).model_dump(),
        registrado_el=_dia(p.created_at),
        hitos=[_hito(h) for h in hitos],
        suma_pesos=float(sum((Decimal(h.weight) for h in hitos), Decimal(0))),
        proximo_hito=ProximoHito(
            numero=proximo.position, nombre=proximo.name, peso=float(proximo.weight),
            avance=float(proximo.current_progress_pct), fecha_prevista=iso(proximo.target_date) or "",
        ) if proximo else None,
        # F2.7: de dónde sale el gasto ejecutado
        desglose=Desglose(
            gastos=float(p.expense_cost or 0), despachos=float(p.dispatch_cost or 0),
            compartidos=float(p.shared_cost or 0),
        ),
        movimientos=_movimientos(_cargos(db, p), hitos, cargas),
        transiciones=[
            Transicion(estatus=e, bloqueo=_bloqueo(p, e)) for e in TRANSICIONES.get(p.operational_status, [])
        ],
    )


def _hito(h: ProjectMilestone) -> Hito:
    return Hito(
        id=str(h.id), numero=h.position, nombre=h.name, peso=float(h.weight),
        fecha_prevista=iso(h.target_date) or "", avance=float(h.current_progress_pct),
    )


@router.get("/proyectos/{proyecto_id}/gastos", response_model=List[CargoProyecto])
def gastos_proyecto(proyecto_id: str, db: Session = Depends(get_db), quien: User = Depends(admin_o_coordinador)):
    p = _acceso(db, quien, proyecto_id)
    return [
        CargoProyecto(id=c["id"], fecha=c["fecha"], tipo=c["tipo"], concepto=c["concepto"],
                      referencia=c["referencia"], monto=c["monto"])
        for c in _cargos(db, p)
    ]


@router.get("/proyectos/{proyecto_id}/reservas", response_model=List[ReservaProyecto])
def reservas_proyecto(proyecto_id: str, db: Session = Depends(get_db), quien: User = Depends(admin_o_coordinador)):
    p = _acceso(db, quien, proyecto_id)
    reservas = (
        db.query(EquipmentReservation)
        .options(joinedload(EquipmentReservation.equipment))
        .filter(EquipmentReservation.project_id == p.id, EquipmentReservation.status.in_(list(ESTADO_RESERVA)))
        .order_by(EquipmentReservation.start_time.desc())
        .all()
    )
    return [
        ReservaProyecto(
            id=str(r.id), equipo=r.equipment.name if r.equipment else "Equipo",
            inicio=iso(r.start_time), fin=iso(r.end_time), estado=ESTADO_RESERVA[r.status],
        )
        for r in reservas
    ]


@router.get("/proyectos/{proyecto_id}/historial", response_model=List[EventoProyecto])
def historial_proyecto(proyecto_id: str, db: Session = Depends(get_db), quien: User = Depends(admin_o_coordinador)):
    p = _acceso(db, quien, proyecto_id)
    registros = (
        db.query(AuditLog)
        .filter(AuditLog.target_table == "projects", AuditLog.target_id == str(p.id))
        .order_by(AuditLog.timestamp.desc())
        .all()
    )
    return [
        EventoProyecto(
            id=str(l.id), fecha=iso(l.timestamp),
            descripcion=(l.new_value or {}).get("descripcion") or f"{l.action_type} · {p.code}",
            justificacion=l.justification, ip=l.ip_address,
        )
        for l in registros
    ]


# =============================================================================
# Estatus y coordinador (solo el Administrador)
# =============================================================================

@router.patch("/proyectos/{proyecto_id}/estatus", response_model=ResumenProyecto)
def cambiar_estatus(
    proyecto_id: str, datos: DatosEstatus, request: Request,
    db: Session = Depends(get_db), quien: User = Depends(solo_admin),
):
    p = _proyecto(db, proyecto_id)
    if datos.estatus not in ESTATUS:
        raise ErrorValidacion({"estatus": "Elige el nuevo estatus."})
    nuevo = datos.estatus
    if nuevo == p.operational_status:
        return _vista_de(db, p)
    if nuevo not in TRANSICIONES.get(p.operational_status, []):
        raise conflicto(f"Un proyecto en estatus {p.operational_status} no puede pasar a {nuevo}.")
    bloqueo = _bloqueo(p, nuevo)
    if bloqueo:
        raise conflicto(bloqueo)

    texto = _texto(datos.comentario).strip()[:MAX_COMENTARIO]
    anterior = p.operational_status
    p.operational_status = nuevo
    _auditar(
        db, quien, get_client_ip(request), p, "PROJECT_STATUS_CHANGED",
        f"{quien.full_name} cambió el estatus de {p.code} de {anterior} a {nuevo}",
        anterior={"status": anterior}, nuevo={"status": nuevo}, justificacion=texto or None,
    )
    avisar(db, p.coordinator_id, "warn" if nuevo == "Suspendido" else "info", f"{p.code} pasó a {nuevo}",
           f"/proyectos/{p.id}", texto or None)
    vista = _vista_de(db, p)
    db.commit()
    return vista


@router.patch("/proyectos/{proyecto_id}/coordinador", response_model=ResumenProyecto)
def asignar_coordinador(
    proyecto_id: str, datos: DatosCoordinador, request: Request,
    db: Session = Depends(get_db), quien: User = Depends(solo_admin),
):
    p = _proyecto(db, proyecto_id)
    if p.operational_status == "Finalizado":
        raise conflicto("El proyecto está finalizado: ya no cambia de coordinador.")
    nuevo = _coordinador_activo(db, datos.coordinador_id)
    if not nuevo:
        raise ErrorValidacion({"coordinadorId": "Elige una cuenta activa con rol Coordinador de Proyecto."})
    if str(nuevo.id) == str(p.coordinator_id or ""):
        return _vista_de(db, p)

    anterior = p.coordinator
    p.coordinator_id = nuevo.id
    p.coordinator = nuevo
    _auditar(
        db, quien, get_client_ip(request), p, "PROJECT_COORDINATOR_ASSIGNED",
        f"{quien.full_name} cambió el coordinador de {p.code} de {anterior.full_name} a {nuevo.full_name}"
        if anterior else f"{quien.full_name} asignó a {nuevo.full_name} como coordinador de {p.code}",
        anterior={"coordinator_id": str(anterior.id) if anterior else None,
                  "coordinator_name": anterior.full_name if anterior else None},
        nuevo={"coordinator_id": str(nuevo.id), "coordinator_name": nuevo.full_name},
    )
    avisar(db, nuevo.id, "info", f"Te asignaron el proyecto {p.code}", f"/proyectos/{p.id}", p.title)
    if anterior:
        avisar(db, anterior.id, "info", f"Ya no coordinas {p.code}", "/proyectos", f"Ahora lo coordina {nuevo.full_name}.")
    vista = _vista_de(db, p)
    db.commit()
    return vista


# =============================================================================
# Plan de hitos y avance (vista 08)
# =============================================================================

def _plan(db: Session, p: Project) -> PlanProyecto:
    hitos = _hitos_de(db, [str(p.id)])[str(p.id)]
    cargas = _cargas_por_hito(db, [str(h.id) for h in hitos])
    return PlanProyecto(
        id=str(p.id), codigo=p.code, nombre=p.title, estatus=p.operational_status,
        plan_confirmado=bool(p.plan_confirmed), avance=_avance(p, hitos),
        hitos=[
            HitoPlan(
                **_hito(h).model_dump(),
                ultima_carga=cargas[str(h.id)][0].progress_date.isoformat() if cargas[str(h.id)] else None,
                cargas=len(cargas[str(h.id)]),
            )
            for h in hitos
        ],
    )


def _no_finalizado(p: Project) -> None:
    if p.operational_status == "Finalizado":
        raise conflicto(f"{p.code} está finalizado: su plan de hitos ya no cambia.")


def _resumen_plan(hitos: List[Dict[str, Any]]) -> str:
    """"1. Revisión bibliográfica (15 %); 2. …", para el antes y el después del audit log."""
    return "; ".join(f"{i + 1}. {h['nombre']} ({_porcentaje(h['peso'])})" for i, h in enumerate(hitos))


@router.get("/proyectos/{proyecto_id}/plan", response_model=PlanProyecto)
def ver_plan(proyecto_id: str, db: Session = Depends(get_db), quien: User = Depends(admin_o_coordinador)):
    return _plan(db, _acceso(db, quien, proyecto_id))


@router.put("/proyectos/{proyecto_id}/hitos", response_model=PlanProyecto)
def guardar_plan(
    proyecto_id: str, datos: DatosPlan, request: Request,
    db: Session = Depends(get_db), quien: User = Depends(solo_coordinador),
):
    """F2.4: el plan se guarda entero. Con "confirmar", o si ya estaba confirmado, los pesos tienen que
    sumar 100: así el avance físico nunca vuelve a "No disponible" por una edición."""
    p = _acceso(db, quien, proyecto_id)
    _no_finalizado(p)
    lista = datos.hitos if isinstance(datos.hitos, list) else []
    if not lista:
        raise ErrorValidacion({"hitos": "Agrega al menos un hito."})

    actuales = _hitos_de(db, [str(p.id)])[str(p.id)]
    por_id = {str(h.id): h for h in actuales}
    errores: Dict[str, str] = {}
    limpios: List[Dict[str, Any]] = []
    for i, h in enumerate(lista):
        h = h if isinstance(h, dict) else {}
        nombre = _texto(h.get("nombre")).strip()
        fecha = _fecha(h.get("fechaPrevista"))
        peso = h.get("peso")
        hito_id = h.get("id") if isinstance(h.get("id"), str) and h.get("id") else None
        if not nombre:
            errores[f"hitos.{i}.nombre"] = "Escribe el nombre del hito."
        elif len(nombre) > MAX_NOMBRE_HITO:
            errores[f"hitos.{i}.nombre"] = f"Usa como máximo {MAX_NOMBRE_HITO} caracteres."
        elif hito_id and hito_id not in por_id:
            errores[f"hitos.{i}.nombre"] = "Este hito ya no existe. Recarga la página."
        if fecha is None:
            errores[f"hitos.{i}.fechaPrevista"] = "Elige la fecha."
        if not _es_entero(peso) or not 1 <= peso <= 100:
            errores[f"hitos.{i}.peso"] = "Usa un entero de 1 a 100."
        limpios.append({"id": hito_id, "nombre": nombre, "fecha": fecha, "peso": int(peso) if _es_entero(peso) else 0})
    if errores:
        raise ErrorValidacion(errores)

    suma = sum(h["peso"] for h in limpios)
    ya_confirmado = bool(p.plan_confirmed)
    confirmar = datos.confirmar is True or ya_confirmado
    if confirmar and suma != 100:
        raise ErrorValidacion({
            "hitos": f"Los pesos suman {suma} %: faltan {100 - suma} % para llegar a 100 %."
            if suma < 100 else f"Los pesos suman {suma} %: sobran {suma - 100} %."
        })

    # F2.5: las cargas no se borran, así que un hito con avance cargado no se puede quitar
    quedan = {h["id"] for h in limpios if h["id"]}
    quitados = [h for h in actuales if str(h.id) not in quedan]
    cargas = _cargas_por_hito(db, [str(h.id) for h in quitados])
    con_cargas = next((h for h in quitados if cargas[str(h.id)]), None)
    if con_cargas:
        raise conflicto(f"El hito «{con_cargas.name}» ya tiene cargas de avance: no se puede quitar.")

    antes = _resumen_plan([{"nombre": h.name, "peso": h.weight} for h in actuales])
    ahora = datetime.now(timezone.utc)
    for h in quitados:
        db.delete(h)
    db.flush()
    for i, h in enumerate(limpios):
        existente = por_id.get(h["id"]) if h["id"] else None
        if existente is not None:
            existente.position = i + 1
            existente.name = h["nombre"]
            existente.weight = Decimal(h["peso"])
            existente.target_date = h["fecha"]
            existente.updated_at = ahora
        else:
            db.add(ProjectMilestone(
                project_id=p.id, name=h["nombre"], weight=Decimal(h["peso"]), target_date=h["fecha"],
                position=i + 1, current_progress_pct=Decimal("0.00"),
            ))
    if confirmar:
        p.plan_confirmed = True
    db.flush()
    _guardar_avance_fisico(p, _hitos_de(db, [str(p.id)])[str(p.id)])

    cuantos = f"{len(limpios)} {'hito' if len(limpios) == 1 else 'hitos'}"
    if ya_confirmado:
        descripcion = f"{quien.full_name} cambió el plan de hitos de {p.code} ({cuantos})"
    elif confirmar:
        descripcion = f"{quien.full_name} confirmó el plan de hitos de {p.code} ({cuantos}, 100 %)"
    else:
        descripcion = f"{quien.full_name} guardó el borrador del plan de hitos de {p.code} ({cuantos}, {_porcentaje(suma)})"
    _auditar(
        db, quien, get_client_ip(request), p, "MILESTONE_PLAN_SAVED", descripcion,
        anterior={"plan": antes or None}, nuevo={"plan": _resumen_plan(limpios), "plan_confirmed": bool(p.plan_confirmed)},
    )

    # Un plan recién confirmado en Propuesta queda listo para pasar a En ejecución (F2.3)
    if confirmar and not ya_confirmado and p.operational_status == "Propuesta":
        avisar_a(db, ids_por_rol(db, ADMINISTRADOR), "info", f"{p.code} tiene su plan de hitos confirmado",
                 f"/proyectos/{p.id}", "Está en Propuesta. Puedes pasarlo a En ejecución.")
    plan = _plan(db, p)
    db.commit()
    return plan


def _hito_del_proyecto(db: Session, p: Project, hito_id: str) -> ProjectMilestone:
    h = (
        db.query(ProjectMilestone)
        .filter(ProjectMilestone.id == hito_id, ProjectMilestone.project_id == p.id)
        .first()
        if es_id_valido(hito_id, db) else None
    )
    if not h:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=HITO_NO_EXISTE)
    return h


@router.get("/proyectos/{proyecto_id}/hitos/{hito_id}/avances", response_model=List[CargaAvance])
def cargas_hito(
    proyecto_id: str, hito_id: str, db: Session = Depends(get_db), quien: User = Depends(admin_o_coordinador)
):
    p = _acceso(db, quien, proyecto_id)
    h = _hito_del_proyecto(db, p, hito_id)
    return [
        CargaAvance(
            id=str(a.id), fecha=a.progress_date.isoformat(), porcentaje=float(a.new_progress_pct),
            comentario=a.notes, usuario=a.reported_by.full_name if a.reported_by else "—",
        )
        for a in _cargas_por_hito(db, [str(h.id)])[str(h.id)]
    ]


@router.post("/proyectos/{proyecto_id}/hitos/{hito_id}/avances", response_model=ResultadoCarga,
             status_code=status.HTTP_201_CREATED)
def cargar_avance(
    proyecto_id: str, hito_id: str, datos: DatosAvance, request: Request,
    db: Session = Depends(get_db), quien: User = Depends(solo_coordinador),
):
    """F2.5: cada carga es un registro nuevo; el hito queda con la última y el avance se recalcula (F2.6)."""
    p = _acceso(db, quien, proyecto_id)
    _no_finalizado(p)
    if not p.plan_confirmed:
        raise conflicto("Primero confirma el plan de hitos: el avance se carga cuando los pesos suman 100.")
    h = _hito_del_proyecto(db, p, hito_id)

    valor = datos.porcentaje
    fecha = _fecha(datos.fecha)
    comentario = _texto(datos.comentario).strip()
    anteriores = _cargas_por_hito(db, [str(h.id)])[str(h.id)]
    ultima = anteriores[0] if anteriores else None
    errores: Dict[str, str] = {}
    if not _es_entero(valor) or not 0 <= valor <= 100:
        escrito = "null" if valor is None else ("true" if valor is True else "false" if valor is False else str(valor))
        errores["porcentaje"] = f"Escribe un porcentaje entre 0 y 100. Escribiste {escrito}."
    if fecha is None:
        errores["fecha"] = "Elige la fecha de la carga."
    elif fecha > _hoy():
        errores["fecha"] = "La fecha no puede ser posterior a hoy."
    elif ultima and fecha < ultima.progress_date:
        errores["fecha"] = (
            f"La fecha no puede ser anterior a la última carga ({ultima.progress_date.strftime('%d/%m/%Y')})."
        )
    if len(comentario) > MAX_COMENTARIO:
        errores["comentario"] = f"Usa como máximo {MAX_COMENTARIO} caracteres."
    if errores:
        raise ErrorValidacion(errores)

    hitos = _hitos_de(db, [str(p.id)])[str(p.id)]
    antes = _avance(p, hitos)
    nuevo = Decimal(int(valor))
    previo = Decimal(h.current_progress_pct)
    ahora = datetime.now(timezone.utc)
    db.add(MilestoneProgressLog(
        milestone_id=h.id, reported_by_user_id=quien.id, previous_progress_pct=previo, new_progress_pct=nuevo,
        notes=comentario or None, progress_date=fecha, reported_at=ahora,
    ))
    h.current_progress_pct = nuevo
    h.completed_at = ahora if nuevo == 100 else None
    h.updated_at = ahora
    db.flush()
    _guardar_avance_fisico(p, hitos)
    despues = _avance(p, hitos)
    _auditar(
        db, quien, get_client_ip(request), p, "MILESTONE_PROGRESS",
        f"{quien.full_name} cargó {_porcentaje(nuevo)} en el hito {h.position} de {p.code}",
        anterior={"milestone_id": str(h.id), "progress": _porcentaje(previo)},
        nuevo={"milestone_id": str(h.id), "progress": _porcentaje(nuevo), "progress_date": fecha.isoformat()},
        justificacion=comentario or None,
    )
    db.commit()
    return ResultadoCarga(hito=h.position, antes=antes, despues=despues, completo=nuevo == 100)
