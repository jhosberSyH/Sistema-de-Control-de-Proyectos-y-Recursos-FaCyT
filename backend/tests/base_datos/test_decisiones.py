"""Decisiones de diseño del 9 de noviembre de 2026 (docs/revision/hallazgos_backend.md §6), contra PostgreSQL."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.almacenamiento.service import AlmacenLocal, obtener_almacen
from app.main import app
from app.modulos.usuarios.models import (
    Dispatch,
    EquipmentReservation,
    Notification,
    Project,
    Request,
)
from tests.conftest import iniciar_sesion

QUI = "b0000000-0000-0000-0000-000000000001"
COORD_QUI = "a0000000-0000-0000-0000-000000000003"
EQUIPO = "f0000000-0000-0000-0000-000000000001"
DESPACHO_SEED = "20000000-0000-0000-0000-000000000001"  # 5 unidades a 14,50 para QUI-024
ITEM = "e0000000-0000-0000-0000-000000000001"


def _reserva(db, estado, desde_horas=48, horas=2):
    inicio = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=desde_horas)
    r = EquipmentReservation(
        equipment_id=EQUIPO, project_id=QUI, reserved_by_user_id=COORD_QUI,
        start_time=inicio, end_time=inicio + timedelta(hours=horas), status=estado,
    )
    db.add(r)
    db.flush()
    return r


def _gasto_vista(db, proyecto_id):
    return db.execute(text("SELECT executed_budget FROM app.v_project_spend WHERE project_id = :p"), {"p": proyecto_id}).scalar()


# --- Decisión 1: 'Cancelado' -----------------------------------------------------------------

def test_mantenimiento_cancela_reservas_y_avisa(pg_client, pg_db):
    reserva = _reserva(pg_db, "Aprobado")
    pg_db.commit()
    iniciar_sesion(pg_client, "admin@cpq.local")
    r = pg_client.post(f"/api/equipos/{EQUIPO}/mantenimiento", json={"motivo": "Calibración anual del fabricante"})
    assert r.status_code == 200, r.text
    pg_db.expire_all()
    assert pg_db.get(EquipmentReservation, reserva.id).status == "Cancelado"
    aviso = pg_db.query(Notification).filter(Notification.user_id == COORD_QUI).one()
    assert aviso.kind == "warn" and "canceló" in aviso.title


# --- Decisión 2: solo Pendiente y Aprobado ocupan la agenda ------------------------------------

def test_borradores_superpuestos_se_permiten(pg_db):
    _reserva(pg_db, "Borrador")
    _reserva(pg_db, "Borrador")  # mismo horario: un borrador no aparta el equipo
    _reserva(pg_db, "Pendiente de Aprobación")


def test_pendiente_superpuesta_con_aprobada_se_rechaza(pg_db):
    _reserva(pg_db, "Aprobado")
    with pytest.raises(DBAPIError):
        with pg_db.begin_nested():
            _reserva(pg_db, "Pendiente de Aprobación")


# --- Decisión 3: devolución positiva con sentido; decisión 5: gasto desde los movimientos ------

def test_correccion_a_la_baja_devuelve_y_ajusta_el_gasto(pg_client, pg_db):
    antes = _gasto_vista(pg_db, QUI)
    assert antes == Decimal("72.50")

    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    pedida = pg_client.post("/api/correcciones", json={
        "lineaId": DESPACHO_SEED, "campo": "cantidad", "cantidadNueva": 3,
        "motivo": "Solo llegaron 3 pares al laboratorio",
    })
    assert pedida.status_code == 201, pedida.text

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    revisada = pg_client.post(f"/api/correcciones/{pedida.json()['id']}/aprobar")
    assert revisada.status_code == 200, revisada.text

    pg_db.expire_all()
    comp = pg_db.query(Dispatch).filter(Dispatch.is_compensatory.is_(True)).one()
    assert (comp.dispatched_quantity, comp.direction, comp.signed_quantity) == (Decimal("2.000"), "devolucion", Decimal("-2.000"))
    # 72,50 - 2 x 14,50 = 43,50, igual en la vista y en el ORM
    assert _gasto_vista(pg_db, QUI) == Decimal("43.50")
    assert pg_db.get(Project, QUI).executed_budget == Decimal("43.50")
    assert pg_db.query(Notification).filter(Notification.user_id == COORD_QUI, Notification.kind == "ok").count() == 1


def test_orm_y_vista_dan_el_mismo_gasto(pg_db):
    for p in pg_db.query(Project).all():
        assert p.executed_budget == _gasto_vista(pg_db, p.id), p.code


def test_ver_un_proyecto_no_escribe(pg_client, pg_db):
    antes = pg_db.execute(text("SELECT updated_at FROM app.projects WHERE id = :p"), {"p": QUI}).scalar()
    iniciar_sesion(pg_client, "admin@cpq.local")
    assert pg_client.get(f"/api/proyectos/{QUI}").status_code == 200
    assert pg_client.get(f"/api/proyectos/{QUI}/plan").status_code == 200
    despues = pg_db.execute(text("SELECT updated_at FROM app.projects WHERE id = :p"), {"p": QUI}).scalar()
    assert antes == despues


# --- Decisión 4: centro de costo ---------------------------------------------------------------

def test_reposicion_va_a_centro_general_y_avisa_al_aprobador(pg_client, pg_db):
    iniciar_sesion(pg_client, "admin@cpq.local")
    r = pg_client.patch(f"/api/insumos/{ITEM}/minimo", json={"stockMinimo": 100000})
    assert r.status_code == 200, r.text
    pg_db.expire_all()
    rep = pg_db.query(Request).filter(Request.request_type == "Reposición automática").one()
    assert rep.cost_center == "general" and rep.project_id is None
    assert pg_db.query(Project).filter(Project.code == "GEN-001").count() == 0
    aprobador = "a0000000-0000-0000-0000-000000000002"
    assert pg_db.query(Notification).filter(Notification.user_id == aprobador, Notification.kind == "info").count() == 1


def test_centro_proyecto_exige_proyecto(pg_db):
    with pytest.raises(DBAPIError):
        with pg_db.begin_nested():
            pg_db.execute(text(
                "INSERT INTO app.requests (request_number, request_type, cost_center, project_id, requester_user_id) "
                "VALUES ('X-1', 'Gasto', 'proyecto', NULL, :u)"
            ), {"u": COORD_QUI})


# --- Decisión 6: avisos ------------------------------------------------------------------------

def test_avisos_de_una_reserva_aprobada(pg_client, pg_db):
    reserva = _reserva(pg_db, "Pendiente de Aprobación")
    pg_db.commit()
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.post(f"/api/reservas/{reserva.id}/aprobar", json={}).status_code == 200

    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    avisos = pg_client.get("/api/avisos").json()
    assert len(avisos) == 1 and avisos[0]["tipo"] == "ok" and avisos[0]["leido"] is False
    assert avisos[0]["enlace"] == f"/reservas?reserva={reserva.id}"
    assert pg_client.post(f"/api/avisos/{avisos[0]['id']}/leido").status_code == 204
    assert pg_client.get("/api/avisos").json()[0]["leido"] is True
    assert pg_client.post("/api/avisos/no-existe/leido").status_code == 404
    assert pg_client.post("/api/avisos/leidos").status_code == 204
    # Los avisos son de cada quien
    iniciar_sesion(pg_client, "coord.fisica@cpq.local")
    assert pg_client.get("/api/avisos").json() == []


# --- Decisión 7: cotización en el almacenamiento -----------------------------------------------

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


@pytest.fixture
def almacen_temporal(tmp_path):
    app.dependency_overrides[obtener_almacen] = lambda: AlmacenLocal(str(tmp_path))
    yield tmp_path
    app.dependency_overrides.pop(obtener_almacen, None)


def _borrador_gasto(db, estado="Borrador"):
    s = Request(request_number=f"SOL-T-{estado[:3]}", request_type="Gasto", cost_center="proyecto",
                project_id=QUI, requester_user_id=COORD_QUI, status=estado, estimated_amount=Decimal("120.00"))
    db.add(s)
    db.commit()
    return s


def test_subir_y_descargar_cotizacion(pg_client, pg_db, almacen_temporal):
    s = _borrador_gasto(pg_db)
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    r = pg_client.post(f"/api/solicitudes/{s.id}/cotizacion",
                       files={"archivo": ("Cotización Merck.pdf", PDF, "application/pdf")})
    assert r.status_code == 200, r.text
    assert r.json() == {"nombre": "Cotizacion Merck.pdf", "tamano": len(PDF)}
    assert (almacen_temporal / "solicitudes" / str(s.id) / "cotizacion.pdf").read_bytes() == PDF

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    d = pg_client.get(f"/api/solicitudes/{s.id}/cotizacion")
    assert d.status_code == 200 and d.content == PDF
    assert d.headers["content-type"] == "application/pdf"
    assert 'filename="Cotizacion Merck.pdf"' in d.headers["content-disposition"]

    # Otro coordinador no la ve (404, como el resto de M5)
    iniciar_sesion(pg_client, "coord.fisica@cpq.local")
    assert pg_client.get(f"/api/solicitudes/{s.id}/cotizacion").status_code == 404
    assert pg_client.post(f"/api/solicitudes/{s.id}/cotizacion",
                          files={"archivo": ("x.pdf", PDF, "application/pdf")}).status_code == 404


def test_cotizacion_validaciones(pg_client, pg_db, almacen_temporal):
    s = _borrador_gasto(pg_db)
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    url = f"/api/solicitudes/{s.id}/cotizacion"
    no_pdf = pg_client.post(url, files={"archivo": ("factura.pdf", b"no soy un pdf", "application/pdf")})
    assert no_pdf.status_code == 422 and no_pdf.json()["detail"][0]["loc"] == ["body", "archivo"]
    grande = pg_client.post(url, files={"archivo": ("x.pdf", PDF + b"0" * (10 * 1024 * 1024), "application/pdf")})
    assert grande.status_code == 422
    assert pg_client.post(url).status_code == 422
    assert pg_client.get(url).status_code == 404  # todavía sin cotización

    enviada = _borrador_gasto(pg_db, estado="Pendiente de Aprobación")
    r = pg_client.post(f"/api/solicitudes/{enviada.id}/cotizacion", files={"archivo": ("x.pdf", PDF, "application/pdf")})
    assert r.status_code == 409
    # Sin el token CSRF la subida se rechaza como cualquier escritura
    r = pg_client.post(url, files={"archivo": ("x.pdf", PDF, "application/pdf")}, headers={"X-CSRF-Token": ""})
    assert r.status_code == 403
