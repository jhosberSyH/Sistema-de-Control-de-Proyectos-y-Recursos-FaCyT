from datetime import date, timedelta

import pytest

from app.modulos.usuarios.models import AccountingPeriod
from tests.conftest import iniciar_sesion
from tests.seguridad.helpers import PROYECTO


@pytest.fixture
def periodo_cerrado(pg_db):
    periodo = pg_db.get(AccountingPeriod, "70000000-0000-0000-0000-000000000001")
    assert periodo is not None and periodo.status == "Cerrado"
    return periodo


@pytest.mark.parametrize("extremo", ["start_date", "end_date"])
def test_lote_rechaza_ingreso_en_periodo_cerrado(pg_client, periodo_cerrado, extremo):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    respuesta = pg_client.post("/api/lotes", json={
        "insumoId": "e0000000-0000-0000-0000-000000000004",
        "loteProveedor": "SEG-CERRADO", "cantidad": 1, "costoUnitario": 10,
        "proveedor": "Proveedor de prueba",
        "ingreso": getattr(periodo_cerrado, extremo).isoformat(),
        "vence": (date.today() + timedelta(days=365)).isoformat(),
        "ubicacionId": "c0000000-0000-0000-0000-000000000003",
    })
    assert respuesta.status_code == 422, respuesta.text
    assert any(e["loc"][-1] == "ingreso" for e in respuesta.json()["detail"])


@pytest.mark.parametrize("extremo", ["start_date", "end_date"])
def test_uso_rechaza_fecha_en_periodo_cerrado(pg_client, periodo_cerrado, extremo):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    respuesta = pg_client.post("/api/usos-materia", json={
        "proyectoId": PROYECTO, "insumoId": "e0000000-0000-0000-0000-000000000001",
        "cantidad": 1, "fecha": getattr(periodo_cerrado, extremo).isoformat(),
    })
    assert respuesta.status_code == 422, respuesta.text
    assert any(e["loc"][-1] == "fecha" for e in respuesta.json()["detail"])
