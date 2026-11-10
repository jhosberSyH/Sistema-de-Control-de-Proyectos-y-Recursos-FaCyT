"""Reglas del almacén (M6) para el contrato del frontend, reutilizables por otros módulos.

- Códigos visibles: lotes L-0001, despachos DES-0001 (compartido por las líneas de un despacho),
  correcciones COR-001. Se calculan desde el mayor existente (no con count(), D10) y, en PostgreSQL,
  bajo un candado de transacción para que dos despachos simultáneos no tomen el mismo número.
- Correcciones (F6.5, F6.6, RN-06): ``efecto_correccion`` y ``resumen_correccion`` (lo que muestra la
  bandeja del aprobador) y ``aprobar_correccion`` / ``denegar_correccion``. La bitácora es inmutable:
  una corrección agrega movimientos nuevos (cantidad siempre positiva + sentido, decisión 3).
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Optional

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auditoria.service import record_audit_log
from app.avisos.service import avisar
from app.core.api import ErrorValidacion, conflicto, es_id_valido
from app.modulos.inventario.reglas import fecha_local, legible, periodo_cerrado_en, revisar_reposicion
from app.modulos.inventario.service import _siguiente_correlativo
from app.modulos.usuarios.models import (
    Batch,
    Dispatch,
    DispatchCorrection,
    Item,
    Project,
    Request,
    User,
)


# --- Códigos ---------------------------------------------------------------------------------------

def _candado(db: Session, nombre: str) -> None:
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:n))"), {"n": nombre})


def siguiente_codigo_lote(db: Session) -> str:
    _candado(db, "codigo_lote")
    return f"L-{_siguiente_correlativo(db, Batch.batch_number, 'L'):04d}"


def siguiente_codigo_despacho(db: Session) -> str:
    _candado(db, "codigo_despacho")
    n = max(
        _siguiente_correlativo(db, Dispatch.movement_code, "DES"),
        _siguiente_correlativo(db, Dispatch.dispatch_number, "DES"),
    )
    return f"DES-{n:04d}"


def siguiente_codigo_correccion(db: Session) -> str:
    _candado(db, "codigo_correccion")
    return f"COR-{_siguiente_correlativo(db, DispatchCorrection.correction_number, 'COR'):03d}"


def numero_linea(codigo: str, n: int) -> str:
    """dispatch_number es único por línea: DES-0320, DES-0320-2, DES-0320-3…"""
    return codigo if n == 1 else f"{codigo}-{n}"


# --- Búsquedas por id público ----------------------------------------------------------------------

def buscar_solicitud(db: Session, valor: Optional[str]) -> Optional[Request]:
    """Por su número (SOL-…, REP-…), que es el id que ve el frontend, o por su UUID."""
    if not valor:
        return None
    s = db.query(Request).filter(Request.request_number == valor).first()
    if s is None and es_id_valido(valor, db):
        s = db.get(Request, valor)
    return s


def buscar_correccion(db: Session, valor: str) -> Optional[DispatchCorrection]:
    c = db.query(DispatchCorrection).filter(DispatchCorrection.correction_number == valor).first()
    if c is None and es_id_valido(valor, db):
        c = db.get(DispatchCorrection, valor)
    return c


def codigo_correccion(c: DispatchCorrection) -> str:
    return c.correction_number or str(c.id)


def correccion_pendiente(db: Session, linea_id) -> Optional[DispatchCorrection]:
    return (
        db.query(DispatchCorrection)
        .filter(DispatchCorrection.original_dispatch_id == linea_id, DispatchCorrection.status == "Pendiente")
        .first()
    )


def movimiento_que_corrige(db: Session, linea_id) -> Optional[Dispatch]:
    return (
        db.query(Dispatch)
        .filter(Dispatch.original_dispatch_id == linea_id, Dispatch.is_compensatory.is_(True))
        .order_by(Dispatch.dispatched_at)
        .first()
    )


# --- Correcciones ----------------------------------------------------------------------------------

def _valores(db: Session, c: DispatchCorrection, linea: Dispatch, item: Item):
    if c.corrected_field == "proyecto":
        origen = db.get(Project, linea.project_id)
        destino = db.get(Project, c.new_project_id) if c.new_project_id else None
        return (origen.code if origen else ""), (destino.code if destino else "")
    return legible(linea.dispatched_quantity, item.unit_of_measure), legible(c.correct_quantity, item.unit_of_measure)


def efecto_correccion(db: Session, c: DispatchCorrection) -> Dict[str, Any]:
    """Lo que cambia si se aprueba: traslado entre proyectos, devolución al lote o descuento de más."""
    linea = db.get(Dispatch, c.original_dispatch_id)
    item = linea.batch.item
    costo = float(linea.unit_cost_snapshot)
    if c.corrected_field == "proyecto":
        return {"linea": linea, "item": item, "tipo": "traslado", "cantidad": None, "diferencia": 0.0,
                "monto": round(float(linea.dispatched_quantity) * costo, 2)}
    # Positiva: se registró de más y vuelve al lote; negativa: se entregó más de lo registrado
    diferencia = round(float(linea.dispatched_quantity) - float(c.correct_quantity), 3)
    return {"linea": linea, "item": item, "tipo": "devolucion" if diferencia >= 0 else "descuento",
            "cantidad": legible(diferencia, item.unit_of_measure), "diferencia": diferencia,
            "monto": round(abs(diferencia) * costo, 2)}


def resumen_correccion(db: Session, c: DispatchCorrection) -> Dict[str, Any]:
    """Los datos de una corrección para la bandeja del aprobador (mock handlers/bandeja.ts: pedidoCorreccion)."""
    e = efecto_correccion(db, c)
    linea, item = e["linea"], e["item"]
    original, nuevo = _valores(db, c, linea, item)
    proyecto = db.get(Project, linea.project_id)
    return {
        "id": codigo_correccion(c),
        "proyecto": proyecto.code if proyecto else None,
        "proyectoId": str(linea.project_id),
        "despacho": {"codigo": linea.codigo, "fecha": linea.dispatched_at.isoformat()},
        "insumo": item.name,
        "lote": linea.batch.batch_number,
        "campo": c.corrected_field,
        "valorOriginal": original,
        "valorNuevo": nuevo,
        "motivo": c.justification,
        "efecto": {"tipo": e["tipo"], "cantidad": e["cantidad"], "monto": e["monto"]},
        "pedidaPor": str(c.requested_by_user_id),
        "fecha": c.created_at.isoformat() if c.created_at else None,
    }


def _por_decidir(c: DispatchCorrection) -> None:
    if c.status != "Pendiente":
        raise conflicto(f"{codigo_correccion(c)} ya está {c.status}: no se puede decidir de nuevo.")


def _movimiento(c: DispatchCorrection, linea: Dispatch, quien: User, numero: str, codigo: str,
                proyecto_id, cantidad: Decimal, sentido: str, ahora: datetime) -> Dispatch:
    return Dispatch(
        dispatch_number=numero, movement_code=codigo, batch_id=linea.batch_id, project_id=proyecto_id,
        dispatched_quantity=cantidad, direction=sentido, unit_cost_snapshot=linea.unit_cost_snapshot,
        dispatched_by=quien.id, received_by_name=linea.received_by_name, request_id=linea.request_id,
        is_compensatory=True, original_dispatch_id=linea.id, notes=f"Corrección {codigo_correccion(c)}",
        dispatched_at=ahora,
    )


def aprobar_correccion(db: Session, c: DispatchCorrection, quien: User, ip: str) -> Dict[str, str]:
    """F6.6 y RN-06: el despacho original no cambia. Un movimiento nuevo devuelve (o descuenta) la
    diferencia del lote, o traslada la línea a otro proyecto; el gasto ejecutado se recalcula solo
    (decisión 5). No hace commit."""
    _por_decidir(c)
    e = efecto_correccion(db, c)
    linea, item = e["linea"], e["item"]
    if periodo_cerrado_en(db, fecha_local(linea.dispatched_at)):
        raise conflicto(f"{linea.codigo} es de un período cerrado: ya no se corrige.")
    lote = db.query(Batch).filter(Batch.id == linea.batch_id).with_for_update().one()
    ahora = datetime.now(timezone.utc)
    codigo = siguiente_codigo_despacho(db)

    if c.corrected_field == "cantidad":
        d = Decimal(str(e["diferencia"]))
        if d < 0 and lote.available_quantity < -d:
            raise conflicto(f"El lote {lote.batch_number} ya no tiene {e['cantidad']} para entregar de más.")
        if d != 0:
            lote.available_quantity = lote.available_quantity + d
            item.current_stock = item.current_stock + d
            item.updated_at = ahora
            db.add(_movimiento(c, linea, quien, codigo, codigo, linea.project_id, abs(d),
                               "devolucion" if d > 0 else "salida", ahora))
    else:
        # El costo pasa de un proyecto al otro: vuelve del original y sale hacia el nuevo (sin mover stock)
        db.add(_movimiento(c, linea, quien, numero_linea(codigo, 1), codigo, linea.project_id,
                           linea.dispatched_quantity, "devolucion", ahora))
        db.add(_movimiento(c, linea, quien, numero_linea(codigo, 2), codigo, c.new_project_id,
                           linea.dispatched_quantity, "salida", ahora))

    original, nuevo = _valores(db, c, linea, item)
    c.status = "Aprobado"
    c.reviewed_by_user_id = quien.id
    c.reviewed_at = ahora
    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=f"CORRECCION:{codigo_correccion(c)}",
        target_table="dispatch_corrections", target_id=str(c.id), action_type="DISPATCH_CORRECTION_APPROVED",
        old_value={"status": "Pendiente"},
        new_value={"status": "Aprobado", "movimiento": codigo,
                   "descripcion": f"{quien.full_name} aprobó la corrección {codigo_correccion(c)} de {linea.codigo}: "
                                  f"{nuevo} en lugar de {original}"},
    )
    avisar(db, c.requested_by_user_id, "ok", f"Corrección aprobada: {codigo_correccion(c)}",
           f"/proyectos/bitacora?despacho={linea.codigo}", detalle=f"{linea.codigo} queda en {nuevo}.")
    db.flush()
    if c.corrected_field == "cantidad" and e["diferencia"] < 0:
        revisar_reposicion(db, item, quien.id, ip)
    return {"id": codigo_correccion(c), "estado": "Aprobado"}


def denegar_correccion(db: Session, c: DispatchCorrection, nota, quien: User, ip: str) -> Dict[str, str]:
    """El despacho queda como estaba; quien la pidió recibe la nota. No hace commit."""
    _por_decidir(c)
    texto = nota.strip()[:500] if isinstance(nota, str) else ""
    if not texto:
        raise ErrorValidacion({"nota": "Escribe la nota. Sin nota no se puede denegar."})
    linea = db.get(Dispatch, c.original_dispatch_id)
    c.status = "Denegado"
    c.review_notes = texto
    c.reviewed_by_user_id = quien.id
    c.reviewed_at = datetime.now(timezone.utc)
    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=f"CORRECCION:{codigo_correccion(c)}",
        target_table="dispatch_corrections", target_id=str(c.id), action_type="DISPATCH_CORRECTION_DENIED",
        old_value={"status": "Pendiente"},
        new_value={"status": "Denegado",
                   "descripcion": f"{quien.full_name} denegó la corrección {codigo_correccion(c)} de {linea.codigo}"},
        justification=texto,
    )
    avisar(db, c.requested_by_user_id, "err", f"Corrección denegada: {codigo_correccion(c)}",
           f"/proyectos/bitacora?despacho={linea.codigo}", detalle=f"{linea.codigo} queda como estaba. «{texto}»")
    db.flush()
    return {"id": codigo_correccion(c), "estado": "Denegado"}


def correccion_o_404(db: Session, valor: str) -> DispatchCorrection:
    c = buscar_correccion(db, valor)
    if not c:
        raise HTTPException(status_code=404, detail=f"No encontramos la corrección {valor}.")
    return c
