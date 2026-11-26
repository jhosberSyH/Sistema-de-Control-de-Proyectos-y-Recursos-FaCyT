import json
from datetime import date, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.modulos.inventario.reglas import numero_valido
from app.modulos.usuarios.models import Batch, Request
from tests.conftest import iniciar_sesion
from tests.seguridad.helpers import PROYECTO


@pytest.mark.parametrize("numero", ["Infinity", "NaN", "1e300"])
def test_monto_no_representable_da_422_y_no_crea_solicitud(pg_client, pg_db, numero):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    antes = set(pg_db.scalars(select(Request.id)))
    cuerpo = '{"tipo":"gasto","proyectoId":"' + PROYECTO + '","monto":' + numero + '}'
    respuesta = pg_client.post(
        "/api/solicitudes", content=cuerpo, headers={"Content-Type": "application/json"},
    )
    despues = set(pg_db.scalars(select(Request.id)))
    assert despues == antes, "El monto inválido dejó una solicitud guardada"
    assert respuesta.status_code == 422, respuesta.text


def test_entero_mayor_que_float_es_numero_invalido_sin_lanzar():
    assert numero_valido(10**400) is None


def test_lote_con_entero_json_enorme_responde_422_sin_crear_lote(pg_client, pg_db):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    antes = set(pg_db.scalars(select(Batch.id)))
    cuerpo = json.dumps({
        "insumoId": "e0000000-0000-0000-0000-000000000004",
        "loteProveedor": "SEG-" + uuid4().hex, "cantidad": "ENTERO_ENORME",
        "costoUnitario": 10, "proveedor": "Proveedor de regresión",
        "ingreso": date.today().isoformat(),
        "vence": (date.today() + timedelta(days=365)).isoformat(),
        "ubicacionId": "c0000000-0000-0000-0000-000000000003",
    }).replace('"ENTERO_ENORME"', "1" + "0" * 400)
    respuesta = pg_client.post(
        "/api/lotes", content=cuerpo, headers={"Content-Type": "application/json"},
    )
    assert respuesta.status_code == 422, respuesta.text
    assert any(error["loc"][-1] == "cantidad" for error in respuesta.json()["detail"])
    assert set(pg_db.scalars(select(Batch.id))) == antes
