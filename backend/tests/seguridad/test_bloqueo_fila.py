from threading import Event, Thread
from time import monotonic, sleep

import pytest
from fastapi import HTTPException
from sqlalchemy import delete, text
from sqlalchemy.orm import Session

from app.modulos.solicitudes.contrato import (
    DatosAprobacion, DatosEjecucion, _buscar, aprobar_solicitud, ejecutar_gasto,
)
from app.modulos.usuarios.models import Request, User
from tests.seguridad.helpers import APROBADOR, PENDIENTE, gasto, peticion


@pytest.mark.parametrize("accion,estado", [
    ("ejecutar", "Aprobado"), ("aprobar", PENDIENTE),
])
def test_handler_bloquea_fila_antes_de_validar_o_mutar(pg_engine, accion, estado):
    # Sesiones reales, sin la transacción exterior/savepoints de pg_db.
    with Session(pg_engine) as preparacion:
        fila = gasto(preparacion, estado=estado)
        identificador, numero = fila.id, fila.request_number
        preparacion.commit()

    lista = Event()
    resultado = {}

    def competir():
        # La sesión y el usuario pertenecen exclusivamente al hilo B.
        try:
            with Session(pg_engine) as b:
                b.execute(text("SET TRANSACTION ISOLATION LEVEL READ COMMITTED"))
                b.execute(text("SET LOCAL statement_timeout = '10s'"))
                quien = b.get(User, APROBADOR)
                assert quien is not None
                resultado["pid"] = b.scalar(text("SELECT pg_backend_pid()"))
                lista.set()
                try:
                    if accion == "ejecutar":
                        resultado["valor"] = ejecutar_gasto(
                            ref=numero, request=peticion(), datos=DatosEjecucion(monto_real=10),
                            db=b, quien=quien,
                        )
                    else:
                        resultado["valor"] = aprobar_solicitud(
                            ref=numero, request=peticion(), datos=DatosAprobacion(),
                            db=b, quien=quien,
                        )
                finally:
                    b.rollback()
        except Exception as error:
            resultado["error"] = error
        finally:
            # También despierta al principal si falla la preparación de B.
            lista.set()

    hilo = Thread(target=competir, daemon=True)
    try:
        try:
            with Session(pg_engine) as a:
                fila = _buscar(a, numero, bloquear=True)
                assert fila is not None
                pid_a = a.scalar(text("SELECT pg_backend_pid()"))
                hilo.start()
                assert lista.wait(timeout=5), "B no terminó su preparación"
                assert "pid" in resultado, repr(resultado)
                sleep(0.5)

                # No basta con iniciar el hilo: B debe haber llegado al bloqueo.
                # Sin FOR UPDATE también espera, pero en el UPDATE, tras validar
                # el estado viejo. Después del commit de A ese handler tendrá éxito.
                limite = monotonic() + 5
                while True:
                    bloqueada = a.scalar(text(
                        "SELECT :pid_a = ANY(pg_blocking_pids(:pid_b))"
                    ), {"pid_a": pid_a, "pid_b": resultado["pid"]})
                    if bloqueada:
                        break
                    assert hilo.is_alive(), repr(resultado)
                    assert monotonic() < limite, "B no quedó bloqueada por A"
                    sleep(0.05)

                fila.status = "Ejecutado" if accion == "ejecutar" else "Aprobado"
                if accion == "ejecutar":
                    fila.actual_amount = 5
                a.commit()
        finally:
            # El contexto de A libera el candado incluso si falla una aserción.
            # Esperar a B antes de borrar evita que opere sobre la fila eliminada.
            if hilo.ident is not None:
                hilo.join(timeout=15)

        assert not hilo.is_alive(), "B no terminó después de liberar el candado"
        error = resultado.get("error")
        assert isinstance(error, HTTPException), repr(resultado)
        assert error.status_code == 409, repr(error)
        with Session(pg_engine) as verificacion:
            fila = verificacion.get(Request, identificador)
            assert fila is not None
            assert fila.status == ("Ejecutado" if accion == "ejecutar" else "Aprobado")
            assert fila.actual_amount == (5 if accion == "ejecutar" else 0)
    finally:
        with Session(pg_engine) as limpieza:
            limpieza.execute(delete(Request).where(Request.id == identificador))
            limpieza.commit()
