"""Módulo 1 con el contrato del frontend, contra PostgreSQL con el esquema real."""

from app.auditoria.models import AuditLog
from app.modulos.usuarios.models import Project, SessionModel, User
from tests.conftest import iniciar_sesion

ADMIN = "a0000000-0000-0000-0000-000000000001"
COORD_BIO = "a0000000-0000-0000-0000-000000000004"


def test_solo_el_administrador(pg_client):
    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    for ruta in ("/api/usuarios", "/api/ubicaciones", "/api/parametros"):
        assert pg_client.get(ruta).status_code == 403


def test_lista_paginada_filtros_y_orden(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    r = pg_client.get("/api/usuarios")
    cuerpo = r.json()
    assert r.status_code == 200
    assert cuerpo["total"] == 5 and cuerpo["porPagina"] == 8 and cuerpo["paginas"] == 1
    roles = [c["rol"] for c in cuerpo["items"]]
    assert roles == sorted(roles, key=["administrador", "aprobador", "coordinador"].index)
    propia = next(c for c in cuerpo["items"] if c["id"] == ADMIN)
    assert propia["esPropia"] is True
    assert not {"clave", "password", "passwordHash", "hash"} & set(propia)

    # Búsqueda sin tildes ni mayúsculas
    assert [c["correo"] for c in pg_client.get("/api/usuarios", params={"q": "MARIA"}).json()["items"]] == [
        "coord.biologia@cpq.local"
    ]
    assert pg_client.get("/api/usuarios", params={"rol": "coordinador"}).json()["total"] == 3
    # La página se ajusta al rango
    assert pg_client.get("/api/usuarios", params={"pagina": 99}).json()["pagina"] == 1


def test_crear_editar_y_conflictos(pg_client, pg_db):
    iniciar_sesion(pg_client, "admin@cpq.local")
    r = pg_client.post("/api/usuarios", json={"nombre": "  Pedro   Lugo ", "correo": "Pedro.Lugo@cpq.local", "rol": "coordinador"})
    assert r.status_code == 201
    cuenta = r.json()["cuenta"]
    assert cuenta["nombre"] == "Pedro Lugo" and cuenta["correo"] == "pedro.lugo@cpq.local"
    assert cuenta["debeCambiarClave"] is True and len(r.json()["claveTemporal"]) == 14

    dup = pg_client.post("/api/usuarios", json={"nombre": "Otro", "correo": "pedro.lugo@cpq.local", "rol": "aprobador"})
    assert dup.status_code == 409
    assert dup.json()["detail"]["mensaje"] and dup.json()["detail"]["cuenta"]["id"] == cuenta["id"]

    mala = pg_client.post("/api/usuarios", json={"nombre": "P", "correo": "no", "rol": "jefe"})
    assert mala.status_code == 422
    assert {e["loc"][-1] for e in mala.json()["detail"]} == {"nombre", "correo", "rol"}

    editada = pg_client.patch(f"/api/usuarios/{cuenta['id']}", json={"nombre": "Pedro Lugo R.", "correo": "pedro.lugo@cpq.local", "rol": "coordinador"})
    assert editada.status_code == 200 and editada.json()["nombre"] == "Pedro Lugo R."

    propio = pg_client.patch(f"/api/usuarios/{ADMIN}", json={"nombre": "José Rodríguez", "correo": "admin@cpq.local", "rol": "aprobador"})
    assert propio.status_code == 409

    # Cada cambio queda en la auditoría, sin la contraseña
    logs = pg_db.query(AuditLog).filter(AuditLog.target_id == cuenta["id"]).all()
    assert {l.action_type for l in logs} >= {"USER_CREATED", "USER_UPDATED"}
    assert all("clave" not in str(l.new_value).lower() and "password" not in str(l.new_value).lower() for l in logs)


def test_cambio_de_rol_libera_proyectos_y_cierra_sesiones(pg_client, pg_db):
    iniciar_sesion(pg_client, "admin@cpq.local")
    impacto = pg_client.get(f"/api/usuarios/{COORD_BIO}/impacto").json()
    assert impacto["proyectos"] == [{"id": "b0000000-0000-0000-0000-000000000002", "codigo": "BIO-011", "estatus": "En ejecución"}]

    r = pg_client.patch(f"/api/usuarios/{COORD_BIO}", json={"nombre": "María Fernanda Ochoa", "correo": "coord.biologia@cpq.local", "rol": "aprobador"})
    assert r.status_code == 200 and r.json()["rol"] == "aprobador"
    assert pg_db.query(Project).filter(Project.code == "BIO-011").one().coordinator_id is None
    assert pg_db.query(SessionModel).filter(SessionModel.user_id == COORD_BIO).count() == 0
    # El proyecto aparece como pendiente del administrador
    inicio = pg_client.get("/api/inicio").json()
    assert {"clase": "sin-coordinador", "proyecto": "BIO-011"}.items() <= inicio["pendientes"][0].items()
    assert pg_client.get("/api/navegacion/contadores").json() == {"proyectos": 1}


def test_desactivar_reactivar_y_restablecer(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    assert pg_client.patch(f"/api/usuarios/{ADMIN}/estado", json={"activo": False}).status_code == 409
    assert pg_client.patch(f"/api/usuarios/{COORD_BIO}/estado", json={}).status_code == 422

    r = pg_client.patch(f"/api/usuarios/{COORD_BIO}/estado", json={"activo": False})
    assert r.status_code == 200 and r.json()["activo"] is False
    assert pg_client.post(f"/api/usuarios/{COORD_BIO}/clave-temporal").status_code == 409
    assert pg_client.patch(f"/api/usuarios/{COORD_BIO}/estado", json={"activo": True}).json()["activo"] is True

    reset = pg_client.post(f"/api/usuarios/{COORD_BIO}/clave-temporal")
    assert reset.status_code == 200 and reset.json()["cuenta"]["debeCambiarClave"] is True
    assert pg_client.post(f"/api/usuarios/{ADMIN}/clave-temporal").status_code == 409
    # La clave vieja deja de servir y la temporal sí entra
    viejo = pg_client.post("/api/auth/iniciar-sesion", json={"correo": "coord.biologia@cpq.local", "clave": "Demo2026*"})
    assert viejo.status_code == 401
    iniciar_sesion(pg_client, "coord.biologia@cpq.local", reset.json()["claveTemporal"])


def test_id_mal_formado_es_404(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    assert pg_client.get("/api/usuarios/no-es-un-uuid/impacto").status_code == 404
    assert pg_client.patch("/api/ubicaciones/123/estado", json={"activa": False}).status_code == 404


def test_ubicaciones_ciclo_completo(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    lista = pg_client.get("/api/ubicaciones").json()["items"]
    usada = next(u for u in lista if u["usada"])

    nueva = pg_client.post("/api/ubicaciones", json={"nombre": "Depósito  de reactivos C", "descripcion": "Sótano"})
    assert nueva.status_code == 201
    u = nueva.json()
    assert u["nombre"] == "Depósito de reactivos C" and u["usada"] is False

    choque = pg_client.post("/api/ubicaciones", json={"nombre": "deposito de REACTIVOS c"})
    assert choque.status_code == 409 and choque.json()["detail"]["ubicacion"]["id"] == u["id"]
    assert pg_client.post("/api/ubicaciones", json={"nombre": "ab"}).status_code == 422

    assert pg_client.patch(f"/api/ubicaciones/{u['id']}", json={"nombre": "Depósito C", "descripcion": ""}).json()["nombre"] == "Depósito C"
    assert pg_client.patch(f"/api/ubicaciones/{u['id']}/estado", json={"activa": False}).json()["activa"] is False
    assert pg_client.delete(f"/api/ubicaciones/{u['id']}").status_code == 204
    assert all(x["id"] != u["id"] for x in pg_client.get("/api/ubicaciones").json()["items"])

    # Con lotes o equipos no se elimina: solo se desactiva (F1.4)
    assert pg_client.delete(f"/api/ubicaciones/{usada['id']}").status_code == 409


def test_parametros_validacion_y_ultimo_cambio(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    inicial = {p["clave"]: p for p in pg_client.get("/api/parametros").json()["items"]}
    assert inicial["anticipacion_vencimiento_dias"]["valor"] == 30
    assert inicial["meses_minimos_pronostico"]["valor"] == 3

    malo = pg_client.put("/api/parametros", json={"valores": {"anticipacion_vencimiento_dias": 0, "meses_minimos_pronostico": 61, "otro": 1}})
    assert malo.status_code == 422
    assert {e["loc"][-1] for e in malo.json()["detail"]} == {"anticipacion_vencimiento_dias", "meses_minimos_pronostico", "otro"}
    assert pg_client.put("/api/parametros", json={"valores": {"meses_minimos_pronostico": 2.5}}).status_code == 422

    ok = pg_client.put("/api/parametros", json={"valores": {"anticipacion_vencimiento_dias": 45}})
    cambio = {p["clave"]: p for p in ok.json()["items"]}["anticipacion_vencimiento_dias"]
    assert cambio["valor"] == 45
    assert cambio["ultimoCambio"]["anterior"] == 30 and cambio["ultimoCambio"]["nuevo"] == 45
    assert cambio["ultimoCambio"]["usuario"] == "José Rodríguez"


def test_inicio_y_contadores_por_rol(pg_client):
    iniciar_sesion(pg_client, "admin@cpq.local")
    adm = pg_client.get("/api/inicio").json()
    assert adm["rol"] == "administrador" and adm["contadores"]["proyectosActivos"] == 3
    assert adm["accesos"] == {"cuentasActivas": 5, "anticipacionVencimiento": 30}
    assert [p["codigo"] for p in adm["prioridades"]][0] == "BIO-011"  # Crítica primero

    iniciar_sesion(pg_client, "coord.fisica@cpq.local")
    coo = pg_client.get("/api/inicio").json()
    assert coo["rol"] == "coordinador" and [p["codigo"] for p in coo["proyectos"]] == ["FIS-008"]
    assert set(pg_client.get("/api/navegacion/contadores").json()) == {"solicitudes", "cierre"}

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    apr = pg_client.get("/api/inicio").json()
    assert apr["rol"] == "aprobador" and set(apr["contadores"]) == {"solicitudes", "reservas", "correcciones", "despachos"}
    assert set(pg_client.get("/api/navegacion/contadores").json()) == {"bandeja", "bandejaPorEjecutar", "almacen"}
    assert pg_client.get("/api/periodos/actual").json() is None
    assert pg_client.get("/api/avisos").json() == []
