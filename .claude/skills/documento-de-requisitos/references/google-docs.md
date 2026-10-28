# Generar el documento en Google Docs

Flujo para entregar el documento como Google Doc con el MCP de Google Drive y Google Docs. Si la sesión tiene la skill `google-workspace`, léela antes de la primera llamada, porque explica cómo se comportan los índices del API y cómo se verifica el resultado. Este archivo no repite esas reglas.

El Markdown de `salida/` es la fuente. El Google Doc se genera a partir de él. Una corrección grande se hace en el Markdown y se vuelve a generar el documento, salvo que el documento ya tenga comentarios (ver "Actualizar un documento existente" en SKILL.md).

Los scripts están en la carpeta `scripts/` de esta skill. Las rutas de abajo son relativas a la carpeta de la skill, que la sesión informa al cargarla. Requieren Python 3.8 o posterior. `md_a_html.py` y `gdocs_formato.py` no usan librerías externas; `revisar_paginas.py` necesita PyMuPDF (`pip install pymupdf`).

Este flujo se probó de punta a punta con el conector: creación desde HTML, encabezado y pie, y los 10 tipos de petición que usa el script, sin errores.

Herramientas del MCP que usa este flujo, con su nombre completo en Claude Code.

| Paso | Herramienta |
|---|---|
| Buscar la carpeta de Drive | Google Drive `search_files` (`mcp__claude_ai_Google_Drive__search_files`) |
| Crear el documento | Google Drive `create_file` (`mcp__claude_ai_Google_Drive__create_file`) |
| Leer la estructura con índices | Google Docs `read_doc` (`mcp__claude_ai_Google_Docs__read_doc`) |
| Aplicar el formato | Google Docs `update_doc` (`mcp__claude_ai_Google_Docs__update_doc`) |
| Verificar el texto | Google Drive `read_file_content` (`mcp__claude_ai_Google_Drive__read_file_content`) |

Copia esta lista y márcala a medida que avanzas.

```
- [ ] 1. Markdown revisado y convertido a HTML, avisos de enlaces resueltos
- [ ] 2. Documento creado en Drive
- [ ] 3. Encabezado y pie creados
- [ ] 4. Lotes de formato enviados, avisos atendidos
- [ ] 5. Paginación revisada hasta "Sin cuadros partidos"
- [ ] 6. Enlace y pasos manuales entregados
```

Los resultados grandes del MCP (`read_doc`, la exportación a PDF) no caben en la conversación y la sesión los guarda en un archivo cuya ruta informa. Los scripts leen esos archivos tal como quedan guardados, sin convertirlos.

---

## Lo que el MCP hace y lo que no

| Se hace con el MCP | Lo hace la persona en Google Docs |
|---|---|
| Crear el documento a partir de HTML, con títulos, párrafos, listas, tablas, negrita y enlaces | Pegar los diagramas en sus espacios rotulados |
| Página, márgenes, fuentes, interlineado y espacios | Insertar la tabla de contenido (Insertar > Tabla de contenido) |
| Saltos de página antes de cada Título 1, "conservar con el siguiente" en los títulos | Insertar los números de página (Insertar > Números de página) |
| Bordes, rellenos y fondos de tablas, fila de encabezado fija, filas que no se parten | Cambiar los estilos de párrafo con nombre, si se quieren permanentes |
| Cuadros destacados, marcas `[POR CONFIRMAR]` y `[PROPUESTA]` resaltadas | Revisar y aprobar el documento |
| Texto del encabezado y del pie | — |

**Las imágenes no se insertan.** `insertInlineImage` solo acepta una URL pública, y un diagrama del equipo no debe publicarse en internet para eso. Cada espacio de diagrama dice qué archivo va ahí, y la persona lo pega desde la carpeta.

---

## Paso 1 — Preparar el Markdown

1. El documento completo ya está escrito en `salida/` y pasó la revisión final de la skill.
2. Cada espacio de diagrama tiene su línea `Archivo:` con la ruta del archivo de la carpeta, o `Archivo: no encontrado en la carpeta`.
3. Convierte el Markdown a HTML.

```bash
python scripts/md_a_html.py salida/<nombre>.md salida/<nombre>.html
```

El script arma el cuadro de funcionalidad de dos columnas con los párrafos **Qué:**, **Cómo:** y **Para qué:**, y convierte cada cita `>` en una tabla de una celda, que el script de formato reconoce como cuadro destacado.

4. **Enlaces relativos.** Si el script avisa de enlaces relativos (`bpmn/modulo-1.bpmn`, `../docs/arquitectura.md`), esos enlaces no funcionarían en Google Docs y quedaron como ruta en texto. Muestra la lista al usuario. Si los archivos están en Drive, búscalos con `search_files`, reemplaza cada ruta por su enlace de Drive en el Markdown y vuelve a convertir. Si no están, la ruta en texto se queda.

## Paso 2 — Crear el Google Doc

Llama a Google Drive `create_file`.

- `title` sigue la convención de nombres de la skill de formato, por ejemplo `2026-10-25_Flota_DocRequerimientos_v1.0`.
- `contentMimeType` es `text/html`, y `textContent` es el contenido completo del archivo HTML.
- `parentId` es la carpeta de Drive del proyecto, si el usuario la indicó. Búscala con `search_files` (`mimeType = 'application/vnd.google-apps.folder' and title contains '...'`). Si no la indicó, el documento se crea en Mi unidad, y se le dice al usuario.

Guarda el `id` que devuelve, porque es el `documentId` de las llamadas siguientes. Un documento de unas 40 páginas produce cerca de 90 KB de HTML, que caben en una sola llamada.

## Paso 3 — Encabezado y pie

1. Lee el documento con `read_doc`. Si el resultado llega guardado en un archivo, usa esa ruta. Si llega en línea, guárdalo como `salida/doc.json`.
2. Genera el lote que crea el encabezado y el pie, si faltan.

```bash
python scripts/gdocs_formato.py salida/doc.json --crear-encabezados --salida salida/lote
```

3. Si `salida/lote-encabezados.json` tiene peticiones, envíalas con `update_doc` y vuelve a leer el documento. Si tiene cero, sigue.

## Paso 4 — Aplicar el formato

```bash
python scripts/gdocs_formato.py salida/doc.json \
  --sistema "<Nombre del sistema>" --version <X.Y> \
  --perfil A --papel carta --clasificacion "Uso interno" \
  --salida salida/lote
```

- `--perfil` es A, B o C, según la sección 1 de la skill de formato. Por defecto es A.
- `--fuente` cambia la fuente del perfil. En el perfil A se usa Arial, porque Google Docs la tiene en todos los equipos. Calibri también existe en Docs y se puede usar si el usuario la pide.
- `--tab` es necesario si el documento tiene varias pestañas.

El script escribe `lote-01.json`, `lote-02.json`, y así sucesivamente, con hasta 60 peticiones cada uno (unos 20 KB). Ese tamaño cabe en una sola salida de consola para copiarlo completo a `update_doc`; un lote más grande se corta al imprimirlo. Un documento de 12 páginas produce 4 lotes, y uno de 40 páginas con 50 tablas, unos 13.

1. **Sonda.** La primera vez que se usa el flujo en una sesión, envía antes una petición de cada tipo del `lote-01.json`, con su `writeControl`. Si un tipo falla, falla solo la sonda y se corrige ese tipo. Las peticiones de estilo se pueden repetir sin efecto, así que reenviarlas después no hace daño.
2. **Lotes.** Imprime cada lote con `python -c "import json,sys; print(json.dumps(json.load(open(sys.argv[1],encoding='utf-8'))['requests'],ensure_ascii=False,separators=(',',':')))" salida/lote-01.json` y envíalo con `update_doc`, en orden. Solo el primer lote lleva `writeControl`, y solo si no se envió la sonda, porque la sonda cambia la revisión. Todas las peticiones son de estilo y no mueven índices, por eso los lotes siguientes no necesitan volver a leer el documento.

Lee los avisos que imprime el script.

- **Celda vacía.** Corrige el Markdown con "—" o "No aplica" y vuelve a generar el documento, o escribe el valor en la celda con `update_doc`.
- **Modo sin páginas.** Pide al usuario que cambie a páginas (Archivo > Configuración de página > Páginas) antes de aplicar el formato, porque en ese modo no se ven márgenes, encabezado ni pie.

Si `update_doc` rechaza un lote, no se aplica ninguna petición de ese lote. Lee el error, que indica el número de la petición que falló. Quita esa petición, vuelve a enviar el lote y avisa al usuario qué parte del formato quedó pendiente. Las peticiones siguen la referencia oficial del API de Google Docs, pero no todas se han probado con este conector.

## Paso 5 — Verificar la paginación

Google Docs no permite mantener una tabla entera en una página. Las filas no se parten, pero un cuadro de funcionalidad sí puede quedar partido entre dos páginas, y eso contradice la regla 8.5 de la skill de formato. La única corrección es un salto de página antes del título de esa funcionalidad, y para saber dónde hace falta hay que mirar el PDF.

1. Exporta con `download_file_content` (`exportMimeType: application/pdf`) y ejecuta el revisor sobre el archivo guardado.

```bash
python scripts/revisar_paginas.py <archivo de la exportación>
```

2. Si dice **"Sin cuadros partidos"** y no avisa de páginas en blanco o casi vacías, la paginación está lista.
3. Si informa cuadros partidos, aplica el salto **solo para el primero** y vuelve al punto 1. El salto desplaza todo lo que sigue, así que los demás cuadros pueden quedar bien solos o partirse en otro lugar.

```bash
python scripts/gdocs_formato.py salida/doc.json --tab t.0 --salto-antes F1.2 --salida salida/lote
```

El lote `lote-saltos.json` pone el salto en el primer título de la cadena. Si el título "Funcionalidades" va justo antes de F2.1, el salto va en "Funcionalidades" y no en F2.1, porque si no ese título queda solo en su página. Los índices de `doc.json` siguen sirviendo, porque los saltos no mueven texto.
4. Si avisa de una **página casi vacía**, casi siempre es un título que quedó solo por un salto mal puesto. Quita ese salto (`pageBreakBefore: false`) y ponlo en el título anterior.
5. Repite hasta 10 veces. Si después de eso quedan cuadros partidos, entrégalos en la lista de pasos manuales, porque un cuadro más largo que una página no tiene arreglo con saltos.

Para mirar las páginas con los ojos, sirve el script `render_export.py` de la skill `google-workspace` (necesita `pdftoppm`) o PyMuPDF (`page.get_pixmap(dpi=60).save(...)`).

**Al leer `read_doc` para verificar,** un estilo que coincide con el estilo con nombre del documento no aparece en el texto. En Docs el texto normal ya es Arial 11 y el Título 4 ya mide 12 pt, así que una fuente o un tamaño vacíos en esos párrafos no son una falla. Compáralos con `namedStyles` antes de concluir que algo no se aplicó.

Finalmente, lee el documento con `read_file_content` y revisa que los títulos estén completos, en orden y sin repetir.

## Paso 6 — Entregar

Responde con el enlace del documento y esta lista de pasos manuales, ya rellena.

```markdown
Documento: <enlace>

Pasos pendientes en Google Docs:
1. Insertar la tabla de contenido en el espacio "Índice" (Insertar > Tabla de contenido).
2. Insertar los números de página en el pie, a la derecha (Insertar > Números de página).
3. Pegar los diagramas en sus espacios.

| Espacio | Archivo |
|---|---|
| Diagrama BPMN del Módulo 1 | diagramas/modulo-01-registro-de-flota.png |
| Diagrama de base de datos | No encontrado en la carpeta |
```

Al pegar cada diagrama, el texto del espacio se borra y se escribe arriba de la imagen su número y título ("Figura N" y el título en cursiva). También se agrega el texto alternativo (clic derecho > Texto alternativo).
