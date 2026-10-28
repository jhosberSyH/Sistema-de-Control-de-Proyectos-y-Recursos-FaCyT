#!/usr/bin/env python3
"""Convierte el Markdown del documento de requerimientos en HTML para Google Drive.

Drive convierte el HTML subido con create_file (contentMimeType text/html) en un
Google Doc nativo. Este script solo produce la estructura que Drive entiende
(titulos, parrafos, listas, tablas, negrita, cursiva, enlaces). Todo el formato
(margenes, fuentes, sombreados, filas fijas) lo aplica despues gdocs_formato.py
con el MCP de Google Docs.

Reglas de conversion:
- El primer "#" es el titulo del documento. Los demas "#" son Titulo 1.
- Las citas ">" se convierten en una tabla de una sola celda. gdocs_formato.py
  reconoce asi el cuadro destacado por su forma y no por su texto, de modo que
  sigue siendo cuadro cuando el espacio ya se lleno.
- Los enlaces relativos (bpmn/modulo-1.bpmn, ../docs/x.md) se rompen en Google
  Docs, porque no hay carpeta a la cual apuntar. Se escriben como ruta en texto
  monoespaciado y se listan al terminar.
- Los parrafos seguidos que empiezan con **Que:**, **Como:**, **Para que:** y los
  atributos opcionales (**Prioridad:**, **Origen:**, **Verificacion:**) se
  convierten en el cuadro de funcionalidad de dos columnas "Aspecto | Descripcion".
- "---" se omite, porque los saltos de pagina los pone gdocs_formato.py.

Uso:
    python md_a_html.py documento.md documento.html
"""

import html
import re
import sys

ETIQUETAS_CUADRO = ["Qué", "Cómo", "Para qué", "Prioridad", "Origen", "Verificación"]
RE_ETIQUETA = re.compile(r"^\*\*(" + "|".join(ETIQUETAS_CUADRO) + r"):\*\*\s*(.*)$", re.S)

# Drive no garantiza respetar el CSS en linea, y gdocs_formato.py aplica todo el
# formato despues. Por eso el HTML lleva solo estructura, y asi la llamada a
# create_file, que viaja con el archivo completo, pesa cerca de 40 % menos.

MONO = "<span style=\"font-family:'Courier New'\">%s</span>"
RE_ABSOLUTO = re.compile(r"^(https?:|mailto:|#)")
enlaces_relativos = []


def enlace(m):
    texto, destino = m.group(1), m.group(2)
    if RE_ABSOLUTO.match(destino):
        return '<a href="%s">%s</a>' % (destino, texto)
    enlaces_relativos.append(destino)
    if texto.strip() == destino.strip():
        return MONO % destino
    return "%s (%s)" % (texto, MONO % destino)


def en_linea(texto):
    """Aplica el formato en linea de Markdown sobre texto ya escapado."""
    texto = html.escape(texto, quote=False)
    texto = texto.replace("\\|", "|")
    codigos = []

    def guardar_codigo(m):
        codigos.append(m.group(1))
        return "\x00%d\x00" % (len(codigos) - 1)

    texto = re.sub(r"`([^`]+)`", guardar_codigo, texto)
    texto = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", enlace, texto)
    texto = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", texto)
    texto = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<i>\1</i>", texto)
    texto = re.sub(
        r"\x00(\d+)\x00",
        lambda m: MONO % codigos[int(m.group(1))],
        texto,
    )
    return texto


def partir_fila(linea):
    linea = linea.strip()
    if linea.startswith("|"):
        linea = linea[1:]
    if linea.endswith("|") and not linea.endswith("\\|"):
        linea = linea[:-1]
    return [c.strip() for c in re.split(r"(?<!\\)\|", linea)]


def es_separador(linea):
    return bool(re.match(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$", linea))


def tabla_html(filas):
    partes = ["<table>"]
    for i, fila in enumerate(filas):
        partes.append("<tr>")
        for celda in fila:
            if i == 0:
                partes.append("<td><b>%s</b></td>" % en_linea(celda))
            else:
                partes.append("<td>%s</td>" % (en_linea(celda) or "—"))
        partes.append("</tr>")
    partes.append("</table>")
    return "".join(partes)


def cuadro_funcionalidad(pares):
    partes = ["<table><tr><td><b>Aspecto</b></td><td><b>Descripción</b></td></tr>"]
    for etiqueta, texto in pares:
        partes.append("<tr><td><b>%s</b></td><td>%s</td></tr>" % (etiqueta, en_linea(texto) or "—"))
    partes.append("</table>")
    return "".join(partes)


def cuadro_destacado(lineas):
    return "<table><tr><td>%s</td></tr></table>" % "<br>".join(en_linea(l) for l in lineas)


def convertir(md):
    lineas = md.replace("\r\n", "\n").split("\n")
    salida = []
    parrafo = []
    pares_cuadro = []
    i = 0

    def cerrar_parrafo():
        if not parrafo:
            return
        texto = " ".join(l.strip() for l in parrafo)
        parrafo.clear()
        m = RE_ETIQUETA.match(texto)
        if m:
            pares_cuadro.append((m.group(1), m.group(2)))
            return
        cerrar_cuadro()
        salida.append("<p>%s</p>" % en_linea(texto))

    def cerrar_cuadro():
        if pares_cuadro:
            salida.append(cuadro_funcionalidad(pares_cuadro))
            pares_cuadro.clear()

    while i < len(lineas):
        linea = lineas[i]
        bloque = linea.strip()

        if not bloque:
            cerrar_parrafo()
            i += 1
            continue

        m = re.match(r"^(#{1,6})\s+(.*?)\s*#*\s*$", bloque)
        if m:
            cerrar_parrafo()
            cerrar_cuadro()
            nivel = len(m.group(1))
            salida.append("<h%d>%s</h%d>" % (nivel, en_linea(m.group(2)), nivel))
            i += 1
            continue

        if re.match(r"^(-{3,}|\*{3,}|_{3,})$", bloque):
            cerrar_parrafo()
            cerrar_cuadro()
            i += 1
            continue

        if bloque.startswith("|") and i + 1 < len(lineas) and es_separador(lineas[i + 1]):
            cerrar_parrafo()
            cerrar_cuadro()
            filas = [partir_fila(bloque)]
            i += 2
            while i < len(lineas) and lineas[i].strip().startswith("|"):
                filas.append(partir_fila(lineas[i]))
                i += 1
            if [c.strip("* ") for c in filas[0][:2]] == ["Aspecto", "Descripción"]:
                pares = [(f[0].strip("* "), f[1] if len(f) > 1 else "") for f in filas[1:]]
                salida.append(cuadro_funcionalidad(pares))
            else:
                salida.append(tabla_html(filas))
            continue

        if bloque.startswith(">"):
            cerrar_parrafo()
            cerrar_cuadro()
            citas = []
            while i < len(lineas) and lineas[i].strip().startswith(">"):
                contenido = re.sub(r"^\s*>\s?", "", lineas[i]).strip()
                if contenido:
                    citas.append(contenido)
                i += 1
            if citas:
                salida.append(cuadro_destacado(citas))
            continue

        m = re.match(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$", linea)
        if m:
            cerrar_parrafo()
            cerrar_cuadro()
            pila = []
            while i < len(lineas):
                m = re.match(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$", lineas[i])
                if not m:
                    break
                nivel = 1 if len(m.group(1).replace("\t", "  ")) >= 2 else 0
                etiqueta = "ul" if m.group(2) in "-*+" else "ol"
                while len(pila) > nivel + 1:
                    salida.append("</%s>" % pila.pop())
                if len(pila) < nivel + 1:
                    salida.append("<%s>" % etiqueta)
                    pila.append(etiqueta)
                salida.append("<li>%s</li>" % en_linea(m.group(3)))
                i += 1
            while pila:
                salida.append("</%s>" % pila.pop())
            continue

        parrafo.append(linea)
        i += 1

    cerrar_parrafo()
    cerrar_cuadro()
    return (
        '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>'
        + "\n".join(salida)
        + "</body></html>"
    )


def main():
    if len(sys.argv) != 3:
        sys.exit("Uso: python md_a_html.py entrada.md salida.html")
    try:
        with open(sys.argv[1], encoding="utf-8") as f:
            md = f.read()
    except FileNotFoundError:
        sys.exit("No existe %s. Revisa la ruta del Markdown en salida/." % sys.argv[1])
    except UnicodeDecodeError:
        sys.exit("%s no está en UTF-8. Guárdalo como UTF-8 y vuelve a ejecutar." % sys.argv[1])
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        f.write(convertir(md))
    print("HTML generado en %s" % sys.argv[2])
    if enlaces_relativos:
        print("AVISO: %d enlaces relativos quedaron como texto, porque en Google Docs no funcionan." % len(enlaces_relativos))
        for destino in dict.fromkeys(enlaces_relativos):
            print("  - " + destino)
        print("Si esos archivos están en Drive, reemplaza cada ruta por su enlace de Drive en el Markdown.")


if __name__ == "__main__":
    main()
