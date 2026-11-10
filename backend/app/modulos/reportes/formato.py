"""Formatos de los textos que arma el servidor (M7 y M8), iguales a los del frontend (src/lib/formato.ts).

Fechas en la zona horaria de la organización (APP_TIMEZONE) y números como en Venezuela (es-VE):
"1.284,50", "32,6 %", "27/10/2026", "sábado 31/10".
"""

from datetime import date, datetime, time, timedelta, timezone
from decimal import ROUND_FLOOR, ROUND_HALF_UP, Decimal
from typing import Optional, Tuple, Union

from app.core.config import settings

try:
    from zoneinfo import ZoneInfo

    ZONA = ZoneInfo(settings.APP_TIMEZONE)
except Exception:  # pragma: no cover - sin base de zonas horarias (falta tzdata)
    ZONA = timezone(timedelta(hours=-4))

MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre")
DIAS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
CENTAVO = Decimal("0.01")


# --- Fechas --------------------------------------------------------------------------------------

def ahora() -> datetime:
    return datetime.now(ZONA)


def hoy() -> date:
    return ahora().date()


def local(momento: Optional[datetime]) -> Optional[datetime]:
    """El momento en la zona de la organización. Sin zona (SQLite) se toma como UTC."""
    if momento is None:
        return None
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    return momento.astimezone(ZONA)


def dia_local(momento: Union[datetime, date, None]) -> Optional[date]:
    if momento is None:
        return None
    if isinstance(momento, datetime):
        return local(momento).date()
    return momento


def limites(inicio: date, fin: date) -> Tuple[datetime, datetime]:
    """[desde, hasta) en UTC para filtrar un timestamptz por días locales (inicio y fin incluidos)."""
    desde = datetime.combine(inicio, time.min, ZONA).astimezone(timezone.utc)
    hasta = datetime.combine(fin + timedelta(days=1), time.min, ZONA).astimezone(timezone.utc)
    return desde, hasta


def iso_momento(momento: Optional[datetime]) -> Optional[str]:
    """ISO 8601 con zona (el frontend lo convierte a la hora de Caracas)."""
    if momento is None:
        return None
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    return momento.isoformat()


def nombre_mes(d: date) -> str:
    return MESES[d.month - 1]


def fecha_corta(d: Union[date, datetime]) -> str:
    """27/10/2026"""
    d = dia_local(d)
    return f"{d.day:02d}/{d.month:02d}/{d.year}"


def dia_mes(d: Union[date, datetime]) -> str:
    """05/11"""
    d = dia_local(d)
    return f"{d.day:02d}/{d.month:02d}"


def dia_y_fecha(d: Union[date, datetime]) -> str:
    """sábado 31/10"""
    d = dia_local(d)
    return f"{DIAS[d.weekday()]} {dia_mes(d)}"


def hora(momento: datetime) -> str:
    """10:42"""
    m = local(momento)
    return f"{m.hour:02d}:{m.minute:02d}"


def mayuscula(texto: str) -> str:
    return texto[:1].upper() + texto[1:]


def mes_atras(n: int, referencia: Optional[date] = None) -> Tuple[date, date]:
    """Primer y último día del mes que está n meses antes del de la referencia (hoy)."""
    r = referencia or hoy()
    total = r.year * 12 + (r.month - 1) - n
    inicio = date(total // 12, total % 12 + 1, 1)
    siguiente = total + 1
    fin = date(siguiente // 12, siguiente % 12 + 1, 1) - timedelta(days=1)
    return inicio, fin


def siguiente_mes(fin: date) -> Tuple[date, date]:
    """El mes que sigue a una fecha de fin: lo que se sugiere al abrir la siguiente revisión."""
    inicio = fin + timedelta(days=1)
    ultimo = mes_atras(-1, inicio)[0] - timedelta(days=1)
    return inicio, ultimo


# --- Números -------------------------------------------------------------------------------------

def _es(texto: str) -> str:
    """'1,234.50' (formato de Python) → '1.234,50' (es-VE)."""
    return texto.replace(",", "\0").replace(".", ",").replace("\0", ".")


def monto(valor) -> str:
    """1284.5 → '1.284,50'"""
    return _es(f"{float(valor):,.2f}")


def moneda(valor) -> str:
    """1284.5 → 'US$ 1.284,50'"""
    return f"US$ {monto(valor)}"


def numero(valor, decimales: int = 1) -> str:
    """Con los decimales justos: 6.2 → '6,2'; 12 → '12'; 1234.56 → '1.234,6'."""
    texto = f"{float(valor):,.{decimales}f}"
    if "." in texto:
        texto = texto.rstrip("0").rstrip(".")
    return _es(texto)


def porcentaje_fijo(valor) -> str:
    """Siempre con un decimal: 32.55 → '32,6 %'."""
    return f"{_es(f'{float(valor):,.1f}')} %"


def centavos(valor) -> Decimal:
    return Decimal(str(valor or 0)).quantize(CENTAVO, rounding=ROUND_HALF_UP)


def centavos_abajo(valor: Decimal) -> Decimal:
    return valor.quantize(CENTAVO, rounding=ROUND_FLOOR)
