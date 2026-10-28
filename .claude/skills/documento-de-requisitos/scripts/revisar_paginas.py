#!/usr/bin/env python3
"""Revisa la paginacion del PDF exportado de un Google Doc de requerimientos.

Google Docs no permite mantener una tabla entera en una pagina, asi que un
cuadro de funcionalidad puede quedar partido entre dos paginas aunque sus filas
no se partan. Este script detecta esos cuadros en el PDF exportado y dice antes
de que funcionalidad hay que poner un salto de pagina. Tambien detecta paginas
en blanco.

Entrada: el resultado guardado de download_file_content con exportMimeType
application/pdf (un JSON con el campo "content" en base64), o un archivo .pdf.

Uso:
    python revisar_paginas.py export.json

Requiere PyMuPDF (pip install pymupdf).

Salida: la lista de codigos para pasar a gdocs_formato.py --salto-antes, o
"Sin cuadros partidos".
"""

import base64
import json
import re
import sys

# Filas del cuadro de funcionalidad. Si una pagina empieza con una de estas
# etiquetas, el cuadro empezo en la pagina anterior.
FILAS_CUADRO = ("Qué", "Cómo", "Para qué", "Prioridad", "Origen", "Verificación")
RE_CODIGO = re.compile(r"^(F\d+\.\d+)\s+—")


def cargar_pdf(ruta):
    try:
        with open(ruta, "rb") as f:
            crudo = f.read()
    except FileNotFoundError:
        sys.exit("No existe %s. Usa la ruta donde la sesión guardó la exportación a PDF." % ruta)
    if crudo[:5] == b"%PDF-":
        return crudo
    try:
        datos = json.loads(crudo.decode("utf-8"))
    except ValueError:
        sys.exit("%s no es un PDF ni el JSON de download_file_content." % ruta)
    while isinstance(datos, dict) and "content" in datos:
        datos = datos["content"]
    if not isinstance(datos, str):
        sys.exit("No encontré el campo content con el PDF en base64 en %s." % ruta)
    return base64.b64decode("".join(datos.split()))


def main():
    if len(sys.argv) != 2:
        sys.exit("Uso: python revisar_paginas.py export.json")
    try:
        import pymupdf
    except ImportError:
        try:
            import fitz as pymupdf
        except ImportError:
            sys.exit("Falta PyMuPDF. Instálalo con: pip install pymupdf. Si no se puede, revisa el PDF a mano buscando cuadros partidos.")

    doc = pymupdf.open(stream=cargar_pdf(sys.argv[1]), filetype="pdf")
    partidos, en_blanco, casi_vacias = [], [], []
    ultimo_codigo = None
    for n, pagina in enumerate(doc, 1):
        lineas = [l.strip() for l in pagina.get_text().splitlines() if l.strip()]
        # La primera linea es el encabezado y la ultima el pie, salvo en la portada
        cuerpo = lineas[1:-1] if n > 1 and len(lineas) >= 2 else lineas
        if not cuerpo:
            en_blanco.append(n)
            continue
        # Dos lineas o menos en una pagina que no es la ultima suelen ser un
        # titulo que quedo solo porque el contenido que encabeza paso a la siguiente
        if len(cuerpo) <= 2 and n < doc.page_count:
            casi_vacias.append((n, cuerpo[0][:60]))
        if cuerpo[0] in FILAS_CUADRO and ultimo_codigo:
            partidos.append((ultimo_codigo, n))
        for linea in cuerpo:
            m = RE_CODIGO.match(linea)
            if m:
                ultimo_codigo = m.group(1)

    print("Páginas: %d" % doc.page_count)
    if en_blanco:
        print("Páginas en blanco: %s" % ", ".join(map(str, en_blanco)))
    for n, texto in casi_vacias:
        print("Página %d casi vacía, empieza con \"%s\". Revisa si un título quedó solo; quita el salto que lo dejó así o muévelo al primer título de la cadena." % (n, texto))
    if not partidos:
        print("Sin cuadros partidos")
        return
    for codigo, pagina in partidos:
        print("Cuadro partido: %s continúa en la página %d" % (codigo, pagina))
    # Solo el primero: el salto desplaza todo lo que sigue, asi que los demas
    # cuadros pueden quedar bien o partirse en otro lugar. Corregirlos todos de
    # una vez puede dejar paginas medio vacias.
    print("Siguiente paso: python gdocs_formato.py doc.json --salto-antes %s" % partidos[0][0])
    print("Después, exporta otra vez y vuelve a ejecutar este script.")


if __name__ == "__main__":
    main()
