"""Autenticación con el contrato del frontend, contra PostgreSQL con el esquema real."""

from datetime import datetime, timedelta, timezone

from app.core.security import hash_session_token
from app.modulos.usuarios.models import SessionModel, User
from tests.conftest import iniciar_sesion


def test_iniciar_sesion_devuelve_sesion_y_cookie_segura(pg_client):
    r = pg_client.post("/api/auth/iniciar-sesion", json={"correo": "ADMIN@cpq.local ", "clave": "Demo2026*"})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["usuario"] == {
        "id": "a0000000-0000-0000-0000-000000000001",
        "nombre": "José Rodríguez",
        "correo": "admin@cpq.local",
        "rol": "administrador",
        "iniciales": "JR",
    }
    assert cuerpo["csrf"] and cuerpo["inactividadMinutos"] == 30 and cuerpo["debeCambiarClave"] is False
    cookie = r.headers["set-cookie"]
    assert cookie.startswith("__Host-sesion=")
    for atributo in ("HttpOnly", "Secure", "Path=/"):
        assert atributo in cookie


def test_credenciales_erradas_y_campos_vacios(pg_client):
    r = pg_client.post("/api/auth/iniciar-sesion", json={"correo": "admin@cpq.local", "clave": "otra"})
    assert r.status_code == 401
    r = pg_client.post("/api/auth/iniciar-sesion", json={"correo": "nadie@cpq.local", "clave": "otra"})
    assert r.status_code == 401
    r = pg_client.post("/api/auth/iniciar-sesion", json={})
    assert r.status_code == 422
    assert {e["loc"][-1] for e in r.json()["detail"]} == {"correo", "clave"}


def test_hash_corrupto_no_da_error_500(pg_client, pg_db):
    admin = pg_db.query(User).filter(User.email == "admin@cpq.local").one()
    admin.password_hash = "$argon2id$v=19$m=65536,t=3,p=4$corrupto$corrupto"
    pg_db.commit()
    r = pg_client.post("/api/auth/iniciar-sesion", json={"correo": "admin@cpq.local", "clave": "Demo2026*"})
    assert r.status_code == 401


def test_sesion_requiere_cookie_y_se_cierra(pg_client):
    assert pg_client.get("/api/auth/sesion").status_code == 401
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    r = pg_client.get("/api/auth/sesion")
    assert r.status_code == 200 and r.json()["usuario"]["rol"] == "aprobador"
    assert pg_client.post("/api/auth/cerrar-sesion").status_code == 204
    assert pg_client.get("/api/auth/sesion").status_code == 401


def test_escritura_sin_csrf_es_rechazada(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    datos = {"nombre": "Depósito CSRF", "descripcion": ""}
    sin = pg_client.post("/api/ubicaciones", json=datos, headers={"X-CSRF-Token": ""})
    assert sin.status_code == 403
    otro = pg_client.post("/api/ubicaciones", json=datos, headers={"X-CSRF-Token": "falso"})
    assert otro.status_code == 403
    ok = pg_client.post("/api/ubicaciones", json=datos)
    assert ok.status_code == 201


def test_cuenta_desactivada_no_entra(pg_client, pg_db):
    coord = pg_db.query(User).filter(User.email == "coord.fisica@cpq.local").one()
    coord.is_active = False
    pg_db.commit()
    r = pg_client.post("/api/auth/iniciar-sesion", json={"correo": "coord.fisica@cpq.local", "clave": "Demo2026*"})
    assert r.status_code == 403


def test_inactividad_cierra_la_sesion(pg_client, pg_db):
    iniciar_sesion(pg_client, "admin@cpq.local")
    token = pg_client.cookies.get("__Host-sesion")
    sesion = pg_db.query(SessionModel).filter(SessionModel.token_hash == hash_session_token(token)).one()
    sesion.last_activity_at = datetime.now(timezone.utc) - timedelta(minutes=31)
    pg_db.commit()
    r = pg_client.get("/api/auth/sesion")
    assert r.status_code == 401 and "inactividad" in r.json()["detail"]


def test_clave_temporal_obliga_a_crear_la_propia(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    creada = pg_client.post("/api/usuarios", json={"nombre": "Luisa Marcano", "correo": "luisa.m@cpq.local", "rol": "aprobador"})
    assert creada.status_code == 201
    temporal = creada.json()["claveTemporal"]

    sesion = iniciar_sesion(pg_client, "luisa.m@cpq.local", temporal)
    assert sesion["debeCambiarClave"] is True
    # Con clave temporal, el resto de la API responde 403
    assert pg_client.get("/api/inicio").status_code == 403

    corta = pg_client.post("/api/auth/cambiar-clave", json={"clave": "corta"})
    assert corta.status_code == 422 and corta.json()["detail"][0]["loc"] == ["body", "clave"]
    igual = pg_client.post("/api/auth/cambiar-clave", json={"clave": temporal})
    assert igual.status_code == 422
    con_correo = pg_client.post("/api/auth/cambiar-clave", json={"clave": "luisa.m-es-mi-clave"})
    assert con_correo.status_code == 422

    nueva = pg_client.post("/api/auth/cambiar-clave", json={"clave": "Reactivos-Seguros-2026"})
    assert nueva.status_code == 200 and nueva.json()["debeCambiarClave"] is False
    # La sesión rota: el CSRF anterior deja de servir
    assert nueva.json()["csrf"] != sesion["csrf"]
    pg_client.headers["X-CSRF-Token"] = nueva.json()["csrf"]
    assert pg_client.get("/api/inicio").status_code == 200
    assert pg_client.post("/api/auth/cambiar-clave", json={"clave": "Otra-Clave-Larga-2026"}).status_code == 409

    iniciar_sesion(pg_client, "luisa.m@cpq.local", "Reactivos-Seguros-2026")
