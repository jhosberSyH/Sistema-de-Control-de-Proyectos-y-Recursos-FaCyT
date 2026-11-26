from inspect import iscoroutinefunction
from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.almacenamiento.service import obtener_almacen
from app.main import app
from app.modulos.solicitudes.contrato import (
    DatosBorrador, _buscar, descartar_borrador, guardar_borrador,
)
from app.modulos.solicitudes.cotizacion import subir_cotizacion
from app.modulos.usuarios.models import Request, User
from tests.conftest import iniciar_sesion
from tests.seguridad.helpers import (
    COORDINADOR, PENDIENTE, carrera_con_fila, gasto, peticion,
)


class AlmacenEnMemoria:
    def __init__(self):
        self.archivos = {}

    def guardar(self, ruta, contenido, tipo):
        self.archivos[ruta] = (contenido, tipo)


def test_subir_cotizacion_es_sincrona_para_no_bloquear_el_event_loop():
    assert not iscoroutinefunction(subir_cotizacion)


@pytest.mark.parametrize("estado,codigo", [("Borrador", 200), (PENDIENTE, 409)])
def test_cotizacion_http_solo_admite_borrador_propio(pg_client, pg_db, estado, codigo):
    iniciar_sesion(pg_client, "coord.quimica@cpq.local")
    fila = gasto(pg_db, estado=estado)
    identificador = fila.id
    almacen = AlmacenEnMemoria()
    ausente = object()
    anterior = app.dependency_overrides.get(obtener_almacen, ausente)
    app.dependency_overrides[obtener_almacen] = lambda: almacen
    try:
        respuesta = pg_client.post(
            f"/api/solicitudes/{identificador}/cotizacion",
            files={"archivo": ("oferta.pdf", b"%PDF-1.4\n", "application/pdf")},
        )
        assert respuesta.status_code == codigo, respuesta.text
        pg_db.expire_all()
        fila = pg_db.get(Request, identificador)
        if codigo == 200:
            assert list(almacen.archivos.values()) == [(b"%PDF-1.4\n", "application/pdf")]
            assert fila.quote_path in almacen.archivos
            assert fila.quote_filename == "oferta.pdf"
        else:
            assert not almacen.archivos
            assert fila.quote_path is None
    finally:
        if anterior is ausente:
            app.dependency_overrides.pop(obtener_almacen, None)
        else:
            app.dependency_overrides[obtener_almacen] = anterior


@pytest.mark.parametrize("accion", ["editar", "descartar", "cotizacion"])
def test_cambio_de_estado_concurrente_impide_mutar_el_borrador(pg_engine, accion):
    with Session(pg_engine) as preparacion:
        fila = gasto(preparacion, estado="Borrador")
        identificador, numero = fila.id, fila.request_number
        preparacion.commit()
    almacen = AlmacenEnMemoria()

    def operar(b):
        coordinador = b.get(User, COORDINADOR)
        assert coordinador is not None
        if accion == "editar":
            return guardar_borrador(numero, DatosBorrador(proposito="cambio de B"),
                                    db=b, quien=coordinador)
        if accion == "descartar":
            return descartar_borrador(numero, db=b, quien=coordinador)
        with BytesIO(b"%PDF-1.4\n") as contenido:
            return subir_cotizacion(
                request_id=identificador, request=peticion(),
                archivo=UploadFile(file=contenido, filename="oferta.pdf"),
                db=b, u=coordinador, almacen=almacen,
            )

    try:
        resultado = carrera_con_fila(
            pg_engine, lambda a: _buscar(a, numero, bloquear=True),
            lambda fila: setattr(fila, "status", PENDIENTE), operar,
        )
        error = resultado.get("error")
        assert isinstance(error, HTTPException), repr(resultado)
        assert error.status_code == 409, repr(error)
        assert not almacen.archivos
        with Session(pg_engine) as verificacion:
            fila = verificacion.get(Request, identificador)
            assert fila is not None
            assert fila.status == PENDIENTE
            assert fila.purpose != "cambio de B"
            assert fila.quote_path is None
    finally:
        with Session(pg_engine) as limpieza:
            limpieza.execute(delete(Request).where(Request.id == identificador))
            limpieza.commit()
