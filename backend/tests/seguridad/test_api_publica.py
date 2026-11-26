import os
from pathlib import Path
import subprocess
import sys
import textwrap

import pytest


def test_health_no_publica_el_entorno(pg_client):
    respuesta = pg_client.get("/api/health")
    assert respuesta.status_code == 200, respuesta.text
    assert "environment" not in respuesta.json()


@pytest.mark.parametrize("ruta,estado", [
    ("/api/health", 200), ("/api/auth/sesion", 401), ("/api/ruta-inexistente-seguridad", 404),
])
def test_cabeceras_de_seguridad_en_respuestas_exitosas_y_errores(pg_client, ruta, estado):
    respuesta = pg_client.get(ruta)
    assert respuesta.status_code == estado, respuesta.text
    assert respuesta.headers.get("X-Content-Type-Options") == "nosniff"
    assert respuesta.headers.get("X-Frame-Options") == "DENY"
    assert "default-src 'none'" in respuesta.headers.get("Content-Security-Policy", "")


def test_produccion_oculta_docs_y_no_autoriza_cors_localhost():
    # Proceso nuevo: evita reutilizar settings/app ya importados por conftest.
    codigo = textwrap.dedent("""
        from fastapi.testclient import TestClient
        from app.main import app

        assert app.openapi_url is None, app.openapi_url
        assert app.docs_url is None, app.docs_url
        assert app.redoc_url is None, app.redoc_url
        with TestClient(app, base_url="https://testserver") as cliente:
            respuesta = cliente.get("/api/openapi.json")
            assert respuesta.status_code == 404, respuesta.text
            preflight = cliente.options("/api/auth/sesion", headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            })
            assert "access-control-allow-origin" not in preflight.headers, dict(preflight.headers)
    """)
    entorno = {**os.environ, "APP_ENV": "production", "DATABASE_URL": "sqlite:///:memory:"}
    resultado = subprocess.run(
        [sys.executable, "-c", codigo], cwd=Path(__file__).resolve().parents[2],
        env=entorno, capture_output=True, text=True, timeout=45,
    )
    assert resultado.returncode == 0, resultado.stdout + resultado.stderr
