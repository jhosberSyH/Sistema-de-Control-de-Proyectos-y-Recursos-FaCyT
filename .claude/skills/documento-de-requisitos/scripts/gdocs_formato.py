#!/usr/bin/env python3
"""Genera las peticiones de formato para un Google Doc de requerimientos.

Lee el JSON que devuelve la herramienta read_doc del MCP de Google Docs y
escribe uno o varios archivos con peticiones para update_doc. Las peticiones
aplican el perfil de la skill formato-documento-requisitos: pagina,
margenes, fuentes, titulos, tablas, cuadros de funcionalidad, cuadros
destacados, marcas [POR CONFIRMAR] y [PROPUESTA], encabezado y pie.

Todas las peticiones de estilo dejan los indices intactos, por eso se pueden
partir en varios lotes. Solo el primer lote lleva requiredRevisionId.

Uso:
    python gdocs_formato.py doc.json --sistema "Nombre" --version 1.0 \
        [--perfil A|B|C] [--papel carta|a4] [--fuente Arial] \
        [--clasificacion "Uso interno"] [--tab t.0] [--salida lote]

    python gdocs_formato.py doc.json --crear-encabezados
        Escribe el lote que crea el encabezado y el pie cuando el documento
        todavia no los tiene. Despues hay que volver a leer el documento.

    python gdocs_formato.py doc.json --salto-antes F1.2,F2.3
        Escribe el lote que pone un salto de pagina antes del titulo de esas
        funcionalidades, cuyos cuadros revisar_paginas.py encontro partidos.
"""

import argparse
import json
import re
import sys

CM = 28.3465  # puntos por centimetro

PERFILES = {
    "A": {
        "fuente": "Arial", "cuerpo": 11, "interlineado": 115, "alineacion": "START",
        "sangria": 0, "margenes": (2.5, 2.5, 2.5, 2.5),
    },
    "B": {
        "fuente": "Times New Roman", "cuerpo": 12, "interlineado": 150, "alineacion": "JUSTIFIED",
        "sangria": 1.27, "margenes": (3, 3, 3, 4),  # superior, derecho, inferior, izquierdo
    },
    "C": {
        "fuente": "Times New Roman", "cuerpo": 12, "interlineado": 200, "alineacion": "START",
        "sangria": 1.27, "margenes": (2.54, 2.54, 2.54, 2.54),
    },
}
PAPEL = {"carta": (612, 792), "a4": (595.28, 841.89)}

# tamano, espacio antes, espacio despues, cursiva
TITULOS = {
    "TITLE": (26, 0, 12, False),
    "HEADING_1": (16, 24, 12, False),
    "HEADING_2": (14, 18, 6, False),
    "HEADING_3": (12, 12, 6, False),
    "HEADING_4": (12, 12, 6, False),  # funcionalidades F1.1, nivel visual de Titulo 3
    "HEADING_5": (11, 12, 4, True),
    "HEADING_6": (11, 12, 4, True),
}
CUADROS = {
    "[ESPACIO": ("#7F7F7F", "#F2F2F2"),
    "[NOTA": ("#2F5597", "#DEEAF6"),
    "[ADVERTENCIA": ("#BF8F00", "#FFF2CC"),
}
MARCAS = [
    (re.compile(r"\[POR CONFIRMAR[^\]]*\]"), "#FFF2CC"),
    (re.compile(r"\[PROPUESTA\]"), "#DEEAF6"),
]
PAGINA_NUEVA_H2 = {"control de versiones", "aprobaciones", "índice", "indice"}
CONTINUACION_CUADRO = ("INSERTAR", "ARCHIVO:", "EN GOOGLE DOCS", "EN WORD")


def rgb(hexa):
    # Tres decimales bastan para distinguir los 256 niveles de cada canal
    hexa = hexa.lstrip("#")
    return {k: round(int(hexa[n:n + 2], 16) / 255, 3) for k, n in (("red", 0), ("green", 2), ("blue", 4))}


def color(hexa):
    return {"color": {"rgbColor": rgb(hexa)}}


def pt(valor):
    return {"magnitude": round(valor, 2), "unit": "PT"}


def borde(hexa, ancho, relleno=None):
    b = {"color": color(hexa), "width": pt(ancho), "dashStyle": "SOLID"}
    if relleno is not None:
        b["padding"] = pt(relleno)
    return b


def u16(texto):
    return len(texto.encode("utf-16-le")) // 2


def buscar_documento(datos):
    """Encuentra el objeto del documento aunque venga envuelto."""
    if isinstance(datos, dict):
        if "body" in datos or "tabs" in datos:
            return datos
        for valor in datos.values():
            encontrado = buscar_documento(valor)
            if encontrado:
                return encontrado
    if isinstance(datos, list):
        for valor in datos:
            encontrado = buscar_documento(valor)
            if encontrado:
                return encontrado
    if isinstance(datos, str) and datos.lstrip().startswith("{"):
        try:
            return buscar_documento(json.loads(datos))
        except ValueError:
            return None
    return None


def elegir_pestana(doc, tab_id):
    if "tabs" in doc and doc["tabs"]:
        pila = list(doc["tabs"])
        while pila:
            tab = pila.pop(0)
            tid = tab.get("tabProperties", {}).get("tabId")
            if tab_id is None or tid == tab_id:
                dt = tab.get("documentTab", {})
                return tid, dt.get("body", {}), dt.get("documentStyle", {}), dt.get("headers", {}), dt.get("footers", {})
            pila.extend(tab.get("childTabs", []))
        sys.exit("No existe la pestaña %s" % tab_id)
    return None, doc.get("body", {}), doc.get("documentStyle", {}), doc.get("headers", {}), doc.get("footers", {})


def texto_celda(celda):
    return "".join(texto_parrafo(e["paragraph"])[0] for e in celda.get("content", []) if "paragraph" in e).strip()


def texto_parrafo(parrafo):
    """Devuelve el texto y, por cada caracter, su indice en el documento."""
    texto, indices = [], []
    for el in parrafo.get("elements", []):
        corrida = el.get("textRun")
        if not corrida:
            continue
        pos = el.get("startIndex", 0)
        for ch in corrida.get("content", ""):
            texto.append(ch)
            indices.append(pos)
            pos += u16(ch)
    return "".join(texto), indices


def recorrer(contenido, en_tabla=False):
    """Produce (tipo, elemento) en orden, entrando a las celdas de las tablas."""
    for el in contenido:
        if "paragraph" in el:
            yield ("parrafo", el, en_tabla)
        elif "table" in el:
            yield ("tabla", el, en_tabla)
            for fila in el["table"].get("tableRows", []):
                for celda in fila.get("tableCells", []):
                    for sub in recorrer(celda.get("content", []), True):
                        yield sub


def rango(inicio, fin, tab):
    r = {"startIndex": inicio, "endIndex": fin}
    if tab:
        r["tabId"] = tab
    return r


def ubicacion(indice, tab):
    u = {"index": indice}
    if tab:
        u["tabId"] = tab
    return u


def generar(doc, args):
    tab, cuerpo, estilo_doc, encabezados, pies = elegir_pestana(doc, args.tab)
    perfil = dict(PERFILES[args.perfil])
    if args.fuente:
        perfil["fuente"] = args.fuente
    ancho, alto = PAPEL[args.papel]
    sup, der, inf, izq = (m * CM for m in perfil["margenes"])
    ancho_util = ancho - izq - der
    contenido = cuerpo.get("content", [])
    fin_cuerpo = contenido[-1]["endIndex"] if contenido else 1
    avisos = []
    req = []

    modo = estilo_doc.get("documentFormat", {}).get("documentMode")
    if modo == "PAGELESS":
        avisos.append("El documento está en modo sin páginas. Pide al usuario Archivo > Configurar página > Páginas antes de aplicar el formato.")

    # 1. Pagina y margenes
    peticion = {
        "updateDocumentStyle": {
            "documentStyle": {
                "pageSize": {"width": pt(ancho), "height": pt(alto)},
                "marginTop": pt(sup), "marginBottom": pt(inf),
                "marginLeft": pt(izq), "marginRight": pt(der),
                "marginHeader": pt(1.25 * CM), "marginFooter": pt(1.25 * CM),
                "useFirstPageHeaderFooter": True,
            },
            "fields": "pageSize,marginTop,marginBottom,marginLeft,marginRight,marginHeader,marginFooter,useFirstPageHeaderFooter",
        }
    }
    if tab:
        peticion["updateDocumentStyle"]["tabId"] = tab
    req.append(peticion)

    # 2. Fuente y tamano base en todo el cuerpo
    if fin_cuerpo > 2:
        req.append({"updateTextStyle": {
            "range": rango(1, fin_cuerpo - 1, tab),
            "textStyle": {"weightedFontFamily": {"fontFamily": perfil["fuente"]}, "fontSize": pt(perfil["cuerpo"])},
            "fields": "weightedFontFamily,fontSize",
        }})
        # Estilo base del parrafo en una sola peticion. Titulos, listas, tablas y
        # cuadros lo reemplazan despues. No incluye la sangria de primera linea,
        # porque sobre una lista borraria la sangria de las vinetas.
        req.append({"updateParagraphStyle": {
            "range": rango(1, fin_cuerpo, tab),
            "paragraphStyle": {
                "lineSpacing": perfil["interlineado"], "spaceAbove": pt(0), "spaceBelow": pt(6),
                "alignment": perfil["alineacion"], "avoidWidowAndOrphan": True,
            },
            "fields": "lineSpacing,spaceAbove,spaceBelow,alignment,avoidWidowAndOrphan",
        }})

    elementos = list(recorrer(contenido))
    primer_titulo = True
    tras_indice = False
    lista_abierta = None
    cuadro_previo = None

    def cerrar_lista():
        if lista_abierta:
            req.append({"updateParagraphStyle": {
                "range": rango(lista_abierta[0], lista_abierta[1], tab),
                "paragraphStyle": {"spaceBelow": pt(6)}, "fields": "spaceBelow",
            }})

    for tipo, el, en_tabla in elementos:
        if tipo != "parrafo" or en_tabla:
            continue
        p = el["paragraph"]
        inicio, fin = el["startIndex"], el["endIndex"]
        estilo = p.get("paragraphStyle", {}).get("namedStyleType", "NORMAL_TEXT")
        texto, indices = texto_parrafo(p)
        limpio = texto.strip()

        # Lista: sin espacio entre elementos y 6 pt despues del ultimo
        if "bullet" in p:
            req.append({"updateParagraphStyle": {
                "range": rango(inicio, fin, tab),
                "paragraphStyle": {"spaceAbove": pt(0), "spaceBelow": pt(0), "lineSpacing": perfil["interlineado"]},
                "fields": "spaceAbove,spaceBelow,lineSpacing",
            }})
            lista_abierta = (inicio, fin)
            cuadro_previo = None
            continue
        cerrar_lista()
        lista_abierta = None

        if estilo in TITULOS:
            if primer_titulo and estilo == "HEADING_1" and not re.match(r"^\d", limpio):
                req.append({"updateParagraphStyle": {
                    "range": rango(inicio, fin, tab),
                    "paragraphStyle": {"namedStyleType": "TITLE"}, "fields": "namedStyleType",
                }})
                estilo = "TITLE"
            primer_titulo = False
            cuadro_previo = None
            tam, antes, despues, cursiva = TITULOS[estilo]
            salto = False
            if estilo == "HEADING_1":
                salto = True
            elif estilo == "HEADING_2" and (limpio.lower() in PAGINA_NUEVA_H2 or tras_indice):
                salto = True
                tras_indice = limpio.lower() in ("índice", "indice")
            req.append({"updateParagraphStyle": {
                "range": rango(inicio, fin, tab),
                "paragraphStyle": {
                    "spaceAbove": pt(0 if salto else antes), "spaceBelow": pt(despues),
                    "keepWithNext": True, "keepLinesTogether": True, "pageBreakBefore": salto,
                    "alignment": "START", "lineSpacing": 100, "indentFirstLine": pt(0),
                },
                "fields": "spaceAbove,spaceBelow,keepWithNext,keepLinesTogether,pageBreakBefore,alignment,lineSpacing,indentFirstLine",
            }})
            if fin - 1 > inicio:
                req.append({"updateTextStyle": {
                    "range": rango(inicio, fin - 1, tab),
                    "textStyle": {"fontSize": pt(tam), "bold": True, "italic": cursiva, "foregroundColor": color("#000000")},
                    "fields": "fontSize,bold,italic,foregroundColor",
                }})
            continue

        primer_titulo = False
        cuadro = next((c for pref, c in CUADROS.items() if limpio.upper().startswith(pref)), None)
        # Si Drive convirtio los <br> del cuadro en parrafos aparte, las lineas
        # que siguen al rotulo forman parte del mismo cuadro.
        if not cuadro and cuadro_previo and limpio.upper().startswith(CONTINUACION_CUADRO):
            cuadro = cuadro_previo
        cuadro_previo = cuadro
        if cuadro:
            borde_hex, fondo_hex = cuadro
            req.append({"updateParagraphStyle": {
                "range": rango(inicio, fin, tab),
                "paragraphStyle": {
                    "shading": {"backgroundColor": color(fondo_hex)},
                    "borderLeft": borde(borde_hex, 3, 6),
                    "spaceAbove": pt(6), "spaceBelow": pt(12), "indentFirstLine": pt(0),
                    "lineSpacing": 100, "alignment": "START", "keepLinesTogether": True,
                },
                "fields": "shading,borderLeft,spaceAbove,spaceBelow,indentFirstLine,lineSpacing,alignment,keepLinesTogether",
            }})
            continue

        # El parrafo normal ya tiene el estilo base del paso 2. Solo los perfiles
        # academicos le agregan sangria de primera linea.
        if perfil["sangria"]:
            req.append({"updateParagraphStyle": {
                "range": rango(inicio, fin, tab),
                "paragraphStyle": {"indentFirstLine": pt(perfil["sangria"] * CM)},
                "fields": "indentFirstLine",
            }})
    cerrar_lista()

    # 3. Tablas
    tablas = [el for tipo, el, _ in elementos if tipo == "tabla"]
    for t in tablas:
        inicio_t = t["startIndex"]
        tabla = t["table"]
        filas = tabla.get("tableRows", [])
        n_filas, n_cols = tabla.get("rows", len(filas)), tabla.get("columns", 0)
        if not filas or not n_cols:
            continue
        loc = ubicacion(inicio_t, tab)

        def celda_rango(f0, c0, nf, nc):
            return {"tableCellLocation": {"tableStartLocation": loc, "rowIndex": f0, "columnIndex": c0},
                    "rowSpan": nf, "columnSpan": nc}

        texto_primera = texto_celda(filas[0]["tableCells"][0])
        primera_celda = filas[0]["tableCells"][0]["content"][0]["startIndex"]
        fin_t = filas[-1]["tableCells"][-1]["content"][-1]["endIndex"]

        # Una tabla de una sola celda es un cuadro destacado (md_a_html.py
        # convierte asi cada cita ">"). Se reconoce por su forma, no por su texto.
        if n_filas == 1 and n_cols == 1:
            borde_hex, fondo_hex = next(
                (c for pref, c in CUADROS.items() if texto_primera.upper().startswith(pref)), CUADROS["[ESPACIO"]
            )
            invisible = borde(fondo_hex, 0.5)
            req.append({"updateTableCellStyle": {
                "tableStartLocation": loc,
                "tableCellStyle": {
                    "backgroundColor": color(fondo_hex), "borderLeft": borde(borde_hex, 3),
                    "borderTop": invisible, "borderBottom": invisible, "borderRight": invisible,
                    "paddingTop": pt(6), "paddingBottom": pt(6), "paddingLeft": pt(8), "paddingRight": pt(8),
                },
                "fields": "backgroundColor,borderLeft,borderTop,borderBottom,borderRight,paddingTop,paddingBottom,paddingLeft,paddingRight",
            }})
            req.append({"updateTableRowStyle": {
                "tableStartLocation": loc, "tableRowStyle": {"preventOverflow": True}, "fields": "preventOverflow",
            }})
            req.append({"updateParagraphStyle": {
                "range": rango(primera_celda, fin_t, tab),
                "paragraphStyle": {"lineSpacing": 100, "spaceAbove": pt(0), "spaceBelow": pt(0),
                                   "indentFirstLine": pt(0), "alignment": "START"},
                "fields": "lineSpacing,spaceAbove,spaceBelow,indentFirstLine,alignment",
            }})
            req.append({"updateTextStyle": {
                "range": rango(primera_celda, fin_t - 1, tab),
                "textStyle": {"fontSize": pt(10)}, "fields": "fontSize",
            }})
            continue

        es_cuadro = texto_primera == "Aspecto" and n_cols == 2

        # El cuadro de funcionalidad no se parte entre paginas, asi que no
        # necesita encabezado fijo. Las demas tablas si.
        if not es_cuadro:
            req.append({"pinTableHeaderRows": {"tableStartLocation": loc, "pinnedHeaderRowsCount": 1}})
        req.append({"updateTableRowStyle": {
            "tableStartLocation": loc, "tableRowStyle": {"preventOverflow": True}, "fields": "preventOverflow",
        }})
        gris = borde("#A6A6A6", 0.5)
        req.append({"updateTableCellStyle": {
            "tableStartLocation": loc,
            "tableCellStyle": {
                "borderTop": gris, "borderBottom": gris, "borderLeft": gris, "borderRight": gris,
                "paddingTop": pt(0.1 * CM), "paddingBottom": pt(0.1 * CM),
                "paddingLeft": pt(0.19 * CM), "paddingRight": pt(0.19 * CM),
                "contentAlignment": "TOP",
            },
            "fields": "borderTop,borderBottom,borderLeft,borderRight,paddingTop,paddingBottom,paddingLeft,paddingRight,contentAlignment",
        }})
        req.append({"updateTableCellStyle": {
            "tableRange": celda_rango(0, 0, 1, n_cols),
            "tableCellStyle": {"backgroundColor": color("#D9D9D9")}, "fields": "backgroundColor",
        }})
        if es_cuadro and n_filas > 1:
            req.append({"updateTableCellStyle": {
                "tableRange": celda_rango(1, 0, n_filas - 1, 1),
                "tableCellStyle": {"backgroundColor": color("#F2F2F2")}, "fields": "backgroundColor",
            }})
            req.append({"updateTableColumnProperties": {
                "tableStartLocation": loc, "columnIndices": [0],
                "tableColumnProperties": {"widthType": "FIXED_WIDTH", "width": pt(3 * CM)}, "fields": "widthType,width",
            }})
            req.append({"updateTableColumnProperties": {
                "tableStartLocation": loc, "columnIndices": [1],
                "tableColumnProperties": {"widthType": "FIXED_WIDTH", "width": pt(ancho_util - 3 * CM)}, "fields": "widthType,width",
            }})
        elif n_filas > 10:
            for f in range(2, n_filas, 2):
                req.append({"updateTableCellStyle": {
                    "tableRange": celda_rango(f, 0, 1, n_cols),
                    "tableCellStyle": {"backgroundColor": color("#F2F2F2")}, "fields": "backgroundColor",
                }})

        # Texto de la tabla: 10 pt, interlineado sencillo, 2 pt antes y despues.
        # La negrita del encabezado y de las etiquetas ya viene del HTML.
        req.append({"updateParagraphStyle": {
            "range": rango(primera_celda, fin_t, tab),
            "paragraphStyle": {"lineSpacing": 100, "spaceAbove": pt(2), "spaceBelow": pt(2),
                               "indentFirstLine": pt(0), "alignment": "START"},
            "fields": "lineSpacing,spaceAbove,spaceBelow,indentFirstLine,alignment",
        }})
        req.append({"updateTextStyle": {
            "range": rango(primera_celda, fin_t - 1, tab),
            "textStyle": {"fontSize": pt(10)}, "fields": "fontSize",
        }})
        for nf, fila in enumerate(filas):
            for nc, celda in enumerate(fila.get("tableCells", [])):
                if not texto_celda(celda):
                    avisos.append("Tabla en el índice %d tiene la celda fila %d, columna %d vacía. Escribe \"—\" o \"No aplica\"." % (inicio_t, nf + 1, nc + 1))

    # 4. Marcas en linea, dentro y fuera de tablas
    for tipo, el, _ in elementos:
        if tipo != "parrafo":
            continue
        texto, indices = texto_parrafo(el["paragraph"])
        for patron, fondo in MARCAS:
            for m in patron.finditer(texto):
                ini = indices[m.start()]
                fin = indices[m.end() - 1] + u16(texto[m.end() - 1])
                req.append({"updateTextStyle": {
                    "range": rango(ini, fin, tab),
                    "textStyle": {"backgroundColor": color(fondo), "weightedFontFamily": {"fontFamily": "Courier New"}},
                    "fields": "backgroundColor,weightedFontFamily",
                }})

    # 5. Parrafo final. Docs exige un parrafo vacio despues de una tabla que
    # cierra el documento, y con el tamano normal ese parrafo puede caer solo en
    # una pagina en blanco. Se reduce a 1 pt.
    if len(contenido) >= 2 and "table" in contenido[-2] and "paragraph" in contenido[-1]:
        final = contenido[-1]
        if not texto_parrafo(final["paragraph"])[0].strip():
            req.append({"updateParagraphStyle": {
                "range": rango(final["startIndex"], final["endIndex"], tab),
                "paragraphStyle": {"spaceAbove": pt(0), "spaceBelow": pt(0), "lineSpacing": 100},
                "fields": "spaceAbove,spaceBelow,lineSpacing",
            }})
            req.append({"updateTextStyle": {
                "range": rango(final["startIndex"], final["endIndex"], tab),
                "textStyle": {"fontSize": pt(1)}, "fields": "fontSize",
            }})

    # 6. Encabezado y pie
    id_enc = estilo_doc.get("defaultHeaderId")
    id_pie = estilo_doc.get("defaultFooterId")
    textos = [
        (id_enc, encabezados, "%s · Doc. de requerimientos v%s" % (args.sistema, args.version)),
        (id_pie, pies, args.clasificacion),
    ]
    if not id_enc or not id_pie:
        avisos.append("Falta el encabezado o el pie. Ejecuta primero el lote de --crear-encabezados y vuelve a leer el documento.")
    for seg_id, segmentos, texto in textos:
        if not seg_id or not texto:
            continue
        seg = segmentos.get(seg_id, {})
        actual = "".join(
            texto_parrafo(e["paragraph"])[0] for e in seg.get("content", []) if "paragraph" in e
        ).strip()
        if actual:
            avisos.append("El segmento %s ya tiene texto (\"%s\"). No se modifica." % (seg_id, actual[:60]))
            continue
        loc = {"segmentId": seg_id, "index": 0}
        if tab:
            loc["tabId"] = tab
        req.append({"insertText": {"location": loc, "text": texto}})
        r = {"segmentId": seg_id, "startIndex": 0, "endIndex": u16(texto)}
        if tab:
            r["tabId"] = tab
        req.append({"updateTextStyle": {
            "range": r,
            "textStyle": {"fontSize": pt(9), "foregroundColor": color("#595959"),
                          "weightedFontFamily": {"fontFamily": perfil["fuente"]}},
            "fields": "fontSize,foregroundColor,weightedFontFamily",
        }})

    return fusionar(req), avisos, len(tablas)


def fusionar(req):
    """Une peticiones de estilo seguidas que aplican lo mismo a rangos contiguos.

    Cada parrafo normal genera su propia peticion, y en un documento de 40
    paginas eso son cientos. Unirlas reduce los lotes que hay que enviar.
    """
    salida = []
    for r in req:
        tipo = next(iter(r))
        previa = salida[-1] if salida else None
        if (
            previa is not None
            and tipo in ("updateParagraphStyle", "updateTextStyle")
            and next(iter(previa)) == tipo
        ):
            a, b = previa[tipo], r[tipo]
            ra, rb = a["range"], b["range"]
            mismo_estilo = {k: v for k, v in a.items() if k != "range"} == {k: v for k, v in b.items() if k != "range"}
            mismo_segmento = {k: v for k, v in ra.items() if k not in ("startIndex", "endIndex")} == {
                k: v for k, v in rb.items() if k not in ("startIndex", "endIndex")
            }
            if mismo_estilo and mismo_segmento and ra["endIndex"] == rb["startIndex"]:
                ra["endIndex"] = rb["endIndex"]
                continue
        salida.append(r)
    return salida


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("doc_json")
    ap.add_argument("--sistema", default="Sistema")
    ap.add_argument("--version", default="1.0")
    ap.add_argument("--perfil", choices="ABC", default="A")
    ap.add_argument("--papel", choices=PAPEL, default="carta")
    ap.add_argument("--fuente")
    ap.add_argument("--clasificacion", default="Uso interno")
    ap.add_argument("--tab")
    ap.add_argument("--salida", default="lote")
    # 60 peticiones pesan unos 20 KB, lo que cabe en una sola llamada al MCP y en
    # una sola salida de consola para copiarlas sin cortes
    ap.add_argument("--max", type=int, default=60, help="peticiones por lote")
    ap.add_argument("--crear-encabezados", action="store_true")
    ap.add_argument("--salto-antes", help="codigos separados por coma (F1.2,F2.3) que revisar_paginas.py marco como cuadros partidos")
    args = ap.parse_args()

    try:
        with open(args.doc_json, encoding="utf-8") as f:
            crudo = f.read()
    except FileNotFoundError:
        sys.exit("No existe %s. Guarda ahí el resultado de read_doc y vuelve a ejecutar." % args.doc_json)
    try:
        datos = json.loads(crudo)
    except ValueError:
        # El resultado guardado puede traer texto antes del JSON
        inicio = crudo.find("{")
        try:
            datos = json.loads(crudo[inicio:]) if inicio >= 0 else None
        except ValueError:
            sys.exit("%s no contiene un JSON válido. Vuelve a leer el documento con read_doc y guarda el resultado completo." % args.doc_json)
    doc = buscar_documento(datos)
    if not doc:
        sys.exit("No encontré un documento de Google Docs en %s" % args.doc_json)
    revision = doc.get("revisionId")

    if args.crear_encabezados:
        _, _, estilo_doc, _, _ = elegir_pestana(doc, args.tab)
        req = []
        if not estilo_doc.get("defaultHeaderId"):
            req.append({"createHeader": {"type": "DEFAULT"}})
        if not estilo_doc.get("defaultFooterId"):
            req.append({"createFooter": {"type": "DEFAULT"}})
        nombre = "%s-encabezados.json" % args.salida
        with open(nombre, "w", encoding="utf-8") as f:
            json.dump({"requests": req}, f, ensure_ascii=False, indent=1)
        print("%s: %d peticiones" % (nombre, len(req)))
        return

    if args.salto_antes:
        tab, cuerpo, _, _, _ = elegir_pestana(doc, args.tab)
        pedidos = [c.strip() for c in args.salto_antes.split(",") if c.strip()]
        req, hallados = [], set()
        contenido = cuerpo.get("content", [])
        es_titulo = lambda e: "paragraph" in e and e["paragraph"].get("paragraphStyle", {}).get("namedStyleType", "").startswith("HEADING")
        for i, el in enumerate(contenido):
            if "paragraph" not in el:
                continue
            texto = texto_parrafo(el["paragraph"])[0].strip()
            for codigo in pedidos:
                if re.match(re.escape(codigo) + r"\s+—", texto):
                    hallados.add(codigo)
                    # Los titulos seguidos estan encadenados con "conservar con el
                    # siguiente". Si el salto va en el ultimo, el anterior queda
                    # solo en su pagina, asi que va en el primero de la cadena.
                    j = i
                    while j > 0 and es_titulo(contenido[j - 1]):
                        j -= 1
                    destino = contenido[j]
                    req.append({"updateParagraphStyle": {
                        "range": rango(destino["startIndex"], destino["endIndex"], tab),
                        "paragraphStyle": {"pageBreakBefore": True, "spaceAbove": pt(0)},
                        "fields": "pageBreakBefore,spaceAbove",
                    }})
        nombre = "%s-saltos.json" % args.salida
        with open(nombre, "w", encoding="utf-8") as f:
            json.dump({"requests": req}, f, ensure_ascii=False, separators=(",", ":"))
        print("%s: %d peticiones" % (nombre, len(req)))
        for codigo in pedidos:
            if codigo not in hallados:
                print("AVISO: no encontré el título de %s en el documento." % codigo)
        return

    req, avisos, n_tablas = generar(doc, args)
    lotes =[req[i:i + args.max] for i in range(0, len(req), args.max)] or [[]]
    for n, lote in enumerate(lotes, 1):
        cuerpo = {"requests": lote}
        if n == 1 and revision:
            cuerpo["writeControl"] = {"requiredRevisionId": revision}
        nombre = "%s-%02d.json" % (args.salida, n)
        with open(nombre, "w", encoding="utf-8") as f:
            json.dump(cuerpo, f, ensure_ascii=False, separators=(",", ":"))
        print("%s: %d peticiones" % (nombre, len(lote)))
    print("Tablas formateadas: %d" % n_tablas)
    for a in avisos:
        print("AVISO: " + a)


if __name__ == "__main__":
    main()
