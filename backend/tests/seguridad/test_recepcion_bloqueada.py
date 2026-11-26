from datetime import date, timedelta
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.api import ErrorValidacion
from app.modulos.almacen.contrato import DatosLote, registrar_lote
from app.modulos.almacen.reglas import buscar_solicitud
from app.modulos.usuarios.models import Batch, Request, RequestItem, User
from tests.seguridad.helpers import APROBADOR, carrera_con_fila, gasto, peticion


def test_recepcion_revalida_reposicion_despues_de_esperar_su_fila(pg_engine):
    insumo = "e0000000-0000-0000-0000-000000000004"
    lote_proveedor = "SEG-" + uuid4().hex
    with Session(pg_engine) as preparacion:
        fila = gasto(preparacion, estado="Aprobado")
        fila.request_type = "Reposición automática"
        preparacion.add(RequestItem(request_id=fila.id, item_id=insumo,
                                   requested_quantity=1, approved_quantity=1,
                                   unit_cost_estimate=10))
        identificador, numero = fila.id, fila.request_number
        preparacion.commit()
    datos = DatosLote(
        solicitud=numero, insumo_id=insumo, lote_proveedor=lote_proveedor,
        cantidad=1, costo_unitario=10, proveedor="Proveedor de regresión",
        ubicacion_id="c0000000-0000-0000-0000-000000000003",
        ingreso=date.today().isoformat(),
        vence=(date.today() + timedelta(days=365)).isoformat(),
    )
    lotes_observados = {}

    def operar(b):
        quien = b.get(User, APROBADOR)
        assert quien is not None
        try:
            return registrar_lote(datos, request=peticion(), db=b, quien=quien)
        finally:
            # Antes del rollback exterior: no ocultar un lote creado por el handler.
            lotes_observados["ids"] = list(b.scalars(select(Batch.id).where(
                Batch.supplier_lot_code == lote_proveedor)))

    try:
        resultado = carrera_con_fila(
            pg_engine, lambda a: buscar_solicitud(a, numero, bloquear=True),
            lambda fila: setattr(fila, "status", "Ejecutado"), operar,
        )
        error = resultado.get("error")
        assert isinstance(error, ErrorValidacion), repr(resultado)
        assert set(error.errores) == {"solicitud"}, error.errores
        assert lotes_observados["ids"] == []
        with Session(pg_engine) as verificacion:
            assert verificacion.get(Request, identificador).status == "Ejecutado"
            assert not list(verificacion.scalars(select(Batch.id).where(
                Batch.supplier_lot_code == lote_proveedor)))
    finally:
        # B se deshace incluso si la mutación permitió commit (incluye stock y auditoría).
        with Session(pg_engine) as limpieza:
            limpieza.execute(delete(Batch).where(Batch.supplier_lot_code == lote_proveedor))
            limpieza.execute(delete(RequestItem).where(RequestItem.request_id == identificador))
            limpieza.execute(delete(Request).where(Request.id == identificador))
            limpieza.commit()
