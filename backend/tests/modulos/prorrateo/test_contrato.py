"""M7 Gastos compartidos con el contrato del frontend, contra PostgreSQL con el esquema real.

Especificación: frontend/src/testing/mocks/handlers/prorrateo.ts.
"""

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import text

from app.auditoria.models import AuditLog
from app.modulos.usuarios.models import (
    AccountingPeriod,
    Batch,
    Dispatch,
    DispatchCorrection,
    Notification,
    OverheadAllocation,
    Project,
    Request as Solicitud,
)
from tests.conftest import iniciar_sesion

APROBADOR = "a0000000-0000-0000-0000-000000000002"
COORD_QUI = "a0000000-0000-0000-0000-000000000003"
COORD_BIO = "a0000000-0000-0000-0000-000000000004"
COORD_FIS = "a0000000-0000-0000-0000-000000000005"
QUI = "b0000000-0000-0000-0000-000000000001"
BIO = "b0000000-0000-0000-0000-000000000002"
FIS = "b0000000-0000-0000-0000-000000000003"
LOTE_GUANTES = "10000000-0000-0000-0000-000000000003"
GUANTES = "e0000000-0000-0000-0000-000000000004"
PERIODO_SEMILLA = "70000000-0000-0000-0000-000000000001"


def _sin_periodo_de_la_semilla(db):
    db.execute(text("DELETE FROM app.accounting_periods WHERE id = :i"), {"i": PERIODO_SEMILLA})


# Los movimientos de las pruebas van en marzo de 2030: así no se mezclan con los de la semilla (que
# dependen de la fecha en que corren las pruebas)
MARZO = {"tipo": "mensual", "inicio": "2030-03-01", "fin": "2030-03-31"}
DIA = date(2030, 3, 15)


def _movimientos(db):
    """Marzo de 2030: un despacho de QUI-024 (5 x 14,50), un gasto ejecutado de BIO-011 (100), un despacho
    de FIS-008 (2 x 14,50) con una corrección pendiente y un lote de uso general (gasto compartido de 100)."""
    ahora = datetime(2030, 3, 15, 15, 0, tzinfo=timezone.utc)
    db.add(Solicitud(request_number="SOL-T-001", request_type="Gasto", cost_center="proyecto", project_id=BIO,
                     requester_user_id=COORD_BIO, status="Ejecutado", estimated_amount=100, actual_amount=100,
                     created_at=ahora, updated_at=ahora))
    db.add(Dispatch(dispatch_number="DSP-T-0002", batch_id=LOTE_GUANTES, project_id=QUI, dispatched_quantity=5,
                    unit_cost_snapshot=Decimal("14.50"), dispatched_by=APROBADOR, received_by_name="Daniela Rivas",
                    dispatched_at=ahora))
    despacho = Dispatch(dispatch_number="DSP-T-0001", batch_id=LOTE_GUANTES, project_id=FIS, dispatched_quantity=2,
                        unit_cost_snapshot=Decimal("14.50"), dispatched_by=APROBADOR, received_by_name="Andrés Salazar",
                        dispatched_at=ahora)
    db.add(despacho)
    db.flush()
    db.add(DispatchCorrection(original_dispatch_id=despacho.id, requested_by_user_id=COORD_FIS, status="Pendiente",
                              justification="Llegó una sola caja", correct_quantity=1))
    db.add(Batch(item_id=GUANTES, location_id="c0000000-0000-0000-0000-000000000003", batch_number="LOT-T-GEN",
                 initial_quantity=10, available_quantity=10, unit_cost=Decimal("10.00"), received_date=DIA))
    db.flush()


def _abrir(cliente, rango=None):
    r = cliente.post("/api/periodos", json=rango or MARZO)
    assert r.status_code == 201, r.text
    return r.json()


def test_permisos_por_rol(pg_client):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    assert pg_client.get("/api/cierre").status_code == 403
    assert pg_client.get("/api/reparto").status_code == 403
    assert pg_client.post("/api/periodos", json={}).status_code == 403
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.get("/api/cierre/cargos").status_code == 403
    assert pg_client.post("/api/cierre/confirmaciones", json={}).status_code == 403
    iniciar_sesion(pg_client, "admin@cpq.local")
    assert pg_client.get("/api/cierre").status_code == 403
    pg_client.cookies.clear()
    assert pg_client.get("/api/cierre").status_code == 401


def test_tablero_sin_revision_sugiere_el_mes_siguiente(pg_client):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    t = pg_client.get("/api/cierre").json()
    assert t["periodo"] is None and t["filas"] == [] and t["coordinadoresPendientes"] == 0
    # La semilla trae el mes de hace dos meses cerrado y sin repartir
    assert t["porRepartir"]["id"] == PERIODO_SEMILLA and t["porRepartir"]["tipo"] == "mensual"
    fin_semilla = t["porRepartir"]["fin"]
    assert t["sugerido"]["inicio"] > fin_semilla and t["sugerido"]["inicio"].endswith("-01")
    assert pg_client.get("/api/periodos/actual").json() is None


def test_abrir_revision_valida_y_rechaza_cruces(pg_client, pg_db):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    mala = pg_client.post("/api/periodos", json={"tipo": "anual", "inicio": "2026-13-01", "fin": ""})
    assert mala.status_code == 422
    assert {e["loc"][-1]: e["msg"] for e in mala.json()["detail"]} == {
        "tipo": "Elige si el período es mensual o trimestral.",
        "inicio": "Elige la fecha de inicio.",
        "fin": "Elige la fecha de fin.",
    }
    al_reves = pg_client.post("/api/periodos", json={"tipo": "mensual", "inicio": "2030-02-10", "fin": "2030-02-01"})
    assert al_reves.json()["detail"][0]["msg"] == "El fin tiene que ser después del inicio."

    semilla = pg_db.get(AccountingPeriod, PERIODO_SEMILLA)
    cruce = pg_client.post("/api/periodos", json={"tipo": "mensual", "inicio": semilla.start_date.isoformat(),
                                                   "fin": semilla.end_date.isoformat()})
    assert cruce.status_code == 409
    detalle = cruce.json()["detail"]
    assert detalle["mensaje"].startswith("Se cruza con el período cerrado de ")
    assert "o después." in detalle["mensaje"]
    assert detalle["periodo"] == {"inicio": semilla.start_date.isoformat(), "fin": semilla.end_date.isoformat()}

    abierto = _abrir(pg_client)
    assert abierto["estado"] == "en_revision" and abierto["tipo"] == "mensual"
    assert abierto["abiertoPor"] == "Carmen Pérez" and abierto["abiertoEl"]
    assert pg_client.get("/api/periodos/actual").json()["id"] == abierto["id"]
    otra = pg_client.post("/api/periodos", json={"tipo": "mensual", "inicio": "2031-01-01", "fin": "2031-01-31"})
    assert otra.status_code == 409
    assert otra.json()["detail"] == "Ya hay un período en revisión: ciérralo antes de abrir otro."

    # Un aviso a cada coordinador con su proyecto, y el registro en la auditoría
    avisos = pg_db.query(Notification).filter(Notification.title == "Revisa los cargos de QUI-024").all()
    assert [a.user_id for a in avisos] == [COORD_QUI] and avisos[0].link == f"/cierre/cargos?proyecto={QUI}"
    log = pg_db.query(AuditLog).filter(AuditLog.action_type == "PERIOD_REVIEW_OPENED").one()
    assert log.new_value["descripcion"].startswith("Carmen Pérez abrió la revisión de ")


def test_cargos_confirmacion_recordatorio_y_cierre(pg_client, pg_db):
    _movimientos(pg_db)
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    periodo = _abrir(pg_client)

    t = pg_client.get("/api/cierre").json()
    filas = {f["proyecto"]: f for f in t["filas"]}
    assert set(filas) == {"QUI-024", "BIO-011", "FIS-008"}
    assert (filas["QUI-024"]["cargos"], filas["QUI-024"]["monto"]) == (1, 72.5)
    assert (filas["BIO-011"]["cargos"], filas["BIO-011"]["monto"]) == (1, 100.0)
    assert (filas["FIS-008"]["cargos"], filas["FIS-008"]["monto"]) == (1, 29.0)
    assert filas["FIS-008"]["estado"] == "correccion" and filas["QUI-024"]["estado"] == "por-confirmar"
    assert filas["QUI-024"]["coordinador"] == "Daniela Rivas" and filas["QUI-024"]["proyectoId"] == QUI
    assert t["coordinadoresPendientes"] == 3

    # Coordinadora de Química: solo su proyecto (RN-07)
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    c = pg_client.get("/api/cierre/cargos").json()
    assert [p["codigo"] for p in c["proyectos"]] == ["QUI-024"]
    assert c["proyecto"] == "QUI-024" and c["proyectoId"] == QUI and c["cierra"] == "Carmen Pérez"
    assert c["periodo"]["id"] == periodo["id"]
    assert [(x["tipo"], x["referencia"], x["monto"]) for x in c["cargos"]] == [("despacho", "DSP-T-0002", 72.5)]
    assert c["cargos"][0]["fecha"] == "2030-03-15"
    assert c["cargos"][0]["concepto"] == "Guantes de Nitrilo Talla M (Caja x100) 5 caja"

    ajeno = pg_client.post("/api/cierre/confirmaciones", json={"proyectoId": BIO})
    assert ajeno.status_code == 404 and ajeno.json()["detail"] == "Ese proyecto no es tuyo."
    assert pg_client.post("/api/cierre/confirmaciones", json={"proyectoId": "QUI-024"}).status_code == 404
    ok = pg_client.post("/api/cierre/confirmaciones", json={"proyectoId": QUI})
    assert ok.status_code == 200, ok.text
    assert ok.json()["proyecto"] == "QUI-024" and ok.json()["cargos"] == 1 and ok.json()["monto"] == 72.5
    otra_vez = pg_client.post("/api/cierre/confirmaciones", json={"proyectoId": QUI})
    assert otra_vez.status_code == 409 and otra_vez.json()["detail"] == "Ya confirmaste los cargos de QUI-024."

    # Física tiene una corrección pendiente: no confirma
    iniciar_sesion(pg_client, "coord.fisica@cpq.local")
    c = pg_client.get("/api/cierre/cargos").json()
    assert c["proyectos"][0]["correcciones"] == ["DSP-T-0001"]
    bloqueada = pg_client.post("/api/cierre/confirmaciones", json={"proyectoId": FIS})
    assert bloqueada.status_code == 409 and "DSP-T-0001 espera la decisión del aprobador" in bloqueada.json()["detail"]

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    t = pg_client.get("/api/cierre").json()
    assert t["filas"][0]["proyecto"] == "QUI-024" and t["filas"][0]["estado"] == "confirmado"
    assert t["coordinadoresPendientes"] == 2
    r = pg_client.post(f"/api/periodos/{periodo['id']}/recordatorios")
    assert r.json() == {"enviados": 2, "sinCoordinador": 0}
    recordatorios = pg_db.query(Notification).filter(Notification.title.like("Recordatorio:%")).all()
    assert {a.user_id for a in recordatorios} == {COORD_BIO, COORD_FIS}

    # SP-08: se cierra aunque falten confirmaciones; queda registrado cuáles faltaban
    cerrado = pg_client.post(f"/api/periodos/{periodo['id']}/cerrar")
    assert cerrado.status_code == 200, cerrado.text
    assert cerrado.json()["estado"] == "cerrado" and cerrado.json()["faltan"] == 2
    log = pg_db.query(AuditLog).filter(AuditLog.action_type == "ACCOUNTING_PERIOD_CLOSED").one()
    assert log.new_value["detalle"] == "Sin confirmar: BIO-011, FIS-008"
    assert pg_db.get(AccountingPeriod, periodo["id"]).total_overhead_cost == Decimal("100.00")
    assert pg_client.post(f"/api/periodos/{periodo['id']}/cerrar").json()["detail"] == "Ese período ya está cerrado."
    assert pg_client.post(f"/api/periodos/{periodo['id']}/recordatorios").status_code == 409
    assert pg_client.get("/api/periodos/actual").json() is None
    assert pg_client.post("/api/periodos/no-es-uuid/cerrar").status_code == 404


def test_reparto_con_los_dos_criterios(pg_client, pg_db):
    _sin_periodo_de_la_semilla(pg_db)
    _movimientos(pg_db)
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    vacio = pg_client.get("/api/reparto").json()
    assert vacio["periodo"] is None and vacio["filas"] == [] and vacio["gastos"] is None and vacio["ultimo"] is None

    periodo = _abrir(pg_client)
    antes = pg_client.post(f"/api/periodos/{periodo['id']}/reparto", json={"criterio": "iguales"})
    assert antes.status_code == 409 and antes.json()["detail"].startswith("Cierra ")
    pg_client.post(f"/api/periodos/{periodo['id']}/cerrar")

    r = pg_client.get("/api/reparto").json()
    assert r["periodo"]["id"] == periodo["id"] and r["periodo"]["cerradoEl"]
    assert r["gastos"] == {"total": 100.0, "lotes": 1, "insumos": ["Guantes de Nitrilo Talla M (Caja x100)"]}
    assert r["consumoTotal"] == 101.5  # 72,50 de QUI-024 + 29,00 de FIS-008 (el gasto de BIO-011 no es consumo)
    filas = {f["proyecto"]: f for f in r["filas"]}
    assert [f["proyecto"] for f in r["filas"]] == ["BIO-011", "FIS-008", "QUI-024"]
    # En centavos hacia abajo; el residuo va al código menor (F7.4)
    assert [filas[c]["segunConsumo"] for c in ("BIO-011", "FIS-008", "QUI-024")] == [0.01, 28.57, 71.42]
    assert [filas[c]["enPartesIguales"] for c in ("BIO-011", "FIS-008", "QUI-024")] == [33.34, 33.33, 33.33]
    assert r["residuo"] == {"consumo": 0.01, "iguales": 0.01}
    assert round(filas["QUI-024"]["porcentaje"], 1) == 71.4
    assert r["excluidos"] == []

    malo = pg_client.post(f"/api/periodos/{periodo['id']}/reparto", json={"criterio": "otro"})
    assert malo.status_code == 422 and malo.json()["detail"][0]["loc"] == ["body", "criterio"]

    gasto_qui = pg_db.get(Project, QUI).executed_budget
    aplicado = pg_client.post(f"/api/periodos/{periodo['id']}/reparto", json={"criterio": "consumo"})
    assert aplicado.status_code == 200, aplicado.text
    cuerpo = aplicado.json()
    assert cuerpo["periodoId"] == periodo["id"] and cuerpo["criterio"] == "consumo" and cuerpo["total"] == 100.0
    assert [(f["proyecto"], f["monto"], f["porcentaje"]) for f in cuerpo["filas"]] == [
        ("BIO-011", 0.01, 0.0), ("FIS-008", 28.57, 28.6), ("QUI-024", 71.42, 71.4)]
    pg_db.expire_all()
    # El reparto entra al gasto ejecutado (vista app.v_project_spend)
    assert pg_db.get(Project, QUI).executed_budget == gasto_qui + Decimal("71.42")
    p = pg_db.get(AccountingPeriod, periodo["id"])
    assert (p.status, p.proration_criterion, p.prorated_by_user_id) == ("Prorrateado", "Proporcional", APROBADOR)
    assert pg_db.query(OverheadAllocation).filter(OverheadAllocation.period_id == p.id).count() == 3
    aviso = pg_db.query(Notification).filter(Notification.user_id == COORD_QUI,
                                             Notification.title.like("Se cargaron US$ 71,42%")).one()
    assert aviso.link == f"/proyectos/{QUI}"

    dos_veces = pg_client.post(f"/api/periodos/{periodo['id']}/reparto", json={"criterio": "iguales"})
    assert dos_veces.status_code == 409 and dos_veces.json()["detail"].endswith("ya se repartieron.")
    despues = pg_client.get("/api/reparto").json()
    assert despues["periodo"] is None
    assert despues["ultimo"]["criterio"] == "consumo" and despues["ultimo"]["aplicadoPor"] == "Carmen Pérez"
    assert despues["ultimo"]["total"] == 100.0


def test_sin_consumo_solo_se_reparte_en_partes_iguales(pg_client, pg_db):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    r = pg_client.get("/api/reparto").json()
    assert r["periodo"]["id"] == PERIODO_SEMILLA and r["consumoTotal"] == 0
    assert all(f["segunConsumo"] is None for f in r["filas"])
    consumo = pg_client.post(f"/api/periodos/{PERIODO_SEMILLA}/reparto", json={"criterio": "consumo"})
    assert consumo.status_code == 409
    assert consumo.json()["detail"] == "Ningún proyecto activo consumió en el período: repártelo en partes iguales."
    iguales = pg_client.post(f"/api/periodos/{PERIODO_SEMILLA}/reparto", json={"criterio": "iguales"})
    assert iguales.status_code == 200, iguales.text
    assert round(sum(f["monto"] for f in iguales.json()["filas"]), 2) == iguales.json()["total"]


def test_suspendidos_no_participan(pg_client, pg_db):
    pg_db.get(Project, FIS).operational_status = "Suspendido"
    pg_db.flush()
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    r = pg_client.get("/api/reparto").json()
    assert r["excluidos"] == ["FIS-008"]
    assert [f["proyecto"] for f in r["filas"]] == ["BIO-011", "QUI-024"]
