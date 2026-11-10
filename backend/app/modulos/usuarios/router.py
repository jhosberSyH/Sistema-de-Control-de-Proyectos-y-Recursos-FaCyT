"""Módulo 1 con el contrato del frontend (F1.1 a F1.5; RF-01 a RF-03). Solo el Administrador del Sistema.

Cuentas
  GET   /api/usuarios?q&rol&estado&pagina    lista paginada (8 por página)
  GET   /api/usuarios/{id}/impacto           qué pasa si cambia de rol o se desactiva
  POST  /api/usuarios                        crea la cuenta con contraseña temporal
  PATCH /api/usuarios/{id}                   nombre, correo y rol
  PATCH /api/usuarios/{id}/estado            desactiva o reactiva (nunca se borra)
  POST  /api/usuarios/{id}/clave-temporal    restablece la contraseña
Ubicaciones
  GET/POST /api/ubicaciones, PATCH /api/ubicaciones/{id}, PATCH /api/ubicaciones/{id}/estado,
  DELETE /api/ubicaciones/{id} (solo si nunca tuvo lotes ni tiene equipos)
Parámetros
  GET /api/parametros, PUT /api/parametros {valores: {clave: entero}}

Las reglas de negocio replican las del mock (frontend/src/testing/mocks/handlers/usuarios.ts y
catalogos.ts), que es la especificación acordada con las pantallas aprobadas.
"""

import math
import re
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.auditoria.models import AuditLog
from app.auditoria.service import record_audit_log
from app.autenticacion.dependencies import get_client_ip, require_admin
from app.core.api import (
    es_id_valido as _es_uuid,
    COORDINADOR,
    ROL_API,
    ROL_BD,
    ErrorValidacion,
    ModeloApi,
    conflicto,
    iniciales,
    iso,
    normalizar,
    rol_api,
)
from app.core.database import get_db
from app.core.security import hash_password
from app.modulos.usuarios.models import (
    Batch,
    Equipment,
    Location,
    Project,
    Request as Solicitud,
    SessionModel,
    SystemParameter,
    User,
)

router = APIRouter(tags=["Módulo 1: Usuarios, catálogos y parámetros"])

POR_PAGINA = 8
CORREO = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
ORDEN_ROL = {"administrador": 0, "aprobador": 1, "coordinador": 2}
NOMBRE_ROL = {v: k for k, v in ROL_API.items()}


# =============================================================================
# Esquemas
# =============================================================================

Rol = Literal["administrador", "coordinador", "aprobador"]
ClaveParametro = Literal["anticipacion_vencimiento_dias", "meses_minimos_pronostico"]


class Cuenta(ModeloApi):
    id: str
    nombre: str
    correo: str
    iniciales: str
    rol: Rol
    activo: bool
    ultimo_acceso: Optional[str]
    debe_cambiar_clave: bool
    proyectos: List[str]
    es_propia: bool


class PaginaCuentas(ModeloApi):
    items: List[Cuenta]
    total: int
    pagina: int
    paginas: int
    por_pagina: int


class ProyectoImpacto(ModeloApi):
    id: str
    codigo: str
    estatus: Literal["Propuesta", "En ejecución", "Suspendido"]


class Impacto(ModeloApi):
    proyectos: List[ProyectoImpacto]
    solicitudes_pendientes: List[str]
    unico_de_su_rol: bool


class DatosCuenta(ModeloApi):
    nombre: str = ""
    correo: str = ""
    rol: str = ""


class EstadoCuenta(ModeloApi):
    activo: Optional[bool] = None


class CuentaConClave(ModeloApi):
    cuenta: Cuenta
    clave_temporal: str


class Ubicacion(ModeloApi):
    id: str
    nombre: str
    descripcion: str
    activa: bool
    lotes: int
    equipos: int
    usada: bool


class ListaUbicaciones(ModeloApi):
    items: List[Ubicacion]


class DatosUbicacion(ModeloApi):
    nombre: str = ""
    descripcion: str = ""


class EstadoUbicacion(ModeloApi):
    activa: Optional[bool] = None


class UltimoCambio(ModeloApi):
    usuario: str
    anterior: int
    nuevo: int
    fecha: str


class Parametro(ModeloApi):
    clave: ClaveParametro
    valor: int
    ultimo_cambio: Optional[UltimoCambio]


class ListaParametros(ModeloApi):
    items: List[Parametro]


class GuardarParametros(ModeloApi):
    valores: Dict[str, Any] = {}


# =============================================================================
# Cuentas (F1.1 a F1.3)
# =============================================================================

def _proyectos_vigentes(db: Session, user_id: str) -> List[Project]:
    """Proyectos no finalizados que coordina la cuenta (los que quedarían sin coordinador)."""
    orden = {"En ejecución": 0, "Propuesta": 1, "Suspendido": 2, "Finalizado": 3}
    proyectos = (
        db.query(Project)
        .filter(Project.coordinator_id == user_id, Project.operational_status != "Finalizado")
        .all()
    )
    return sorted(proyectos, key=lambda p: (orden.get(p.operational_status, 9), p.code))


def _cuenta(db: Session, u: User, quien: User) -> Cuenta:
    activos = (
        db.query(Project.code)
        .filter(Project.coordinator_id == u.id, Project.operational_status == "En ejecución")
        .order_by(Project.code)
        .all()
    )
    return Cuenta(
        id=str(u.id),
        nombre=u.full_name,
        correo=u.email,
        iniciales=iniciales(u.full_name),
        rol=rol_api(u.role),
        activo=u.is_active,
        ultimo_acceso=iso(u.last_login_at),
        debe_cambiar_clave=bool(u.must_change_password),
        proyectos=[c for (c,) in activos],
        es_propia=u.id == quien.id,
    )


def _buscar_cuenta(db: Session, user_id: str) -> User:
    u = db.query(User).filter(User.id == user_id).first() if _es_uuid(user_id, db) else None
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Esa cuenta no existe.")
    return u




def _validar_cuenta(db: Session, datos: DatosCuenta, quien: User, propia: Optional[User] = None):
    nombre = " ".join(datos.nombre.split())
    correo = datos.correo.strip().lower()
    rol = datos.rol
    errores = {}
    if len(nombre) < 3:
        errores["nombre"] = "Escribe el nombre y el apellido de la persona."
    elif len(nombre) > 150:
        errores["nombre"] = "Usa como máximo 150 caracteres."
    if not CORREO.match(correo) or len(correo) > 255:
        errores["correo"] = "Escribe un correo válido, como nombre@uc.edu.ve."
    if rol not in ROL_BD:
        errores["rol"] = "Elige el rol de la cuenta."
    if errores:
        raise ErrorValidacion(errores)
    otra = db.query(User).filter(User.email == correo).first()
    if otra and (propia is None or otra.id != propia.id):
        # F1.1 y F1.2: se muestra la cuenta que ya usa el correo, no solo el error
        raise conflicto("Ya existe una cuenta con ese correo.", cuenta=_cuenta(db, otra, quien))
    return nombre, correo, ROL_BD[rol]


def _clave_temporal() -> str:
    alfabeto = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    c = "".join(secrets.choice(alfabeto) for _ in range(12))
    return f"{c[:4]}-{c[4:8]}-{c[8:]}"


def _liberar_proyectos(db: Session, u: User, quien: User, ip: str, motivo: str) -> List[str]:
    """Deja sin coordinador los proyectos vigentes; quedan en la bandeja del administrador (F1.2, F2.2)."""
    codigos = []
    for p in _proyectos_vigentes(db, u.id):
        p.coordinator_id = None
        codigos.append(p.code)
        record_audit_log(
            db=db, user_id=quien.id, ip_address=ip, target_object=f"PROJECT:{p.id}",
            target_table="projects", target_id=str(p.id), action_type="COORDINATOR_UNASSIGNED",
            old_value={"coordinator_id": str(u.id)},
            new_value={"coordinator_id": None, "motivo": motivo,
                       "descripcion": f"{p.code} quedó sin coordinador {motivo}"},
        )
    return codigos


def _texto_sin_coordinador(codigos: List[str]) -> Optional[str]:
    if not codigos:
        return None
    return f"{', '.join(codigos)} {'quedó' if len(codigos) == 1 else 'quedaron'} sin coordinador"


@router.get("/usuarios", response_model=PaginaCuentas)
def listar_cuentas(
    q: str = "",
    rol: Optional[str] = None,
    estado: str = "activas",
    pagina: int = Query(1),
    db: Session = Depends(get_db),
    quien: User = Depends(require_admin),
):
    texto = normalizar(q.strip())
    cuentas = []
    for u in db.query(User).all():
        if texto and texto not in normalizar(u.full_name) and texto not in u.email:
            continue
        if rol in ROL_BD and u.role != ROL_BD[rol]:
            continue
        if estado == "activas" and not u.is_active:
            continue
        if estado == "desactivadas" and u.is_active:
            continue
        cuentas.append(u)
    # Activas primero; dentro, por rol (administrador, aprobador, coordinadores) y por nombre (mockup 04)
    cuentas.sort(key=lambda u: (not u.is_active, ORDEN_ROL.get(rol_api(u.role), 9), normalizar(u.full_name)))
    paginas = max(1, math.ceil(len(cuentas) / POR_PAGINA))
    pagina = min(max(1, pagina), paginas)
    tramo = cuentas[(pagina - 1) * POR_PAGINA: pagina * POR_PAGINA]
    return PaginaCuentas(
        items=[_cuenta(db, u, quien) for u in tramo],
        total=len(cuentas), pagina=pagina, paginas=paginas, por_pagina=POR_PAGINA,
    )


@router.get("/usuarios/{user_id}/impacto", response_model=Impacto)
def impacto_cuenta(user_id: str, db: Session = Depends(get_db), quien: User = Depends(require_admin)):
    u = _buscar_cuenta(db, user_id)
    activos_del_rol = db.query(User).filter(User.role == u.role, User.is_active.is_(True)).count()
    pendientes = (
        db.query(Solicitud.request_number)
        .filter(Solicitud.requester_user_id == u.id, Solicitud.status == "Pendiente de Aprobación")
        .order_by(Solicitud.request_number)
        .all()
    )
    return Impacto(
        proyectos=[ProyectoImpacto(id=str(p.id), codigo=p.code, estatus=p.operational_status) for p in _proyectos_vigentes(db, u.id)],
        solicitudes_pendientes=[n for (n,) in pendientes],
        unico_de_su_rol=u.is_active and activos_del_rol == 1,
    )


@router.post("/usuarios", response_model=CuentaConClave, status_code=status.HTTP_201_CREATED)
def crear_cuenta(
    datos: DatosCuenta, request: Request, db: Session = Depends(get_db), quien: User = Depends(require_admin)
):
    nombre, correo, rol = _validar_cuenta(db, datos, quien)
    clave = _clave_temporal()
    nueva = User(
        full_name=nombre, email=correo, role=rol, is_active=True,
        password_hash=hash_password(clave), must_change_password=True,
    )
    db.add(nueva)
    db.flush()
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"USER:{nueva.id}",
        target_table="users", target_id=str(nueva.id), action_type="USER_CREATED",
        # La contraseña nunca va al audit log
        new_value={"full_name": nombre, "email": correo, "role": rol, "is_active": True,
                   "descripcion": f"{quien.full_name} creó la cuenta de {nombre}",
                   "detalle": f"{rol} · {correo}"},
    )
    db.commit()
    db.refresh(nueva)
    return CuentaConClave(cuenta=_cuenta(db, nueva, quien), clave_temporal=clave)


@router.patch("/usuarios/{user_id}", response_model=Cuenta)
def editar_cuenta(
    user_id: str, datos: DatosCuenta, request: Request,
    db: Session = Depends(get_db), quien: User = Depends(require_admin),
):
    u = _buscar_cuenta(db, user_id)
    nombre, correo, rol = _validar_cuenta(db, datos, quien, propia=u)
    cambia_rol = rol != u.role
    if cambia_rol and u.id == quien.id:
        raise conflicto("No puedes cambiar tu propio rol. Pídeselo a otro administrador.")
    cambios = [t for t in (
        nombre != u.full_name and f"Nombre: {u.full_name} → {nombre}",
        correo != u.email and f"Correo: {u.email} → {correo}",
    ) if t]
    if not cambia_rol and not cambios:
        return _cuenta(db, u, quien)

    ip = get_client_ip(request)
    anterior = {"full_name": u.full_name, "email": u.email, "role": u.role}
    liberados = (
        _liberar_proyectos(db, u, quien, ip, f"al cambiar el rol de {u.full_name}")
        if cambia_rol and u.role == COORDINADOR else []
    )
    nombre_anterior, rol_anterior = u.full_name, u.role
    u.full_name, u.email, u.role = nombre, correo, rol
    if cambia_rol:
        # El rol nuevo aplica desde la siguiente acción: se cierran sus sesiones abiertas
        db.query(SessionModel).filter(SessionModel.user_id == u.id).delete()
    descripcion = (
        f"{quien.full_name} cambió el rol de {nombre_anterior} de {rol_anterior} a {rol}" if cambia_rol
        else f"{quien.full_name} editó los datos de la cuenta de {nombre_anterior}"
    )
    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=f"USER:{u.id}",
        target_table="users", target_id=str(u.id), action_type="USER_UPDATED",
        old_value=anterior,
        new_value={"full_name": nombre, "email": correo, "role": rol, "descripcion": descripcion,
                   "detalle": " · ".join([*cambios, *filter(None, [_texto_sin_coordinador(liberados)])]) or None},
    )
    db.commit()
    db.refresh(u)
    return _cuenta(db, u, quien)


@router.patch("/usuarios/{user_id}/estado", response_model=Cuenta)
def cambiar_estado_cuenta(
    user_id: str, datos: EstadoCuenta, request: Request,
    db: Session = Depends(get_db), quien: User = Depends(require_admin),
):
    u = _buscar_cuenta(db, user_id)
    if datos.activo is None:
        raise ErrorValidacion({"activo": "Indica si la cuenta queda activa."})
    if not datos.activo and u.id == quien.id:
        raise conflicto("No puedes desactivar tu propia cuenta. Pídeselo a otro administrador.")
    if u.is_active == datos.activo:
        return _cuenta(db, u, quien)

    ip = get_client_ip(request)
    liberados = []
    if not datos.activo:
        if u.role == COORDINADOR:
            liberados = _liberar_proyectos(db, u, quien, ip, f"al desactivar la cuenta de {u.full_name}")
        # F1.3: pierde el acceso de inmediato
        db.query(SessionModel).filter(SessionModel.user_id == u.id).delete()
    u.is_active = datos.activo
    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=f"USER:{u.id}",
        target_table="users", target_id=str(u.id),
        action_type="USER_REACTIVATED" if datos.activo else "USER_DEACTIVATED",
        old_value={"is_active": not datos.activo},
        new_value={"is_active": datos.activo,
                   "descripcion": f"{quien.full_name} {'reactivó' if datos.activo else 'desactivó'} la cuenta de {u.full_name}",
                   "detalle": _texto_sin_coordinador(liberados)},
    )
    db.commit()
    db.refresh(u)
    return _cuenta(db, u, quien)


@router.post("/usuarios/{user_id}/clave-temporal", response_model=CuentaConClave)
def restablecer_clave(
    user_id: str, request: Request, db: Session = Depends(get_db), quien: User = Depends(require_admin)
):
    u = _buscar_cuenta(db, user_id)
    if u.id == quien.id:
        raise conflicto("Tu propia contraseña no se restablece aquí. Pídeselo a otro administrador.")
    if not u.is_active:
        raise conflicto("Reactiva la cuenta antes de restablecer su contraseña.")
    clave = _clave_temporal()
    u.password_hash = hash_password(clave)
    u.must_change_password = True
    # Se cierran las sesiones abiertas de la cuenta
    db.query(SessionModel).filter(SessionModel.user_id == u.id).delete()
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"USER:{u.id}",
        target_table="users", target_id=str(u.id), action_type="USER_PASSWORD_RESET",
        new_value={"descripcion": f"{quien.full_name} restableció la contraseña de {u.full_name}"},
    )
    db.commit()
    db.refresh(u)
    return CuentaConClave(cuenta=_cuenta(db, u, quien), clave_temporal=clave)


# =============================================================================
# Ubicaciones (F1.4)
# =============================================================================

def _ubicacion(db: Session, u: Location) -> Ubicacion:
    lotes_total = db.query(Batch).filter(Batch.location_id == u.id).count()
    lotes_con_existencia = db.query(Batch).filter(Batch.location_id == u.id, Batch.available_quantity > 0).count()
    equipos = db.query(Equipment).filter(Equipment.location_id == u.id).count()
    return Ubicacion(
        id=str(u.id), nombre=u.name, descripcion=u.description or "", activa=u.is_active,
        lotes=lotes_con_existencia, equipos=equipos, usada=lotes_total > 0 or equipos > 0,
    )


def _buscar_ubicacion(db: Session, ubicacion_id: str) -> Location:
    u = db.query(Location).filter(Location.id == ubicacion_id).first() if _es_uuid(ubicacion_id, db) else None
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Esa ubicación no existe.")
    return u


def _choca(db: Session, nombre: str, excepto: Optional[str] = None) -> Optional[Location]:
    """Otra ubicación activa con el mismo nombre, sin distinguir mayúsculas, tildes ni espacios (F1.4)."""
    clave = normalizar(nombre)
    for u in db.query(Location).filter(Location.is_active.is_(True)).all():
        if u.id != excepto and normalizar(u.name) == clave:
            return u
    return None


def _validar_ubicacion(datos: DatosUbicacion):
    nombre = " ".join(datos.nombre.split())
    descripcion = " ".join(datos.descripcion.split())
    errores = {}
    if len(nombre) < 3:
        errores["nombre"] = 'Escribe el nombre de la ubicación, por ejemplo "Depósito de reactivos C".'
    elif len(nombre) > 80:
        errores["nombre"] = "Usa como máximo 80 caracteres."
    if len(descripcion) > 160:
        errores["descripcion"] = "Usa como máximo 160 caracteres."
    if errores:
        raise ErrorValidacion(errores)
    return nombre, descripcion


def _conflicto_ubicacion(db: Session, u: Location) -> HTTPException:
    return conflicto(
        "Ya existe una ubicación activa con ese nombre. Usa otro nombre o edita la existente.",
        ubicacion=_ubicacion(db, u),
    )


@router.get("/ubicaciones", response_model=ListaUbicaciones)
def listar_ubicaciones(db: Session = Depends(get_db), quien: User = Depends(require_admin)):
    ubicaciones = sorted(db.query(Location).all(), key=lambda u: (not u.is_active, normalizar(u.name)))
    return ListaUbicaciones(items=[_ubicacion(db, u) for u in ubicaciones])


@router.post("/ubicaciones", response_model=Ubicacion, status_code=status.HTTP_201_CREATED)
def crear_ubicacion(
    datos: DatosUbicacion, request: Request, db: Session = Depends(get_db), quien: User = Depends(require_admin)
):
    nombre, descripcion = _validar_ubicacion(datos)
    otra = _choca(db, nombre)
    if otra:
        raise _conflicto_ubicacion(db, otra)
    nueva = Location(name=nombre, description=descripcion or None, is_active=True)
    db.add(nueva)
    db.flush()
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"LOCATION:{nueva.id}",
        target_table="locations", target_id=str(nueva.id), action_type="LOCATION_CREATED",
        new_value={"name": nombre, "description": descripcion or None, "is_active": True,
                   "descripcion": f"{quien.full_name} agregó la ubicación {nombre}", "detalle": descripcion or None},
    )
    db.commit()
    db.refresh(nueva)
    return _ubicacion(db, nueva)


@router.patch("/ubicaciones/{ubicacion_id}", response_model=Ubicacion)
def editar_ubicacion(
    ubicacion_id: str, datos: DatosUbicacion, request: Request,
    db: Session = Depends(get_db), quien: User = Depends(require_admin),
):
    u = _buscar_ubicacion(db, ubicacion_id)
    nombre, descripcion = _validar_ubicacion(datos)
    if u.is_active:
        otra = _choca(db, nombre, excepto=u.id)
        if otra:
            raise _conflicto_ubicacion(db, otra)
    actual_desc = u.description or ""
    cambios = [t for t in (
        nombre != u.name and f"Nombre: {u.name} → {nombre}",
        descripcion != actual_desc and f"Descripción: {actual_desc or '—'} → {descripcion or '—'}",
    ) if t]
    if not cambios:
        return _ubicacion(db, u)
    anterior = {"name": u.name, "description": u.description}
    nombre_anterior = u.name
    u.name, u.description = nombre, descripcion or None
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"LOCATION:{u.id}",
        target_table="locations", target_id=str(u.id), action_type="LOCATION_UPDATED",
        old_value=anterior,
        new_value={"name": nombre, "description": descripcion or None,
                   "descripcion": f"{quien.full_name} editó la ubicación {nombre_anterior}", "detalle": " · ".join(cambios)},
    )
    db.commit()
    db.refresh(u)
    return _ubicacion(db, u)


@router.patch("/ubicaciones/{ubicacion_id}/estado", response_model=Ubicacion)
def cambiar_estado_ubicacion(
    ubicacion_id: str, datos: EstadoUbicacion, request: Request,
    db: Session = Depends(get_db), quien: User = Depends(require_admin),
):
    u = _buscar_ubicacion(db, ubicacion_id)
    if datos.activa is None:
        raise ErrorValidacion({"activa": "Indica si la ubicación queda activa."})
    if u.is_active == datos.activa:
        return _ubicacion(db, u)
    if datos.activa:
        otra = _choca(db, u.name, excepto=u.id)
        if otra:
            raise conflicto(f'Ya hay otra ubicación activa llamada "{otra.name}". Cambia el nombre de una de las dos.')
    u.is_active = datos.activa
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"LOCATION:{u.id}",
        target_table="locations", target_id=str(u.id),
        action_type="LOCATION_REACTIVATED" if datos.activa else "LOCATION_DEACTIVATED",
        old_value={"is_active": not datos.activa},
        new_value={"is_active": datos.activa,
                   "descripcion": f"{quien.full_name} {'reactivó' if datos.activa else 'desactivó'} la ubicación {u.name}"},
    )
    db.commit()
    db.refresh(u)
    return _ubicacion(db, u)


@router.delete("/ubicaciones/{ubicacion_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def eliminar_ubicacion(
    ubicacion_id: str, request: Request, db: Session = Depends(get_db), quien: User = Depends(require_admin)
):
    u = _buscar_ubicacion(db, ubicacion_id)
    vista = _ubicacion(db, u)
    if vista.usada:
        raise conflicto(
            "Esta ubicación tiene equipos, así que no se elimina: desactívala para que deje de aparecer."
            if vista.equipos > 0 else
            "Esta ubicación tuvo lotes, así que no se elimina: desactívala para que deje de aparecer."
        )
    record_audit_log(
        db=db, user_id=quien.id, ip_address=get_client_ip(request), target_object=f"LOCATION:{u.id}",
        target_table="locations", target_id=str(u.id), action_type="LOCATION_DELETED",
        old_value={"name": u.name, "description": u.description},
        new_value={"descripcion": f"{quien.full_name} eliminó la ubicación {u.name}",
                   "detalle": "Nunca tuvo lotes ni equipos"},
    )
    db.delete(u)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# =============================================================================
# Parámetros (F1.5)
# =============================================================================

# Clave del contrato -> clave en app.system_parameters, con su rango y textos
PARAMETROS = {
    "anticipacion_vencimiento_dias": {
        "bd": "batch_expiration_alert_days", "maximo": 365, "unidad": "días",
        "nombre": "la anticipación de la alerta de vencimiento",
    },
    "meses_minimos_pronostico": {
        "bd": "min_dispatch_history_months", "maximo": 60, "unidad": "meses",
        "nombre": "el historial mínimo para el pronóstico",
    },
}


def _ultimo_cambio(db: Session, clave_bd: str) -> Optional[UltimoCambio]:
    log = (
        db.query(AuditLog)
        .filter(AuditLog.target_object == f"SYSTEM_PARAMETER:{clave_bd}", AuditLog.action_type == "PARAMETER_UPDATED")
        .order_by(AuditLog.timestamp.desc())
        .first()
    )
    if not log:
        return None
    usuario = db.query(User).filter(User.id == log.user_id).first() if log.user_id else None
    return UltimoCambio(
        usuario=usuario.full_name if usuario else "Sistema",
        anterior=int((log.old_value or {}).get("parameter_value", 0)),
        nuevo=int((log.new_value or {}).get("parameter_value", 0)),
        fecha=iso(log.timestamp),
    )


def _parametros(db: Session) -> ListaParametros:
    items = []
    for clave, definicion in PARAMETROS.items():
        p = db.query(SystemParameter).filter(SystemParameter.parameter_key == definicion["bd"]).first()
        if p:
            items.append(Parametro(clave=clave, valor=p.parameter_value, ultimo_cambio=_ultimo_cambio(db, p.parameter_key)))
    return ListaParametros(items=items)


@router.get("/parametros", response_model=ListaParametros)
def listar_parametros(db: Session = Depends(get_db), quien: User = Depends(require_admin)):
    return _parametros(db)


@router.put("/parametros", response_model=ListaParametros)
def guardar_parametros(
    datos: GuardarParametros, request: Request, db: Session = Depends(get_db), quien: User = Depends(require_admin)
):
    errores = {}
    for clave, valor in datos.valores.items():
        definicion = PARAMETROS.get(clave)
        if not definicion:
            errores[clave] = "Ese parámetro no existe."
        elif isinstance(valor, bool) or not isinstance(valor, int) or valor < 1:
            errores[clave] = "Escribe un número entero mayor que cero, por ejemplo 30."
        elif valor > definicion["maximo"]:
            errores[clave] = f"Usa como máximo {definicion['maximo']} {definicion['unidad']}."
    if errores:
        raise ErrorValidacion(errores)

    ip = get_client_ip(request)
    # El valor nuevo aplica desde este momento; cada cambio queda con el valor anterior y el nuevo (F1.5)
    for clave, valor in datos.valores.items():
        definicion = PARAMETROS[clave]
        p = db.query(SystemParameter).filter(SystemParameter.parameter_key == definicion["bd"]).first()
        if not p or p.parameter_value == valor:
            continue
        anterior = p.parameter_value
        p.parameter_value = valor
        p.updated_by_user_id = quien.id
        record_audit_log(
            db=db, user_id=quien.id, ip_address=ip, target_object=f"SYSTEM_PARAMETER:{p.parameter_key}",
            target_table="system_parameters", target_id=str(p.id), action_type="PARAMETER_UPDATED",
            old_value={"parameter_value": anterior},
            new_value={"parameter_value": valor,
                       "descripcion": f"{quien.full_name} cambió {definicion['nombre']} de {anterior} a {valor} {definicion['unidad']}"},
        )
    db.commit()
    return _parametros(db)
