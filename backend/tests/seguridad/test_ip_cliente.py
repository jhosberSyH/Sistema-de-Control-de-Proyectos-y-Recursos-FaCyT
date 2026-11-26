import pytest

from app.autenticacion.dependencies import get_client_ip
from app.core.config import settings
from tests.seguridad.helpers import peticion


@pytest.fixture(autouse=True)
def un_proxy_confiable(monkeypatch):
    monkeypatch.setattr(settings, "PROXIES_CONFIABLES", 1)


def test_usa_la_ultima_ip_agregada_por_el_proxy():
    request = peticion([(b"x-forwarded-for", b"1.1.1.1, 9.9.9.9")])
    assert get_client_ip(request) == "9.9.9.9"


def test_ultima_entrada_invalida_no_se_usa_como_ip():
    request = peticion([(b"x-forwarded-for", b"1.1.1.1, " + b"A" * 60)])
    ip = get_client_ip(request)
    assert ip == "desconocida"
    assert len(ip) <= 45


def test_sin_cabecera_usa_la_conexion_directa():
    assert get_client_ip(peticion(ip="192.0.2.10")) == "192.0.2.10"


def test_login_con_ip_invalida_no_rompe_la_auditoria(pg_client):
    respuesta = pg_client.post(
        "/api/auth/iniciar-sesion", headers={"X-Forwarded-For": "A" * 60},
        json={"correo": "admin@cpq.local", "clave": "incorrecta"},
    )
    assert respuesta.status_code == 401, respuesta.text
