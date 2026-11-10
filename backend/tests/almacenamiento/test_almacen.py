"""Almacenamiento de cotizaciones (decisión 7): disco local y Supabase Storage (con HTTP simulado)."""

import httpx
import pytest

from app.almacenamiento import service
from app.almacenamiento.service import AlmacenLocal, AlmacenSupabase, ErrorAlmacenamiento


def test_local_guarda_lee_y_borra(tmp_path):
    a = AlmacenLocal(str(tmp_path))
    a.guardar("solicitudes/1/cotizacion.pdf", b"%PDF-1", "application/pdf")
    assert a.leer("solicitudes/1/cotizacion.pdf") == b"%PDF-1"
    a.borrar("solicitudes/1/cotizacion.pdf")
    with pytest.raises(ErrorAlmacenamiento):
        a.leer("solicitudes/1/cotizacion.pdf")


def test_local_no_sale_de_su_carpeta(tmp_path):
    with pytest.raises(ErrorAlmacenamiento):
        AlmacenLocal(str(tmp_path)).guardar("../fuera.pdf", b"x", "application/pdf")


def test_supabase_usa_la_api_rest_con_la_clave_de_servicio(monkeypatch):
    llamadas = []

    def falso(metodo, url, headers=None, timeout=None, **kw):
        llamadas.append((metodo, url, headers, kw))
        if "/object/sign/" in url:
            return httpx.Response(200, json={"signedURL": "/object/sign/cotizaciones/a.pdf?token=t"})
        if metodo == "GET":
            return httpx.Response(200, content=b"%PDF-1")
        return httpx.Response(200, json={})

    monkeypatch.setattr(service.httpx, "request", falso)
    a = AlmacenSupabase("https://demo.supabase.co/", "clave-servicio", "cotizaciones")
    a.guardar("a.pdf", b"%PDF-1", "application/pdf")
    assert a.leer("a.pdf") == b"%PDF-1"
    assert a.enlace_firmado("a.pdf", 60) == "https://demo.supabase.co/storage/v1/object/sign/cotizaciones/a.pdf?token=t"
    a.borrar("a.pdf")

    subir, leer, firmar, borrar = llamadas
    assert subir[0] == "POST" and subir[1] == "https://demo.supabase.co/storage/v1/object/cotizaciones/a.pdf"
    assert subir[2]["Authorization"] == "Bearer clave-servicio" and subir[2]["x-upsert"] == "true"
    assert leer[1].endswith("/object/authenticated/cotizaciones/a.pdf")
    assert firmar[3]["json"] == {"expiresIn": 60}
    assert borrar[0] == "DELETE" and borrar[3]["json"] == {"prefixes": ["a.pdf"]}


def test_supabase_error_http_se_traduce(monkeypatch):
    monkeypatch.setattr(service.httpx, "request", lambda *a, **k: httpx.Response(403))
    with pytest.raises(ErrorAlmacenamiento):
        AlmacenSupabase("https://demo.supabase.co", "k", "b").leer("a.pdf")


def test_supabase_sin_credenciales_no_arranca():
    with pytest.raises(ErrorAlmacenamiento):
        AlmacenSupabase("", "", "b")
