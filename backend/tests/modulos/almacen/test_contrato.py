"""Módulo 6 (Almacén) con el contrato del frontend, contra PostgreSQL con el esquema y la semilla reales."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.modulos.inventario import reglas
from app.modulos.usuarios.models import (
    AccountingPeriod,
    Batch,
    Dispatch,
    DispatchCorrection,
    Item,
    Notification,
    Project,
    Request,
    RequestItem,
)
from tests.conftest import iniciar_sesion

APROBADOR = "a0000000-0000-0000-0000-000000000002"
COORD_BIO = "a0000000-0000-0000-0000-000000000004"
QUI = "b0000000-0000-0000-0000-000000000001"
BIO = "b0000000-0000-0000-0000-000000000002"
FIS = "b0000000-0000-0000-0000-000000000003"
ACETONA = "30000000-0000-0000-0000-000000000001"
TRIPSINA = "30000000-0000-0000-0000-000000000002"
LB = "30000000-0000-0000-0000-000000000003"
PEPTONA = "30000000-0000-0000-0000-000000000004"
LOTE_LB = "31000000-0000-0000-0000-000000000003"
DES_0105 = "32000000-0000-0000-0000-000000000005"
DES_0106 = "32000000-0000-0000-0000-000000000006"
FRIO = "c0000000-0000-0000-0000-000000000002"
GABINETE = "c0000000-0000-0000-0000-000000000004"


def _retiro(db, lineas, numero="SOL-T-0001", proyecto=BIO, coordinador=COORD_BIO, estado="Aprobado"):
    s = Request(request_number=numero, request_type="Retiro", cost_center="proyecto", project_id=proyecto,
                requester_user_id=coordinador, status=estado, decided_by_user_id=APROBADOR,
                decided_at=datetime.now(timezone.utc))
    db.add(s)
    db.flush()
    for item, cantidad in lineas:
        db.add(RequestItem(request_id=s.id, item_id=item, requested_quantity=Decimal(str(cantidad)),
                           approved_quantity=Decimal(str(cantidad))))
    db.commit()
    return s


def _periodo_cerrado(db, inicio, fin):
    db.add(AccountingPeriod(period_name="Cerrado de prueba", period_type="Mensual", start_date=inicio, end_date=fin,
                            status="Cerrado"))
    db.commit()


def _errores(r):
    assert r.status_code == 422, r.text
    return {".".join(str(p) for p in e["loc"][1:]): e["msg"] for e in r.json()["detail"]}


# =============================================================================
# Almacén y recepción
# =============================================================================

def test_tareas_del_almacen(pg_client, pg_db):
    _retiro(pg_db, [(LB, 0.3)])
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    r = pg_client.get("/api/almacen")
    assert r.status_code == 200, r.text
    a = r.json()
    assert a["lotesPorVencer"] >= 1 and a["lotesVencidos"] >= 1
    despacho = next(d for d in a["despachos"] if d["solicitud"] == "SOL-T-0001")
    assert despacho["proyecto"] == "BIO-011" and despacho["proyectoId"] == BIO and despacho["prioridad"] == "Crítica"
    assert despacho["items"] == ["Medio LB agar 0,3 kg"]
    assert len(a["recientes"]) == 3 and {"codigo", "insumoId", "insumo", "cantidad", "unidad", "ingreso", "proveedor"} == set(a["recientes"][0])
    assert a["porRecibir"] == []

    for correo in ("coord.biologia@cpq.local", "admin@cpq.local"):
        iniciar_sesion(pg_client, correo)
        assert pg_client.get("/api/almacen").status_code == 403
        assert pg_client.get("/api/recepciones/opciones").status_code == 403
        assert pg_client.post("/api/lotes", json={}).status_code == 403


def test_opciones_de_recepcion(pg_client):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    o = pg_client.get("/api/recepciones/opciones").json()
    lb = next(i for i in o["insumos"] if i["id"] == LB)
    assert lb == {"id": LB, "nombre": "Medio LB agar", "unidad": "kg", "stock": 2.3, "stockMinimo": 0.5, "vence": True, "ubicacionId": FRIO}
    nombres = [i["nombre"] for i in o["insumos"]]
    assert nombres == sorted(nombres, key=lambda n: n.lower().replace("á", "a"))
    assert all({"id", "nombre"} == set(u) for u in o["ubicaciones"]) and o["reposiciones"] == []


def _lote(**cambios):
    hoy = reglas.hoy()
    datos = {"solicitud": None, "insumoId": TRIPSINA, "loteProveedor": "TRP-1101", "cantidad": 0.5, "costoUnitario": 92.5,
             "proveedor": "Bioquim de Venezuela", "ingreso": hoy.isoformat(), "vence": (hoy + timedelta(days=90)).isoformat(),
             "ubicacionId": FRIO}
    datos.update(cambios)
    return datos


def test_registrar_lote_validaciones_y_conflicto(pg_client, pg_db):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    hoy = reglas.hoy()
    vacio = _errores(pg_client.post("/api/lotes", json={}))
    assert set(vacio) == {"insumoId", "loteProveedor", "cantidad", "costoUnitario", "proveedor", "ingreso", "ubicacionId"}
    assert _errores(pg_client.post("/api/lotes", json=_lote(vence=(hoy - timedelta(days=1)).isoformat()))) == {
        "vence": "La fecha de vencimiento ya pasó. Un lote vencido no se registra: devuélvelo al proveedor."}
    assert _errores(pg_client.post("/api/lotes", json=_lote(ingreso=(hoy + timedelta(days=1)).isoformat()))) == {
        "ingreso": "La fecha de ingreso no puede ser posterior a hoy."}
    # Si el insumo vence, el lote trae su vencimiento
    assert _errores(pg_client.post("/api/lotes", json=_lote(vence=None))) == {
        "vence": "Tripsina 0,25 % vence: escribe la fecha de vencimiento del lote."}
    assert _errores(pg_client.post("/api/lotes", json=_lote(solicitud="REP-NO-EXISTE"))) == {
        "solicitud": "REP-NO-EXISTE ya no está aprobada por recibir."}
    assert "ubicacionId" in _errores(pg_client.post("/api/lotes", json=_lote(ubicacionId="no-uuid")))

    r = pg_client.post("/api/lotes", json=_lote())
    assert r.status_code == 201, r.text
    lote = r.json()
    assert lote["codigo"].startswith("L-") and lote["insumoId"] == TRIPSINA and lote["unidad"] == "L"
    assert (lote["stockAntes"], lote["stockDespues"], lote["stockMinimo"]) == (0.4, 0.9, 0.2)
    assert lote["reposicion"] is None and lote["nuevaReposicion"] is None
    pg_db.expire_all()
    b = pg_db.query(Batch).filter(Batch.batch_number == lote["codigo"]).one()
    assert b.supplier_lot_code == "TRP-1101" and b.available_quantity == Decimal("0.500") and b.unit_cost == Decimal("92.50")
    assert pg_db.get(Item, TRIPSINA).current_stock == Decimal("0.900")

    # El mismo lote del mismo proveedor ya se registró
    dup = pg_client.post("/api/lotes", json=_lote(proveedor="BIOQUIM DE VENEZUELA"))
    assert dup.status_code == 409
    assert dup.json()["detail"] == f"El lote TRP-1101 de BIOQUIM DE VENEZUELA ya se registró como {lote['codigo']}."


def test_recibir_una_reposicion_la_ejecuta_y_avisa(pg_client, pg_db):
    iniciar_sesion(pg_client, "admin@cpq.local")
    numero = pg_client.patch(f"/api/insumos/{ACETONA}/minimo", json={"stockMinimo": 6}).json()["reposicion"]
    pg_db.expire_all()
    s = pg_db.query(Request).filter(Request.request_number == numero).one()
    # El administrador tiene el rol de aprobador en la decisión (lo hace M5); aquí basta con aprobarla
    from app.modulos.usuarios.models import User
    otro = pg_db.get(User, "a0000000-0000-0000-0000-000000000001")
    reglas.aprobar_reposicion(pg_db, s, 10, otro, "127.0.0.1")
    pg_db.commit()

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    # Las solicitudes viajan con su UUID (id) y su número (numero, el que se muestra)
    rep_id = pg_client.get("/api/almacen").json()["porRecibir"][0]["id"]
    assert pg_client.get("/api/almacen").json()["porRecibir"][0] == {
        "id": rep_id, "numero": numero, "insumoId": ACETONA, "insumo": "Acetona grado analítico", "cantidad": 10.0, "unidad": "L",
        "aprobadaEl": pg_client.get("/api/almacen").json()["porRecibir"][0]["aprobadaEl"]}
    assert pg_client.get("/api/recepciones/opciones").json()["reposiciones"] == [{"id": rep_id, "numero": numero, "insumoId": ACETONA, "cantidad": 10.0}]
    # La reposición es de otro insumo
    assert _errores(pg_client.post("/api/lotes", json=_lote(solicitud=numero))) == {
        "insumoId": f"{numero} es de Acetona grado analítico: elige ese insumo."}

    r = pg_client.post("/api/lotes", json=_lote(solicitud=numero, insumoId=ACETONA, loteProveedor="MK-AC-3001",
                                                 proveedor="Merck Químicos C.A.", cantidad=10, costoUnitario=18.4,
                                                 ubicacionId=GABINETE))
    assert r.status_code == 201, r.text
    assert r.json()["reposicion"] == numero and r.json()["stockDespues"] == 12.5 and r.json()["nuevaReposicion"] is None
    pg_db.expire_all()
    s = pg_db.query(Request).filter(Request.request_number == numero).one()
    assert s.status == "Ejecutado" and s.actual_amount == Decimal("184.00")
    aviso = pg_db.query(Notification).filter(Notification.user_id == otro.id).one()
    assert aviso.kind == "ok" and numero in aviso.title
    assert pg_client.get("/api/almacen").json()["porRecibir"] == []


# =============================================================================
# Despachos
# =============================================================================

def test_preparar_despacho_con_fefo(pg_client, pg_db):
    _retiro(pg_db, [(LB, 0.3), (PEPTONA, 0.4)])
    _retiro(pg_db, [(TRIPSINA, 0.1)], numero="SOL-T-0002", proyecto=FIS, coordinador="a0000000-0000-0000-0000-000000000005")
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    r = pg_client.get("/api/despachos/nuevo", params={"solicitud": "SOL-T-0001"})
    assert r.status_code == 200, r.text
    n = r.json()
    assert n["solicitud"]["numero"] == "SOL-T-0001" and n["solicitud"]["proyecto"] == "BIO-011" and n["solicitud"]["proyectoId"] == BIO
    assert n["solicitud"]["coordinador"] == "María Fernanda Ochoa"
    assert n["personas"] == ["María Fernanda Ochoa", "Lic. Pedro Gómez"]
    assert n["siguiente"] == "SOL-T-0002"
    lb, peptona = n["lineas"]
    assert (lb["insumo"], lb["cantidad"], lb["stock"], lb["vence"]) == ("Medio LB agar", 0.3, 2.3, True)
    assert [(l["codigo"], l["sugerido"], l["vencido"]) for l in lb["lotes"]] == [("L-0103", True, False)]
    # El vencido va al final y no se sugiere
    assert [(l["codigo"], l["sugerido"], l["vencido"]) for l in peptona["lotes"]] == [("L-0105", True, False), ("L-0104", False, True)]
    assert peptona["lotes"][0]["ubicacion"] == "Cuarto frío de Biología"

    # Sin solicitud: el retiro aprobado más antiguo
    assert pg_client.get("/api/despachos/nuevo").json()["solicitud"]["numero"] == "SOL-T-0001"
    assert pg_client.get("/api/despachos/nuevo", params={"solicitud": "SOL-NADA"}).json()["detail"] == "No encontramos el retiro SOL-NADA."
    _retiro(pg_db, [(LB, 1)], numero="SOL-T-0003", estado="Pendiente de Aprobación")
    pendiente = pg_client.get("/api/despachos/nuevo", params={"solicitud": "SOL-T-0003"})
    assert pendiente.status_code == 409
    assert pendiente.json()["detail"] == "SOL-T-0003 está Pendiente de Aprobación: solo se despacha un retiro aprobado."
    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    assert pg_client.get("/api/despachos/nuevo").status_code == 403


def test_sin_retiros_por_despachar(pg_client):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.get("/api/despachos/nuevo").json() == {"solicitud": None, "lineas": [], "personas": [], "siguiente": None, "siguienteId": None}


def test_registrar_despacho(pg_client, pg_db):
    s = _retiro(pg_db, [(LB, 0.3), (PEPTONA, 0.4)])
    gasto_antes = pg_db.get(Project, BIO).executed_budget
    iniciar_sesion(pg_client, "aprobador@cpq.local")

    malo = _errores(pg_client.post("/api/despachos", json={"solicitud": "SOL-T-0001", "lotes": {LB: "L-0999", PEPTONA: "L-0104"}, "retiro": " "}))
    assert malo == {"retiro": "Escribe quién retira los insumos.", f"lotes.{LB}": "Elige el lote de medio LB agar.",
                    f"lotes.{PEPTONA}": "L-0104 está vencido: no se despacha."}
    assert pg_client.post("/api/despachos", json={"solicitud": "NADA"}).status_code == 404

    r = pg_client.post("/api/despachos", json={"solicitud": "SOL-T-0001", "lotes": {LB: "L-0103", PEPTONA: "L-0105"},
                                                "retiro": "Lic. Ana Torres", "observacion": "Para el lote 4 del ensayo"})
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["codigo"].startswith("DES-") and d["solicitud"] == "SOL-T-0001" and d["proyecto"] == "BIO-011" and d["proyectoId"] == BIO
    assert d["coordinador"] == "María Fernanda Ochoa" and d["retiro"] == "Lic. Ana Torres"
    assert d["monto"] == round(0.3 * 58 + 0.4 * 42, 2) and d["siguiente"] is None
    assert d["lineas"] == [{"insumo": "Medio LB agar", "unidad": "kg", "cantidad": 0.3, "lote": "L-0103"},
                           {"insumo": "Peptona de caseína", "unidad": "kg", "cantidad": 0.4, "lote": "L-0105"}]

    pg_db.expire_all()
    lineas = pg_db.query(Dispatch).filter(Dispatch.movement_code == d["codigo"]).order_by(Dispatch.dispatch_number).all()
    assert [l.dispatch_number for l in lineas] == [d["codigo"], f"{d['codigo']}-2"]
    assert all(l.notes == "Para el lote 4 del ensayo" and l.direction == "salida" for l in lineas)
    assert pg_db.get(Batch, LOTE_LB).available_quantity == Decimal("2.000")
    assert pg_db.get(Item, PEPTONA).current_stock == Decimal("1.100")
    assert pg_db.get(Request, s.id).status == "Ejecutado"
    assert pg_db.get(Project, BIO).executed_budget == gasto_antes + Decimal(str(d["monto"]))
    aviso = pg_db.query(Notification).filter(Notification.user_id == COORD_BIO).one()
    assert aviso.kind == "ok" and aviso.link == f"/proyectos/bitacora?despacho={d['codigo']}"

    otra = pg_client.post("/api/despachos", json={"solicitud": "SOL-T-0001", "lotes": {}, "retiro": "X"})
    assert otra.status_code == 409 and otra.json()["detail"] == "SOL-T-0001 está Ejecutado: ya no se puede despachar."
    assert pg_client.get("/api/despachos/nuevo", params={"solicitud": "SOL-T-0001"}).json()["detail"] == f"SOL-T-0001 ya se despachó con {d['codigo']}."


def test_despacho_que_deja_bajo_el_minimo_y_periodo_cerrado(pg_client, pg_db):
    _retiro(pg_db, [(TRIPSINA, 0.3)])
    _retiro(pg_db, [(TRIPSINA, 0.5)], numero="SOL-T-0002")
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    # El lote no alcanza (se muestra en mL: es menos de 1 L)
    assert _errores(pg_client.post("/api/despachos", json={"solicitud": "SOL-T-0002", "lotes": {TRIPSINA: "L-0102"}, "retiro": "Ana"})) == {
        f"lotes.{TRIPSINA}": "L-0102 tiene 400 mL; se piden 500 mL."}
    # 0,4 L − 0,3 L = 0,1 L, bajo el mínimo de 0,2 L: el sistema prepara la reposición (F3.5)
    r = pg_client.post("/api/despachos", json={"solicitud": "SOL-T-0001", "lotes": {TRIPSINA: "L-0102"}, "retiro": "Ana"})
    assert r.status_code == 201, r.text
    pg_db.expire_all()
    rep = pg_db.query(Request).filter(Request.request_type == "Reposición automática").one()
    assert rep.status == "Borrador" and str(rep.items[0].item_id) == TRIPSINA and rep.items[0].requested_quantity == Decimal("0.300")

    _retiro(pg_db, [(LB, 0.1)], numero="SOL-T-0009")
    hoy = reglas.hoy()
    _periodo_cerrado(pg_db, hoy - timedelta(days=1), hoy + timedelta(days=1))
    cerrado = pg_client.post("/api/despachos", json={"solicitud": "SOL-T-0009", "lotes": {LB: "L-0103"}, "retiro": "Ana"})
    assert cerrado.status_code == 409 and cerrado.json()["detail"] == "El período de hoy está cerrado: no admite despachos."


# =============================================================================
# Bitácora y correcciones
# =============================================================================

def test_bitacora_por_rol(pg_client):
    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    r = pg_client.get("/api/bitacora")
    assert r.status_code == 200, r.text
    b = r.json()
    assert [p["codigo"] for p in b["proyectos"]] == ["BIO-011"] and b["hasta"] == reglas.hoy().isoformat()
    assert {f["proyecto"] for f in b["filas"]} == {"BIO-011"}
    # Sin período en curso el rango por defecto son los últimos 30 días; con desde se ve el mes pasado
    assert b["desde"] == (reglas.hoy() - timedelta(days=30)).isoformat() and b["filas"][0]["codigo"] == "DES-0106"
    mes_pasado = reglas.mes_de(reglas.mes_de(reglas.hoy())[0] - timedelta(days=1))[0].isoformat()
    con_desde = pg_client.get("/api/bitacora", params={"desde": mes_pasado}).json()
    assert [f["codigo"] for f in con_desde["filas"]][:2] == ["DES-0106", "DES-0105"]
    fila = b["filas"][0]
    assert fila == {
        "id": DES_0106, "codigo": "DES-0106", "fecha": fila["fecha"], "proyecto": "BIO-011", "proyectoId": BIO,
        "insumoId": LB, "insumo": "Medio LB agar", "unidad": "kg", "lote": "L-0103", "cantidad": 0.2,
        "retiro": "Lic. Pedro Gómez", "corrige": None, "aprobadaPor": None, "corregidoPor": None,
        "correccionPendiente": None, "puedeCorregir": True,
    }
    # Un enlace a un despacho anterior al rango lo incluye
    enlace = pg_client.get("/api/bitacora", params={"despacho": "DES-0101"}).json()
    assert enlace["resaltado"] == "DES-0101" and "DES-0101" in [f["codigo"] for f in enlace["filas"]]
    assert pg_client.get("/api/bitacora", params={"q": "peptona"}).json()["filas"] == []
    # RN-07: otro proyecto no aparece aunque se pida
    assert pg_client.get("/api/bitacora", params={"proyectoId": QUI}).json()["filas"] == []
    assert pg_client.get("/api/bitacora", params={"proyectoId": "no-uuid"}).status_code == 404

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    todo = pg_client.get("/api/bitacora").json()
    assert {"BIO-011", "QUI-024"} <= {f["proyecto"] for f in todo["filas"]}
    assert len(todo["proyectos"]) >= 3 and not any(f["puedeCorregir"] for f in todo["filas"])
    assert {f["proyecto"] for f in pg_client.get("/api/bitacora", params={"proyectoId": QUI}).json()["filas"]} == {"QUI-024"}
    iniciar_sesion(pg_client, "admin@cpq.local")
    assert pg_client.get("/api/bitacora").status_code == 403


def test_corregir_cantidad(pg_client, pg_db):
    iniciar_sesion(pg_client, "coord.fisica@cpq.local")
    ajeno = pg_client.post("/api/correcciones", json={"lineaId": DES_0106, "campo": "cantidad", "cantidadNueva": 0.1, "motivo": "x"})
    assert ajeno.status_code == 404 and ajeno.json()["detail"] == "No encontramos ese despacho en tus proyectos."

    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    assert _errores(pg_client.post("/api/correcciones", json={"lineaId": DES_0106})) == {
        "campo": "Elige qué está mal: la cantidad o el proyecto.",
        "motivo": "Escribe el motivo de la corrección. Sin motivo no se puede enviar."}
    assert _errores(pg_client.post("/api/correcciones", json={"lineaId": DES_0106, "campo": "cantidad", "cantidadNueva": 0.2, "motivo": "m"})) == {
        "cantidadNueva": "Es la misma cantidad registrada."}
    assert _errores(pg_client.post("/api/correcciones", json={"lineaId": DES_0106, "campo": "proyecto", "proyectoNuevoId": BIO, "motivo": "m"})) == {
        "proyectoNuevoId": "Es el mismo proyecto registrado."}
    assert _errores(pg_client.post("/api/correcciones", json={"lineaId": DES_0106, "campo": "proyecto", "proyectoNuevoId": FIS, "motivo": "m"})) == {
        "proyectoNuevoId": "Elige otro de tus proyectos."}

    r = pg_client.post("/api/correcciones", json={"lineaId": DES_0106, "campo": "cantidad", "cantidadNueva": 0.05,
                                                   "motivo": "Se retiraron 50 g, no 200 g"})
    assert r.status_code == 201, r.text
    cor = r.json()["id"]
    assert cor.startswith("COR-") and r.json()["estado"] == "Pendiente"
    otra = pg_client.post("/api/correcciones", json={"lineaId": DES_0106, "campo": "cantidad", "cantidadNueva": 0.1, "motivo": "m"})
    assert otra.status_code == 409 and otra.json()["detail"] == f"DES-0106 ya tiene la corrección {cor} esperando al aprobador."
    fila = next(f for f in pg_client.get("/api/bitacora").json()["filas"] if f["id"] == DES_0106)
    assert fila["correccionPendiente"] == cor and fila["puedeCorregir"] is False
    pg_db.expire_all()
    aviso = pg_db.query(Notification).filter(Notification.user_id == APROBADOR).one()
    assert aviso.kind == "info" and aviso.link == f"/bandeja?pedido={cor}"

    # El coordinador no decide; el aprobador sí
    assert pg_client.post(f"/api/correcciones/{cor}/aprobar").status_code == 403
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.post("/api/correcciones/COR-999/aprobar").json()["detail"] == "No encontramos la corrección COR-999."
    stock_antes = pg_db.get(Item, LB).current_stock
    gasto_antes = pg_db.get(Project, BIO).executed_budget
    ok = pg_client.post(f"/api/correcciones/{cor}/aprobar")
    assert ok.status_code == 200 and ok.json() == {"id": cor, "estado": "Aprobado"}
    assert pg_client.post(f"/api/correcciones/{cor}/aprobar").json()["detail"] == f"{cor} ya está Aprobado: no se puede decidir de nuevo."

    pg_db.expire_all()
    mov = pg_db.query(Dispatch).filter(Dispatch.original_dispatch_id == DES_0106).one()
    assert (mov.direction, mov.dispatched_quantity, mov.signed_quantity, mov.is_compensatory) == ("devolucion", Decimal("0.150"), Decimal("-0.150"), True)
    assert pg_db.get(Item, LB).current_stock == stock_antes + Decimal("0.150")
    assert pg_db.get(Project, BIO).executed_budget == gasto_antes - Decimal("8.70")
    assert pg_db.query(Notification).filter(Notification.user_id == COORD_BIO, Notification.kind == "ok").count() == 1

    filas = {f["codigo"]: f for f in pg_client.get("/api/bitacora").json()["filas"]}
    assert filas[mov.movement_code]["corrige"] == "DES-0106" and filas[mov.movement_code]["cantidad"] == -0.15
    assert filas[mov.movement_code]["aprobadaPor"] == "Carmen Pérez" and filas[mov.movement_code]["retiro"] is None
    assert filas["DES-0106"]["corregidoPor"] == mov.movement_code

    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    assert not next(f for f in pg_client.get("/api/bitacora").json()["filas"] if f["id"] == DES_0106)["puedeCorregir"]
    de_nuevo = pg_client.post("/api/correcciones", json={"lineaId": str(mov.id), "campo": "cantidad", "cantidadNueva": 0, "motivo": "m"})
    assert de_nuevo.status_code == 409 and "es un movimiento de corrección" in de_nuevo.json()["detail"]
    assert pg_client.post("/api/correcciones", json={"lineaId": DES_0106, "campo": "cantidad", "cantidadNueva": 0, "motivo": "m"}).status_code == 409


def test_corregir_proyecto_traslada_el_costo(pg_client, pg_db):
    otro = Project(code="BIO-099", title="Cultivos de prueba", operational_status="En ejecución", priority_level="Media",
                   assigned_budget=Decimal("1000"), coordinator_id=COORD_BIO)
    pg_db.add(otro)
    pg_db.commit()
    gasto_bio = pg_db.get(Project, BIO).executed_budget
    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    r = pg_client.post("/api/correcciones", json={"lineaId": DES_0105, "campo": "proyecto", "proyectoNuevoId": str(otro.id),
                                                   "motivo": "Se usó en los cultivos de prueba"})
    assert r.status_code == 201, r.text
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.post(f"/api/correcciones/{r.json()['id']}/aprobar").status_code == 200

    pg_db.expire_all()
    movs = pg_db.query(Dispatch).filter(Dispatch.original_dispatch_id == DES_0105).order_by(Dispatch.dispatch_number).all()
    assert [(str(m.project_id), m.direction) for m in movs] == [(BIO, "devolucion"), (str(otro.id), "salida")]
    assert len({m.movement_code for m in movs}) == 1
    assert pg_db.get(Project, BIO).executed_budget == gasto_bio - Decimal("31.90")
    assert pg_db.get(Project, otro.id).executed_budget == Decimal("31.90")
    assert pg_db.get(Batch, LOTE_LB).available_quantity == Decimal("2.300")  # el stock no se mueve


def test_denegar_y_periodo_cerrado(pg_client, pg_db):
    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    cor = pg_client.post("/api/correcciones", json={"lineaId": DES_0106, "campo": "cantidad", "cantidadNueva": 0.3, "motivo": "Faltó"}).json()["id"]
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert _errores(pg_client.post(f"/api/correcciones/{cor}/denegar", json={"nota": "  "})) == {"nota": "Escribe la nota. Sin nota no se puede denegar."}
    r = pg_client.post(f"/api/correcciones/{cor}/denegar", json={"nota": "El vale dice 200 g"})
    assert r.status_code == 200 and r.json() == {"id": cor, "estado": "Denegado"}
    pg_db.expire_all()
    c = pg_db.query(DispatchCorrection).filter(DispatchCorrection.correction_number == cor).one()
    assert c.review_notes == "El vale dice 200 g" and pg_db.query(Dispatch).filter(Dispatch.original_dispatch_id == DES_0106).count() == 0
    aviso = pg_db.query(Notification).filter(Notification.user_id == COORD_BIO).one()
    assert aviso.kind == "err" and "«El vale dice 200 g»" in aviso.detail

    # Un despacho de un período cerrado ya no se corrige
    linea = pg_db.get(Dispatch, DES_0105)
    dia = reglas.fecha_local(linea.dispatched_at)
    _periodo_cerrado(pg_db, dia, dia)
    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    r = pg_client.post("/api/correcciones", json={"lineaId": DES_0105, "campo": "cantidad", "cantidadNueva": 0.5, "motivo": "m"})
    assert r.status_code == 409 and r.json()["detail"] == "DES-0105 es de un período cerrado: ya no se corrige."
    assert not next(f for f in pg_client.get("/api/bitacora", params={"despacho": "DES-0105"}).json()["filas"] if f["id"] == DES_0105)["puedeCorregir"]


def test_correccion_al_alza_sin_stock(pg_client, pg_db):
    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    cor = pg_client.post("/api/correcciones", json={"lineaId": DES_0106, "campo": "cantidad", "cantidadNueva": 3, "motivo": "Se llevaron 3 kg"}).json()["id"]
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    r = pg_client.post(f"/api/correcciones/{cor}/aprobar")
    assert r.status_code == 409 and r.json()["detail"] == "El lote L-0103 ya no tiene 2,8 kg para entregar de más."


# =============================================================================
# Uso de materia prima
# =============================================================================

def test_uso_de_materia_prima(pg_client, pg_db):
    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    r = pg_client.get("/api/usos-materia")
    assert r.status_code == 200, r.text
    u = r.json()
    inicio, fin = reglas.mes_de(reglas.hoy())
    assert u["proyectos"] == [{"id": BIO, "codigo": "BIO-011", "nombre": u["proyectos"][0]["nombre"]}]
    assert (u["proyecto"], u["proyectoId"], u["insumo"]) == ("BIO-011", BIO, LB)
    assert u["insumos"] == [{"id": LB, "nombre": "Medio LB agar", "unidad": "kg"}]
    assert u["mes"] == {"inicio": inicio.isoformat(), "fin": fin.isoformat()}
    assert (u["despachado"], u["usado"], len(u["usos"])) == (0.2, 0.15, 1)
    pasado = pg_client.get("/api/usos-materia", params={"fecha": (inicio - timedelta(days=1)).isoformat()}).json()
    assert (pasado["despachado"], pasado["usado"]) == (0.55, 0)

    assert pg_client.get("/api/usos-materia", params={"proyectoId": FIS}).json()["detail"] == "FIS-008 no es uno de tus proyectos."
    assert pg_client.get("/api/usos-materia", params={"proyectoId": "b0000000-0000-0000-0000-00000000ffff"}).json()["detail"] == "Ese proyecto no existe."

    hoy = reglas.hoy().isoformat()
    assert _errores(pg_client.post("/api/usos-materia", json={"proyectoId": FIS})) == {"proyectoId": "Elige uno de tus proyectos."}
    assert pg_client.post("/api/usos-materia", json={"proyectoId": "b0000000-0000-0000-0000-00000000ffff"}).status_code == 404
    assert _errores(pg_client.post("/api/usos-materia", json={"proyectoId": BIO, "insumoId": PEPTONA, "cantidad": 0, "fecha": "2099-01-01"})) == {
        "insumoId": "Elige un insumo despachado a este proyecto.", "cantidad": "Escribe la cantidad usada, mayor que cero.",
        "fecha": "La fecha no puede ser posterior a hoy."}

    # Supera lo despachado: se guarda igual
    r = pg_client.post("/api/usos-materia", json={"proyectoId": BIO, "insumoId": LB, "cantidad": 0.1, "fecha": hoy, "observaciones": " Placas "})
    assert r.status_code == 201, r.text
    assert (r.json()["usado"], r.json()["despachado"]) == (0.25, 0.2) and r.json()["id"]
    assert r.json()["usos"][0]["observaciones"] == "Placas"

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.get("/api/usos-materia").status_code == 403
    assert pg_client.post("/api/usos-materia", json={}).status_code == 403


def test_coordinador_sin_despachos(pg_client):
    iniciar_sesion(pg_client, "coord.fisica@cpq.local")
    u = pg_client.get("/api/usos-materia").json()
    assert u["proyecto"] == "FIS-008" and u["insumos"] == [] and u["insumo"] is None and u["usos"] == []
