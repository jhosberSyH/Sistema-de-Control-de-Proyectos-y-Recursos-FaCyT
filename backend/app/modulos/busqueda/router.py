"""Búsqueda global de la barra superior. GET /api/buscar?q=texto

Cada rol encuentra solo lo que puede abrir (contrato: frontend/src/testing/mocks/handlers/busqueda.ts):
- Administrador: proyectos, insumos y equipos.
- Coordinador: sus proyectos y sus solicitudes (RN-07), insumos y equipos.
- Aprobador: insumos, equipos y los pedidos que le llegan (todo menos los borradores).

Sin tildes ni mayúsculas; con menos de 2 letras no busca. Cada grupo trae los 6 primeros y el total.
"""

from decimal import Decimal
from typing import List, Literal, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.autenticacion.dependencies import get_current_user
from app.core.api import ADMINISTRADOR, APROBADOR, COORDINADOR, ModeloApi, normalizar
from app.core.database import get_db
from app.modulos.usuarios.models import Equipment, Item, Project, Request as Solicitud, RequestItem, User

router = APIRouter(tags=["Búsqueda"])

POR_GRUPO = 6
MINIMO = 2
TIPO_SOLICITUD = {"Gasto": "gasto", "Retiro": "retiro", "Reposición automática": "reposicion"}


class Resultado(ModeloApi):
    id: str
    titulo: str
    detalle: str
    enlace: str


class Grupo(ModeloApi):
    clave: Literal["proyectos", "insumos", "equipos", "solicitudes"]
    titulo: str
    total: int
    resultados: List[Resultado]


class RespuestaBusqueda(ModeloApi):
    q: str
    grupos: List[Grupo]


def _coincide(q: str, *campos: Optional[str]) -> bool:
    return q in normalizar(" ".join(c for c in campos if c))


def _grupo(clave: str, titulo: str, todos: List[Resultado]) -> Grupo:
    return Grupo(clave=clave, titulo=titulo, total=len(todos), resultados=todos[:POR_GRUPO])


def _cantidad(valor) -> str:
    d = Decimal(str(valor or 0)).normalize()
    return str(int(d)) if d == d.to_integral_value() else format(d, "f")


def _enc(texto: str) -> str:
    """Como encodeURIComponent."""
    return quote(texto, safe="-_.!~*'()")


@router.get("/buscar", response_model=RespuestaBusqueda)
def buscar(q: str = "", db: Session = Depends(get_db), u: User = Depends(get_current_user)):
    texto = q.strip()
    if len(texto) < MINIMO:
        return RespuestaBusqueda(q=texto, grupos=[])
    buscado = normalizar(texto)
    grupos: List[Grupo] = []
    mios = None
    if u.role == COORDINADOR:
        mios = {str(pid) for (pid,) in db.query(Project.id).filter(Project.coordinator_id == u.id).all()}

    if u.role in (ADMINISTRADOR, COORDINADOR):
        consulta = db.query(Project)
        if mios is not None:
            consulta = consulta.filter(Project.coordinator_id == u.id)
        proyectos = sorted(
            (p for p in consulta.all() if _coincide(buscado, p.code, p.title, p.area)), key=lambda p: p.code
        )
        grupos.append(_grupo("proyectos", "Proyectos", [
            Resultado(id=str(p.id), titulo=f"{p.code} · {p.title}", detalle=f"{p.area} · {p.operational_status}",
                      enlace=f"/proyectos/{p.id}")
            for p in proyectos
        ]))

    insumos = sorted(
        (i for i in db.query(Item).filter(Item.is_active.is_(True)).all() if _coincide(buscado, i.name, i.item_type)),
        key=lambda i: normalizar(i.name),
    )
    grupos.append(_grupo("insumos", "Insumos", [
        Resultado(
            id=str(i.id), titulo=i.name,
            detalle=f"{i.item_type} · {_cantidad(i.current_stock)} {i.unit_of_measure} en stock",
            enlace=f"/inventario?q={_enc(i.name)}" if u.role == COORDINADOR else f"/inventario/{i.id}",
        )
        for i in insumos
    ]))

    equipos = sorted(
        (e for e in db.query(Equipment).all() if _coincide(buscado, e.name, e.asset_code)),
        key=lambda e: normalizar(e.name),
    )
    grupos.append(_grupo("equipos", "Equipos", [
        Resultado(
            id=str(e.id), titulo=e.name, detalle=f"{e.asset_code} · {e.operational_status}",
            enlace=f"/equipos?q={_enc(e.asset_code)}" if u.role == ADMINISTRADOR else "/reservas",
        )
        for e in equipos
    ]))

    if u.role in (COORDINADOR, APROBADOR):
        consulta = db.query(Solicitud).options(
            joinedload(Solicitud.project), joinedload(Solicitud.items).joinedload(RequestItem.item)
        )
        if mios is not None:
            consulta = consulta.filter(Solicitud.project_id.in_(list(mios)))
        else:
            consulta = consulta.filter(Solicitud.status != "Borrador")
        encontradas = []
        for s in consulta.all():
            insumos_servicio = ", ".join(i.item.name for i in s.items if i.item is not None)
            descripcion = getattr(s, "description", None) or insumos_servicio or s.request_type
            codigo = s.project.code if s.project else None
            if _coincide(buscado, s.request_number, descripcion, codigo, insumos_servicio):
                encontradas.append((s, descripcion, codigo))
        encontradas.sort(key=lambda t: t[0].request_number, reverse=True)
        grupos.append(_grupo("solicitudes", "Solicitudes", [
            Resultado(
                # El UUID para el enlace; el número es lo que se lee
                id=str(s.id), titulo=f"{s.request_number} · {descripcion}",
                detalle=f"{codigo or 'Sin proyecto'} · {s.status}",
                enlace="/solicitudes" if u.role == COORDINADOR else (
                    f"/bandeja?{'tipo=reposicion&' if TIPO_SOLICITUD.get(s.request_type) == 'reposicion' else ''}"
                    f"pedido={s.id}"
                ),
            )
            for s, descripcion, codigo in encontradas
        ]))

    return RespuestaBusqueda(q=texto, grupos=grupos)
