"""Módulo 2 (proyectos, plan de hitos y avance) y la búsqueda global con el contrato del frontend,
contra PostgreSQL con el esquema real (fixtures pg_* de tests/conftest.py)."""

import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import text

from app.auditoria.models import AuditLog
from app.core.config import settings
from app.modulos.usuarios.models import (
    EquipmentReservation,
    MilestoneProgressLog,
    Notification,
    Project,
    Request,
)
from tests.conftest import iniciar_sesion

ADMIN = "a0000000-0000-0000-0000-000000000001"
COORD_QUI = "a0000000-0000-0000-0000-000000000003"
COORD_BIO = "a0000000-0000-0000-0000-000000000004"
COORD_FIS = "a0000000-0000-0000-0000-000000000005"
QUI = "b0000000-0000-0000-0000-000000000001"
BIO = "b0000000-0000-0000-0000-000000000002"
FIS = "b0000000-0000-0000-0000-000000000003"
HITO_1 = "b1000000-0000-0000-0000-000000000001"
HITO_2 = "b1000000-0000-0000-0000-000000000002"
HITO_3 = "b1000000-0000-0000-0000-000000000003"
EQUIPO = "f0000000-0000-0000-0000-000000000001"


def _hoy():
    return datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date()


def _campos(errores):
    return {tuple(e["loc"][1:]) for e in errores.json()["detail"]}


def _nuevo(cliente, **extra):
    datos = {"codigo": "QUI-099", "nombre": "Catálisis de prueba", "area": "Química", "presupuesto": 5000,
             "prioridad": "Media", "coordinadorId": None, **extra}
    r = cliente.post("/api/proyectos", json=datos)
    assert r.status_code == 201, r.text
    return r.json()


# =============================================================================
# Lista, exportación y coordinadores
# =============================================================================

def test_lista_rn07_conteos_y_filtros(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    r = pg_client.get("/api/proyectos")
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["total"] == 3 and cuerpo["pagina"] == 1 and cuerpo["paginas"] == 1 and cuerpo["porPagina"] == 20
    assert cuerpo["conteos"] == {"Todos": 3, "En ejecución": 3, "Propuesta": 0, "Suspendido": 0, "Finalizado": 0}
    # Por prioridad: Crítica, Alta, Media
    assert [p["codigo"] for p in cuerpo["items"]] == ["BIO-011", "QUI-024", "FIS-008"]
    qui = next(p for p in cuerpo["items"] if p["codigo"] == "QUI-024")
    assert qui == {
        "id": QUI, "codigo": "QUI-024", "nombre": "Síntesis de nanopartículas para catálisis heterogénea",
        "area": "Química", "estatus": "En ejecución", "prioridad": "Alta", "presupuesto": 8500.0,
        # Despacho de la semilla: 5 cajas de guantes × 14,50
        "gastoEjecutado": 72.5, "avance": 45.0, "ejecucion": 1, "planConfirmado": True,
        "coordinador": {"id": COORD_QUI, "nombre": "Daniela Rivas"},
    }
    bio = next(p for p in cuerpo["items"] if p["codigo"] == "BIO-011")
    assert bio["avance"] is None and bio["planConfirmado"] is False

    # Búsqueda sin tildes (también por el coordinador), área, prioridad y estatus
    assert [p["codigo"] for p in pg_client.get("/api/proyectos", params={"q": "MARIA"}).json()["items"]] == ["BIO-011"]
    assert [p["codigo"] for p in pg_client.get("/api/proyectos", params={"area": "Física"}).json()["items"]] == ["FIS-008"]
    assert pg_client.get("/api/proyectos", params={"prioridad": "Inventada"}).json()["total"] == 0
    filtrada = pg_client.get("/api/proyectos", params={"estatus": "Propuesta"}).json()
    assert filtrada["total"] == 0 and filtrada["conteos"]["Todos"] == 3
    assert pg_client.get("/api/proyectos", params={"pagina": "abc"}).json()["pagina"] == 1
    assert pg_client.get("/api/proyectos", params={"pagina": 99}).json()["pagina"] == 1

    # RN-07: el coordinador solo ve los suyos
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    assert [p["codigo"] for p in pg_client.get("/api/proyectos").json()["items"]] == ["QUI-024"]
    # El aprobador no entra
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.get("/api/proyectos").status_code == 403
    assert pg_client.get("/api/proyectos/exportar").status_code == 403


def test_exportar_csv(pg_client):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    r = pg_client.get("/api/proyectos/exportar")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert r.headers["content-disposition"] == f'attachment; filename="proyectos-{_hoy().isoformat()}.csv"'
    contenido = r.content.decode("utf-8")
    assert contenido.startswith("﻿")
    filas = contenido.lstrip("﻿").split("\r\n")
    assert filas[0].startswith('"Código";"Nombre";"Área";"Coordinador"')
    assert len(filas) == 2  # RN-07
    assert filas[1] == (
        '"QUI-024";"Síntesis de nanopartículas para catálisis heterogénea";"Química";"Daniela Rivas";'
        '"En ejecución";"Alta";"8500,00";"72,50";"45";"1"'
    )


def test_coordinadores_para_asignar(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    r = pg_client.get("/api/proyectos/coordinadores")
    assert r.status_code == 200
    assert r.json() == [
        {"id": COORD_FIS, "nombre": "Andrés Salazar", "proyectos": 1},
        {"id": COORD_QUI, "nombre": "Daniela Rivas", "proyectos": 1},
        {"id": COORD_BIO, "nombre": "María Fernanda Ochoa", "proyectos": 1},
    ]
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    assert pg_client.get("/api/proyectos/coordinadores").status_code == 403


# =============================================================================
# Registro (F2.1)
# =============================================================================

def test_registrar_proyecto_avisa_y_audita(pg_client, pg_db):
    iniciar_sesion(pg_client, "admin@cpq.local")
    nuevo = _nuevo(pg_client, codigo=" qui-099 ", nombre="  Catálisis   de prueba ", presupuesto=5000.456,
                   coordinadorId=COORD_QUI)
    assert nuevo["codigo"] == "QUI-099" and nuevo["nombre"] == "Catálisis de prueba"
    assert nuevo["estatus"] == "Propuesta" and nuevo["area"] == "Química" and nuevo["presupuesto"] == 5000.46
    assert nuevo["avance"] is None and nuevo["planConfirmado"] is False and nuevo["gastoEjecutado"] == 0
    assert nuevo["coordinador"] == {"id": COORD_QUI, "nombre": "Daniela Rivas"}
    uuid.UUID(nuevo["id"])

    aviso = pg_db.query(Notification).filter(Notification.user_id == COORD_QUI).one()
    assert aviso.title == "Te asignaron el proyecto QUI-099" and aviso.link == f"/proyectos/{nuevo['id']}"
    log = pg_db.query(AuditLog).filter(AuditLog.target_id == nuevo["id"]).one()
    assert log.action_type == "PROJECT_CREATED" and log.new_value["descripcion"] == "José Rodríguez registró el proyecto QUI-099"

    dup = pg_client.post("/api/proyectos", json={"codigo": "QUI-024", "nombre": "Otro proyecto", "area": "Química",
                                                 "presupuesto": 10, "prioridad": "Alta"})
    assert dup.status_code == 409
    assert dup.json()["detail"] == {
        "mensaje": "Ya existe un proyecto con ese código.",
        "proyecto": {"id": QUI, "codigo": "QUI-024", "nombre": "Síntesis de nanopartículas para catálisis heterogénea"},
    }


def test_registrar_proyecto_validaciones(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    mala = pg_client.post("/api/proyectos", json={"codigo": "Q-1", "nombre": "abc", "area": "Arte",
                                                  "presupuesto": 0, "prioridad": "Urgente",
                                                  "coordinadorId": ADMIN})
    assert mala.status_code == 422
    assert _campos(mala) == {("codigo",), ("nombre",), ("area",), ("presupuesto",), ("prioridad",), ("coordinadorId",)}

    area = pg_client.post("/api/proyectos", json={"codigo": "FIS-099", "nombre": "Óptica no lineal", "area": "Química",
                                                  "presupuesto": "100", "prioridad": "Baja"})
    assert area.status_code == 422
    mensajes = {e["loc"][1]: e["msg"] for e in area.json()["detail"]}
    assert mensajes["area"] == "El código FIS-099 es de Física. Cambia el área o el código."
    assert mensajes["presupuesto"] == "Escribe un monto mayor que cero, por ejemplo 9.500,00."

    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    assert pg_client.post("/api/proyectos", json={}).status_code == 403


# =============================================================================
# Ficha y pestañas (vista 07)
# =============================================================================

def test_ficha_completa(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    r = pg_client.get(f"/api/proyectos/{QUI}")
    assert r.status_code == 200
    f = r.json()
    assert f["codigo"] == "QUI-024" and f["avance"] == 45.0 and f["registradoEl"]
    assert [(h["numero"], h["peso"], h["avance"]) for h in f["hitos"]] == [(1, 30.0, 100.0), (2, 40.0, 37.5), (3, 30.0, 0.0)]
    assert f["sumaPesos"] == 100
    assert f["proximoHito"]["numero"] == 2 and f["proximoHito"]["nombre"].startswith("Fase 2")
    assert f["desglose"] == {"gastos": 0.0, "despachos": 72.5, "compartidos": 0.0}
    assert f["movimientos"][0]["tipo"] == "Despacho" and f["movimientos"][0]["referencia"] == "DSP-2026-0001"
    assert f["movimientos"][0]["texto"].startswith("Despacho de guantes de Nitrilo")
    assert f["transiciones"] == [{"estatus": "Suspendido", "bloqueo": None}, {"estatus": "Finalizado", "bloqueo": None}]


def test_ficha_acceso_rn07_y_404(pg_client):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    assert pg_client.get(f"/api/proyectos/{QUI}").status_code == 200
    ajena = pg_client.get(f"/api/proyectos/{BIO}")
    assert ajena.status_code == 403
    assert ajena.json()["detail"] == "BIO-011 no está asignado a ti: solo ves los proyectos que coordinas."
    for pestana in ("gastos", "reservas", "historial", "plan"):
        assert pg_client.get(f"/api/proyectos/{BIO}/{pestana}").status_code == 403
    for ruta in ("/api/proyectos/QUI-024", f"/api/proyectos/{uuid.uuid4()}"):
        r = pg_client.get(ruta)
        assert r.status_code == 404 and r.json()["detail"] == "Ese proyecto no existe."
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.get(f"/api/proyectos/{QUI}").status_code == 403


def test_pestanas_gastos_reservas_historial(pg_client, pg_db):
    inicio = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=2)
    for estado, horas in (("Pendiente de Aprobación", 0), ("Aprobado", 5), ("Borrador", 10)):
        pg_db.add(EquipmentReservation(
            equipment_id=EQUIPO, project_id=QUI, reserved_by_user_id=COORD_QUI, status=estado,
            start_time=inicio + timedelta(hours=horas), end_time=inicio + timedelta(hours=horas + 2),
        ))
    pg_db.flush()

    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    gastos = pg_client.get(f"/api/proyectos/{QUI}/gastos").json()
    assert len(gastos) == 1
    assert {k: gastos[0][k] for k in ("tipo", "referencia", "monto", "concepto")} == {
        "tipo": "despacho", "referencia": "DSP-2026-0001", "monto": 72.5,
        "concepto": "Guantes de Nitrilo Talla M (Caja x100) 5 caja",
    }

    reservas = pg_client.get(f"/api/proyectos/{QUI}/reservas").json()
    # Los borradores no se muestran; la más próxima en el tiempo va al final
    assert [r["estado"] for r in reservas] == ["aprobada", "pendiente"]
    assert reservas[0]["equipo"] == "Espectrofotómetro UV-Vis Shimadzu"

    iniciar_sesion(pg_client, "admin@cpq.local")
    assert pg_client.patch(f"/api/proyectos/{QUI}/estatus",
                           json={"estatus": "Suspendido", "comentario": " Falta de reactivos "}).status_code == 200
    historial = pg_client.get(f"/api/proyectos/{QUI}/historial").json()
    assert historial[0]["descripcion"] == "José Rodríguez cambió el estatus de QUI-024 de En ejecución a Suspendido"
    assert historial[0]["justificacion"] == "Falta de reactivos" and historial[0]["ip"]


def test_las_consultas_no_escriben(pg_client, pg_db):
    antes = pg_db.execute(text("SELECT updated_at, physical_progress_pct FROM app.projects WHERE id = :p"), {"p": QUI}).one()
    iniciar_sesion(pg_client, "admin@cpq.local")
    for ruta in ("", "/gastos", "/reservas", "/historial", "/plan", f"/hitos/{HITO_2}/avances"):
        assert pg_client.get(f"/api/proyectos/{QUI}{ruta}").status_code == 200, ruta
    assert pg_client.get("/api/proyectos").status_code == 200
    despues = pg_db.execute(text("SELECT updated_at, physical_progress_pct FROM app.projects WHERE id = :p"), {"p": QUI}).one()
    assert antes == despues
    assert pg_db.query(AuditLog).filter(AuditLog.target_table == "projects").count() == 0


# =============================================================================
# Estatus y coordinador (F2.2, F2.3)
# =============================================================================

def test_ciclo_de_estatus_con_bloqueos(pg_client, pg_db):
    iniciar_sesion(pg_client, "admin@cpq.local")
    p = _nuevo(pg_client)
    url = f"/api/proyectos/{p['id']}"

    ficha = pg_client.get(url).json()
    assert ficha["transiciones"] == [{"estatus": "En ejecución", "bloqueo": "Primero asígnale un coordinador."}]
    r = pg_client.patch(f"{url}/estatus", json={"estatus": "En ejecución"})
    assert r.status_code == 409 and r.json()["detail"] == "Primero asígnale un coordinador."
    r = pg_client.patch(f"{url}/estatus", json={"estatus": "Finalizado"})
    assert r.status_code == 409 and r.json()["detail"] == "Un proyecto en estatus Propuesta no puede pasar a Finalizado."
    assert pg_client.patch(f"{url}/estatus", json={"estatus": "Cerrado"}).status_code == 422
    # El mismo estatus no cambia nada
    assert pg_client.patch(f"{url}/estatus", json={"estatus": "Propuesta"}).json()["estatus"] == "Propuesta"

    assert pg_client.patch(f"{url}/coordinador", json={"coordinadorId": COORD_QUI}).status_code == 200
    r = pg_client.patch(f"{url}/estatus", json={"estatus": "En ejecución"})
    assert r.status_code == 409 and "plan de hitos" in r.json()["detail"]

    # El coordinador confirma el plan: los administradores reciben el aviso y ya se puede pasar
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    plan = pg_client.put(f"{url}/hitos", json={"confirmar": True, "hitos": [
        {"id": None, "nombre": "Diseño", "fechaPrevista": "2027-01-15", "peso": 40},
        {"id": None, "nombre": "Ensayos", "fechaPrevista": "2027-03-15", "peso": 60},
    ]})
    assert plan.status_code == 200 and plan.json()["planConfirmado"] is True and plan.json()["avance"] == 0.0
    assert pg_db.query(Notification).filter(
        Notification.user_id == ADMIN, Notification.title == "QUI-099 tiene su plan de hitos confirmado"
    ).count() == 1

    iniciar_sesion(pg_client, "admin@cpq.local")
    r = pg_client.patch(f"{url}/estatus", json={"estatus": "En ejecución", "comentario": "x" * 400})
    assert r.status_code == 200 and r.json()["estatus"] == "En ejecución"
    log = pg_db.query(AuditLog).filter(AuditLog.target_id == p["id"], AuditLog.action_type == "PROJECT_STATUS_CHANGED").one()
    assert log.old_value == {"status": "Propuesta"} and len(log.justification) == 300
    assert pg_db.query(Notification).filter(Notification.user_id == COORD_QUI, Notification.title == "QUI-099 pasó a En ejecución").count() == 1

    assert pg_client.patch(f"{url}/estatus", json={"estatus": "Finalizado"}).status_code == 200
    r = pg_client.patch(f"{url}/coordinador", json={"coordinadorId": COORD_BIO})
    assert r.status_code == 409 and r.json()["detail"] == "El proyecto está finalizado: ya no cambia de coordinador."

    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    assert pg_client.patch(f"{url}/estatus", json={"estatus": "Suspendido"}).status_code == 403


def test_cambiar_coordinador_avisa_a_los_dos(pg_client, pg_db):
    iniciar_sesion(pg_client, "admin@cpq.local")
    r = pg_client.patch(f"/api/proyectos/{BIO}/coordinador", json={"coordinadorId": COORD_QUI})
    assert r.status_code == 200 and r.json()["coordinador"] == {"id": COORD_QUI, "nombre": "Daniela Rivas"}
    assert pg_db.query(Notification).filter(Notification.user_id == COORD_QUI, Notification.title == "Te asignaron el proyecto BIO-011").count() == 1
    assert pg_db.query(Notification).filter(Notification.user_id == COORD_BIO, Notification.title == "Ya no coordinas BIO-011").count() == 1
    log = pg_db.query(AuditLog).filter(AuditLog.target_id == BIO).one()
    assert log.new_value["descripcion"] == "José Rodríguez cambió el coordinador de BIO-011 de María Fernanda Ochoa a Daniela Rivas"

    for malo in (ADMIN, "no-es-uuid", None, str(uuid.uuid4())):
        r = pg_client.patch(f"/api/proyectos/{BIO}/coordinador", json={"coordinadorId": malo})
        assert r.status_code == 422 and r.json()["detail"][0]["loc"] == ["body", "coordinadorId"]
    assert pg_client.patch(f"/api/proyectos/{uuid.uuid4()}/coordinador", json={"coordinadorId": COORD_QUI}).status_code == 404


# =============================================================================
# Plan de hitos y avance (vista 08)
# =============================================================================

def test_plan_y_validaciones(pg_client):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    plan = pg_client.get(f"/api/proyectos/{QUI}/plan").json()
    assert plan["planConfirmado"] is True and plan["avance"] == 45.0
    assert [(h["id"], h["numero"], h["cargas"], h["ultimaCarga"]) for h in plan["hitos"]] == [
        (HITO_1, 1, 0, None), (HITO_2, 2, 0, None), (HITO_3, 3, 0, None)]

    url = f"/api/proyectos/{QUI}/hitos"
    assert _campos(pg_client.put(url, json={"hitos": []})) == {("hitos",)}
    mala = pg_client.put(url, json={"hitos": [
        {"id": None, "nombre": "", "fechaPrevista": "2027-02-30", "peso": 0},
        {"id": str(uuid.uuid4()), "nombre": "Otro", "fechaPrevista": "2027-01-01", "peso": 10.5},
    ]})
    assert mala.status_code == 422
    assert _campos(mala) == {("hitos", 0, "nombre"), ("hitos", 0, "fechaPrevista"), ("hitos", 0, "peso"),
                             ("hitos", 1, "nombre"), ("hitos", 1, "peso")}
    # Ya confirmado: los pesos tienen que seguir sumando 100
    r = pg_client.put(url, json={"hitos": [{"id": HITO_1, "nombre": "Fase 1", "fechaPrevista": "2026-10-01", "peso": 70}]})
    assert r.status_code == 422 and r.json()["detail"][0]["msg"] == "Los pesos suman 70 %: faltan 30 % para llegar a 100 %."

    # El administrador no edita el plan; otro coordinador tampoco
    iniciar_sesion(pg_client, "admin@cpq.local")
    assert pg_client.put(url, json={"hitos": []}).status_code == 403
    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    assert pg_client.put(url, json={"hitos": []}).status_code == 403


def test_plan_reordena_y_no_quita_hitos_con_cargas(pg_client, pg_db):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    hoy = _hoy().isoformat()
    assert pg_client.post(f"/api/proyectos/{QUI}/hitos/{HITO_2}/avances",
                          json={"porcentaje": 50, "fecha": hoy, "comentario": ""}).status_code == 201

    url = f"/api/proyectos/{QUI}/hitos"
    sin_hito_2 = [
        {"id": HITO_1, "nombre": "Fase 1", "fechaPrevista": "2026-10-01", "peso": 30},
        {"id": HITO_3, "nombre": "Fase 3", "fechaPrevista": "2027-02-01", "peso": 70},
    ]
    r = pg_client.put(url, json={"hitos": sin_hito_2})
    assert r.status_code == 409 and "ya tiene cargas de avance" in r.json()["detail"]

    # Quitar el 3 (sin cargas), reordenar y agregar uno nuevo
    r = pg_client.put(url, json={"hitos": [
        {"id": HITO_2, "nombre": "Síntesis", "fechaPrevista": "2026-12-01", "peso": 40},
        {"id": HITO_1, "nombre": "Precursores", "fechaPrevista": "2026-10-01", "peso": 30},
        {"id": None, "nombre": "Informe final", "fechaPrevista": "2027-03-01", "peso": 30},
    ]})
    assert r.status_code == 200, r.text
    plan = r.json()
    assert [(h["numero"], h["nombre"], h["avance"], h["cargas"]) for h in plan["hitos"]] == [
        (1, "Síntesis", 50.0, 1), (2, "Precursores", 100.0, 0), (3, "Informe final", 0.0, 0)]
    assert plan["avance"] == 50.0  # 40 × 50 % + 30 × 100 %
    assert pg_db.execute(text("SELECT physical_progress_pct FROM app.projects WHERE id = :p"), {"p": QUI}).scalar() == 50
    log = pg_db.query(AuditLog).filter(AuditLog.target_id == QUI, AuditLog.action_type == "MILESTONE_PLAN_SAVED").one()
    assert log.new_value["descripcion"] == "Daniela Rivas cambió el plan de hitos de QUI-024 (3 hitos)"
    assert log.new_value["plan"] == "1. Síntesis (40 %); 2. Precursores (30 %); 3. Informe final (30 %)"


def test_borrador_del_plan_sin_avance(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    p = _nuevo(pg_client, coordinadorId=COORD_QUI)
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    r = pg_client.put(f"/api/proyectos/{p['id']}/hitos", json={"confirmar": False, "hitos": [
        {"id": None, "nombre": "Diseño", "fechaPrevista": "2027-01-15", "peso": 60}]})
    assert r.status_code == 200 and r.json()["planConfirmado"] is False and r.json()["avance"] is None
    r = pg_client.put(f"/api/proyectos/{p['id']}/hitos", json={"confirmar": True, "hitos": [
        {"id": r.json()["hitos"][0]["id"], "nombre": "Diseño", "fechaPrevista": "2027-01-15", "peso": 120}]})
    assert r.status_code == 422
    hito = pg_client.get(f"/api/proyectos/{p['id']}/plan").json()["hitos"][0]
    # Sin plan confirmado no se carga avance
    r = pg_client.post(f"/api/proyectos/{p['id']}/hitos/{hito['id']}/avances", json={"porcentaje": 10, "fecha": _hoy().isoformat()})
    assert r.status_code == 409 and r.json()["detail"].startswith("Primero confirma el plan de hitos")


def test_cargar_avance(pg_client, pg_db):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    url = f"/api/proyectos/{QUI}/hitos/{HITO_2}/avances"
    hoy = _hoy()
    ayer = (hoy - timedelta(days=1)).isoformat()

    r = pg_client.post(url, json={"porcentaje": 50, "fecha": ayer, "comentario": " Calcinación lista "})
    assert r.status_code == 201
    assert r.json() == {"hito": 2, "antes": 45.0, "despues": 50.0, "completo": False}

    malas = pg_client.post(url, json={"porcentaje": 101, "fecha": (hoy + timedelta(days=1)).isoformat(), "comentario": "x" * 301})
    assert malas.status_code == 422
    mensajes = {e["loc"][1]: e["msg"] for e in malas.json()["detail"]}
    assert mensajes == {
        "porcentaje": "Escribe un porcentaje entre 0 y 100. Escribiste 101.",
        "fecha": "La fecha no puede ser posterior a hoy.",
        "comentario": "Usa como máximo 300 caracteres.",
    }
    antes = pg_client.post(url, json={"porcentaje": 60, "fecha": (hoy - timedelta(days=5)).isoformat()})
    assert antes.status_code == 422
    assert antes.json()["detail"][0]["msg"] == f"La fecha no puede ser anterior a la última carga ({(hoy - timedelta(days=1)).strftime('%d/%m/%Y')})."

    r = pg_client.post(url, json={"porcentaje": 100, "fecha": hoy.isoformat()})
    assert r.status_code == 201 and r.json() == {"hito": 2, "antes": 50.0, "despues": 70.0, "completo": True}

    cargas = pg_client.get(url).json()
    assert [(c["porcentaje"], c["comentario"], c["usuario"]) for c in cargas] == [
        (100.0, None, "Daniela Rivas"), (50.0, "Calcinación lista", "Daniela Rivas")]
    assert pg_db.query(MilestoneProgressLog).filter(MilestoneProgressLog.milestone_id == HITO_2).count() == 2

    ficha = pg_client.get(f"/api/proyectos/{QUI}").json()
    assert ficha["avance"] == 70.0 and ficha["proximoHito"]["numero"] == 3
    avances = [m for m in ficha["movimientos"] if m["tipo"] == "Avance"]
    assert avances and avances[0]["texto"] == "Avance del hito 2 cargado: 100 %"
    historial = pg_client.get(f"/api/proyectos/{QUI}/historial").json()
    assert historial[0]["descripcion"] == "Daniela Rivas cargó 100 % en el hito 2 de QUI-024"

    # Hito de otro proyecto o inexistente: 404; el administrador no carga avance
    assert pg_client.post(f"/api/proyectos/{QUI}/hitos/{uuid.uuid4()}/avances",
                          json={"porcentaje": 1, "fecha": hoy.isoformat()}).json()["detail"] == "No encontramos ese hito. Recarga la página."
    assert pg_client.get(f"/api/proyectos/{QUI}/hitos/no-uuid/avances").status_code == 404
    iniciar_sesion(pg_client, "admin@cpq.local")
    assert pg_client.post(url, json={"porcentaje": 1, "fecha": hoy.isoformat()}).status_code == 403
    assert pg_client.get(url).status_code == 200


def test_proyecto_finalizado_no_cambia_su_plan(pg_client, pg_db):
    pg_db.query(Project).filter(Project.id == QUI).update({"operational_status": "Finalizado"})
    pg_db.flush()
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    r = pg_client.post(f"/api/proyectos/{QUI}/hitos/{HITO_2}/avances", json={"porcentaje": 60, "fecha": _hoy().isoformat()})
    assert r.status_code == 409 and r.json()["detail"] == "QUI-024 está finalizado: su plan de hitos ya no cambia."
    assert pg_client.put(f"/api/proyectos/{QUI}/hitos", json={"hitos": []}).status_code == 409


# =============================================================================
# Búsqueda global
# =============================================================================

def test_busqueda_por_rol(pg_client, pg_db):
    pg_db.add(Request(request_number="SOL-T-001", request_type="Retiro", cost_center="proyecto", project_id=QUI,
                      requester_user_id=COORD_QUI, status="Pendiente de Aprobación"))
    pg_db.add(Request(request_number="SOL-T-002", request_type="Retiro", cost_center="proyecto", project_id=BIO,
                      requester_user_id=COORD_BIO, status="Borrador"))
    pg_db.flush()

    iniciar_sesion(pg_client, "admin@cpq.local")
    assert pg_client.get("/api/buscar", params={"q": " a "}).json() == {"q": "a", "grupos": []}
    r = pg_client.get("/api/buscar", params={"q": "quimica"}).json()
    assert [g["clave"] for g in r["grupos"]] == ["proyectos", "insumos", "equipos"]
    proyectos = r["grupos"][0]
    assert proyectos["total"] == 1 and proyectos["resultados"][0] == {
        "id": QUI, "titulo": "QUI-024 · Síntesis de nanopartículas para catálisis heterogénea",
        "detalle": "Química · En ejecución", "enlace": f"/proyectos/{QUI}",
    }
    guantes = pg_client.get("/api/buscar", params={"q": "guantes"}).json()["grupos"][1]["resultados"][0]
    assert guantes["detalle"] == "Consumible de uso general · 25 caja en stock"
    assert guantes["enlace"] == f"/inventario/{guantes['id']}"
    equipo = pg_client.get("/api/buscar", params={"q": "espectro"}).json()["grupos"][2]["resultados"][0]
    assert equipo["detalle"] == "EQ-FACYT-001 · Disponible" and equipo["enlace"] == "/equipos?q=EQ-FACYT-001"

    # Coordinador: sus proyectos y sus solicitudes (RN-07)
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    r = pg_client.get("/api/buscar", params={"q": "sol-t"}).json()
    assert [g["clave"] for g in r["grupos"]] == ["proyectos", "insumos", "equipos", "solicitudes"]
    assert [s["titulo"].split(" · ")[0] for s in r["grupos"][3]["resultados"]] == ["SOL-T-001"]
    assert r["grupos"][3]["resultados"][0]["enlace"] == "/solicitudes"
    assert pg_client.get("/api/buscar", params={"q": "BIO-011"}).json()["grupos"][0]["total"] == 0
    guantes = pg_client.get("/api/buscar", params={"q": "guantes"}).json()["grupos"][1]["resultados"][0]
    assert guantes["enlace"] == "/inventario?q=Guantes%20de%20Nitrilo%20Talla%20M%20(Caja%20x100)"
    assert pg_client.get("/api/buscar", params={"q": "espectro"}).json()["grupos"][2]["resultados"][0]["enlace"] == "/reservas"

    # Aprobador: sin proyectos; los pedidos que le llegan (sin borradores)
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    r = pg_client.get("/api/buscar", params={"q": "sol-t"}).json()
    assert [g["clave"] for g in r["grupos"]] == ["insumos", "equipos", "solicitudes"]
    resultados = r["grupos"][2]["resultados"]
    # Se lee el número; se enlaza con el UUID
    assert [x["titulo"].split(" · ")[0] for x in resultados] == ["SOL-T-001"]
    assert resultados[0]["detalle"] == "QUI-024 · Pendiente de Aprobación"
    assert resultados[0]["enlace"] == f"/bandeja?pedido={resultados[0]['id']}"

    pg_client.cookies.clear()
    assert pg_client.get("/api/buscar", params={"q": "quimica"}).status_code == 401
