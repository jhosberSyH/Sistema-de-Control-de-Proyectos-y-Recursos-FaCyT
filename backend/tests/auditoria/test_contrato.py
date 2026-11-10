"""Auditoría global con el contrato del frontend (F8.5, F8.6), contra PostgreSQL con el esquema real.

Especificación: frontend/src/testing/mocks/handlers/auditoria.ts.
"""

from datetime import timedelta

from app.auditoria.models import AuditLog
from app.modulos.reportes.formato import hoy
from tests.conftest import iniciar_sesion

ADMIN = "a0000000-0000-0000-0000-000000000001"
APROBADOR = "a0000000-0000-0000-0000-000000000002"
QUI = "b0000000-0000-0000-0000-000000000001"


def test_solo_el_administrador(pg_client):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.get("/api/auditoria").status_code == 403
    pg_client.cookies.clear()
    assert pg_client.get("/api/auditoria").status_code == 401


def test_pagina_con_registros_legibles(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    r = pg_client.get("/api/auditoria")
    assert r.status_code == 200
    p = r.json()
    assert set(p) == {"total", "filtrados", "pagina", "paginas", "porPagina", "registros", "usuarios"}
    assert p["porPagina"] == 10 and p["pagina"] == 1 and p["total"] == p["filtrados"] >= 2
    # Lo más reciente primero: el inicio de sesión de quien consulta
    ultimo = p["registros"][0]
    assert ultimo["accion"] == "sesion" and ultimo["etiqueta"] == "Inicio de sesión"
    assert ultimo["descripcion"] == "José Rodríguez inició sesión"
    assert ultimo["usuario"] == {"nombre": "José Rodríguez", "rol": "Administrador del Sistema"} and ultimo["ip"]
    assert ultimo["objeto"] == "Cuenta admin@cpq.local" and ultimo["enlace"] == "/usuarios"
    # La fila de la semilla no trae descripción: se arma en español
    semilla = next(x for x in p["registros"] if x["descripcion"].endswith("cargó los datos iniciales"))
    assert semilla["accion"] == "creacion" and semilla["etiqueta"] == "Creación" and semilla["objeto"] == "Sistema"
    assert {"id": ADMIN, "nombre": "José Rodríguez"} in p["usuarios"]


def test_filas_antiguas_y_filtros(pg_client, pg_db):
    # Una fila con el formato anterior al contrato (sin descripción), de otra persona
    pg_db.add(AuditLog(user_id=APROBADOR, ip_address="10.0.0.9", action_type="REQUEST_APPROVE",
                       target_object="REQUEST:SOL-0099", old_value={"status": "Pendiente de Aprobación"},
                       new_value={"status": "Aprobado"}, justification="Aprobación de solicitud (F5.4 - HU-15)"))
    pg_db.add(AuditLog(user_id=APROBADOR, ip_address="10.0.0.9", action_type="PROJECT_PRIORITY_CHANGE",
                       target_object="PROJECT:QUI-024", old_value={"priority_level": "Media"},
                       new_value={"priority_level": "Alta"}))
    pg_db.flush()
    iniciar_sesion(pg_client, "admin@cpq.local")

    estado = pg_client.get("/api/auditoria", params={"accion": "cambio-estado"}).json()
    assert estado["filtrados"] == 1 and estado["total"] > 1
    r = estado["registros"][0]
    assert r["descripcion"] == "Carmen Pérez aprobó solicitud SOL-0099"
    assert r["objeto"] == "Solicitud SOL-0099 a Aprobado" and r["codigo"] == "SOL-0099"
    assert (r["valorAnterior"], r["valorNuevo"]) == ("Pendiente de Aprobación", "Aprobado")
    assert r["justificacion"] == "Aprobación de solicitud" and r["etiqueta"] == "Cambio de estado"

    prioridad = pg_client.get("/api/auditoria", params={"objeto": "qui-024"}).json()
    assert prioridad["filtrados"] == 1
    r = prioridad["registros"][0]
    assert r["etiqueta"] == "Cambio de prioridad" and r["enlace"] == f"/proyectos/{QUI}" and r["codigo"] == "QUI-024"
    assert (r["valorAnterior"], r["valorNuevo"]) == ("Media", "Alta")

    del_aprobador = pg_client.get("/api/auditoria", params={"usuario": APROBADOR}).json()
    assert del_aprobador["filtrados"] == 2
    assert pg_client.get("/api/auditoria", params={"usuario": "nadie"}).json()["filtrados"] == 0
    manana = (hoy() + timedelta(days=1)).isoformat()
    assert pg_client.get("/api/auditoria", params={"desde": manana}).json()["filtrados"] == 0
    assert pg_client.get("/api/auditoria", params={"desde": hoy().isoformat()}).json()["filtrados"] >= 3
    # La página se ajusta al rango
    assert pg_client.get("/api/auditoria", params={"pagina": 99}).json()["pagina"] == 1


def test_lo_que_registra_el_cierre_se_lee_bien(pg_client):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    hoy_iso = hoy().isoformat()
    periodo = pg_client.post("/api/periodos", json={"tipo": "mensual", "inicio": hoy_iso, "fin": hoy_iso}).json()
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    assert pg_client.post("/api/cierre/confirmaciones", json={"proyectoId": QUI}).status_code == 200
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    pg_client.post(f"/api/periodos/{periodo['id']}/cerrar")

    iniciar_sesion(pg_client, "admin@cpq.local")
    registros = pg_client.get("/api/auditoria", params={"accion": "cambio-estado"}).json()["registros"]
    cierre, confirmacion = registros[0], registros[1]
    assert cierre["descripcion"].startswith("Carmen Pérez cerró el período de ")
    assert cierre["objeto"].endswith(" a Cerrado") and cierre["detalle"] == "Sin confirmar: BIO-011, FIS-008"
    assert (cierre["valorAnterior"], cierre["valorNuevo"]) == ("En revisión", "Cerrado")
    assert confirmacion["objeto"] == "Proyecto QUI-024 a Confirmado" and confirmacion["detalle"] == "1 cargos · US$ 72,50"
    apertura = pg_client.get("/api/auditoria", params={"accion": "creacion", "objeto": "período"}).json()["registros"][0]
    assert apertura["descripcion"].startswith("Carmen Pérez abrió la revisión de ")
