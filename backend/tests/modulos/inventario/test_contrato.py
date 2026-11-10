"""Módulo 3 (Inventario) con el contrato del frontend, contra PostgreSQL con el esquema y la semilla reales."""

from datetime import date
from decimal import Decimal

from app.auditoria.models import AuditLog
from app.modulos.inventario import reglas
from app.modulos.usuarios.models import Item, Notification, Request, RequestItem, User
from tests.conftest import iniciar_sesion

APROBADOR = "a0000000-0000-0000-0000-000000000002"
AGNO3 = "e0000000-0000-0000-0000-000000000001"
ACETONA = "30000000-0000-0000-0000-000000000001"
TRIPSINA = "30000000-0000-0000-0000-000000000002"
LB = "30000000-0000-0000-0000-000000000003"
PEPTONA = "30000000-0000-0000-0000-000000000004"
GABINETE = "c0000000-0000-0000-0000-000000000004"


def _dias(fecha):
    # La semilla usa CURRENT_DATE de la BD (UTC); "hoy" es el de Caracas: cerca de medianoche difieren en 1
    return (date.fromisoformat(fecha) - reglas.hoy()).days


def _ids(cuerpo):
    return [i["id"] for i in cuerpo["items"]]


def test_lista_con_alertas_filtros_y_orden(pg_client):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    r = pg_client.get("/api/insumos")
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["porPagina"] == 20 and cuerpo["pagina"] == 1 and cuerpo["anticipacion"] == 30
    assert cuerpo["alertas"]["bajoMinimo"] >= 1 and cuerpo["alertas"]["porVencer"] >= 1 and cuerpo["alertas"]["vencidos"] >= 1
    # Orden del mockup 09: bajo el mínimo, por vencer, vencido y al día
    orden = {"bajo": 0, "vence": 1, "vencido": 2, "ok": 3}
    estados = [orden[i["estado"]] for i in cuerpo["items"]]
    assert estados == sorted(estados)
    acetona = next(i for i in cuerpo["items"] if i["id"] == ACETONA)
    assert acetona == {
        "id": ACETONA, "nombre": "Acetona grado analítico", "unidad": "L", "tipo": "Materia prima", "stock": 2.5,
        "stockMinimo": 5.0, "lotes": 1, "proximoVencimiento": acetona["proximoVencimiento"], "vencidos": 0,
        "porVencer": 0, "estado": "bajo",
    }
    tripsina = next(i for i in cuerpo["items"] if i["id"] == TRIPSINA)
    assert tripsina["estado"] == "vence" and tripsina["proximoVencimiento"]["dias"] == _dias(tripsina["proximoVencimiento"]["fecha"])
    peptona = next(i for i in cuerpo["items"] if i["id"] == PEPTONA)
    assert peptona["estado"] == "vencido" and peptona["vencidos"] == 1 and peptona["proximoVencimiento"]["dias"] == _dias(peptona["proximoVencimiento"]["fecha"]) < 0
    assert {"id", "nombre"} == set(cuerpo["ubicaciones"][0])

    assert ACETONA in _ids(pg_client.get("/api/insumos", params={"alerta": "minimo"}).json())
    assert all(i["estado"] == "bajo" for i in pg_client.get("/api/insumos", params={"alerta": "minimo"}).json()["items"])
    assert _ids(pg_client.get("/api/insumos", params={"alerta": "vencimiento"}).json()) == [TRIPSINA]
    assert PEPTONA in _ids(pg_client.get("/api/insumos", params={"alerta": "vencido"}).json())
    # Por nombre sin tildes ni mayúsculas, o por número de lote
    assert _ids(pg_client.get("/api/insumos", params={"q": "PEPTONA DE CASEINA"}).json()) == [PEPTONA]
    assert _ids(pg_client.get("/api/insumos", params={"q": "l-0103"}).json()) == [LB]
    en_gabinete = _ids(pg_client.get("/api/insumos", params={"ubicacion": GABINETE}).json())
    assert ACETONA in en_gabinete and LB not in en_gabinete
    tipo = pg_client.get("/api/insumos", params={"tipo": "Consumible de uso general"}).json()
    assert tipo["items"] and all(i["tipo"] == "Consumible de uso general" for i in tipo["items"])
    # Las tarjetas son del inventario completo aunque haya filtros; la página se ajusta al rango
    filtrada = pg_client.get("/api/insumos", params={"q": "zzz", "pagina": 99}).json()
    assert filtrada["total"] == 0 and filtrada["pagina"] == 1 and filtrada["alertas"] == cuerpo["alertas"]


def test_roles_de_lectura(pg_client):
    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    assert pg_client.get("/api/insumos").status_code == 200
    # La ficha es del aprobador y del administrador
    assert pg_client.get(f"/api/insumos/{LB}").status_code == 403
    assert pg_client.post("/api/insumos", json={}).status_code == 403
    assert pg_client.patch(f"/api/insumos/{LB}/minimo", json={"stockMinimo": 1}).status_code == 403
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.post("/api/insumos", json={}).status_code == 403
    assert pg_client.patch(f"/api/insumos/{LB}/minimo", json={"stockMinimo": 1}).status_code == 403
    pg_client.cookies.clear()
    assert pg_client.get("/api/insumos").status_code == 401


def test_exportar_csv(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    r = pg_client.get("/api/insumos/exportar", params={"alerta": "vencido"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert r.headers["content-disposition"].startswith('attachment; filename="inventario-')
    texto = r.content.decode("utf-8")
    assert texto.startswith("﻿")
    filas = texto[1:].split("\r\n")
    assert filas[0] == '"Insumo";"Tipo";"Unidad";"Stock";"Stock mínimo";"Lotes";"Próximo vencimiento";"Estado"'
    peptona = next(f for f in filas if f.startswith('"Peptona'))
    assert '"1,5";"0,5";"2"' in peptona and peptona.endswith('"Lote vencido"')


def test_registrar_insumo_crea_reposicion_y_avisa(pg_client, pg_db):
    iniciar_sesion(pg_client, "admin@cpq.local")
    r = pg_client.post("/api/insumos", json={"nombre": "  Ácido  sulfúrico 98 % ", "unidad": "L", "tipo": "Materia prima", "stockMinimo": 2})
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["insumo"]["nombre"] == "Ácido sulfúrico 98 %" and cuerpo["insumo"]["stock"] == 0
    assert cuerpo["insumo"]["estado"] == "bajo" and cuerpo["reposicion"].startswith("REP-")

    pg_db.expire_all()
    rep = pg_db.query(Request).filter(Request.request_number == cuerpo["reposicion"]).one()
    assert rep.status == "Borrador" and rep.cost_center == "general" and rep.project_id is None
    assert pg_db.query(RequestItem).filter(RequestItem.request_id == rep.id).one().requested_quantity == Decimal("4.000")
    aviso = pg_db.query(Notification).filter(Notification.user_id == APROBADOR).one()
    assert aviso.kind == "info" and aviso.link == f"/bandeja?tipo=reposicion&pedido={rep.id}"
    assert pg_db.query(AuditLog).filter(AuditLog.action_type == "ITEM_CREATED", AuditLog.target_id == cuerpo["insumo"]["id"]).count() == 1

    # Mismo nombre (sin tildes ni mayúsculas) y misma unidad: 409 con el insumo que ya existe
    dup = pg_client.post("/api/insumos", json={"nombre": "acido SULFURICO 98 %", "unidad": "L", "tipo": "Materia prima", "stockMinimo": 1})
    assert dup.status_code == 409
    assert dup.json()["detail"]["insumo"] == {"id": cuerpo["insumo"]["id"], "nombre": "Ácido sulfúrico 98 %", "unidad": "L"}
    assert dup.json()["detail"]["mensaje"] == "Ya existe Ácido sulfúrico 98 % en L."
    # Otra unidad sí se permite
    assert pg_client.post("/api/insumos", json={"nombre": "Ácido sulfúrico 98 %", "unidad": "mL", "tipo": "Materia prima", "stockMinimo": 1}).status_code == 201

    malo = pg_client.post("/api/insumos", json={"nombre": "Ab", "unidad": "galón", "tipo": "Otro", "stockMinimo": "5"})
    assert malo.status_code == 422
    errores = {e["loc"][-1]: e["msg"] for e in malo.json()["detail"]}
    assert errores == {
        "nombre": "Escribe el nombre del insumo.", "unidad": "Elige la unidad de medida.",
        "stockMinimo": "Escribe un número mayor que cero.", "tipo": "Elige el tipo de insumo.",
    }


def test_ficha_con_lotes_movimiento_y_pronostico(pg_client):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    r = pg_client.get(f"/api/insumos/{LB}")
    assert r.status_code == 200, r.text
    f = r.json()
    assert f["stock"] == 2.3 and f["ubicaciones"] == ["Cuarto frío de Biología"] and f["anticipacion"] == 30
    assert f["lotes"] == [{
        "codigo": "L-0103", "ingreso": f["lotes"][0]["ingreso"], "vence": f["lotes"][0]["vence"], "dias": _dias(f["lotes"][0]["vence"]),
        "cantidad": 2.3, "costoUnitario": 58.0, "proveedor": "Bioquim de Venezuela",
    }]
    mov = f["ultimoMovimiento"]
    assert mov["tipo"] == "despacho" and mov["codigo"] == "DES-0106" and mov["proyecto"] == "BIO-011"
    assert mov["proyectoId"] == "b0000000-0000-0000-0000-000000000002" and mov["cantidad"] == 0.2 and mov["lote"] == "L-0103"
    p = f["pronostico"]
    assert p["metodo"] == "Holt-Winters" and p["requeridos"] == 3 and p["meses"] == 6
    assert [h["consumo"] for h in p["historial"]] == [0.4, 0.5, 0.45, 0.6, 0.0, 0.55]
    assert p["valor"] is not None and p["minimo"] <= p["valor"] <= p["maximo"]
    assert f["reposicion"] is None

    # Sin historial: sin pronóstico; la recepción es el último movimiento
    t = pg_client.get(f"/api/insumos/{TRIPSINA}").json()
    assert t["pronostico"]["valor"] is None and t["pronostico"]["historial"] == []
    assert t["ultimoMovimiento"]["tipo"] == "recepcion" and t["ultimoMovimiento"]["lote"] == "L-0102"
    # El lote vencido aparece con días negativos
    assert [l["dias"] < 0 for l in pg_client.get(f"/api/insumos/{PEPTONA}").json()["lotes"]] == [True, False]

    assert pg_client.get("/api/insumos/b0000000-0000-0000-0000-00000000ffff").status_code == 404
    assert pg_client.get("/api/insumos/no-es-uuid").json()["detail"].startswith("No encontramos ese insumo")


def test_las_lecturas_no_escriben(pg_client, pg_db):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    antes = (pg_db.query(AuditLog).count(), pg_db.get(Item, PEPTONA).updated_at)
    for ruta in ("/api/insumos", f"/api/insumos/{PEPTONA}", "/api/insumos/exportar"):
        assert pg_client.get(ruta).status_code == 200
    pg_db.expire_all()
    assert (pg_db.query(AuditLog).count(), pg_db.get(Item, PEPTONA).updated_at) == antes
    assert not pg_db.dirty


def test_cambiar_minimo_y_decidir_la_reposicion(pg_client, pg_db):
    iniciar_sesion(pg_client, "admin@cpq.local")
    assert pg_client.patch(f"/api/insumos/{ACETONA}/minimo", json={"stockMinimo": 0}).status_code == 422
    assert pg_client.patch(f"/api/insumos/{ACETONA}/minimo", json={}).json()["detail"][0]["loc"] == ["body", "stockMinimo"]
    assert pg_client.patch("/api/insumos/no-uuid/minimo", json={"stockMinimo": 1}).status_code == 404

    r = pg_client.patch(f"/api/insumos/{ACETONA}/minimo", json={"stockMinimo": 6})
    assert r.status_code == 200 and r.json()["stockMinimo"] == 6.0
    numero = r.json()["reposicion"]
    assert numero.startswith("REP-")
    # Con una reposición abierta no se crea otra
    assert pg_client.patch(f"/api/insumos/{ACETONA}/minimo", json={"stockMinimo": 7}).json()["reposicion"] is None
    # Subir el mínimo de un insumo con stock de sobra no crea nada
    assert pg_client.patch(f"/api/insumos/{AGNO3}/minimo", json={"stockMinimo": 50}).json()["reposicion"] is None

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    rep = pg_client.get(f"/api/insumos/{ACETONA}").json()["reposicion"]
    assert rep["numero"] == numero and rep["estado"] == "Borrador" and rep["cantidad"] == 9.5 and rep["decididaPor"] is None

    # La decisión la expone el servicio para POST /api/solicitudes/{id}/aprobar|rechazar (M5)
    pg_db.expire_all()
    s = pg_db.query(Request).filter(Request.request_number == numero).one()
    aprobador = pg_db.get(User, APROBADOR)
    assert reglas.aprobar_reposicion(pg_db, s, 8, aprobador, "127.0.0.1") == {"id": numero, "estado": "Aprobado", "cantidad": 8.0}
    pg_db.commit()
    rep = pg_client.get(f"/api/insumos/{ACETONA}").json()["reposicion"]
    assert rep["estado"] == "Aprobado" and rep["cantidad"] == 8.0 and rep["decididaPor"] == "Carmen Pérez"
    acciones = [a for (a,) in pg_db.query(AuditLog.action_type).filter(AuditLog.target_id == str(s.id)).all()]
    assert {"REQUEST_SUBMITTED", "REQUEST_APPROVED"} <= set(acciones)
    try:
        reglas.descartar_reposicion(pg_db, s, None, aprobador, "127.0.0.1")
        raise AssertionError("una reposición aprobada no se descarta")
    except Exception as e:
        assert getattr(e, "status_code", None) == 409


def test_descartar_reposicion(pg_client, pg_db):
    iniciar_sesion(pg_client, "admin@cpq.local")
    numero = pg_client.patch(f"/api/insumos/{ACETONA}/minimo", json={"stockMinimo": 6}).json()["reposicion"]
    pg_db.expire_all()
    s = pg_db.query(Request).filter(Request.request_number == numero).one()
    assert reglas.descartar_reposicion(pg_db, s, "", pg_db.get(User, APROBADOR), "127.0.0.1") == {"id": numero, "estado": "Rechazado"}
    pg_db.commit()
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    ficha = pg_client.get(f"/api/insumos/{ACETONA}").json()
    # HU-09: no se compra nada y la alerta sigue
    assert ficha["reposicion"] is None and ficha["estado"] == "bajo"
