"""Piezas comunes del contrato HTTP con el frontend (capa de presentación).

El frontend (frontend/src/modulos/*/api y los handlers MSW de frontend/src/testing/mocks/handlers)
define el contrato: JSON en camelCase, roles cortos y errores con este formato:

- 4xx simple:      {"detail": "texto"}
- 409 con datos:   {"detail": {"mensaje": "texto", ...lo que choca}}
- 422 validación:  {"detail": [{"loc": ["body", "campo", ...], "msg": "texto", "type": "value_error"}]}

Los mensajes se muestran tal cual en la interfaz, así que van en español.
"""

import unicodedata
import uuid
from decimal import InvalidOperation
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy.exc import DataError, IntegrityError


class ModeloApi(BaseModel):
    """Base de los esquemas del contrato: snake_case en Python, camelCase en el JSON."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        # En las respuestas, un campo con valor por defecto igual viaja siempre: en el OpenAPI de salida
        # se marca como obligatorio para que los tipos generados del frontend no lo vean opcional.
        json_schema_serialization_defaults_required=True,
        # Infinity y NaN llegan como float desde el JSON: daban 500 al redondear o se guardaban como 0
        allow_inf_nan=False,
    )


# --- Roles: el enum de la BD (app.user_role) usa el nombre largo; la API, el corto -----------------

ROL_API = {
    "Administrador del Sistema": "administrador",
    "Coordinador de Proyecto": "coordinador",
    "Aprobador / Gestor de Inventario": "aprobador",
}
ROL_BD = {corto: largo for largo, corto in ROL_API.items()}

ADMINISTRADOR = "Administrador del Sistema"
COORDINADOR = "Coordinador de Proyecto"
APROBADOR = "Aprobador / Gestor de Inventario"


def rol_api(rol_bd: str) -> str:
    return ROL_API.get(rol_bd, rol_bd)


# --- Errores -------------------------------------------------------------------------------------

class ErrorValidacion(Exception):
    """422 con el formato de FastAPI; las claves con puntos son rutas ("hitos.2.peso")."""

    def __init__(self, errores: Dict[str, str]):
        self.errores = errores


def conflicto(mensaje: str, **datos: Any) -> HTTPException:
    """409 con lo que choca, como lo lee el frontend (ApiError.conflicto)."""
    if not datos:
        return HTTPException(status_code=409, detail=mensaje)
    return HTTPException(status_code=409, detail={"mensaje": mensaje, **jsonable_encoder(datos, by_alias=True)})


def _loc(campo: str):
    return ["body", *[int(p) if p.isdigit() else p for p in campo.split(".")]]


MENSAJES_VALIDACION = {
    "missing": "Este dato es obligatorio.",
    "string_type": "Escribe un texto.",
    "string_too_short": "Es demasiado corto.",
    "string_too_long": "Es demasiado largo.",
    "int_type": "Escribe un número entero.",
    "int_parsing": "Escribe un número entero.",
    "int_from_float": "Escribe un número entero.",
    "float_type": "Escribe un número.",
    "float_parsing": "Escribe un número.",
    "finite_number": "Escribe un número válido.",
    "decimal_parsing": "Escribe un número.",
    "bool_type": "Indica sí o no.",
    "bool_parsing": "Indica sí o no.",
    "date_from_datetime_parsing": "Escribe una fecha válida.",
    "date_parsing": "Escribe una fecha válida.",
    "datetime_parsing": "Escribe una fecha y hora válidas.",
    "datetime_from_date_parsing": "Escribe una fecha y hora válidas.",
    "greater_than": "Debe ser mayor que {gt}.",
    "greater_than_equal": "Debe ser mayor o igual que {ge}.",
    "less_than": "Debe ser menor que {lt}.",
    "less_than_equal": "Debe ser menor o igual que {le}.",
    "literal_error": "Elige una de las opciones.",
    "enum": "Elige una de las opciones.",
    "json_invalid": "La petición no es un JSON válido.",
    "model_attributes_type": "Faltan los datos del formulario.",
    "dict_type": "Faltan los datos del formulario.",
    "list_type": "Debe ser una lista.",
    "uuid_parsing": "El identificador no es válido.",
}


def _mensaje_es(error: Dict[str, Any]) -> str:
    tipo = error.get("type", "")
    plantilla = MENSAJES_VALIDACION.get(tipo)
    if plantilla:
        try:
            return plantilla.format(**(error.get("ctx") or {}))
        except (KeyError, IndexError):
            return plantilla
    if tipo == "value_error":
        # ValueError lanzado por un validador propio: el texto ya está en español
        msg = str(error.get("msg", ""))
        return msg.removeprefix("Value error, ")
    return "El dato no es válido."


def registrar_manejadores(app: FastAPI) -> None:
    @app.exception_handler(ErrorValidacion)
    async def _validacion_propia(request: Request, exc: ErrorValidacion):
        return JSONResponse(
            status_code=422,
            content={"detail": [{"loc": _loc(c), "msg": m, "type": "value_error"} for c, m in exc.errores.items()]},
        )

    @app.exception_handler(DataError)
    async def _dato_invalido(request: Request, exc: DataError):
        # Un id que no es UUID llega hasta PostgreSQL ("invalid input syntax for type uuid") y daba 500.
        # Para quien pide, ese recurso simplemente no existe.
        causa = type(getattr(exc, "orig", None)).__name__
        if causa == "InvalidTextRepresentation":
            return JSONResponse(status_code=404, content={"detail": "No encontramos lo que buscas."})
        # Un número que no cabe en la columna (NUMERIC(15,2), NUMERIC(12,3)) o un texto demasiado largo
        if causa in ("NumericValueOutOfRange", "StringDataRightTruncation"):
            return JSONResponse(status_code=422, content={"detail": [
                {"loc": ["body"], "msg": "Un valor es demasiado grande o demasiado largo.", "type": "value_error"}]})
        raise exc

    @app.exception_handler(IntegrityError)
    async def _choque_de_unicidad(request: Request, exc: IntegrityError):
        # Dos peticiones simultáneas que pasan la validación chocan en un índice único o un EXCLUDE de la BD
        # (dos usos abiertos del mismo equipo, un reparto doble, dos reservas solapadas): es un conflicto, no un 500.
        if type(getattr(exc, "orig", None)).__name__ in ("UniqueViolation", "ExclusionViolation"):
            return JSONResponse(status_code=409, content={
                "detail": "Otra operación cambió estos datos al mismo tiempo. Recarga la página y revisa antes de seguir."})
        raise exc

    @app.exception_handler(InvalidOperation)
    async def _numero_fuera_de_rango(request: Request, exc: InvalidOperation):
        # Decimal(...).quantize falla con números enormes (1e300): es un dato inválido, no un error del servidor
        return JSONResponse(status_code=422, content={"detail": [
            {"loc": ["body"], "msg": "Un número es demasiado grande.", "type": "value_error"}]})

    @app.exception_handler(RequestValidationError)
    async def _validacion_fastapi(request: Request, exc: RequestValidationError):
        detalle = [
            {
                # loc de Pydantic con alias: ["body", "stockMinimo"]; "query"/"path" se conservan
                "loc": list(e.get("loc", [])),
                "msg": _mensaje_es(e),
                "type": e.get("type", "value_error"),
            }
            for e in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": detalle})


# --- Utilidades de presentación ------------------------------------------------------------------

def normalizar(texto: Optional[str]) -> str:
    """Sin tildes, sin mayúsculas y sin espacios repetidos: "Depósito  A" == "deposito a"."""
    base = unicodedata.normalize("NFD", texto or "")
    sin_tildes = "".join(c for c in base if unicodedata.category(c) != "Mn")
    return " ".join(sin_tildes.split()).lower()


def sin_formula(valor: Any) -> Any:
    """Celda de CSV a salvo de inyección de fórmulas (OWASP CSV Injection).

    Un texto que empieza con = + - @ (o tabulador/retorno) se abre en Excel como fórmula: se le antepone
    un apóstrofo. Los números negativos escritos como texto ("-5", "-1,5") se dejan igual.
    """
    if not isinstance(valor, str) or not valor or valor[0] not in "=+-@\t\r":
        return valor
    try:
        float(valor.replace(",", "."))
        return valor
    except ValueError:
        return "'" + valor


def iniciales(nombre: str) -> str:
    partes = (nombre or "").split()
    if not partes:
        return ""
    return ((partes[0][0]) + (partes[-1][0] if len(partes) > 1 else "")).upper()


def iso(fecha) -> Optional[str]:
    return fecha.isoformat() if fecha is not None else None


def es_id_valido(valor: str, db=None) -> bool:
    """En PostgreSQL los ids son UUID: un id mal formado se responde con 404 en vez de un error 500.

    En SQLite (pruebas) se acepta cualquier texto.
    """
    dialecto = db.get_bind().dialect.name if db is not None else "postgresql"
    if dialecto != "postgresql":
        return bool(valor)
    try:
        uuid.UUID(valor)
        return True
    except (ValueError, TypeError, AttributeError):
        return False
