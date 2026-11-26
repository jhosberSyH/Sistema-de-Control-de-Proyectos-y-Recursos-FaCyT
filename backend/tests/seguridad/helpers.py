from uuid import uuid4
from threading import Event, Thread
from time import monotonic, sleep

from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.requests import Request as HttpRequest

from app.modulos.usuarios.models import Request


PROYECTO = "b0000000-0000-0000-0000-000000000001"
APROBADOR = "a0000000-0000-0000-0000-000000000002"
COORDINADOR = "a0000000-0000-0000-0000-000000000003"
PENDIENTE = "Pendiente de Aprobación"


def peticion(headers=(), ip="192.0.2.10"):
    return HttpRequest({
        "type": "http", "method": "POST", "scheme": "https",
        "path": "/", "query_string": b"", "headers": list(headers),
        "client": (ip, 12345), "server": ("testserver", 443),
    })


def gasto(db, estado=PENDIENTE, solicitante=COORDINADOR):
    fila = Request(
        id=str(uuid4()), request_number="SEG-" + uuid4().hex,
        request_type="Gasto", cost_center="proyecto", project_id=PROYECTO,
        requester_user_id=solicitante, status=estado, estimated_amount=10,
        actual_amount=0, description="Regresión de seguridad",
    )
    db.add(fila)
    db.flush()
    return fila


def carrera_con_fila(pg_engine, tomar_fila, cambiar_fila, operar):
    """A retiene la fila hasta comprobar que B está esperando en PostgreSQL.

    B usa una conexión independiente y savepoints como pg_db: los commits del
    handler son reales RELEASE SAVEPOINT, pero el rollback exterior limpia también
    auditorías inmutables y otros efectos si una mutación permite la operación.
    La excepción/retorno se observa ANTES de deshacer esa transacción exterior.
    """
    lista = Event()
    resultado = {}

    def competir():
        try:
            with pg_engine.connect() as conexion:
                exterior = conexion.begin()
                try:
                    conexion.execute(text("SET TRANSACTION ISOLATION LEVEL READ COMMITTED"))
                    with Session(bind=conexion, join_transaction_mode="create_savepoint") as b:
                        b.execute(text("SET LOCAL statement_timeout = '10s'"))
                        resultado["pid"] = b.scalar(text("SELECT pg_backend_pid()"))
                        lista.set()
                        resultado["valor"] = operar(b)
                finally:
                    exterior.rollback()
        except Exception as error:
            resultado["error"] = error
        finally:
            lista.set()

    hilo = Thread(target=competir, daemon=True)
    try:
        with Session(pg_engine) as a:
            fila = tomar_fila(a)
            assert fila is not None
            pid_a = a.scalar(text("SELECT pg_backend_pid()"))
            hilo.start()
            assert lista.wait(5), "B no terminó su preparación"
            assert "pid" in resultado, repr(resultado)
            limite = monotonic() + 5
            while not a.scalar(text("SELECT :a = ANY(pg_blocking_pids(:b))"),
                               {"a": pid_a, "b": resultado["pid"]}):
                assert hilo.is_alive(), repr(resultado)
                assert monotonic() < limite, "B no quedó bloqueada por A"
                sleep(0.05)
            cambiar_fila(fila)
            a.commit()
    finally:
        if hilo.ident is not None:
            hilo.join(15)
        assert not hilo.is_alive(), "B no terminó después de liberar A"
    return resultado
