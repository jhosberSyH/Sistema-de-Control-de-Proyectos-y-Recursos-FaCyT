"""Auditoría global con el contrato del frontend (M8; vista 25; F8.5, F8.6). Solo lectura (RN-06).

Especificación: frontend/src/testing/mocks/handlers/auditoria.ts y frontend/src/modulos/reportes.

GET /api/auditoria?usuario&accion&objeto&desde&pagina   lo más reciente primero, 10 por página (Administrador)

app.audit_logs guarda la acción técnica (action_type), el objeto (target_table/target_id o el
target_object heredado) y los valores. Aquí se traduce a lo que lee una persona: la acción
(creacion, edicion, cambio-estado, sesion), su etiqueta, el objeto con su código y enlace, y una
descripción legible. Las filas nuevas traen new_value.descripcion y new_value.detalle; para las
antiguas la descripción se arma en español a partir de la acción y el objeto.
"""

import math
import re
from datetime import date
from typing import Any, Dict, List, Literal, Optional, Tuple

from fastapi import APIRouter, Depends, Query
from sqlalchemy import false
from sqlalchemy.orm import Session

from app.auditoria.models import AuditLog
from app.autenticacion.dependencies import require_admin
from app.core.api import ModeloApi, es_id_valido, normalizar
from app.core.database import ENUMS_BD, get_db
from app.modulos.reportes.formato import fecha_corta, iso_momento, limites, nombre_mes
from app.modulos.usuarios.models import (
    AccountingPeriod,
    Batch,
    Dispatch,
    Equipment,
    EquipmentReservation,
    Item,
    Location,
    Project,
    Request as Solicitud,
    SystemParameter,
    User,
)

router = APIRouter(tags=["Módulo 8: Auditoría"])

POR_PAGINA = 10
AccionAuditoria = Literal["creacion", "edicion", "cambio-estado", "sesion"]
ACCIONES = ("creacion", "edicion", "cambio-estado", "sesion")


# =============================================================================
# Esquemas del contrato
# =============================================================================

class UsuarioRegistro(ModeloApi):
    nombre: str
    rol: str


class RegistroAuditoria(ModeloApi):
    id: str
    fecha: str
    usuario: Optional[UsuarioRegistro] = None
    ip: Optional[str] = None
    accion: AccionAuditoria
    etiqueta: str
    objeto: str
    codigo: Optional[str] = None
    enlace: Optional[str] = None
    descripcion: str
    detalle: Optional[str] = None
    justificacion: Optional[str] = None
    valor_anterior: Optional[str] = None
    valor_nuevo: Optional[str] = None


class UsuarioFiltro(ModeloApi):
    id: str
    nombre: str


class PaginaAuditoria(ModeloApi):
    total: int
    filtrados: int
    pagina: int
    paginas: int
    por_pagina: int
    registros: List[RegistroAuditoria]
    usuarios: List[UsuarioFiltro]


# =============================================================================
# Traducción de una fila de app.audit_logs
# =============================================================================

SESION = {"LOGIN_SUCCESS", "LOGIN_FAILED", "LOGIN_BLOCKED_DEACTIVATED", "LOGOUT"}
ACCION_EXPLICITA = {
    "DISPATCH_EXECUTED": "creacion",
    "PASSWORD_CREATED": "edicion",
    "USER_PASSWORD_RESET": "edicion",
    "COORDINATOR_UNASSIGNED": "edicion",
    "COORDINATOR_ASSIGNED": "edicion",
    "PROJECT_PRIORITY_CHANGE": "edicion",
}
CLAVES_CREACION = ("CREATE", "OPENED", "RECEIVED", "UPLOADED", "REPORTED", "REQUESTED", "BOOTSTRAP", "INITIALIZATION")
CLAVES_ESTADO = ("STATUS", "APPROVE", "REJECT", "EXECUTE", "SUBMIT", "CANCEL", "CLOSED", "CONFIRMED", "PRORATION",
                 "DEACTIVATED", "REACTIVATED", "DENIED", "REPLENISHMENT_")

# Lo que hizo quien actúa, para describir filas que no traen descripción
VERBOS = {
    "LOGIN_SUCCESS": "inició sesión",
    "LOGOUT": "cerró sesión",
    "LOGIN_BLOCKED_DEACTIVATED": "intentó entrar con la cuenta desactivada",
    "PASSWORD_CREATED": "creó su contraseña",
    "INITIAL_BOOTSTRAP": "cargó los datos iniciales",
    "SYSTEM_INITIALIZATION": "cargó los datos iniciales",
    "REQUEST_CREATE": "creó",
    "REQUEST_UPDATE": "editó",
    "REQUEST_SUBMIT": "envió a aprobación",
    "REQUEST_APPROVE": "aprobó",
    "REQUEST_REJECT": "rechazó",
    "REQUEST_EXECUTE": "marcó como ejecutada",
    "RESERVATION_CREATE": "creó",
    "RESERVATION_SUBMIT": "envió a aprobación",
    "RESERVATION_APPROVE": "aprobó",
    "RESERVATION_REJECT": "rechazó",
    "RESERVATION_CANCELLED_MAINTENANCE": "canceló por mantenimiento",
    "EQUIPMENT_CREATE": "registró",
    "EQUIPMENT_UPDATE": "editó",
    "EQUIPMENT_STATUS_CHANGE": "cambió el estado de",
    "EQUIPMENT_USAGE_CREATE": "registró",
    "BATCH_RECEIVED": "recibió",
    "DISPATCH_EXECUTED": "registró",
    "RAW_MATERIAL_USAGE_REPORTED": "reportó",
    "DISPATCH_CORRECTION_REQUESTED": "pidió",
    "DISPATCH_CORRECTION_APPROVED": "aprobó",
    "DISPATCH_CORRECTION_DENIED": "denegó",
    "CREATE_AUTO_REPLENISHMENT": "generó",
    "UPDATE_MIN_STOCK": "cambió el stock mínimo de",
    "STATUS_CHANGE": "cambió el estatus de",
    "PROJECT_PRIORITY_CHANGE": "cambió la prioridad de",
    "COORDINATOR_ASSIGNED": "asignó el coordinador de",
    "COORDINATOR_UNASSIGNED": "dejó sin coordinador",
    "MILESTONE_CREATE": "agregó",
    "MILESTONE_UPDATE": "editó",
    "MILESTONE_PROGRESS": "registró el avance de",
    "QUOTE_UPLOADED": "adjuntó la cotización de",
    "PERIOD_REVIEW_OPENED": "abrió la revisión de",
    "ACCOUNTING_PERIOD_OPENED_FOR_REVIEW": "abrió la revisión de",
    "PROJECT_CHARGES_CONFIRMED": "confirmó los cargos de",
    "ACCOUNTING_PERIOD_CLOSED": "cerró",
    "OVERHEAD_PRORATION_APPLIED": "repartió los gastos compartidos de",
    "USER_CREATED": "creó",
    "USER_UPDATED": "editó",
    "USER_DEACTIVATED": "desactivó",
    "USER_REACTIVATED": "reactivó",
    "USER_PASSWORD_RESET": "restableció la contraseña de",
    "LOCATION_CREATED": "agregó",
    "LOCATION_UPDATED": "editó",
    "LOCATION_DEACTIVATED": "desactivó",
    "LOCATION_REACTIVATED": "reactivó",
    "LOCATION_DELETED": "eliminó",
    "PARAMETER_UPDATED": "cambió",
}
VERBO_POR_ACCION = {"creacion": "registró", "edicion": "editó", "cambio-estado": "cambió el estado de", "sesion": "inició sesión"}

# Valores que se muestran como "antes → después": los estados, prioridades y roles de la BD
VALORES_LEGIBLES = {v for valores in ENUMS_BD.values() for v in valores} | {"Por confirmar", "Confirmado"}
CLAVES_VALOR = ("status", "operational_status", "estado", "priority_level", "prioridad", "role")
ESTADO_PERIODO = {"Prorrateado": "Repartido"}
# "(F7.2 - HU-23)", "(F5.5)": referencias a requisitos que no le dicen nada a quien lee
REFERENCIAS = re.compile(r"\s*\((?:\s*(?:[A-Z]{1,3}-?\d+(?:\.\d+)?|IA-\d+|D\d+)\s*[-,/|y]?\s*)+\)")


def clasificar(action_type: str, valor_nuevo: Optional[Dict[str, Any]] = None) -> str:
    explicita = (valor_nuevo or {}).get("accion") if isinstance(valor_nuevo, dict) else None
    if explicita in ACCIONES:
        return explicita
    a = (action_type or "").upper()
    if a in SESION:
        return "sesion"
    if a in ACCION_EXPLICITA:
        return ACCION_EXPLICITA[a]
    if any(k in a for k in CLAVES_CREACION):
        return "creacion"
    if any(k in a for k in CLAVES_ESTADO):
        return "cambio-estado"
    return "edicion"


def _etiqueta(log: AuditLog, accion: str, descripcion: str) -> str:
    a = (log.action_type or "").upper()
    if accion == "creacion":
        return "Creación"
    if accion == "cambio-estado":
        return "Cambio de estado"
    if accion == "sesion":
        if a == "LOGOUT":
            return "Cierre de sesión"
        if a == "LOGIN_FAILED":
            return "Inicio de sesión fallido"
        if a == "LOGIN_BLOCKED_DEACTIVATED":
            return "Inicio de sesión bloqueado"
        return "Inicio de sesión"
    if "PRIORITY" in a or "la prioridad" in descripcion:
        return "Cambio de prioridad"
    if "el rol" in descripcion:
        return "Cambio de rol"
    return "Edición"


class Traductor:
    """Resuelve los objetos de las filas con cachés (una consulta por objeto distinto)."""

    def __init__(self, db: Session):
        self.db = db
        self._cache: Dict[Tuple[str, str], Any] = {}

    def _uno(self, modelo, campo, valor):
        if valor is None or valor == "":
            return None
        clave = (f"{modelo.__tablename__}.{campo.key}", str(valor))
        if clave not in self._cache:
            if campo.key == "id" and not es_id_valido(str(valor), self.db):
                self._cache[clave] = None
            else:
                self._cache[clave] = self.db.query(modelo).filter(campo == str(valor)).first()
        return self._cache[clave]

    def usuario(self, usuario_id: Optional[str]) -> Optional[User]:
        return self._uno(User, User.id, usuario_id) if usuario_id else None

    def objeto(self, log: AuditLog) -> Dict[str, Optional[str]]:
        """{texto, codigo, enlace, tipo} del registro afectado (L8: el enlace si el Administrador lo abre)."""
        tabla = (log.target_table or "").lower()
        tid = log.target_id
        prefijo, _, resto = (log.target_object or "").partition(":")
        prefijo = prefijo.upper()
        primero = resto.split(":")[0] if resto else ""
        nv = log.new_value if isinstance(log.new_value, dict) else {}

        if tabla == "projects" or prefijo in ("PROJECT", "PROYECTO"):
            p = self._uno(Project, Project.id, tid or primero) if (tid or es_id_valido(primero, self.db)) else None
            p = p or self._uno(Project, Project.code, primero)
            if p:
                return {"tipo": "proyecto", "texto": f"Proyecto {p.code}", "codigo": p.code, "enlace": f"/proyectos/{p.id}"}
            return {"tipo": "proyecto", "texto": f"Proyecto {primero or tid}", "codigo": primero or None, "enlace": None}
        if tabla == "users" or prefijo in ("USER", "AUTH"):
            u = self._uno(User, User.id, tid or primero)
            correo = u.email if u else (nv.get("attempted_email") or nv.get("email") or primero or tid or "")
            return {"tipo": "usuario", "texto": f"Cuenta {correo}".strip(), "codigo": None, "enlace": "/usuarios"}
        if tabla == "items" or prefijo in ("ITEM", "STOCK"):
            i = self._uno(Item, Item.id, tid) if tid else None
            i = i or self._uno(Item, Item.name, primero)
            nombre = i.name if i else primero
            return {"tipo": "insumo", "texto": f"Insumo {nombre}", "codigo": None, "enlace": f"/inventario/{i.id}" if i else None}
        if tabla == "batches" or prefijo == "LOTE":
            b = self._uno(Batch, Batch.id, tid) if tid else None
            b = b or self._uno(Batch, Batch.batch_number, primero)
            numero = b.batch_number if b else primero
            return {"tipo": "lote", "texto": f"Lote {numero}", "codigo": numero or None,
                    "enlace": f"/inventario/{b.item_id}" if b and b.item_id else None}
        if tabla in ("equipments", "equipment") or prefijo in ("EQUIPMENT", "EQUIPO"):
            e = self._uno(Equipment, Equipment.id, tid) if tid else None
            e = e or self._uno(Equipment, Equipment.asset_code, primero)
            return {"tipo": "equipo", "texto": f"Equipo {e.name if e else primero}", "codigo": e.asset_code if e else None,
                    "enlace": "/equipos"}
        if tabla == "locations" or prefijo in ("LOCATION", "UBICACION"):
            l = self._uno(Location, Location.id, tid or primero)
            return {"tipo": "ubicacion", "texto": f"Ubicación {l.name if l else primero}", "codigo": None,
                    "enlace": "/ubicaciones-parametros"}
        if tabla == "system_parameters" or prefijo in ("PARAMETER", "PARAMETRO"):
            sp = self._uno(SystemParameter, SystemParameter.id, tid) if tid else None
            sp = sp or self._uno(SystemParameter, SystemParameter.parameter_key, primero)
            nombre = (sp.label if sp and sp.label else (sp.parameter_key if sp else primero)).replace("_", " ")
            return {"tipo": "parametro", "texto": f"Parámetro {nombre}", "codigo": None, "enlace": "/ubicaciones-parametros"}
        if tabla == "requests" or prefijo in ("REQUEST", "SOLICITUD"):
            s = self._uno(Solicitud, Solicitud.id, tid) if tid else None
            s = s or self._uno(Solicitud, Solicitud.request_number, primero)
            numero = s.request_number if s else primero
            reposicion = (s.request_type == "Reposición automática") if s else numero.startswith("REP")
            return {"tipo": "solicitud", "texto": f"{'Reposición' if reposicion else 'Solicitud'} {numero}",
                    "codigo": numero or None, "enlace": None}
        if tabla == "equipment_reservations" or prefijo in ("RESERVATION", "RESERVA"):
            r = self._uno(EquipmentReservation, EquipmentReservation.id, tid or primero)
            e = self._uno(Equipment, Equipment.id, r.equipment_id) if r else None
            return {"tipo": "reserva", "texto": f"Reserva de {e.name}" if e else "Reserva de equipo", "codigo": None,
                    "enlace": None}
        if tabla == "dispatches" or prefijo in ("DESPACHO", "DISPATCH"):
            d = self._uno(Dispatch, Dispatch.id, tid) if tid else None
            numero = d.dispatch_number if d else primero
            return {"tipo": "despacho", "texto": f"Despacho {numero}", "codigo": numero or None, "enlace": None}
        if tabla == "dispatch_corrections" or prefijo in ("CORRECCION_DESPACHO", "CORRECTION"):
            return {"tipo": "correccion", "texto": f"Corrección de {primero}" if primero else "Corrección de despacho",
                    "codigo": primero or None, "enlace": None}
        if tabla == "accounting_periods" or prefijo in ("PERIOD", "PERIODO", "CIERRE_PERIODO", "PRORRATEO"):
            p = self._uno(AccountingPeriod, AccountingPeriod.id, tid or primero)
            if p and p.period_type == "Mensual":
                texto = f"Período {nombre_mes(p.start_date)} de {p.start_date.year}"
            elif p:
                texto = f"Período del {fecha_corta(p.start_date)} al {fecha_corta(p.end_date)}"
            else:
                texto = f"Período {primero}".strip()
            return {"tipo": "periodo", "texto": texto, "codigo": None, "enlace": "/cierre" if p else None}
        if prefijo == "MILESTONE":
            return {"tipo": "hito", "texto": f"Hito {resto}", "codigo": None, "enlace": None}
        if prefijo == "USO_MATERIA_PRIMA":
            partes = resto.split(":")
            codigo = partes[1] if len(partes) > 1 else None
            return {"tipo": "uso", "texto": f"Uso de materia prima de {codigo}" if codigo else "Uso de materia prima",
                    "codigo": codigo, "enlace": None}
        if prefijo == "EQUIPMENT_USAGE" or tabla == "equipment_usages":
            return {"tipo": "uso", "texto": "Uso de equipo", "codigo": None, "enlace": None}
        if prefijo == "SYSTEM" or tabla == "system":
            return {"tipo": "sistema", "texto": "Sistema", "codigo": None, "enlace": None}
        return {"tipo": "otro", "texto": log.target_object or "—", "codigo": None, "enlace": None}

    @staticmethod
    def valores(log: AuditLog, tipo: str) -> Tuple[Optional[str], Optional[str]]:
        nv = log.new_value if isinstance(log.new_value, dict) else {}
        ov = log.old_value if isinstance(log.old_value, dict) else {}
        anterior = nuevo = None
        for clave in CLAVES_VALOR:
            v = nv.get(clave)
            if isinstance(v, str) and v in VALORES_LEGIBLES:
                nuevo = v
                previo = ov.get(clave)
                anterior = previo if isinstance(previo, str) and previo in VALORES_LEGIBLES else None
                break
        if tipo == "periodo":
            anterior = ESTADO_PERIODO.get(anterior, anterior)
            nuevo = ESTADO_PERIODO.get(nuevo, nuevo)
        return anterior, nuevo

    def registro(self, log: AuditLog) -> RegistroAuditoria:
        nv = log.new_value if isinstance(log.new_value, dict) else {}
        u = self.usuario(log.user_id)
        accion = clasificar(log.action_type, nv)
        o = self.objeto(log)
        anterior, nuevo = self.valores(log, o["tipo"])
        descripcion = nv.get("descripcion") if isinstance(nv.get("descripcion"), str) else None
        if not descripcion:
            descripcion = self.describir(log, accion, o["texto"], u)
        objeto = f"{o['texto']} a {nuevo}" if accion == "cambio-estado" and nuevo else o["texto"]
        detalle = nv.get("detalle") if isinstance(nv.get("detalle"), str) else None
        justificacion = REFERENCIAS.sub("", log.justification).strip() if log.justification else None
        return RegistroAuditoria(
            id=str(log.id),
            fecha=iso_momento(log.timestamp),
            usuario=UsuarioRegistro(nombre=u.full_name, rol=u.role) if u else None,
            ip=log.ip_address if u else None,
            accion=accion,
            etiqueta=_etiqueta(log, accion, descripcion),
            objeto=objeto,
            codigo=o["codigo"],
            enlace=o["enlace"],
            descripcion=descripcion,
            detalle=detalle,
            justificacion=justificacion or None,
            valor_anterior=anterior,
            valor_nuevo=nuevo,
        )

    @staticmethod
    def describir(log: AuditLog, accion: str, objeto: str, u: Optional[User]) -> str:
        """Descripción en español para las filas que no la guardaron (registros anteriores al contrato)."""
        a = (log.action_type or "").upper()
        quien = u.full_name if u else "El sistema"
        nv = log.new_value if isinstance(log.new_value, dict) else {}
        if a == "LOGIN_FAILED":
            correo = nv.get("attempted_email") or nv.get("email")
            return f"Intento fallido de inicio de sesión{f' con {correo}' if correo else ''}"
        verbo = VERBOS.get(a)
        if a in ("LOGIN_SUCCESS", "LOGOUT", "LOGIN_BLOCKED_DEACTIVATED", "PASSWORD_CREATED", "INITIAL_BOOTSTRAP",
                 "SYSTEM_INITIALIZATION"):
            return f"{quien} {verbo}"
        verbo = verbo or VERBO_POR_ACCION[accion]
        objeto = objeto[:1].lower() + objeto[1:] if objeto and objeto != "—" else "un registro"
        return f"{quien} {verbo} {objeto}"


# =============================================================================
# GET /api/auditoria
# =============================================================================

def _desde(valor: Optional[str]) -> Optional[date]:
    try:
        return date.fromisoformat(valor) if valor and len(valor) == 10 else None
    except ValueError:
        return None


@router.get("/auditoria", response_model=PaginaAuditoria)
def consultar_auditoria(
    usuario: Optional[str] = Query(None),
    accion: Optional[str] = Query(None),
    objeto: Optional[str] = Query(None),
    desde: Optional[str] = Query(None),
    pagina: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    quien: User = Depends(require_admin),
):
    total = db.query(AuditLog).count()
    q = db.query(AuditLog)
    if usuario:
        q = q.filter(AuditLog.user_id == usuario) if es_id_valido(usuario, db) else q.filter(false())
    inicio = _desde(desde)
    if inicio:
        q = q.filter(AuditLog.timestamp >= limites(inicio, inicio)[0])
    filas = q.order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).all()

    t = Traductor(db)
    if accion:
        filas = [f for f in filas if clasificar(f.action_type, f.new_value if isinstance(f.new_value, dict) else None) == accion]
    texto = normalizar(objeto)
    if texto:
        def coincide(f: AuditLog) -> bool:
            o = t.objeto(f)
            r = t.registro(f)
            return texto in normalizar(f"{o['texto']} {o['codigo'] or ''} {f.target_object or ''} {r.descripcion}")
        filas = [f for f in filas if coincide(f)]

    paginas = max(1, math.ceil(len(filas) / POR_PAGINA))
    try:
        n = int(pagina) if pagina else 1
    except ValueError:
        n = 1
    n = min(max(1, n), paginas)
    ids = [uid for (uid,) in db.query(AuditLog.user_id).filter(AuditLog.user_id.isnot(None)).distinct()]
    usuarios = db.query(User).filter(User.id.in_(ids)).all() if ids else []
    return PaginaAuditoria(
        total=total,
        filtrados=len(filas),
        pagina=n,
        paginas=paginas,
        por_pagina=POR_PAGINA,
        registros=[t.registro(f) for f in filas[(n - 1) * POR_PAGINA:n * POR_PAGINA]],
        # Para el filtro: quienes tienen registros, en orden alfabético
        usuarios=[UsuarioFiltro(id=str(u.id), nombre=u.full_name) for u in sorted(usuarios, key=lambda u: normalizar(u.full_name))],
    )
