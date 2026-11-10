"""Avisos internos (decisión 6): la campana del encabezado.

Cada módulo llama a ``avisar`` dentro de la misma transacción del evento, así el aviso existe si y
solo si el cambio se guardó. Los enlaces son rutas del frontend.
"""

from typing import Iterable, List, Optional

from sqlalchemy.orm import Session

from app.modulos.usuarios.models import Notification, User

TIPOS = ("ok", "warn", "err", "info")


def avisar(
    db: Session,
    usuario_id: Optional[str],
    tipo: str,
    titulo: str,
    enlace: str,
    detalle: Optional[str] = None,
) -> Optional[Notification]:
    """Crea un aviso para una persona. Sin destinatario (p. ej. proyecto sin coordinador) no hace nada."""
    if not usuario_id:
        return None
    if tipo not in TIPOS:
        raise ValueError(f"Tipo de aviso desconocido: {tipo}")
    aviso = Notification(
        user_id=usuario_id,
        kind=tipo,
        title=titulo[:200],
        detail=detalle,
        link=enlace[:300],
    )
    db.add(aviso)
    return aviso


def avisar_a(db: Session, usuarios: Iterable[Optional[str]], tipo: str, titulo: str, enlace: str,
             detalle: Optional[str] = None) -> List[Notification]:
    """El mismo aviso para varias personas (sin repetir)."""
    creados = []
    for uid in dict.fromkeys(u for u in usuarios if u):
        creados.append(avisar(db, uid, tipo, titulo, enlace, detalle))
    return creados


def ids_por_rol(db: Session, rol: str) -> List[str]:
    """Cuentas activas de un rol (nombre largo de la BD)."""
    return [uid for (uid,) in db.query(User.id).filter(User.role == rol, User.is_active.is_(True)).all()]
