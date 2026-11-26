from datetime import date
from threading import Thread
from uuid import uuid4

import pytest
from sqlalchemy import delete, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.database import candado_de_cierre
from app.modulos.inventario.reglas import periodo_cerrado_en as inventario
from app.modulos.prorrateo.contrato import (
    DatosReparto, aplicar_reparto, cerrar_periodo,
    periodo_cerrado_en as prorrateo,
)
from app.modulos.solicitudes.contrato import _periodo_cerrado_en as solicitudes
from app.modulos.usuarios.models import AccountingPeriod, User
from tests.seguridad.helpers import APROBADOR, peticion


LECTORES = [inventario, solicitudes, prorrateo]
MODULOS = ["inventario", "solicitudes", "prorrateo"]


def afirmar_timeout_de_candado(error):
    assert isinstance(error, OperationalError), repr(error)
    # 55P03 = lock_not_available; no aceptar statement_timeout ni un deadlock.
    codigo = getattr(error.orig, "sqlstate", None) or getattr(error.orig, "pgcode", None)
    assert codigo == "55P03", repr(error)


@pytest.mark.parametrize("leer", LECTORES, ids=MODULOS)
def test_movimiento_retiene_compartido_hasta_fin_de_transaccion(pg_engine, leer):
    with Session(pg_engine) as a, Session(pg_engine) as b:
        try:
            leer(a, date.today())
            b.execute(text("SET LOCAL lock_timeout = '300ms'"))
            with pytest.raises(OperationalError) as captura:
                candado_de_cierre(b, exclusivo=True)
            afirmar_timeout_de_candado(captura.value)
        finally:
            b.rollback()
            a.rollback()


@pytest.mark.parametrize("leer_a", LECTORES, ids=MODULOS)
@pytest.mark.parametrize("leer_b", LECTORES, ids=MODULOS)
def test_movimientos_comparten_candado_sin_bloquearse(pg_engine, leer_a, leer_b):
    with Session(pg_engine) as a, Session(pg_engine) as b:
        try:
            leer_a(a, date.today())
            b.execute(text("SET LOCAL lock_timeout = '300ms'"))
            leer_b(b, date.today())
        finally:
            b.rollback()
            a.rollback()


@pytest.mark.parametrize("accion,estado", [("cerrar", "En revisión"), ("repartir", "Cerrado")])
def test_handler_de_cierre_o_reparto_exige_exclusivo_antes_de_operar(pg_engine, accion, estado):
    identificador = str(uuid4())
    with Session(pg_engine) as preparacion:
        preparacion.add(AccountingPeriod(
            id=identificador, period_name="Regresión " + identificador,
            period_type="Mensual", start_date=date(2090, 1, 1),
            end_date=date(2090, 1, 31), status=estado,
        ))
        preparacion.commit()
    resultado = {}

    def competir():
        try:
            with pg_engine.connect() as conexion:
                exterior = conexion.begin()
                try:
                    with Session(bind=conexion, join_transaction_mode="create_savepoint") as b:
                        b.execute(text("SET LOCAL lock_timeout = '300ms'"))
                        b.execute(text("SET LOCAL statement_timeout = '10s'"))
                        quien = b.get(User, APROBADOR)
                        assert quien is not None
                        if accion == "cerrar":
                            resultado["valor"] = cerrar_periodo(
                                identificador, request=peticion(), db=b, quien=quien)
                        else:
                            resultado["valor"] = aplicar_reparto(
                                identificador, DatosReparto(criterio="iguales"),
                                request=peticion(), db=b, quien=quien)
                finally:
                    # También limpia auditoría y repartos si falta el exclusivo.
                    exterior.rollback()
        except Exception as error:
            resultado["error"] = error

    hilo = Thread(target=competir, daemon=True)
    try:
        try:
            with Session(pg_engine) as a:
                inventario(a, date.today())
                hilo.start()
                hilo.join(5)
                assert not hilo.is_alive(), "El handler no respetó lock_timeout"
                afirmar_timeout_de_candado(resultado.get("error"))
        finally:
            if hilo.ident is not None:
                hilo.join(15)
            assert not hilo.is_alive(), "B no terminó después de liberar A"
        with Session(pg_engine) as verificacion:
            assert verificacion.get(AccountingPeriod, identificador).status == estado
    finally:
        with Session(pg_engine) as limpieza:
            limpieza.execute(delete(AccountingPeriod).where(AccountingPeriod.id == identificador))
            limpieza.commit()
