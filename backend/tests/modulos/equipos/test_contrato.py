"""Módulo 4 con el contrato del frontend, contra PostgreSQL con el esquema real."""

from datetime import date, datetime, timedelta, timezone

from app.modulos.equipos import horarios as h
from app.modulos.usuarios.models import Equipment, EquipmentReservation, EquipmentUsage, Notification
from tests.conftest import iniciar_sesion

QUI = "b0000000-0000-0000-0000-000000000001"
BIO = "b0000000-0000-0000-0000-000000000002"
COORD_QUI = "a0000000-0000-0000-0000-000000000003"
COORD_BIO = "a0000000-0000-0000-0000-000000000004"
APROBADOR = "a0000000-0000-0000-0000-000000000002"
ESPECTRO = "f0000000-0000-0000-0000-000000000001"
AUTOCLAVE = "f0000000-0000-0000-0000-000000000002"
DEPOSITO_A = "c0000000-0000-0000-0000-000000000001"


def _dia_habil(desde: int = 2) -> date:
    """Un día de lunes a sábado, al menos `desde` días después de hoy (Caracas)."""
    d = h.hoy() + timedelta(days=desde)
    return d + timedelta(days=1) if d.weekday() == 6 else d


def _instante(d: date, hora: str) -> str:
    return f"{d.isoformat()}T{hora}:00-04:00"


def _reserva(db, estado="Aprobado", equipo=ESPECTRO, proyecto=QUI, quien=COORD_QUI, dias=2, desde="10:00", hasta="12:00"):
    d = _dia_habil(dias)
    r = EquipmentReservation(
        equipment_id=equipo, project_id=proyecto, reserved_by_user_id=quien,
        start_time=datetime.fromisoformat(_instante(d, desde)), end_time=datetime.fromisoformat(_instante(d, hasta)),
        status=estado,
    )
    db.add(r)
    db.flush()
    db.commit()
    return r


def test_permisos_por_rol(pg_client):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    assert pg_client.get("/api/equipos").status_code == 403
    iniciar_sesion(pg_client, "admin@cpq.local")
    assert pg_client.get("/api/reservas").status_code == 403
    assert pg_client.get("/api/usos").status_code == 403
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.get("/api/usos").status_code == 403
    assert pg_client.post("/api/reservas", json={}).status_code == 403


def test_catalogo_alta_y_conflictos(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    lista = pg_client.get("/api/equipos").json()
    assert lista["total"] == 3 and len(lista["items"]) == 3
    assert [e["nombre"] for e in lista["items"]] == sorted((e["nombre"] for e in lista["items"]), key=str.lower)
    e = next(x for x in lista["items"] if x["id"] == ESPECTRO)
    assert set(e) == {"id", "nombre", "codigo", "ubicacion", "estado", "mantenimiento", "proximaReserva"}
    assert e["ubicacion"]["id"] == DEPOSITO_A and lista["ubicacionesConEquipos"] and lista["ubicaciones"]
    # Búsqueda sin tildes y filtro por estado
    assert [x["id"] for x in pg_client.get("/api/equipos", params={"q": "ESPECTROFOTOMETRO"}).json()["items"]] == [ESPECTRO]
    assert all(x["estado"] == "En uso" for x in pg_client.get("/api/equipos", params={"estado": "En uso"}).json()["items"])

    mala = pg_client.post("/api/equipos", json={"nombre": "X", "codigo": "no vale", "ubicacionId": "nada"})
    assert mala.status_code == 422
    assert {e["loc"][-1] for e in mala.json()["detail"]} == {"nombre", "codigo", "ubicacionId"}

    nuevo = pg_client.post("/api/equipos", json={"nombre": "  Centrífuga   refrigerada ", "codigo": "uc-facyt-0457", "ubicacionId": DEPOSITO_A})
    assert nuevo.status_code == 201, nuevo.text
    cuerpo = nuevo.json()
    assert cuerpo["nombre"] == "Centrífuga refrigerada" and cuerpo["codigo"] == "UC-FACYT-0457"
    assert cuerpo["estado"] == "Disponible" and cuerpo["proximaReserva"] is None

    dup = pg_client.post("/api/equipos", json={"nombre": "Otra", "codigo": "UC-FACYT-0457", "ubicacionId": DEPOSITO_A})
    assert dup.status_code == 409 and dup.json()["detail"]["equipo"]["id"] == cuerpo["id"]
    assert pg_client.get("/api/equipos/no-es-uuid/reservas-afectadas").status_code == 404


def test_mantenimiento_cancela_y_avisa_una_vez_por_coordinador(pg_client, pg_db):
    r1 = _reserva(pg_db, "Aprobado", dias=2)
    r2 = _reserva(pg_db, "Pendiente de Aprobación", dias=3)
    otra = _reserva(pg_db, "Aprobado", equipo=AUTOCLAVE, dias=2)
    iniciar_sesion(pg_client, "admin@cpq.local")
    vista = next(x for x in pg_client.get("/api/equipos").json()["items"] if x["id"] == ESPECTRO)
    assert vista["proximaReserva"] == {"inicio": vista["proximaReserva"]["inicio"], "proyecto": "QUI-024", "proyectoId": QUI, "aprobada": True}

    afectadas = pg_client.get(f"/api/equipos/{ESPECTRO}/reservas-afectadas").json()
    assert [a["id"] for a in afectadas] == [str(r1.id), str(r2.id)]
    assert afectadas[0]["coordinador"] == "Daniela Rivas" and afectadas[0]["proyectoId"] == QUI

    assert pg_client.post(f"/api/equipos/{ESPECTRO}/mantenimiento", json={"motivo": "ab"}).status_code == 422
    r = pg_client.post(f"/api/equipos/{ESPECTRO}/mantenimiento", json={"motivo": "Cambio de lámpara de deuterio"})
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert (cuerpo["avisados"], cuerpo["reservas"]) == (1, 2)
    assert cuerpo["equipo"]["estado"] == "En mantenimiento" and cuerpo["equipo"]["proximaReserva"] is None
    assert cuerpo["equipo"]["mantenimiento"] == {"motivo": "Cambio de lámpara de deuterio", "desde": h.hoy().isoformat()}

    pg_db.expire_all()
    assert {pg_db.get(EquipmentReservation, x.id).status for x in (r1, r2)} == {"Cancelado"}
    assert pg_db.get(EquipmentReservation, otra.id).status == "Aprobado"
    avisos = pg_db.query(Notification).filter(Notification.user_id == COORD_QUI).all()
    # Un aviso por reserva cancelada, con enlace a esa reserva
    assert sorted(a.link for a in avisos) == sorted(f"/reservas?reserva={x.id}" for x in (r1, r2))
    assert all(a.title.startswith("Se canceló tu reserva") and "deuterio" in a.detail for a in avisos)

    assert pg_client.post(f"/api/equipos/{ESPECTRO}/mantenimiento", json={"motivo": "Otra vez"}).status_code == 409
    # En mantenimiento no admite reservas ni usos
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    d = _dia_habil(4)
    pedida = pg_client.post("/api/reservas", json={"equipoId": ESPECTRO, "proyectoId": QUI,
                                                    "inicio": _instante(d, "08:00"), "fin": _instante(d, "09:00")})
    assert pedida.status_code == 409 and "mantenimiento" in pedida.json()["detail"]
    assert pg_client.post("/api/usos", json={"equipoId": ESPECTRO, "proyectoId": QUI}).status_code == 409

    iniciar_sesion(pg_client, "admin@cpq.local")
    fin = pg_client.post(f"/api/equipos/{ESPECTRO}/fin-mantenimiento")
    assert fin.status_code == 200 and fin.json()["estado"] == "Disponible" and fin.json()["mantenimiento"] is None
    assert pg_client.post(f"/api/equipos/{ESPECTRO}/fin-mantenimiento").status_code == 409


def test_reservar_choque_libres_y_semana(pg_client, pg_db):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    d = _dia_habil(2)
    datos = {"equipoId": ESPECTRO, "proyectoId": QUI, "inicio": _instante(d, "10:00"), "fin": _instante(d, "12:00")}
    creada = pg_client.post("/api/reservas", json=datos)
    assert creada.status_code == 201, creada.text
    c = creada.json()
    assert c["estado"] == "pendiente" and c["proyecto"] == "QUI-024" and c["proyectoId"] == QUI
    assert c["equipo"] == "Espectrofotómetro UV-Vis Shimadzu"
    # Aviso a los aprobadores con enlace a la bandeja
    aviso = pg_db.query(Notification).filter(Notification.user_id == APROBADOR).one()
    assert aviso.link == f"/bandeja?pedido={c['id']}" and aviso.title.startswith("Reserva por aprobar")

    # F4.4: choque con la reserva de QUI-024 y horarios libres de ese día
    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    choque = pg_client.post("/api/reservas", json={**datos, "proyectoId": BIO, "inicio": _instante(d, "11:00"), "fin": _instante(d, "13:00")})
    assert choque.status_code == 409
    detalle = choque.json()["detail"]
    assert detalle["mensaje"] == f"Choca con la reserva de QUI-024 el {d.strftime('%d/%m/%Y')}."
    assert detalle["choque"]["proyectoId"] == QUI and detalle["choque"]["inicio"] == _instante(d, "10:00")
    # Los dos huecos quedan a una hora del pedido (11:00): primero el de la mañana
    assert detalle["libres"] == [
        {"inicio": _instante(d, "07:00"), "fin": _instante(d, "10:00")},
        {"inicio": _instante(d, "12:00"), "fin": _instante(d, "18:00")},
    ]

    # Reglas del horario
    domingo = d + timedelta(days=(6 - d.weekday()) % 7 or 7)
    errores = [
        ({"inicio": _instante(domingo, "10:00"), "fin": _instante(domingo, "11:00")}, "fecha"),
        ({"inicio": _instante(d, "06:00"), "fin": _instante(d, "08:00")}, "inicio"),
        ({"inicio": _instante(d, "15:00"), "fin": _instante(d, "14:00")}, "fin"),
        ({"inicio": "mañana", "fin": ""}, "inicio"),
        ({"proyectoId": QUI}, "proyectoId"),  # no es suyo
    ]
    for cambio, campo in errores:
        r = pg_client.post("/api/reservas", json={**datos, "proyectoId": BIO, **cambio})
        assert r.status_code == 422 and r.json()["detail"][0]["loc"] == ["body", campo], (cambio, r.text)
    assert pg_client.post("/api/reservas", json={**datos, "proyectoId": "b0000000-0000-0000-0000-00000000dead"}).status_code == 404

    # Semana: el coordinador ve todas las del equipo y distingue las suyas (RN-07)
    semana = pg_client.get("/api/reservas", params={"equipo": ESPECTRO, "semana": d.isoformat()}).json()
    assert semana["semana"] == h.lunes_de(d).isoformat()
    fila = next(x for x in semana["reservas"] if x["id"] == c["id"])
    assert fila["mia"] is False and fila["estado"] == "pendiente"
    assert [p["codigo"] for p in semana["misProyectos"]] == ["BIO-011"] and semana["pendientes"] == []

    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    # Con ?reserva= se abre su equipo y su semana
    resaltada = pg_client.get("/api/reservas", params={"reserva": c["id"]}).json()
    assert resaltada["resaltada"] == c["id"] and resaltada["equipo"]["id"] == ESPECTRO
    assert next(x for x in resaltada["reservas"] if x["id"] == c["id"])["mia"] is True
    # Sin parámetros: el equipo de su próxima reserva
    assert pg_client.get("/api/reservas").json()["equipo"]["id"] == ESPECTRO
    assert pg_client.get("/api/reservas", params={"equipo": "nada"}).status_code == 404

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    vista = pg_client.get("/api/reservas", params={"equipo": ESPECTRO}).json()
    assert [p["id"] for p in vista["pendientes"]] == [c["id"]] and vista["misProyectos"] == []


def test_aprobar_y_rechazar_reservas(pg_client, pg_db):
    a = _reserva(pg_db, "Pendiente de Aprobación", dias=2)
    b = _reserva(pg_db, "Pendiente de Aprobación", equipo=AUTOCLAVE, dias=3)
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    assert pg_client.post(f"/api/reservas/{a.id}/aprobar").status_code == 403

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.post(f"/api/reservas/{a.id}/aprobar").json() == {"id": str(a.id), "estado": "aprobada"}
    assert pg_client.post(f"/api/reservas/{a.id}/aprobar").status_code == 409
    assert pg_client.post(f"/api/reservas/{b.id}/rechazar", json={"motivo": "  "}).status_code == 422
    r = pg_client.post(f"/api/reservas/{b.id}/rechazar", json={"motivo": "El autoclave está reservado para la docencia"})
    assert r.json() == {"id": str(b.id), "estado": "rechazada"}
    assert pg_client.post("/api/reservas/no-existe/aprobar").status_code == 404

    pg_db.expire_all()
    avisos = {n.kind: n for n in pg_db.query(Notification).filter(Notification.user_id == COORD_QUI).all()}
    assert avisos["ok"].link == f"/reservas?reserva={a.id}"
    assert avisos["err"].link == f"/reservas?equipo={AUTOCLAVE}" and "docencia" in avisos["err"].detail

    # HU-13: el coordinador ve sus rechazadas recientes con el motivo
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    rechazadas = pg_client.get("/api/reservas", params={"equipo": ESPECTRO}).json()["rechazadas"]
    assert rechazadas[0]["id"] == str(b.id) and rechazadas[0]["motivo"] == "El autoclave está reservado para la docencia"
    assert rechazadas[0]["equipoId"] == AUTOCLAVE


def test_uso_abrir_y_cerrar(pg_client, pg_db):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    inicial = pg_client.get("/api/usos", params={"equipo": ESPECTRO})
    assert inicial.status_code == 200
    assert inicial.json()["abierto"] is None and inicial.json()["historial"] == [] and inicial.json()["mes"] is None

    assert pg_client.post("/api/usos", json={"equipoId": ESPECTRO, "proyectoId": BIO}).status_code == 422
    abierto = pg_client.post("/api/usos", json={"equipoId": ESPECTRO, "proyectoId": QUI})
    assert abierto.status_code == 201, abierto.text
    uso_id = abierto.json()["id"]
    pg_db.expire_all()
    assert pg_db.get(Equipment, ESPECTRO).operational_status == "En uso"

    vista = pg_client.get("/api/usos").json()  # sin equipo: el que está usando
    assert vista["equipo"]["id"] == ESPECTRO and vista["abierto"]["mio"] is True and vista["abierto"]["usuario"] == "Daniela Rivas"

    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    ocupado = pg_client.post("/api/usos", json={"equipoId": ESPECTRO, "proyectoId": BIO})
    assert ocupado.status_code == 409 and "ya está en uso por Daniela Rivas para QUI-024" in ocupado.json()["detail"]
    assert pg_client.post(f"/api/usos/{uso_id}/cerrar", json={}).status_code == 403

    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    cerrado = pg_client.post(f"/api/usos/{uso_id}/cerrar", json={"observaciones": "  Sin novedad  "})
    assert cerrado.status_code == 200
    assert cerrado.json() == {"id": uso_id, "proyecto": "QUI-024", "proyectoId": QUI, "horas": 0.0,
                              "equipo": "Espectrofotómetro UV-Vis Shimadzu"}
    assert pg_client.post(f"/api/usos/{uso_id}/cerrar", json={}).status_code == 409
    pg_db.expire_all()
    assert pg_db.get(Equipment, ESPECTRO).operational_status == "Disponible"
    assert pg_db.get(EquipmentUsage, uso_id).observations == "Sin novedad"

    vista = pg_client.get("/api/usos", params={"equipo": ESPECTRO}).json()
    assert [x["id"] for x in vista["historial"]] == [uso_id] and vista["mes"]["mes"] == h.hoy().strftime("%Y-%m")
    # RN-07: otro coordinador no ve ese historial
    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    assert pg_client.get("/api/usos", params={"equipo": ESPECTRO}).json()["historial"] == []


def test_horarios_libres():
    assert h.rangos_libres([(600, 720)], 660) == [(420, 600), (720, 1080)]
    assert h.rangos_libres([(600, 720)], 900) == [(720, 1080), (420, 600)]
    assert h.rangos_libres([(420, 1080)]) == []
    assert h.lunes_de(date(2026, 11, 8)) == date(2026, 11, 9)  # domingo → lunes siguiente
    assert h.lunes_de(date(2026, 11, 14)) == date(2026, 11, 9)
    assert h.iso(datetime(2026, 11, 9, 14, 0, tzinfo=timezone.utc)) == "2026-11-09T10:00:00-04:00"
