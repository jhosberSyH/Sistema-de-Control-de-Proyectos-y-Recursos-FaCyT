"""Reglas de inventario que usan el contrato del frontend (M3) y otros módulos.

- Fechas en la zona de la organización (APP_TIMEZONE): "hoy", el día local de un despacho.
- Formato de cantidades como los textos del frontend ("2,5 L", "450 g").
- Reposición automática (F3.4, F3.5): ``revisar_reposicion`` después de cambiar stock o mínimo, y
  ``aprobar_reposicion`` / ``descartar_reposicion`` para la decisión del aprobador. Estas dos las llama
  el router de M5 (``POST /api/solicitudes/{id}/aprobar|rechazar``) cuando la solicitud es una
  "Reposición automática".
- Pronóstico de consumo (F3.7): Holt con tendencia amortiguada, igual que el mock.
"""

import math
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.auditoria.service import record_audit_log
from app.core.api import ErrorValidacion, conflicto
from app.core.config import settings
from app.modulos.inventario.service import (
    _minuscula,
    check_and_create_replenishment,
    get_system_param_int,
    reposicion_abierta,
)
from app.modulos.usuarios.models import AccountingPeriod, Item, Request, RequestItem, User

try:  # Windows sin tzdata: Caracas es UTC-4 todo el año (sin horario de verano)
    from zoneinfo import ZoneInfo

    ZONA = ZoneInfo(settings.APP_TIMEZONE)
except Exception:  # pragma: no cover
    ZONA = timezone(timedelta(hours=-4))

APROBADOR = "Aprobador / Gestor de Inventario"


# --- Fechas ----------------------------------------------------------------------------------------

def hoy() -> date:
    return datetime.now(ZONA).date()


def fecha_local(momento: datetime) -> date:
    """Día de la organización en que ocurrió un instante (los de SQLite llegan sin zona: son UTC)."""
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    return momento.astimezone(ZONA).date()


def inicio_del_dia(dia: date) -> datetime:
    return datetime.combine(dia, time.min, ZONA)


def dias_hasta(dia: date) -> int:
    return (dia - hoy()).days


def leer_fecha(valor) -> Optional[date]:
    """AAAA-MM-DD estricto, como el mock."""
    if not isinstance(valor, str) or len(valor) != 10:
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError:
        return None


def mes_de(dia: date) -> Tuple[date, date]:
    inicio = dia.replace(day=1)
    siguiente = (inicio + timedelta(days=32)).replace(day=1)
    return inicio, siguiente - timedelta(days=1)


def mes_atras(atras: int) -> str:
    """AAAA-MM del mes que está n meses antes del actual."""
    d = hoy()
    total = d.year * 12 + (d.month - 1) - atras
    return f"{total // 12:04d}-{total % 12 + 1:02d}"


# --- Números y textos ------------------------------------------------------------------------------

def cantidad(valor) -> float:
    return round(float(valor or 0), 3)


def dinero(valor) -> float:
    return round(float(valor or 0), 2)


def num(valor) -> str:
    """2.5 → "2,5"; 2.0 → "2" (como String(n) en JS)."""
    texto = f"{round(float(valor), 3):.3f}".rstrip("0").rstrip(".")
    return (texto if texto not in ("-0", "") else "0").replace(".", ",")


def legible(valor, unidad: str) -> str:
    """"450 g" en lugar de "0,45 kg": las fracciones de kilo y de litro se leen mejor en g y mL."""
    v = abs(float(valor))
    nbsp = " "
    if unidad == "kg" and v < 1:
        return f"{num(v * 1000)}{nbsp}g"
    if unidad == "L" and v < 1:
        return f"{num(v * 1000)}{nbsp}mL"
    return f"{num(v)}{nbsp}{unidad}"


def numero_valido(valor) -> Optional[float]:
    """Un número del JSON (no bool ni texto), como typeof === 'number' en el mock."""
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        return None
    if isinstance(valor, float) and (math.isnan(valor) or math.isinf(valor)):
        return None
    return float(valor)


def texto(valor, maximo: int) -> str:
    return valor.strip()[:maximo] if isinstance(valor, str) else ""


# --- Parámetros y períodos -------------------------------------------------------------------------

def anticipacion(db: Session) -> int:
    return get_system_param_int(db, "batch_expiration_alert_days", 30)


def meses_requeridos(db: Session) -> int:
    return get_system_param_int(db, "min_dispatch_history_months", 3)


def periodo_en_curso(db: Session) -> Optional[AccountingPeriod]:
    for estado in ("En revisión", "Abierto"):
        p = db.query(AccountingPeriod).filter(AccountingPeriod.status == estado).order_by(AccountingPeriod.start_date).first()
        if p:
            return p
    return None


def periodo_cerrado_en(db: Session, dia: date) -> Optional[AccountingPeriod]:
    """Período cerrado (o ya repartido) que contiene el día: ahí no entran movimientos (F7.2)."""
    return (
        db.query(AccountingPeriod)
        .filter(
            AccountingPeriod.status.in_(["Cerrado", "Prorrateado"]),
            AccountingPeriod.start_date <= dia,
            AccountingPeriod.end_date >= dia,
        )
        .first()
    )


# --- Reposición automática (F3.4, F3.5) ------------------------------------------------------------

def revisar_reposicion(db: Session, item: Item, user_id: Optional[str], ip: str) -> Optional[str]:
    """Si el insumo quedó bajo su mínimo y no tiene una reposición abierta, crea una en Borrador y avisa
    a los aprobadores. Devuelve el número de la reposición creada, o None."""
    if not item.min_stock or Decimal(str(item.current_stock)) >= Decimal(str(item.min_stock)):
        return None
    if reposicion_abierta(db, item.id):
        return None
    nueva = check_and_create_replenishment(db, item, user_id, ip)
    return nueva.request_number if nueva else None


def _linea(db: Session, s: Request) -> Tuple[Optional[RequestItem], Optional[Item]]:
    linea = db.query(RequestItem).filter(RequestItem.request_id == s.id).first()
    return linea, (db.get(Item, linea.item_id) if linea else None)


def _por_decidir(s: Request) -> None:
    if s.status not in ("Borrador", "Pendiente de Aprobación"):
        raise conflicto(f"{s.request_number} ya está en estado {s.status}: no se puede decidir de nuevo.")


def aprobar_reposicion(db: Session, s: Request, cantidad_aprobada, quien: User, ip: str) -> Dict:
    """F3.5: el aprobador aprueba la reposición en un paso (Borrador → Pendiente → Aprobado en el audit
    log, RN-03). No hace commit: lo hace quien llama. Devuelve {id, estado, cantidad}."""
    _por_decidir(s)
    valor = numero_valido(cantidad_aprobada)
    if valor is None or not valor > 0:
        raise ErrorValidacion({"cantidad": "Escribe una cantidad mayor que cero."})
    valor = round(valor, 3)
    linea, item = _linea(db, s)
    ahora = datetime.now(timezone.utc)
    antes = s.status
    if linea:
        linea.approved_quantity = Decimal(str(valor))
        s.estimated_amount = (Decimal(str(valor)) * Decimal(str(linea.unit_cost_estimate or 0))).quantize(Decimal("0.01"))
    texto_cantidad = f"{num(valor)} {item.unit_of_measure}" if item else num(valor)
    s.status = "Aprobado"
    s.decided_by_user_id = quien.id
    s.decided_at = ahora
    s.updated_at = ahora
    nombre = _minuscula(item.name) if item else "el insumo"
    if antes == "Borrador":
        record_audit_log(
            db=db, user_id=quien.id, ip_address=ip, target_object=f"REQUEST:{s.request_number}",
            target_table="requests", target_id=str(s.id), action_type="REQUEST_SUBMITTED",
            old_value={"status": "Borrador"},
            new_value={"status": "Pendiente de Aprobación",
                       "descripcion": f"{quien.full_name} envió la reposición {s.request_number} a aprobación"},
        )
    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=f"REQUEST:{s.request_number}",
        target_table="requests", target_id=str(s.id), action_type="REQUEST_APPROVED",
        old_value={"status": "Pendiente de Aprobación"},
        new_value={"status": "Aprobado", "approved_quantity": str(valor),
                   "descripcion": f"{quien.full_name} aprobó la reposición {s.request_number} de {nombre} por {texto_cantidad}"},
    )
    db.flush()
    return {"id": s.request_number, "estado": "Aprobado", "cantidad": valor}


def descartar_reposicion(db: Session, s: Request, motivo: Optional[str], quien: User, ip: str) -> Dict:
    """HU-09: descartar no compra nada y la alerta sigue visible. Rechazado es final (RN-03)."""
    _por_decidir(s)
    antes = s.status
    nota = motivo.strip()[:300] if isinstance(motivo, str) and motivo.strip() else None
    ahora = datetime.now(timezone.utc)
    s.status = "Rechazado"
    s.decided_by_user_id = quien.id
    s.decided_at = ahora
    s.updated_at = ahora
    s.decision_reason = nota or "Descartada por el aprobador"
    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=f"REQUEST:{s.request_number}",
        target_table="requests", target_id=str(s.id), action_type="REQUEST_REJECTED",
        old_value={"status": antes},
        new_value={"status": "Rechazado", "descripcion": f"{quien.full_name} descartó la reposición {s.request_number}"},
        justification=nota,
    )
    db.flush()
    return {"id": s.request_number, "estado": "Rechazado"}


# --- Pronóstico de consumo (F3.7, IA-01) -----------------------------------------------------------

ALFA, BETA, PHI, Z = 0.5, 0.2, 0.9, 1.96


def _redondear1(x: float) -> float:
    return math.floor(x * 10 + 0.5) / 10


def pronosticar(serie: List[float]) -> Dict[str, float]:
    """Consumo esperado del mes siguiente a la serie con su intervalo del 95 % (Holt amortiguado)."""
    nivel = serie[0]
    tendencia = serie[1] - serie[0] if len(serie) > 1 else 0.0
    errores = []
    for x in serie[1:]:
        errores.append(x - (nivel + PHI * tendencia))
        nuevo = ALFA * x + (1 - ALFA) * (nivel + PHI * tendencia)
        tendencia = BETA * (nuevo - nivel) + (1 - BETA) * PHI * tendencia
        nivel = nuevo
    valor = max(0.0, nivel + PHI * tendencia)
    rmse = math.sqrt(sum(e * e for e in errores) / len(errores)) if errores else 0.0
    return {
        "valor": _redondear1(valor),
        "minimo": _redondear1(max(0.0, valor - Z * rmse)),
        "maximo": _redondear1(valor + Z * rmse),
    }
