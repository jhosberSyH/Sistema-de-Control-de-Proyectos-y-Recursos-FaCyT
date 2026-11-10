"""Módulo 5 con el contrato del frontend (mis solicitudes, bandeja, priorización), contra PostgreSQL."""

from decimal import Decimal

from app.auditoria.models import AuditLog
from app.modulos.usuarios.models import (
    Dispatch,
    DispatchCorrection,
    EquipmentReservation,
    Notification,
    Project,
    Request,
    RequestItem,
)
from tests.conftest import iniciar_sesion

QUI = "b0000000-0000-0000-0000-000000000001"
BIO = "b0000000-0000-0000-0000-000000000002"
COORD_QUI = "a0000000-0000-0000-0000-000000000003"
APROBADOR = "a0000000-0000-0000-0000-000000000002"
ETANOL = "e0000000-0000-0000-0000-000000000005"  # 40 L a 6,20
GUANTES = "e0000000-0000-0000-0000-000000000004"
AGNO3 = "e0000000-0000-0000-0000-000000000001"
DESPACHO_SEED = "20000000-0000-0000-0000-000000000001"  # 5 cajas de guantes a 14,50 para QUI-024


def test_permisos(pg_client):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.get("/api/solicitudes").status_code == 403
    assert pg_client.post("/api/solicitudes", json={"tipo": "gasto", "proyectoId": QUI}).status_code == 403
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    assert pg_client.get("/api/bandeja").status_code == 403
    assert pg_client.patch(f"/api/proyectos/{QUI}/prioridad", json={"prioridad": "Baja", "justificacion": "x"}).status_code == 403
    iniciar_sesion(pg_client, "admin@cpq.local")
    assert pg_client.get("/api/priorizacion").status_code == 200


def test_borrador_de_retiro_hasta_aprobarlo(pg_client, pg_db):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    assert pg_client.post("/api/solicitudes", json={"tipo": "otro", "proyectoId": QUI}).json()["detail"][0]["loc"] == ["body", "tipo"]
    assert pg_client.post("/api/solicitudes", json={"tipo": "retiro"}).status_code == 422
    assert pg_client.post("/api/solicitudes", json={"tipo": "retiro", "proyectoId": BIO}).status_code == 422  # no es suyo
    assert pg_client.post("/api/solicitudes", json={"tipo": "retiro", "proyectoId": "b0000000-0000-0000-0000-00000000dead"}).status_code == 404

    r = pg_client.post("/api/solicitudes", json={"tipo": "retiro", "proyectoId": QUI,
                                                 "lineas": [{"insumoId": ETANOL, "cantidad": 0}, {"insumoId": "no-existe", "cantidad": 1}]})
    assert r.status_code == 201, r.text
    s = r.json()
    assert s["estado"] == "Borrador" and s["numero"].startswith("SOL-") and s["proyecto"] == "QUI-024"
    assert s["lineas"] == [{"insumoId": ETANOL, "cantidad": 0.0}] and s["resumen"] == "Etanol Absoluto 99.8%"

    # F5.3: no se envía sin cantidades
    falta = pg_client.post(f"/api/solicitudes/{s['id']}/enviar")
    assert falta.status_code == 422 and falta.json()["detail"][0]["loc"] == ["body", "lineas", 0, "cantidad"]

    editada = pg_client.patch(f"/api/solicitudes/{s['id']}", json={
        "proyectoId": QUI, "proposito": "  Limpieza de reactores ",
        "lineas": [{"insumoId": ETANOL, "cantidad": 2.5}, {"insumoId": GUANTES, "cantidad": 1}]})
    assert editada.status_code == 200
    assert editada.json()["proposito"] == "Limpieza de reactores"
    assert editada.json()["resumen"] == "Etanol Absoluto 99.8%, guantes de Nitrilo Talla M (Caja x100)"

    enviada = pg_client.post(f"/api/solicitudes/{s['id']}/enviar")
    assert enviada.status_code == 200 and enviada.json()["estado"] == "Pendiente de Aprobación"
    assert pg_client.patch(f"/api/solicitudes/{s['id']}", json={"proposito": "x"}).status_code == 409
    assert pg_client.delete(f"/api/solicitudes/{s['id']}").status_code == 409
    aviso = pg_db.query(Notification).filter(Notification.user_id == APROBADOR).one()
    assert aviso.link == f"/bandeja?pedido={s['id']}"

    lista = pg_client.get("/api/solicitudes").json()
    assert lista["conteos"]["Todas"] == 1 and lista["conteos"]["Pendiente de Aprobación"] == 1
    assert lista["items"][0]["numero"] == s["numero"] and lista["items"][0]["proyectoId"] == QUI
    assert [p["codigo"] for p in lista["misProyectos"]] == ["QUI-024"] and lista["misProyectos"][0]["ejecucion"] == 1
    etanol = next(i for i in lista["insumos"] if i["id"] == ETANOL)
    assert etanol == {"id": ETANOL, "nombre": "Etanol Absoluto 99.8%", "unidad": "L", "disponible": 40.0, "reposicionEnCurso": False}
    assert pg_client.get("/api/solicitudes", params={"estado": "Borrador"}).json()["items"] == []
    # Por número también se encuentra (enlaces del inicio)
    assert pg_client.get(f"/api/solicitudes/{s['numero']}").json()["id"] == s["id"]

    # RN-07: otro coordinador no la ve
    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    assert pg_client.get(f"/api/solicitudes/{s['id']}").status_code == 404

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    pedido = next(p for p in pg_client.get("/api/bandeja").json()["pendientes"] if p["id"] == s["id"])
    assert pedido["clase"] == "retiro" and pedido["grupo"] == "Alta" and pedido["pedidaPor"] == "Daniela Rivas"
    assert pedido["proyecto"] == {"id": QUI, "codigo": "QUI-024", "nombre": "Síntesis de nanopartículas para catálisis heterogénea"}
    assert pedido["valor"] == round(2.5 * 6.20 + 14.50, 2) and pedido["proposito"] == "Limpieza de reactores"
    assert pedido["lineas"][0] == {"insumo": "Etanol Absoluto 99.8%", "unidad": "L", "cantidad": 2.5, "disponible": 40.0, "reposicion": None}

    assert pg_client.post(f"/api/solicitudes/{s['id']}/aprobar", json={}).json() == {"id": s["id"], "estado": "Aprobado"}
    assert pg_client.post(f"/api/solicitudes/{s['id']}/aprobar", json={}).status_code == 409
    assert pg_client.post(f"/api/solicitudes/{s['id']}/ejecutar", json={"montoReal": 10}).status_code == 409  # un retiro
    pg_db.expire_all()
    assert all(ri.approved_quantity == ri.requested_quantity for ri in pg_db.get(Request, s["id"]).items)


def test_gasto_enviado_aprobado_y_ejecutado(pg_client, pg_db):
    antes = pg_db.get(Project, QUI).executed_budget
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    s = pg_client.post("/api/solicitudes", json={"tipo": "gasto", "proyectoId": QUI, "insumoServicio": "Nitrato de cerio"}).json()
    falta = pg_client.post(f"/api/solicitudes/{s['id']}/enviar")
    assert falta.status_code == 422
    assert {e["loc"][-1] for e in falta.json()["detail"]} == {"cantidadGasto", "monto", "justificacion"}
    pg_client.patch(f"/api/solicitudes/{s['id']}", json={"proyectoId": QUI, "insumoServicio": "Nitrato de cerio",
                                                         "cantidadGasto": "1 frasco", "monto": 640, "justificacion": "Dopaje del catalizador"})
    assert pg_client.post(f"/api/solicitudes/{s['id']}/enviar").status_code == 200
    fila = pg_client.get("/api/solicitudes").json()["items"][0]
    assert fila["detalle"] == "Nitrato de cerio, US$ 640,00" and fila["tipo"] == "gasto"

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    pedido = next(p for p in pg_client.get("/api/bandeja").json()["pendientes"] if p["id"] == s["id"])
    assert (pedido["clase"], pedido["insumoServicio"], pedido["cantidad"], pedido["monto"]) == ("gasto", "Nitrato de cerio", "1 frasco", 640.0)
    assert pedido["descripcion"] == "Dopaje del catalizador" and pedido["presupuesto"] == 8500.0
    assert pg_client.post(f"/api/solicitudes/{s['id']}/aprobar", json={}).status_code == 200
    por_ejecutar = pg_client.get("/api/bandeja").json()["porEjecutar"]
    assert [p["id"] for p in por_ejecutar] == [s["id"]] and por_ejecutar[0]["decididaPor"] == "Carmen Pérez"

    assert pg_client.post(f"/api/solicitudes/{s['id']}/ejecutar", json={}).json()["detail"][0]["loc"] == ["body", "montoReal"]
    r = pg_client.post(f"/api/solicitudes/{s['id']}/ejecutar", json={"montoReal": 655.5})
    assert r.json() == {"id": s["id"], "estado": "Ejecutado", "montoReal": 655.5}
    assert pg_client.post(f"/api/solicitudes/{s['id']}/ejecutar", json={"montoReal": 1}).status_code == 409

    pg_db.expire_all()
    # Decisión 5: el gasto ejecutado sale de los movimientos
    assert pg_db.get(Project, QUI).executed_budget == antes + Decimal("655.50")
    titulos = [n.title for n in pg_db.query(Notification).filter(Notification.user_id == COORD_QUI).order_by(Notification.created_at)]
    assert titulos == [f"Solicitud aprobada: {s['numero']}", f"Gasto ejecutado: {s['numero']}"]


def test_rechazo_exige_motivo_y_descartar_borrador(pg_client, pg_db):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    s = pg_client.post("/api/solicitudes", json={"tipo": "retiro", "proyectoId": QUI, "lineas": [{"insumoId": ETANOL, "cantidad": 1}]}).json()
    borrador = pg_client.post("/api/solicitudes", json={"tipo": "gasto", "proyectoId": QUI}).json()
    assert pg_client.delete(f"/api/solicitudes/{borrador['id']}").status_code == 204
    assert pg_client.get(f"/api/solicitudes/{borrador['id']}").status_code == 404
    pg_client.post(f"/api/solicitudes/{s['id']}/enviar")

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.post(f"/api/solicitudes/{s['id']}/rechazar", json={"motivo": " "}).status_code == 422
    assert pg_client.post(f"/api/solicitudes/{s['id']}/rechazar", json={"motivo": "Hay stock en el laboratorio"}).json()["estado"] == "Rechazado"

    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    detalle = pg_client.get(f"/api/solicitudes/{s['id']}").json()
    assert detalle["motivoRechazo"] == "Hay stock en el laboratorio" and detalle["decididaPor"] == "Carmen Pérez"
    aviso = pg_db.query(Notification).filter(Notification.user_id == COORD_QUI, Notification.kind == "err").one()
    assert aviso.link == f"/solicitudes?id={s['id']}"


def _reposicion(db, cantidad="20"):
    s = Request(request_number="REP-T-0001", request_type="Reposición automática", cost_center="general", project_id=None,
                requester_user_id="a0000000-0000-0000-0000-000000000001", status="Borrador",
                estimated_amount=Decimal("57.00"))
    s.items.append(RequestItem(item_id=AGNO3, requested_quantity=Decimal(cantidad), unit_cost_estimate=Decimal("2.85")))
    db.add(s)
    db.commit()
    return s


def test_reposicion_en_la_bandeja_y_aprobada_en_un_paso(pg_client, pg_db):
    rep = _reposicion(pg_db)
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    pendientes = pg_client.get("/api/bandeja").json()["pendientes"]
    assert pendientes[-1]["id"] == str(rep.id) and pendientes[-1]["clase"] == "reposicion" and pendientes[-1]["grupo"] == "auto"
    assert pendientes[-1]["proyecto"] is None and pendientes[-1]["pedidaPor"] is None
    assert pendientes[-1]["insumo"]["minimo"] == 100.0 and pendientes[-1]["sugerida"] == 20.0
    assert pendientes[-1]["consumoPrevisto"] == 280.0  # 150 al mes → 8 semanas

    assert pg_client.post(f"/api/solicitudes/{rep.id}/aprobar", json={}).status_code == 422
    r = pg_client.post(f"/api/solicitudes/{rep.id}/aprobar", json={"cantidad": 35})
    assert r.status_code == 200, r.text
    assert r.json() == {"id": str(rep.id), "estado": "Aprobado", "cantidad": 35.0}
    pg_db.expire_all()
    s = pg_db.get(Request, rep.id)
    assert s.items[0].approved_quantity == Decimal("35.000") and s.decided_by_user_id is not None
    # RN-03: quedaron las dos transiciones en la auditoría
    acciones = {a.action_type for a in pg_db.query(AuditLog).filter(AuditLog.target_id == str(rep.id))}
    assert {"REPLENISHMENT_SUBMIT", "REPLENISHMENT_APPROVE"} <= acciones


def test_descartar_reposicion_sin_motivo(pg_client, pg_db):
    rep = _reposicion(pg_db)
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.post(f"/api/solicitudes/{rep.id}/rechazar", json={}).json() == {"id": str(rep.id), "estado": "Rechazado"}
    pg_db.expire_all()
    assert pg_db.get(Request, rep.id).decision_reason == "Descartada por el aprobador"


def test_correcciones_desde_la_bandeja(pg_client, pg_db):
    x = DispatchCorrection(original_dispatch_id=DESPACHO_SEED, requested_by_user_id=COORD_QUI,
                           justification="Solo llegaron 3 cajas", correct_quantity=Decimal("3"))
    pg_db.add(x)
    pg_db.commit()
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    pedido = next(p for p in pg_client.get("/api/bandeja").json()["pendientes"] if p["id"] == str(x.id))
    assert pedido["clase"] == "correccion" and pedido["despacho"]["codigo"] == "DSP-2026-0001"
    assert pedido["valorOriginal"] == "5 caja" and pedido["valorNuevo"] == "3 caja"
    assert pedido["efecto"] == {"tipo": "devolucion", "cantidad": "2 caja", "monto": 29.0}
    assert pedido["motivo"] == "Solo llegaron 3 cajas" and pedido["grupo"] == "Alta"

    assert pg_client.post(f"/api/correcciones/{x.id}/denegar", json={"nota": ""}).status_code == 422
    assert pg_client.post(f"/api/correcciones/{x.id}/aprobar").json() == {"id": str(x.id), "estado": "Aprobado"}
    assert pg_client.post(f"/api/correcciones/{x.id}/aprobar").status_code == 409
    pg_db.expire_all()
    comp = pg_db.query(Dispatch).filter(Dispatch.is_compensatory.is_(True)).one()
    assert comp.direction == "devolucion" and comp.dispatched_quantity == Decimal("2.000")


def test_priorizacion(pg_client, pg_db):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    propios = pg_client.get("/api/priorizacion").json()["proyectos"]
    assert [p["codigo"] for p in propios] == ["QUI-024"] and propios[0]["ultimoCambio"]["desde"] is None

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    todos = pg_client.get("/api/priorizacion", params={"estatus": "todos"}).json()["proyectos"]
    assert [p["codigo"] for p in todos] == ["BIO-011", "FIS-008", "QUI-024"]
    mala = pg_client.patch(f"/api/proyectos/{QUI}/prioridad", json={"prioridad": "Alta", "justificacion": ""})
    assert mala.status_code == 422 and {e["loc"][-1] for e in mala.json()["detail"]} == {"prioridad", "justificacion"}
    assert pg_client.patch("/api/proyectos/QUI-024/prioridad", json={"prioridad": "Baja", "justificacion": "x"}).status_code == 404

    r = pg_client.patch(f"/api/proyectos/{QUI}/prioridad", json={"prioridad": "Crítica", "justificacion": "Entrega al financista en diciembre"})
    assert r.json() == {"id": QUI, "codigo": "QUI-024", "prioridad": "Crítica", "anterior": "Alta"}
    fila = next(p for p in pg_client.get("/api/priorizacion").json()["proyectos"] if p["id"] == QUI)
    assert fila["prioridad"] == "Crítica" and fila["ultimoCambio"]["desde"] == "Alta" and fila["coordinador"] == "Daniela Rivas"
    log = pg_db.query(AuditLog).filter(AuditLog.action_type == "PROJECT_PRIORITY_CHANGE").one()
    assert log.justification == "Entrega al financista en diciembre"
    aviso = pg_db.query(Notification).filter(Notification.user_id == COORD_QUI).one()
    assert aviso.title == "QUI-024 ahora es prioridad Crítica" and aviso.link == f"/proyectos/{QUI}"


def test_reserva_pendiente_en_la_bandeja(pg_client, pg_db):
    from datetime import datetime, timedelta, timezone
    inicio = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=2)
    r = EquipmentReservation(equipment_id="f0000000-0000-0000-0000-000000000001", project_id=BIO,
                             reserved_by_user_id="a0000000-0000-0000-0000-000000000004",
                             start_time=inicio, end_time=inicio + timedelta(hours=1), status="Pendiente de Aprobación")
    pg_db.add(r)
    pg_db.commit()
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    pendientes = pg_client.get("/api/bandeja").json()["pendientes"]
    pedido = next(p for p in pendientes if p["id"] == str(r.id))
    assert pedido["clase"] == "reserva" and pedido["grupo"] == "Crítica" and pedido["choque"] is None
    assert pedido["equipo"]["nombre"] == "Espectrofotómetro UV-Vis Shimadzu"
    # Crítica va antes que todo lo demás
    assert pendientes[0]["id"] == str(r.id)
