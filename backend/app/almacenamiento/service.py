"""Almacenamiento de archivos (decisión 7): Supabase Storage en producción, disco local en desarrollo.

La BD guarda solo la ruta del archivo. El backend sube, descarga y firma enlaces; el bucket es
privado, así que el navegador nunca recibe las credenciales.

Variables (README §11):
  STORAGE_BACKEND=local | supabase
  STORAGE_LOCAL_DIR=./var/archivos              (solo local)
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET   (solo supabase)
"""

from pathlib import Path
from typing import Protocol

import httpx

from app.core.config import settings


class ErrorAlmacenamiento(Exception):
    """El archivo no se pudo guardar o leer."""


class Almacen(Protocol):
    def guardar(self, ruta: str, contenido: bytes, tipo: str) -> None: ...
    def leer(self, ruta: str) -> bytes: ...
    def enlace_firmado(self, ruta: str, segundos: int = 60) -> str: ...
    def borrar(self, ruta: str) -> None: ...


class AlmacenLocal:
    def __init__(self, raiz: str):
        self.raiz = Path(raiz).resolve()

    def _destino(self, ruta: str) -> Path:
        destino = (self.raiz / ruta).resolve()
        if self.raiz not in destino.parents:
            raise ErrorAlmacenamiento("Ruta de archivo no válida.")
        return destino

    def guardar(self, ruta: str, contenido: bytes, tipo: str) -> None:
        destino = self._destino(ruta)
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(contenido)

    def leer(self, ruta: str) -> bytes:
        destino = self._destino(ruta)
        if not destino.exists():
            raise ErrorAlmacenamiento("El archivo ya no está disponible.")
        return destino.read_bytes()

    def enlace_firmado(self, ruta: str, segundos: int = 60) -> str:
        # En local no hay enlaces firmados: el backend entrega el archivo directamente
        raise ErrorAlmacenamiento("El almacenamiento local no genera enlaces firmados.")

    def borrar(self, ruta: str) -> None:
        destino = self._destino(ruta)
        if destino.exists():
            destino.unlink()


class AlmacenSupabase:
    """API REST de Supabase Storage con la clave de servicio (solo en el servidor)."""

    def __init__(self, url: str, clave: str, bucket: str):
        if not url or not clave:
            raise ErrorAlmacenamiento("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.")
        self.base = url.rstrip("/") + "/storage/v1"
        self.bucket = bucket
        self.cabeceras = {"Authorization": f"Bearer {clave}", "apikey": clave}

    def _pedir(self, metodo: str, ruta: str, **kw) -> httpx.Response:
        try:
            r = httpx.request(metodo, self.base + ruta, headers={**self.cabeceras, **kw.pop("headers", {})},
                              timeout=30, **kw)
        except httpx.HTTPError as e:
            raise ErrorAlmacenamiento("No se pudo conectar con el almacenamiento de archivos.") from e
        if r.status_code >= 400:
            raise ErrorAlmacenamiento(f"El almacenamiento respondió {r.status_code}.")
        return r

    def guardar(self, ruta: str, contenido: bytes, tipo: str) -> None:
        self._pedir("POST", f"/object/{self.bucket}/{ruta}", content=contenido,
                    headers={"Content-Type": tipo, "x-upsert": "true"})

    def leer(self, ruta: str) -> bytes:
        return self._pedir("GET", f"/object/authenticated/{self.bucket}/{ruta}").content

    def enlace_firmado(self, ruta: str, segundos: int = 60) -> str:
        datos = self._pedir("POST", f"/object/sign/{self.bucket}/{ruta}", json={"expiresIn": segundos}).json()
        return self.base + datos["signedURL"]

    def borrar(self, ruta: str) -> None:
        self._pedir("DELETE", f"/object/{self.bucket}", json={"prefixes": [ruta]})


def obtener_almacen() -> Almacen:
    """Dependencia de FastAPI; en pruebas se reemplaza con app.dependency_overrides."""
    if settings.STORAGE_BACKEND == "supabase":
        return AlmacenSupabase(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY, settings.SUPABASE_STORAGE_BUCKET)
    return AlmacenLocal(settings.STORAGE_LOCAL_DIR)
