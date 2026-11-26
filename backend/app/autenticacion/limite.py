"""Límite de intentos de inicio de sesión (OWASP ASVS V2.2.1, API4:2023).

Dos defensas, en memoria del proceso (la API corre con un solo proceso de uvicorn):

1. Por correo: tras LOGIN_MAX_FALLOS intentos fallidos dentro de LOGIN_VENTANA_MINUTOS, ese correo
   responde 429 hasta que el fallo más viejo salga de la ventana. Se cuenta igual para correos que no
   existen, así la respuesta no revela qué cuentas hay. No depende de la IP, que detrás de proxies se
   puede falsificar o compartir.
2. Global: como mucho LOGIN_VERIFICACIONES_SIMULTANEAS verificaciones argon2id a la vez (64 MB cada una).
   Una ráfaga con correos al azar espera su turno y, si no lo consigue, recibe 429 en vez de agotar la
   memoria del servidor.

Si la API llega a tener varias instancias, esto debe pasar a un almacén compartido (Redis).
"""

import threading
import time
from collections import deque
from typing import Deque, Dict

from app.core.config import settings

MAX_CLAVES = 10_000  # tope de correos distintos en memoria: una ráfaga de correos al azar no la hace crecer sin fin


class LimitadorLogin:
    def __init__(self, max_fallos: int, ventana_s: float, simultaneas: int, espera_s: float = 10.0):
        self.max_fallos = max_fallos
        self.ventana_s = ventana_s
        self.espera_s = espera_s
        self._fallos: Dict[str, Deque[float]] = {}
        self._candado = threading.Lock()
        self._turnos = threading.BoundedSemaphore(simultaneas)

    def _vigentes(self, clave: str, ahora: float) -> Deque[float]:
        cola = self._fallos.get(clave)
        if cola is None:
            return deque()
        while cola and ahora - cola[0] >= self.ventana_s:
            cola.popleft()
        if not cola:
            self._fallos.pop(clave, None)
        return cola

    def segundos_bloqueado(self, clave: str) -> int:
        """0 si puede intentar; si no, los segundos que faltan para que salga el fallo más viejo."""
        ahora = time.monotonic()
        with self._candado:
            cola = self._vigentes(clave, ahora)
            if len(cola) < self.max_fallos:
                return 0
            return max(1, int(self.ventana_s - (ahora - cola[0])) + 1)

    def registrar_fallo(self, clave: str) -> None:
        ahora = time.monotonic()
        with self._candado:
            if clave not in self._fallos and len(self._fallos) >= MAX_CLAVES:
                # Se descartan primero las entradas ya vencidas; si no alcanza, la más vieja que NO esté
                # bloqueada. Nunca se expulsa un bloqueo vigente: si no, llenar el diccionario con correos
                # al azar le borraba el bloqueo a la cuenta atacada.
                for k in list(self._fallos):
                    self._vigentes(k, ahora)
                if len(self._fallos) >= MAX_CLAVES:
                    libre = next((k for k, cola in self._fallos.items() if len(cola) < self.max_fallos), None)
                    if libre is None:
                        return  # todo bloqueado: no se registra la clave nueva (inalcanzable con el tope de turnos)
                    self._fallos.pop(libre)
            self._fallos.setdefault(clave, deque()).append(ahora)

    def limpiar(self, clave: str) -> None:
        with self._candado:
            self._fallos.pop(clave, None)

    def tomar_turno(self) -> bool:
        """Espera un turno para verificar una contraseña. False si no lo consigue a tiempo."""
        return self._turnos.acquire(timeout=self.espera_s)

    def soltar_turno(self) -> None:
        self._turnos.release()

    def reiniciar(self) -> None:
        """Solo para pruebas."""
        with self._candado:
            self._fallos.clear()


limitador_login = LimitadorLogin(
    max_fallos=settings.LOGIN_MAX_FALLOS,
    ventana_s=settings.LOGIN_VENTANA_MINUTOS * 60,
    simultaneas=settings.LOGIN_VERIFICACIONES_SIMULTANEAS,
)
