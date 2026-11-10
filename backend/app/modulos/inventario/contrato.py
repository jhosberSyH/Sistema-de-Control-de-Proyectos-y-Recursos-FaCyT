"""Módulo 3 (Inventario) con el contrato del frontend (vistas 09 y 10; F3.1, F3.2, F3.4, F3.6, F3.7; RN-02).

  GET   /api/insumos?q&tipo&ubicacion&alerta&pagina  catálogo con stock, lotes, vencimiento y estado
  GET   /api/insumos/exportar?…                     el mismo catálogo en CSV
  POST  /api/insumos                                alta (solo Administrador); nace con stock cero
  GET   /api/insumos/{id}                           ficha: lotes, último movimiento, reposición y pronóstico
  PATCH /api/insumos/{id}/minimo                    cambiar el stock mínimo (solo Administrador, F3.2)

Lo consultan el Aprobador, el Administrador y el Coordinador (este, solo la lista: la usa para pedir
retiros). El estado de vencimiento se calcula al consultar, sin tarea diaria (F3.6), y ningún GET escribe.
La especificación es frontend/src/testing/mocks/handlers/inventario.ts.
"""

import math
from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.auditoria.service import record_audit_log
from app.autenticacion.dependencies import get_client_ip, require_role
from app.core.api import ADMINISTRADOR, APROBADOR, COORDINADOR, ErrorValidacion, ModeloApi, es_id_valido, iso, normalizar
from app.core.database import get_db
from app.modulos.inventario.reglas import (
    anticipacion,
    cantidad,
    dias_hasta,
    dinero,
    fecha_local,
    hoy,
    mes_atras,
    meses_requeridos,
    num,
    numero_valido,
    pronosticar,
    revisar_reposicion,
)
from app.modulos.inventario.service import reposicion_abierta
from app.modulos.usuarios.models import Batch, Dispatch, Item, Location, Project, RequestItem, User

router = APIRouter(tags=["Módulo 3: Inventario"])

POR_PAGINA = 20
TIPOS = ("Materia prima", "Consumible de proyecto", "Consumible de uso general")
UNIDADES = ("L", "mL", "g", "kg", "unidades", "cajas", "bolsas", "rollos")
ORDEN_ESTADO = {"bajo": 0, "vence": 1, "vencido": 2, "ok": 3}
ESTADO_CSV = {"bajo": "Bajo el mínimo", "vence": "Lote próximo a vencer", "vencido": "Lote vencido", "ok": "Al día"}

leer = require_role([APROBADOR, ADMINISTRADOR, COORDINADOR])
leer_ficha = require_role([APROBADOR, ADMINISTRADOR])
solo_admin = require_role([ADMINISTRADOR])


# =============================================================================
# Esquemas
# =============================================================================

class ProximoVencimiento(ModeloApi):
    fecha: str
    dias: int


class ResumenInsumo(ModeloApi):
    id: str
    nombre: str
    unidad: str
    tipo: Literal["Materia prima", "Consumible de proyecto", "Consumible de uso general"]
    stock: float
    stock_minimo: float
    lotes: int
    proximo_vencimiento: Optional[ProximoVencimiento]
    vencidos: int
    por_vencer: int
    estado: Literal["bajo", "vence", "vencido", "ok"]


class Alertas(ModeloApi):
    bajo_minimo: int
    por_vencer: int
    vencidos: int


class Opcion(ModeloApi):
    id: str
    nombre: str


class PaginaInsumos(ModeloApi):
    items: List[ResumenInsumo]
    total: int
    pagina: int
    paginas: int
    por_pagina: int
    alertas: Alertas
    anticipacion: int
    ubicaciones: List[Opcion]


class DatosInsumo(ModeloApi):
    nombre: Any = None
    unidad: Any = None
    tipo: Any = None
    stock_minimo: Any = None


class InsumoCreado(ModeloApi):
    insumo: ResumenInsumo
    reposicion: Optional[str]


class LoteInsumo(ModeloApi):
    codigo: str
    ingreso: str
    vence: Optional[str]
    dias: Optional[int]
    cantidad: float
    costo_unitario: float
    proveedor: str


class MovimientoInsumo(ModeloApi):
    tipo: Literal["despacho", "recepcion"]
    fecha: str
    cantidad: Optional[float]
    proyecto: Optional[str]
    proyecto_id: Optional[str]
    lote: str
    codigo: Optional[str]


class ReposicionInsumo(ModeloApi):
    id: str
    numero: str
    estado: Literal["Borrador", "Pendiente de Aprobación", "Aprobado"]
    cantidad: Optional[float]
    fecha: str
    decidida_por: Optional[str]


class ConsumoMes(ModeloApi):
    mes: str
    consumo: float


class PronosticoInsumo(ModeloApi):
    mes: str
    historial: List[ConsumoMes]
    meses: int
    requeridos: int
    metodo: str
    valor: Optional[float]
    minimo: Optional[float]
    maximo: Optional[float]


class FichaInsumo(ResumenInsumo):
    anticipacion: int
    ubicaciones: List[str]
    lotes: List[LoteInsumo]  # type: ignore[assignment]  (en la ficha, el detalle de cada lote)
    ultimo_movimiento: Optional[MovimientoInsumo]
    reposicion: Optional[ReposicionInsumo]
    pronostico: PronosticoInsumo


class DatosMinimo(ModeloApi):
    stock_minimo: Any = None


class MinimoCambiado(ModeloApi):
    stock_minimo: float
    reposicion: Optional[str]


# =============================================================================
# Consultas
# =============================================================================

def _lotes_por_insumo(db: Session) -> Dict[str, List[Batch]]:
    por_insumo: Dict[str, List[Batch]] = defaultdict(list)
    for b in db.query(Batch).all():
        por_insumo[str(b.item_id)].append(b)
    return por_insumo


def _con_stock(lotes: List[Batch]) -> List[Batch]:
    return [b for b in lotes if b.available_quantity and b.available_quantity > 0]


def vista(item: Item, lotes: List[Batch], dias_alerta: int) -> Dict[str, Any]:
    """Stock, lotes con existencia, próximo vencimiento y estado de un insumo (F3.4, F3.6)."""
    con_stock = _con_stock(lotes)
    con_fecha = sorted((b for b in con_stock if b.expiration_date), key=lambda b: b.expiration_date)
    vencidos = sum(1 for b in con_fecha if dias_hasta(b.expiration_date) < 0)
    por_vencer = sum(1 for b in con_fecha if 0 <= dias_hasta(b.expiration_date) <= dias_alerta)
    stock, minimo = cantidad(item.current_stock), cantidad(item.min_stock)
    # El chip muestra lo más grave: un faltante, luego un lote que ya no se puede despachar
    estado = "bajo" if stock < minimo else "vencido" if vencidos else "vence" if por_vencer else "ok"
    proximo = con_fecha[0] if con_fecha else None
    return {
        "id": str(item.id),
        "nombre": item.name,
        "unidad": item.unit_of_measure,
        "tipo": item.item_type,
        "stock": stock,
        "stock_minimo": minimo,
        "lotes": len(con_stock),
        "proximo_vencimiento": (
            {"fecha": proximo.expiration_date.isoformat(), "dias": dias_hasta(proximo.expiration_date)} if proximo else None
        ),
        "vencidos": vencidos,
        "por_vencer": por_vencer,
        "estado": estado,
    }


def _filtrar(db: Session, q: str, tipo: Optional[str], ubicacion: Optional[str], alerta: Optional[str]) -> List[Dict]:
    dias_alerta = anticipacion(db)
    lotes = _lotes_por_insumo(db)
    buscado = normalizar(q.strip())
    filas = []
    for item in db.query(Item).filter(Item.is_active.is_(True)).all():
        if tipo and item.item_type != tipo:
            continue
        propios = lotes.get(str(item.id), [])
        if ubicacion and not any(str(b.location_id) == ubicacion for b in _con_stock(propios)):
            continue
        # Por nombre o por número de lote (mockup 09)
        if buscado and buscado not in normalizar(item.name) and not any(buscado in normalizar(b.batch_number) for b in propios):
            continue
        v = vista(item, propios, dias_alerta)
        if alerta == "minimo" and v["estado"] != "bajo":
            continue
        if alerta == "vencimiento" and v["por_vencer"] == 0:
            continue
        if alerta == "vencido" and v["vencidos"] == 0:
            continue
        filas.append(v)
    filas.sort(key=lambda v: (ORDEN_ESTADO[v["estado"]], normalizar(v["nombre"])))
    return filas


def _alertas(db: Session) -> Dict[str, int]:
    """Las tres tarjetas de arriba: siempre del inventario completo, no de los filtros."""
    todos = _filtrar(db, "", None, None, None)
    return {
        "bajo_minimo": sum(1 for v in todos if v["estado"] == "bajo"),
        "por_vencer": sum(v["por_vencer"] for v in todos),
        "vencidos": sum(v["vencidos"] for v in todos),
    }


def _insumo(db: Session, item_id: str, mensaje: str) -> Item:
    item = db.get(Item, item_id) if es_id_valido(item_id, db) else None
    if not item:
        raise HTTPException(status_code=404, detail=mensaje)
    return item


# =============================================================================
# Lista, exportación y alta
# =============================================================================

@router.get("/insumos", response_model=PaginaInsumos)
def listar_insumos(
    q: str = "",
    tipo: Optional[str] = None,
    ubicacion: Optional[str] = None,
    alerta: Optional[str] = None,
    pagina: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    quien: User = Depends(leer),
):
    lista = _filtrar(db, q, tipo, ubicacion, alerta)
    paginas = max(1, math.ceil(len(lista) / POR_PAGINA))
    try:
        pedida = int(pagina) if pagina else 1
    except ValueError:
        pedida = 1
    actual = min(max(1, pedida), paginas)
    ubicaciones = db.query(Location).filter(Location.is_active.is_(True)).all()
    return PaginaInsumos(
        items=[ResumenInsumo(**v) for v in lista[(actual - 1) * POR_PAGINA: actual * POR_PAGINA]],
        total=len(lista),
        pagina=actual,
        paginas=paginas,
        por_pagina=POR_PAGINA,
        alertas=Alertas(**_alertas(db)),
        anticipacion=anticipacion(db),
        ubicaciones=[Opcion(id=str(u.id), nombre=u.name) for u in sorted(ubicaciones, key=lambda u: normalizar(u.name))],
    )


@router.get("/insumos/exportar")
def exportar_insumos(
    q: str = "",
    tipo: Optional[str] = None,
    ubicacion: Optional[str] = None,
    alerta: Optional[str] = None,
    db: Session = Depends(get_db),
    quien: User = Depends(leer),
):
    def celda(valor) -> str:
        return '"' + str("" if valor is None else valor).replace('"', '""') + '"'

    filas = [["Insumo", "Tipo", "Unidad", "Stock", "Stock mínimo", "Lotes", "Próximo vencimiento", "Estado"]]
    for v in _filtrar(db, q, tipo, ubicacion, alerta):
        filas.append([
            v["nombre"], v["tipo"], v["unidad"], num(v["stock"]), num(v["stock_minimo"]), v["lotes"],
            v["proximo_vencimiento"]["fecha"] if v["proximo_vencimiento"] else "", ESTADO_CSV[v["estado"]],
        ])
    csv = "\r\n".join(";".join(celda(c) for c in fila) for fila in filas)
    return Response(
        content=("﻿" + csv).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="inventario-{hoy().isoformat()}.csv"'},
    )


@router.post("/insumos", response_model=InsumoCreado, status_code=status.HTTP_201_CREATED)
def registrar_insumo(datos: DatosInsumo, request: Request, db: Session = Depends(get_db), quien: User = Depends(solo_admin)):
    """F3.1 y F3.2: nace con stock cero, así que si tiene mínimo queda bajo él y entra a la reposición."""
    nombre = " ".join(datos.nombre.split()) if isinstance(datos.nombre, str) else ""
    unidad = datos.unidad if isinstance(datos.unidad, str) else ""
    tipo = datos.tipo if isinstance(datos.tipo, str) else ""
    minimo = numero_valido(datos.stock_minimo)

    errores: Dict[str, str] = {}
    if len(nombre) < 3:
        errores["nombre"] = "Escribe el nombre del insumo."
    elif len(nombre) > 120:
        errores["nombre"] = "Usa como máximo 120 caracteres."
    if unidad not in UNIDADES:
        errores["unidad"] = "Elige la unidad de medida."
    if minimo is None or not minimo > 0:
        errores["stockMinimo"] = "Escribe un número mayor que cero."
    if tipo not in TIPOS:
        errores["tipo"] = "Elige el tipo de insumo."
    if errores:
        raise ErrorValidacion(errores)

    # F3.1: no puede haber dos insumos con el mismo nombre y la misma unidad (sin tildes ni mayúsculas)
    clave = normalizar(nombre)
    repetido = next(
        (i for i in db.query(Item).filter(Item.unit_of_measure == unidad).all() if normalizar(i.name) == clave), None
    )
    if repetido:
        raise HTTPException(status_code=409, detail={
            "mensaje": f"Ya existe {repetido.name} en {unidad}.",
            "insumo": {"id": str(repetido.id), "nombre": repetido.name, "unidad": repetido.unit_of_measure},
        })

    minimo = round(minimo, 3)
    item = Item(name=nombre, unit_of_measure=unidad, item_type=tipo, current_stock=Decimal("0"),
                min_stock=Decimal(str(minimo)), is_active=True)
    db.add(item)
    db.flush()
    ip = get_client_ip(request)
    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=f"ITEM:{item.name}", target_table="items",
        target_id=str(item.id), action_type="ITEM_CREATED",
        new_value={"name": nombre, "unit_of_measure": unidad, "item_type": tipo, "min_stock": str(minimo),
                   "current_stock": "0", "descripcion": f"{quien.full_name} registró el insumo {nombre} ({unidad})",
                   "valorNuevo": f"{tipo}; mínimo {num(minimo)} {unidad}"},
    )
    reposicion = revisar_reposicion(db, item, quien.id, ip)
    db.commit()
    db.refresh(item)
    return InsumoCreado(insumo=ResumenInsumo(**vista(item, [], anticipacion(db))), reposicion=reposicion)


# =============================================================================
# Ficha (vista 10) y stock mínimo
# =============================================================================

def pronostico_de(db: Session, item_id: str) -> Dict[str, Any]:
    """F3.7: consumo de cada mes completo desde el primer despacho hasta el mes pasado, y el pronóstico
    del mes en curso si hay al menos los meses que pide F1.5."""
    requeridos = meses_requeridos(db)
    actual = mes_atras(0)
    por_mes: Dict[str, float] = defaultdict(float)
    lineas = db.query(Dispatch).join(Batch, Dispatch.batch_id == Batch.id).filter(Batch.item_id == item_id).all()
    for d in lineas:
        m = fecha_local(d.dispatched_at).isoformat()[:7]
        if m < actual:
            por_mes[m] += float(d.signed_quantity if d.signed_quantity is not None else d.dispatched_quantity)
    historial = []
    if por_mes:
        primero = min(por_mes)
        atras = 1
        while mes_atras(atras) >= primero:
            historial.insert(0, {"mes": mes_atras(atras), "consumo": round(por_mes.get(mes_atras(atras), 0.0), 3)})
            atras += 1
    suficiente = len(historial) >= requeridos and len(historial) > 0
    calculo = pronosticar([h["consumo"] for h in historial]) if suficiente else {"valor": None, "minimo": None, "maximo": None}
    return {"mes": actual, "historial": historial, "meses": len(historial), "requeridos": requeridos,
            "metodo": "Holt-Winters", **calculo}


def _ultimo_movimiento(db: Session, item_id: str) -> Optional[Dict[str, Any]]:
    """El movimiento más reciente: un despacho de la bitácora o la recepción de un lote."""
    despacho = (
        db.query(Dispatch).join(Batch, Dispatch.batch_id == Batch.id)
        .filter(Batch.item_id == item_id).order_by(Dispatch.dispatched_at.desc()).first()
    )
    recepcion = (
        db.query(Batch).filter(Batch.item_id == item_id)
        .order_by(Batch.received_date.desc(), Batch.created_at.desc()).first()
    )
    if recepcion and (not despacho or recepcion.received_date > fecha_local(despacho.dispatched_at)):
        return {"tipo": "recepcion", "fecha": recepcion.received_date.isoformat(), "cantidad": None,
                "proyecto": None, "proyecto_id": None, "lote": recepcion.batch_number, "codigo": None}
    if not despacho:
        return None
    proyecto = db.get(Project, despacho.project_id)
    return {
        "tipo": "despacho", "fecha": iso(despacho.dispatched_at), "cantidad": cantidad(despacho.signed_quantity),
        "proyecto": proyecto.code if proyecto else None, "proyecto_id": str(despacho.project_id),
        "lote": despacho.batch.batch_number, "codigo": despacho.codigo,
    }


def _reposicion(db: Session, item_id: str) -> Optional[Dict[str, Any]]:
    s = reposicion_abierta(db, item_id)
    if not s:
        return None
    linea = db.query(RequestItem).filter(RequestItem.request_id == s.id, RequestItem.item_id == item_id).first()
    pedida = (linea.approved_quantity if linea and linea.approved_quantity is not None else linea.requested_quantity) if linea else None
    decidio = db.get(User, s.decided_by_user_id) if s.decided_by_user_id else None
    return {"id": str(s.id), "numero": s.request_number, "estado": s.status, "cantidad": cantidad(pedida) if pedida is not None else None,
            "fecha": iso(s.updated_at or s.created_at), "decidida_por": decidio.full_name if decidio else None}


@router.get("/insumos/{item_id}", response_model=FichaInsumo)
def ficha_insumo(item_id: str, db: Session = Depends(get_db), quien: User = Depends(leer_ficha)):
    item = _insumo(db, item_id, "No encontramos ese insumo. Puede que el enlace esté mal: búscalo en el inventario.")
    dias_alerta = anticipacion(db)
    todos = db.query(Batch).filter(Batch.item_id == item.id).all()
    lotes = sorted(_con_stock(todos), key=lambda b: b.expiration_date or date.max)
    ubicaciones: List[str] = []
    for b in lotes:
        nombre = b.location.name if b.location else str(b.location_id)
        if nombre not in ubicaciones:
            ubicaciones.append(nombre)
    return FichaInsumo(
        **{**vista(item, todos, dias_alerta), "lotes": [
            LoteInsumo(
                codigo=b.batch_number, ingreso=b.received_date.isoformat(),
                vence=b.expiration_date.isoformat() if b.expiration_date else None,
                dias=dias_hasta(b.expiration_date) if b.expiration_date else None,
                cantidad=cantidad(b.available_quantity), costo_unitario=dinero(b.unit_cost), proveedor=b.supplier or "",
            ) for b in lotes
        ]},
        anticipacion=dias_alerta,
        ubicaciones=ubicaciones,
        ultimo_movimiento=_ultimo_movimiento(db, item.id),
        reposicion=_reposicion(db, item.id),
        pronostico=pronostico_de(db, item.id),
    )


@router.patch("/insumos/{item_id}/minimo", response_model=MinimoCambiado)
def cambiar_minimo(
    item_id: str, datos: DatosMinimo, request: Request, db: Session = Depends(get_db), quien: User = Depends(solo_admin)
):
    """F3.2: si el stock ya está bajo el nuevo mínimo, la alerta y la reposición aparecen de inmediato (HU-07)."""
    item = _insumo(db, item_id, "No encontramos ese insumo.")
    valor = numero_valido(datos.stock_minimo)
    if valor is None or not valor > 0:
        raise ErrorValidacion({"stockMinimo": "Escribe un número mayor que cero."})
    nuevo = round(valor, 3)
    anterior = cantidad(item.min_stock)
    item.min_stock = Decimal(str(nuevo))
    ip = get_client_ip(request)

    def con_unidad(n):
        return f"{num(n)} {item.unit_of_measure}"

    record_audit_log(
        db=db, user_id=quien.id, ip_address=ip, target_object=f"ITEM:{item.name}", target_table="items",
        target_id=str(item.id), action_type="ITEM_MIN_STOCK_UPDATED",
        old_value={"min_stock": str(anterior), "valorAnterior": con_unidad(anterior)},
        new_value={"min_stock": str(nuevo), "valorNuevo": con_unidad(nuevo),
                   "descripcion": f"{quien.full_name} cambió el stock mínimo de {item.name} de {con_unidad(anterior)} a {con_unidad(nuevo)}"},
    )
    db.flush()
    reposicion = revisar_reposicion(db, item, quien.id, ip)
    db.commit()
    return MinimoCambiado(stock_minimo=nuevo, reposicion=reposicion)
