# Cómo aplicar el formato en cada herramienta

Valores y pasos concretos para llevar las reglas de SKILL.md a cada herramienta. Las reglas mandan; este archivo solo dice cómo se logran.

## Contenido
- Markdown
- Word (.docx)
- PDF
- Google Docs

## Markdown

Markdown no controla márgenes, fuentes ni paginación, porque eso lo decide quien lo muestra o lo exporta. Lo que sí se controla es la estructura.

| Elemento | Markdown |
|---|---|
| Título del documento | `#` una sola vez |
| Título 1 | `#` con número, ej. `# 1. Funcionalidades` |
| Título 2 | `##` |
| Título 3 | `###` o `####`, siempre el mismo nivel para el mismo tipo de elemento |
| Negrita / cursiva / código | `**texto**` / `*texto*` / `` `texto` `` |
| Viñetas | `-` para el nivel 1; dos espacios y `-` para el nivel 2 |
| Numerada | `1.` en todos los elementos, porque el visor numera solo |
| Cuadro de funcionalidad | Tabla de dos columnas "Aspecto" y "Descripción" con filas **Qué**, **Cómo** y **Para qué** (ver 8.5) |
| Tabla | Tabla de GitHub con fila de encabezado y `:---`, `:---:` o `---:` para alinear a la izquierda, al centro o a la derecha |
| Cuadro destacado | Cita con `>` y la etiqueta en negrita, ej. `> **[ESPACIO — Diagrama BPMN del Módulo 1]**` |
| Separador de apartados | `---` antes de cada Título 1 |
| Enlace interno | `[F2.4](#f24--el-autor-adjunta-imágenes-a-la-publicación)` |

Al exportar a PDF o Word desde Markdown (por ejemplo con Pandoc), los valores de página y tipografía de esta skill se definen en la plantilla de referencia de la exportación.

## Word (.docx)

- **Configurar la página primero** (tamaño, márgenes, encabezado y pie) y después escribir.
- **Usar y modificar los estilos integrados** (Título 1, Título 2, Título 3, Normal, Título de tabla, Descripción), no crear estilos con formato directo. Los estilos integrados son los que alimentan el índice y el panel de navegación.
- **Secciones.** Una para la portada (sin encabezado), una para las preliminares (numeración romana), una para el cuerpo (numeración arábiga desde 1) y una sección horizontal por cada tabla o diagrama ancho.
- **Títulos de tablas y figuras** con "Insertar título" (Referencias → Insertar título), para que se numeren y entren al índice de tablas o figuras.
- **Tablas.** Marcar "Repetir como fila de encabezado" en la primera fila y desmarcar "Permitir que las filas se dividan entre páginas".
- **Valores para generar el documento por código.** Las herramientas que crean .docx trabajan en veinteavos de punto (twips), donde 1 cm equivale a 567 twips.

| Medida | Valor en twips |
|---|---|
| Página carta | 12 240 × 15 840 |
| Página A4 | 11 906 × 16 838 |
| Margen 2,5 cm | 1 418 |
| Margen 2,54 cm | 1 440 |
| Margen 3 cm | 1 701 |
| Margen 4 cm | 2 268 |
| Encabezado o pie a 1,25 cm | 709 |
| Sangría de viñeta 0,63 cm | 357 |

Si está disponible la skill `docx`, se usa para generar el archivo aplicando estos valores.

## PDF

- Se exporta desde Word o desde la herramienta de Markdown, nunca se imprime a PDF con una impresora virtual, porque se pierden los marcadores y los enlaces.
- Se activan los **marcadores a partir de los títulos**, para que el PDF tenga navegación lateral.
- Se incrustan las fuentes.
- Nombre del archivo con la forma `AAAA-MM-DD_NombreSistema_DocRequerimientos_vX.Y.pdf`, por ejemplo `2026-09-22_RedFaCyT_DocRequerimientos_v1.0.pdf`.

## Google Docs

El documento se genera con el MCP de Google Drive y Google Docs siguiendo `references/google-docs.md` de la skill `documento-de-requisitos`. El script `scripts/gdocs_formato.py` de esa skill traduce las reglas de esta skill a peticiones de `update_doc`, así que no se escriben a mano. Esta sección dice cómo queda cada regla en Google Docs.

**El documento va en modo páginas**, no en modo sin páginas, porque en ese modo no se ven márgenes, encabezado, pie ni saltos de página.

**Valores en puntos.** El API de Google Docs trabaja en puntos (pt), donde 1 cm equivale a 28,35 pt.

| Medida | Valor en puntos |
|---|---|
| Página carta | 612 × 792 |
| Página A4 | 595,28 × 841,89 |
| Margen 2,5 cm | 70,87 |
| Margen 2,54 cm | 72 |
| Margen 3 cm | 85,04 |
| Margen 4 cm | 113,39 |
| Encabezado o pie a 1,25 cm | 35,43 |
| Primera columna del cuadro de funcionalidad, 3 cm | 85,04 |
| Sangría de primera línea, 1,27 cm | 36 |

**Correspondencia de estilos.**

| Elemento de esta skill | En Google Docs |
|---|---|
| Título del documento | Estilo Título, 26 pt |
| Título 1 | Título 1, 16 pt, con salto de página antes |
| Título 2 (módulo) | Título 2, 14 pt |
| Título 3 (subsección, historia) | Título 3, 12 pt |
| Título 3 de funcionalidad (F1.1) | Título 4 con el mismo aspecto del Título 3, 12 pt. Va un nivel abajo para que el esquema del documento la muestre dentro de su módulo |
| Título 4 excepcional | Título 5, 11 pt, negrita cursiva |
| Fila de encabezado de tabla | Fila fijada (`pinTableHeaderRows`), que se repite en cada página |
| Fila que no se parte | `preventOverflow` en todas las filas |
| Cuadro destacado | Tabla de una sola celda con fondo de color y borde izquierdo de 3 pt. Se usa tabla y no párrafo porque Drive puede partir en varios párrafos el contenido de una cita, y una tabla se reconoce siempre por su forma |
| Fuente del perfil A | Arial, porque Google Docs la tiene en todos los equipos. Calibri también existe en Docs |

**Lo que el API no permite y se hace a mano.** El documento queda con estos pasos pendientes, y la entrega los lista.

- **Tabla de contenido.** Se inserta con Insertar > Tabla de contenido en el espacio "Índice".
- **Números de página.** Se insertan con Insertar > Números de página, en el pie y a la derecha. Escribirlos como texto haría que todas las páginas digan el mismo número. Para "Página X de Y", el total se agrega con la opción de recuento de páginas del mismo menú, si la versión de Docs la ofrece. Si no, el pie lleva solo el número.
- **Números romanos en las preliminares.** Las guías universitarias y los tutoriales recientes no coinciden en si Google Docs ofrece números romanos (Insertar > Números de página > Más opciones). Si la opción aparece, se usa con un salto de sección entre las preliminares y el cuerpo, y el cuerpo reinicia en 1. Si no aparece, todo el documento se numera con arábigos continuos, y se avisa al usuario cuando la entrega exige el perfil B.
- **Tabla entera en una página.** Google Docs no tiene opción para que una tabla no se parta entre páginas, y "conservar con el siguiente" en los párrafos de las celdas no tiene efecto (probado). Las filas sí se mantienen enteras con `preventOverflow`. Para que un cuadro de funcionalidad no quede partido, se pone un salto de página antes de su título. `scripts/revisar_paginas.py` de la skill `documento-de-requisitos` detecta en el PDF exportado qué cuadros quedaron partidos.
- **Párrafo final después de una tabla.** Docs exige un párrafo vacío al final del documento. Si el documento termina en tabla y ese párrafo no cabe, genera una página en blanco, así que se deja en 1 pt.
- **Imágenes.** El API solo inserta imágenes que estén en una URL pública, y los diagramas del proyecto no se publican. Cada espacio de diagrama dice qué archivo va ahí, y la persona lo pega desde Insertar > Imagen.
- **Estilos con nombre.** El API aplica un estilo pero no cambia su definición. Si el equipo quiere que los títulos nuevos salgan con este formato, se ajusta un título y se usa Formato > Estilos de párrafo > Título N > Actualizar para que coincida.
- **Encabezado con dos alineaciones.** El API no crea tabulaciones, así que el encabezado va en una línea, "Nombre del sistema · Doc. de requerimientos vX.Y", alineado a la izquierda. El pie lleva la clasificación a la izquierda y el número de página a la derecha.

**Exportación.** Para entregar un PDF se usa Archivo > Descargar > PDF, o `download_file_content` con `exportMimeType: application/pdf`. El nombre del archivo sigue la convención de la sección PDF.
