"""M8 Reportes y dashboard con el contrato del frontend, contra PostgreSQL con el esquema real.

Especificación: frontend/src/testing/mocks/handlers/{reportes,dashboard}.ts.
"""

import io
import re
from datetime import datetime, timedelta, timezone

from openpyxl import load_workbook

from app.modulos.reportes.formato import hoy
from app.modulos.usuarios.models import EquipmentReservation, EquipmentUsage
from tests.conftest import iniciar_sesion

QUI = "b0000000-0000-0000-0000-000000000001"
BIO = "b0000000-0000-0000-0000-000000000002"
COORD_QUI = "a0000000-0000-0000-0000-000000000003"
APROBADOR = "a0000000-0000-0000-0000-000000000002"
ESPECTRO = "f0000000-0000-0000-0000-000000000001"
PERIODO_SEMILLA = "70000000-0000-0000-0000-000000000001"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _rango(dias=1):
    return {"desde": (hoy() - timedelta(days=dias)).isoformat(), "hasta": hoy().isoformat()}


def _paginas(pdf: bytes) -> int:
    return len(re.findall(rb"/Type\s*/Page(?![a-zA-Z])", pdf))


def test_opciones_segun_el_rol(pg_client):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    o = pg_client.get("/api/reportes/opciones").json()
    assert o["alcance"] == "propios"
    assert o["proyectos"] == [{"id": QUI, "codigo": "QUI-024", "nombre": "Síntesis de nanopartículas para catálisis heterogénea",
                               "estatus": "En ejecución"}]
    assert o["sugerido"]["hasta"] == hoy().isoformat() and o["sugerido"]["desde"].endswith("-01")

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    o = pg_client.get("/api/reportes/opciones").json()
    assert o["alcance"] == "todos" and [p["codigo"] for p in o["proyectos"]] == ["BIO-011", "FIS-008", "QUI-024"]
    # El período cerrado de la semilla sale, marcado como no repartido
    assert [(p["id"], p["repartido"]) for p in o["periodos"]] == [(PERIODO_SEMILLA, False)]
    assert re.fullmatch(r"[a-z]+ de \d{4}", o["periodos"][0]["nombre"])
    nombres = [e["nombre"] for e in o["equipos"]]
    assert nombres == sorted(nombres) and len(nombres) == 3 and {"id", "nombre", "codigo"} == set(o["equipos"][0])


def test_vista_previa_y_descarga_del_analisis_de_gastos(pg_client):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    v = pg_client.get("/api/reportes/vista-previa", params={"tipo": "gastos", **_rango(), "proyectoIds": "todos"}).json()
    assert v["titulo"] == "Análisis de gastos" and v["vacio"] is None and v["paginas"] == 1
    assert v["lineas"][0].endswith("· Proyectos: todos (3)") and v["lineas"][1].endswith("por Carmen Pérez")
    assert [c["numerica"] for c in v["columnas"]] == [False, True, True, True, True]
    # El despacho de QUI-024 de la semilla: 5 x 14,50
    assert ["QUI-024", "0,00", "72,50", "0,00", "72,50"] in v["filas"]
    solo = pg_client.get("/api/reportes/vista-previa", params={"tipo": "gastos", **_rango(), "proyectoIds": QUI}).json()
    assert solo["filas"] == [["QUI-024", "0,00", "72,50", "0,00", "72,50"]]
    assert solo["lineas"][0].endswith("· Proyectos: QUI-024")

    pdf = pg_client.get("/api/reportes/gastos", params={"formato": "pdf", **_rango()})
    assert pdf.status_code == 200, pdf.text
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.headers["content-disposition"] == f'attachment; filename="analisis-de-gastos-{hoy().isoformat()}.pdf"'
    assert pdf.content.startswith(b"%PDF") and pdf.content.rstrip().endswith(b"%%EOF") and _paginas(pdf.content) == 1

    hoja = pg_client.get("/api/reportes/gastos", params={"formato": "xlsx", **_rango(), "proyectoIds": QUI})
    assert hoja.status_code == 200 and hoja.headers["content-type"] == XLSX
    assert hoja.headers["content-disposition"].endswith('.xlsx"')
    ws = load_workbook(io.BytesIO(hoja.content)).active
    filas = [list(r) for r in ws.iter_rows(values_only=True)]
    assert filas[0][0] == "Análisis de gastos" and "Proyectos: QUI-024" in filas[1][0]
    assert ["Proyecto", "Gastos", "Despachos", "Gastos compartidos", "Total"] in filas
    assert ["QUI-024", 0, 72.5, 0, 72.5] in [r[:5] for r in filas]


def test_sin_datos_no_se_genera_el_archivo(pg_client):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    rango = {"desde": "2020-01-01", "hasta": "2020-01-31"}
    v = pg_client.get("/api/reportes/vista-previa", params={"tipo": "gastos", **rango, "proyectoIds": QUI}).json()
    assert v["paginas"] == 0 and v["filas"] == []
    assert v["vacio"]["titulo"] == "No hay gastos de QUI-024 entre el 01/01/2020 y el 31/01/2020."
    assert v["vacio"]["detalle"].startswith("El proyecto se registró el ")
    r = pg_client.get("/api/reportes/gastos", params={"formato": "pdf", **rango})
    assert r.status_code == 409 and r.json()["detail"].endswith("no generamos un archivo vacío.")


def test_validaciones_y_alcance_del_coordinador(pg_client):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    sin_fechas = pg_client.get("/api/reportes/vista-previa", params={"tipo": "gastos"})
    assert sin_fechas.status_code == 422
    assert {e["loc"][-1]: e["msg"] for e in sin_fechas.json()["detail"]} == {
        "desde": "Elige la fecha de inicio.", "hasta": "Elige la fecha de fin."}
    assert pg_client.get("/api/reportes/vista-previa", params={"tipo": "otro"}).status_code == 404
    assert pg_client.get("/api/reportes/otro", params={"formato": "pdf"}).json()["detail"] == "Ese reporte no existe."
    formato = pg_client.get("/api/reportes/gastos", params={"formato": "doc", **_rango()})
    assert formato.status_code == 422 and formato.json()["detail"][0]["msg"] == "Elige PDF o Excel."
    falta = pg_client.get("/api/reportes/vista-previa", params={"tipo": "reparto"})
    assert falta.json()["detail"][0]["msg"] == "Elige el período repartido."
    falta = pg_client.get("/api/reportes/vista-previa", params={"tipo": "hoja-de-vida", **_rango()})
    assert falta.json()["detail"][0]["msg"] == "Elige el equipo."

    # RN-07: un proyecto ajeno no se incluye
    ajeno = pg_client.get("/api/reportes/vista-previa", params={"tipo": "gastos", **_rango(), "proyectoIds": BIO})
    assert ajeno.status_code == 404 and ajeno.json()["detail"] == "Ese proyecto no es tuyo."
    raro = pg_client.get("/api/reportes/vista-previa", params={"tipo": "gastos", **_rango(), "proyectoIds": "QUI-024"})
    assert raro.status_code == 404 and raro.json()["detail"] == "Ese proyecto no existe."
    propios = pg_client.get("/api/reportes/vista-previa", params={"tipo": "gastos", **_rango()}).json()
    assert propios["lineas"][0].endswith("Proyectos: QUI-024") and [f[0] for f in propios["filas"]] == ["QUI-024"]


def test_resumen_del_reparto(pg_client):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    params = {"periodo": PERIODO_SEMILLA, "proyectoIds": "todos"}
    sin = pg_client.get("/api/reportes/reparto", params={"formato": "pdf", **params})
    assert sin.status_code == 409 and sin.json()["detail"].endswith("todavía no se repartieron.")
    assert pg_client.get("/api/reportes/reparto", params={"formato": "pdf", "periodo": "x"}).status_code == 404

    assert pg_client.post(f"/api/periodos/{PERIODO_SEMILLA}/reparto", json={"criterio": "iguales"}).status_code == 200
    v = pg_client.get("/api/reportes/vista-previa", params={"tipo": "reparto", **params}).json()
    assert v["titulo"] == "Resumen del reparto de gastos compartidos" and v["vacio"] is None
    assert "Criterio: en partes iguales" in v["lineas"][0] and "entre 3 proyectos activos" in v["lineas"][1]
    assert [f[0] for f in v["filas"]] == ["BIO-011", "FIS-008", "QUI-024", "Total"]
    assert v["filas"][-1][2] == "0,0 %"  # sin consumo en el período

    pdf = pg_client.get("/api/reportes/reparto", params={"formato": "pdf", **params})
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert re.fullmatch(r'attachment; filename="resumen-reparto-\d{4}-\d{2}\.pdf"', pdf.headers["content-disposition"])

    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    hoja = pg_client.get("/api/reportes/reparto", params={"formato": "xlsx", **params})
    ws = load_workbook(io.BytesIO(hoja.content)).active
    codigos = [r[0] for r in ws.iter_rows(values_only=True)]
    assert "QUI-024" in codigos and "BIO-011" not in codigos


def test_hoja_de_vida_del_equipo(pg_client, pg_db):
    inicio = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(hours=3)
    reserva = EquipmentReservation(equipment_id=ESPECTRO, project_id=QUI, reserved_by_user_id=COORD_QUI,
                                   approved_by_user_id=APROBADOR, start_time=inicio, end_time=inicio + timedelta(hours=2),
                                   status="Aprobado")
    pg_db.add(reserva)
    pg_db.flush()
    pg_db.add(EquipmentUsage(equipment_id=ESPECTRO, project_id=QUI, reservation_id=reserva.id,
                             registered_by_user_id=COORD_QUI, start_time=inicio, end_time=inicio + timedelta(hours=1, minutes=30),
                             used_hours=1.5))
    pg_db.flush()

    iniciar_sesion(pg_client, "aprobador@cpq.local")
    params = {"tipo": "hoja-de-vida", "equipo": ESPECTRO, **_rango()}
    v = pg_client.get("/api/reportes/vista-previa", params=params).json()
    assert v["titulo"] == "Hoja de vida: Espectrofotómetro UV-Vis Shimadzu"
    assert v["lineas"][0].startswith("Equipo: EQ-FACYT-001 · Depósito de reactivos A · Estado: ")
    assert v["filas"] == [["QUI-024", "1", "1,5", "1"]]
    pdf = pg_client.get("/api/reportes/hoja-de-vida", params={**params, "formato": "pdf"})
    assert pdf.status_code == 200
    assert pdf.headers["content-disposition"] == 'attachment; filename="hoja-de-vida-EQ-FACYT-001.pdf"'
    xlsx = pg_client.get("/api/reportes/hoja-de-vida", params={**params, "formato": "xlsx"})
    filas = [r for r in load_workbook(io.BytesIO(xlsx.content)).active.iter_rows(values_only=True)]
    assert "Historial" in [r[0] for r in filas if r]
    assert any(r[1] == "Reserva aprobada" and r[2] == "QUI-024" for r in filas if r and len(r) > 2)
    assert pg_client.get("/api/reportes/vista-previa", params={**params, "equipo": "nada"}).json()["detail"] == "Ese equipo no existe."

    # RN-07: la coordinadora de Biología no ve los usos ni las reservas de Química
    iniciar_sesion(pg_client, "coord.biologia@cpq.local")
    ajeno = pg_client.get("/api/reportes/vista-previa", params=params).json()
    assert ajeno["filas"] == [] and ajeno["vacio"]["titulo"].startswith("No hay usos, reservas ni cambios de estado")


def test_dashboard_del_administrador(pg_client):
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    assert pg_client.get("/api/dashboard").status_code == 403

    iniciar_sesion(pg_client, "admin@cpq.local")
    d = pg_client.get("/api/dashboard").json()
    assert [p["valor"] for p in d["periodos"]][0] == "ultimos-5" and len(d["periodos"]) == 3
    assert d["periodo"] == "ultimos-5" and len(d["meses"]) == 5
    actual = d["meses"][-1]
    assert actual["clave"] == hoy().isoformat()[:7] and actual["hasta"] == hoy().isoformat()
    assert actual["valor"] >= 72.5 and all(m["hasta"] is None for m in d["meses"][:-1])
    assert actual["etiquetaLarga"].endswith(f"de {hoy().year}") and len(actual["etiqueta"]) == 3
    qui = next(p for p in d["proyectos"] if p["codigo"] == "QUI-024")
    assert qui == {"id": QUI, "codigo": "QUI-024", "nombre": qui["nombre"], "prioridad": "Alta",
                   "presupuesto": 8500.0, "gasto": 72.5}
    assert d["anticipacion"] == 30 and d["actualizado"]
    assert isinstance(d["stock"], list) and isinstance(d["vencimientos"], list)

    alta = pg_client.get("/api/dashboard", params={"prioridad": "Alta", "periodo": d["periodos"][1]["valor"]}).json()
    assert [p["codigo"] for p in alta["proyectos"]] == ["QUI-024"]
    assert alta["periodo"] == d["periodos"][1]["valor"] and len(alta["meses"]) == 1
    trimestre = pg_client.get("/api/dashboard", params={"periodo": d["periodos"][2]["valor"]}).json()
    assert len(trimestre["meses"]) == 3 and trimestre["periodo"].startswith("trimestre-")
