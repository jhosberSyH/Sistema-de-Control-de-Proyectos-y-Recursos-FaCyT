"""Regresión de M7 contra PostgreSQL: cierre de período y vista previa del reparto daban error 500.

- El router viejo usaba AccountingPeriod sin importarlo (NameError en la vista previa).
- prorrateo/service.py llamaba a recalculate_consumption_forecasts con argumentos que no existen
  (TypeError al cerrar) y esa función hacía commit propio en medio del cierre.

Ahora con el contrato del frontend: POST /api/periodos/{id}/cerrar y GET /api/reparto.
"""

from tests.conftest import iniciar_sesion


def test_cerrar_periodo_y_ver_el_reparto(pg_client):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    r = pg_client.post("/api/periodos", json={"tipo": "mensual", "inicio": "2030-10-01", "fin": "2030-10-31"})
    assert r.status_code == 201, r.text
    periodo = r.json()["id"]

    # Con el período en revisión el reparto avisa (regla de negocio), no revienta
    abierto = pg_client.post(f"/api/periodos/{periodo}/reparto", json={"criterio": "iguales"})
    assert abierto.status_code == 409

    # Sin confirmaciones también se cierra (SP-08)
    cerrado = pg_client.post(f"/api/periodos/{periodo}/cerrar")
    assert cerrado.status_code == 200, cerrado.text
    assert cerrado.json()["estado"] == "cerrado" and cerrado.json()["faltan"] == 3

    reparto = pg_client.get("/api/reparto")
    assert reparto.status_code == 200, reparto.text
    # El de la semilla es más antiguo: va primero
    assert reparto.json()["periodo"]["id"] != periodo

    aplicado = pg_client.post(f"/api/periodos/{periodo}/reparto", json={"criterio": "iguales"})
    assert aplicado.status_code == 200, aplicado.text
    assert round(sum(f["monto"] for f in aplicado.json()["filas"]), 2) == aplicado.json()["total"]
