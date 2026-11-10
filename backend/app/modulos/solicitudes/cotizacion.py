"""Cotización de una solicitud de gasto (decisión 7).

POST /api/solicitudes/{id}/cotizacion   multipart, campo "archivo" (PDF, máx. MAX_COTIZACION_MB)
                                        -> 200 {nombre, tamano}. Solo el coordinador del proyecto y
                                        solo mientras la solicitud es un borrador de gasto.
GET  /api/solicitudes/{id}/cotizacion   -> el PDF. Aprobador, administrador o el coordinador del proyecto.

El archivo vive en el almacenamiento (Supabase Storage o disco local); la BD guarda solo la ruta.
"""

import re
import unicodedata
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Request as HttpRequest, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.almacenamiento.service import Almacen, ErrorAlmacenamiento, obtener_almacen
from app.auditoria.service import record_audit_log
from app.autenticacion.dependencies import get_client_ip, get_current_user
from app.core.api import COORDINADOR, ErrorValidacion, ModeloApi, conflicto, es_id_valido
from app.core.config import settings
from app.core.database import get_db
from app.modulos.usuarios.models import Request, User

router = APIRouter(tags=["Módulo 5: Solicitudes y Priorización"])


class CotizacionGuardada(ModeloApi):
    nombre: str
    tamano: int


def _solicitud(db: Session, request_id: str) -> Request:
    s = db.query(Request).filter(Request.id == request_id).first() if es_id_valido(request_id, db) else None
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Esa solicitud no existe.")
    return s


def _es_del_coordinador(s: Request, u: User) -> bool:
    return bool(s.project and s.project.coordinator_id == u.id)


def _nombre_seguro(nombre: str) -> str:
    """Nombre para mostrar y para Content-Disposition: sin rutas ni caracteres raros, termina en .pdf."""
    base = (nombre or "").replace("\\", "/").split("/")[-1]
    base = unicodedata.normalize("NFKD", base).encode("ascii", "ignore").decode()
    base = re.sub(r"[^A-Za-z0-9._ -]+", "", base).strip(" .") or "cotizacion"
    if not base.lower().endswith(".pdf"):
        base += ".pdf"
    return base[:120]


@router.post("/solicitudes/{request_id}/cotizacion", response_model=CotizacionGuardada)
async def subir_cotizacion(
    request_id: str,
    request: HttpRequest,
    archivo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    u: User = Depends(get_current_user),
    almacen: Almacen = Depends(obtener_almacen),
):
    s = _solicitud(db, request_id)
    if u.role != COORDINADOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el coordinador del proyecto adjunta la cotización.")
    if not _es_del_coordinador(s, u):
        # Igual que en el resto de M5: las solicitudes de otros coordinadores no se muestran (RN-07)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Esa solicitud no existe.")
    if s.request_type != "Gasto":
        raise conflicto("Solo las solicitudes de gasto llevan cotización.")
    if s.status != "Borrador":
        raise conflicto("La cotización solo se cambia mientras la solicitud es un borrador.")

    if archivo is None:
        raise ErrorValidacion({"archivo": "Adjunta la cotización en PDF."})
    maximo = settings.MAX_COTIZACION_MB * 1024 * 1024
    contenido = await archivo.read(maximo + 1)
    if not contenido:
        raise ErrorValidacion({"archivo": "El archivo está vacío."})
    if len(contenido) > maximo:
        raise ErrorValidacion({"archivo": f"El PDF pesa más de {settings.MAX_COTIZACION_MB} MB. Comprímelo o escanéalo con menos resolución."})
    # Se revisa el contenido, no solo la extensión: un PDF empieza con "%PDF-"
    if not contenido.startswith(b"%PDF-"):
        raise ErrorValidacion({"archivo": "La cotización debe ser un PDF."})

    nombre = _nombre_seguro(archivo.filename)
    ruta = f"solicitudes/{s.id}/cotizacion.pdf"
    try:
        almacen.guardar(ruta, contenido, "application/pdf")
    except ErrorAlmacenamiento as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                            detail="No pudimos guardar la cotización. Inténtalo de nuevo en unos minutos.") from e

    anterior = s.quote_filename
    s.quote_path = ruta
    s.quote_filename = nombre
    s.quote_size_bytes = len(contenido)
    s.quote_uploaded_at = datetime.now(timezone.utc)
    record_audit_log(
        db=db, user_id=u.id, ip_address=get_client_ip(request), target_object=f"REQUEST:{s.id}",
        target_table="requests", target_id=str(s.id), action_type="QUOTE_UPLOADED",
        old_value={"quote_filename": anterior} if anterior else None,
        new_value={"quote_filename": nombre, "quote_size_bytes": len(contenido),
                   "descripcion": f"{u.full_name} adjuntó la cotización de {s.request_number}"},
    )
    db.commit()
    return CotizacionGuardada(nombre=nombre, tamano=len(contenido))


@router.get("/solicitudes/{request_id}/cotizacion", response_class=Response)
def descargar_cotizacion(
    request_id: str,
    db: Session = Depends(get_db),
    u: User = Depends(get_current_user),
    almacen: Almacen = Depends(obtener_almacen),
):
    s = _solicitud(db, request_id)
    if u.role == COORDINADOR and not _es_del_coordinador(s, u):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Esa solicitud no existe.")
    if not s.quote_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Esta solicitud no tiene cotización.")
    try:
        contenido = almacen.leer(s.quote_path)
    except ErrorAlmacenamiento as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                            detail="No pudimos traer la cotización. Inténtalo de nuevo en unos minutos.") from e
    return Response(
        content=contenido,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{s.quote_filename or "cotizacion.pdf"}"',
                 "Cache-Control": "private, no-store"},
    )
