from unittest.mock import Mock

import pytest

from app.autenticacion import router
from app.autenticacion import limite
from app.autenticacion.limite import LimitadorLogin, limitador_login


def login(cliente, correo="admin@cpq.local", clave="incorrecta"):
    return cliente.post("/api/auth/iniciar-sesion", json={"correo": correo, "clave": clave})


def bloqueado(respuesta):
    assert respuesta.status_code == 429, respuesta.text
    assert int(respuesta.headers["Retry-After"]) > 0
    assert isinstance(respuesta.json()["detail"], str)
    assert respuesta.json()["detail"].strip()


@pytest.mark.parametrize("correo", ["admin@cpq.local", "inexistente@cpq.local"])
def test_sexto_fallo_bloquea_correos_existentes_e_inexistentes(pg_client, correo):
    for _ in range(5):
        assert login(pg_client, correo).status_code == 401
    bloqueado(login(pg_client, correo))


def test_bloqueo_rechaza_incluso_la_clave_correcta(pg_client):
    for _ in range(5):
        assert login(pg_client).status_code == 401
    bloqueado(login(pg_client, clave="Demo2026*"))


def test_exito_antes_del_tope_limpia_fallos(pg_client):
    for _ in range(4):
        assert login(pg_client).status_code == 401
    assert login(pg_client, clave="Demo2026*").status_code == 200
    for _ in range(5):
        # Tras el éxito, incluso el quinto fallo debe seguir siendo 401.
        assert login(pg_client).status_code == 401
    bloqueado(login(pg_client))


def test_bloquear_un_correo_no_bloquea_otro_desde_la_misma_ip(pg_client):
    for _ in range(5):
        assert login(pg_client, "a@x").status_code == 401
    bloqueado(login(pg_client, "a@x"))
    assert login(pg_client, "aprobador@cpq.local").status_code == 401
    assert login(pg_client, "aprobador@cpq.local", "Demo2026*").status_code == 200


def test_sin_turno_de_verificacion_responde_429(pg_client, monkeypatch):
    monkeypatch.setattr(limitador_login, "tomar_turno", lambda *args, **kwargs: False)
    bloqueado(login(pg_client, clave="Demo2026*"))


def test_correo_inexistente_verifica_una_contrasena_argon2(pg_client, monkeypatch):
    verificar = Mock(wraps=router.verify_password)
    monkeypatch.setattr(router, "verify_password", verificar)
    assert login(pg_client, "inexistente@cpq.local").status_code == 401
    verificar.assert_called_once()
    argumentos = (*verificar.call_args.args, *verificar.call_args.kwargs.values())
    assert any(isinstance(v, str) and v.startswith("$argon2") for v in argumentos)


@pytest.mark.parametrize("correo", ["admin@cpq.local", "inexistente@cpq.local"])
def test_clave_mayor_de_128_caracteres_no_verifica_ni_acumula_fallos(pg_client, monkeypatch, correo):
    verificar = Mock(wraps=router.verify_password)
    monkeypatch.setattr(router, "verify_password", verificar)
    for _ in range(10):
        respuesta = login(pg_client, correo, "x" * 129)
        assert respuesta.status_code == 401, respuesta.text
    verificar.assert_not_called()
    # El correo existente debe seguir pudiendo iniciar sesión después de diez rechazos.
    if correo == "admin@cpq.local":
        assert login(pg_client, correo, "Demo2026*").status_code == 200
        verificar.assert_called_once()
    else:
        # El correo inexistente tampoco acumula fallos en el limitador.
        assert limitador_login.segundos_bloqueado(correo) == 0


def test_login_revalida_bloqueo_despues_de_tomar_turno(pg_client, monkeypatch):
    segundos = Mock(side_effect=[0, 60])
    tomar = Mock(wraps=limitador_login.tomar_turno)
    soltar = Mock(wraps=limitador_login.soltar_turno)
    verificar = Mock(wraps=router.verify_password)
    monkeypatch.setattr(limitador_login, "segundos_bloqueado", segundos)
    monkeypatch.setattr(limitador_login, "tomar_turno", tomar)
    monkeypatch.setattr(limitador_login, "soltar_turno", soltar)
    monkeypatch.setattr(router, "verify_password", verificar)
    respuesta = login(pg_client, clave="Demo2026*")
    bloqueado(respuesta)
    assert segundos.call_count == 2
    tomar.assert_called_once_with()
    soltar.assert_called_once_with()
    verificar.assert_not_called()


def test_presion_de_correos_no_expulsa_un_bloqueo_vigente(monkeypatch):
    monkeypatch.setattr(limite, "MAX_CLAVES", 3)
    limitador = LimitadorLogin(max_fallos=2, ventana_s=600, simultaneas=1)
    limitador.registrar_fallo("objetivo")
    limitador.registrar_fallo("objetivo")
    assert limitador.segundos_bloqueado("objetivo") > 0
    for n in range(5):
        limitador.registrar_fallo(f"nuevo-{n}@cpq.local")
        assert limitador.segundos_bloqueado("objetivo") > 0
