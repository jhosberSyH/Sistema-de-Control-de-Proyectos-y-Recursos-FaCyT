"""Horarios de los laboratorios (F4.3, F4.4), igual que frontend/src/lib/horarios.ts.

Venezuela no tiene horario de verano: la hora de Caracas es siempre UTC-4. Las fechas "del día" (hoy,
la semana de una reserva) se calculan en esa zona, no en UTC.
"""

import re
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

CARACAS = timezone(timedelta(hours=-4))

#: Los laboratorios atienden de 07:00 a 18:00, de lunes a sábado.
APERTURA = 7 * 60
CIERRE = 18 * 60
#: Un hueco más corto no se ofrece como horario libre.
MINIMO_LIBRE = 30

FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def ahora() -> datetime:
    return datetime.now(timezone.utc)


def a_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Las fechas sin zona (SQLite) se leen como UTC."""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def en_caracas(dt: datetime) -> datetime:
    return a_utc(dt).astimezone(CARACAS)


def iso(dt: Optional[datetime]) -> Optional[str]:
    """Instante ISO con el desfase de Caracas: "2026-11-04T11:00:00-04:00"."""
    return en_caracas(dt).isoformat() if dt is not None else None


def hoy() -> date:
    return en_caracas(ahora()).date()


def fecha_de(dt: datetime) -> date:
    return en_caracas(dt).date()


def minutos_de(dt: datetime) -> int:
    local = en_caracas(dt)
    return local.hour * 60 + local.minute


def hora_de(minutos: int) -> str:
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


def hora(dt: datetime) -> str:
    return hora_de(minutos_de(dt))


def fecha_corta(dt: datetime) -> str:
    return en_caracas(dt).strftime("%d/%m/%Y")


def lunes_de(f: date) -> date:
    """Lunes de la semana de esa fecha. El domingo (laboratorios cerrados) pasa a la semana siguiente."""
    dia = f.weekday()  # lunes 0 … domingo 6
    return f + timedelta(days=1) if dia == 6 else f - timedelta(days=dia)


def leer_instante(texto: object) -> Optional[datetime]:
    """ISO 8601 del cliente. Sin zona se entiende como hora de Caracas."""
    if not isinstance(texto, str) or not texto.strip():
        return None
    try:
        dt = datetime.fromisoformat(texto.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt.replace(tzinfo=CARACAS) if dt.tzinfo is None else dt


def leer_fecha(texto: Optional[str]) -> Optional[date]:
    if not texto or not FECHA.match(texto):
        return None
    try:
        return date.fromisoformat(texto)
    except ValueError:
        return None


def se_cruzan(a_inicio: datetime, a_fin: datetime, b_inicio: datetime, b_fin: datetime) -> bool:
    """[inicio, fin): que uno termine cuando empieza el otro no es choque."""
    return a_utc(a_inicio) < a_utc(b_fin) and a_utc(b_inicio) < a_utc(a_fin)


def rangos_libres(ocupados: List[Tuple[int, int]], cerca: int = APERTURA) -> List[Tuple[int, int]]:
    """Huecos del día entre la apertura y el cierre, de los más cercanos a `cerca` a los más lejanos."""
    libres: List[Tuple[int, int]] = []
    cursor = APERTURA
    for desde, hasta in sorted(ocupados):
        if desde - cursor >= MINIMO_LIBRE:
            libres.append((cursor, min(desde, CIERRE)))
        cursor = max(cursor, hasta)
    if CIERRE - cursor >= MINIMO_LIBRE:
        libres.append((cursor, CIERRE))

    def distancia(r: Tuple[int, int]) -> int:
        if cerca < r[0]:
            return r[0] - cerca
        if cerca > r[1]:
            return cerca - r[1]
        return 0

    return sorted(libres, key=lambda r: (distancia(r), r[0]))


def instante(f: date, minutos: int) -> str:
    return f"{f.isoformat()}T{hora_de(minutos)}:00-04:00"


def libres_del_dia(ocupadas: List[Tuple[datetime, datetime]], inicio: datetime) -> List[Dict[str, str]]:
    """Hasta 3 horarios libres del día de `inicio`, cerca del horario pedido (F4.4)."""
    f = fecha_de(inicio)
    ocupados = [(minutos_de(a), minutos_de(b)) for a, b in ocupadas if fecha_de(a) == f]
    return [{"inicio": instante(f, d), "fin": instante(f, h)} for d, h in rangos_libres(ocupados, minutos_de(inicio))[:3]]
