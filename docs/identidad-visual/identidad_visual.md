# Identidad visual del Sistema de Control de Proyectos FaCyT

Fecha: 27 de octubre de 2026. Estado: **aprobado** el 28/10/2026.

> **Diseño aprobado:** la distribución de la dirección C (riel de íconos y encabezado editorial con el escudo, IBM Plex Sans + Plex Mono) con la paleta de la FaCyT de la dirección A. Sus tokens están en §5.1 y en `docs/mockups/_fuente/compartido/comun.css`. Las direcciones A, B, C y D de §2 y §5 se descartaron y quedan como registro de la comparación.

Este documento fija la paleta, las tipografías, los logos y las cuatro direcciones visuales (A, B, C y D) que se comparan en los mockups. La personalidad, el tono y los criterios de accesibilidad están en [`investigacion_usuarios.md`](../investigacion-ux/investigacion_usuarios.md) (§5 y §6). Aquí se aplican.

## 1. Qué encontramos de la identidad de la UC y de la FaCyT

### 1.1 Universidad de Carabobo

- **Colores oficiales, solo por nombre.** El sitio de la UC describe el escudo como "los tres colores oficiales de la Universidad, Oro, Verde y Púrpura". Ese texto lo vimos en el fragmento que muestra el buscador de uc.edu.ve/univ_ig_simbolos.php y fundabiomed.fcs.uc.edu.ve/escudo.html. No pudimos abrir esas páginas, así que no está verificado en el original.
- **El manual existe, pero no lo pudimos leer.** Se llama "Lineamientos de imagen y uso del escudo" (http://uc.edu.ve/archivos/pdf/MANUALIMAGENUC.pdf) y su hoja 2 trae la carta Pantone. uc.edu.ve no respondió desde nuestra red (falla de TLS y conexión cerrada) y la Wayback Machine devolvió 429. Por eso no tenemos valores Pantone, CMYK ni HEX oficiales.
- **El azul no es un color oficial de la UC.** Solo aparece en los rayos del cuartel superior derecho del escudo.
- **Valores extraídos del escudo publicado en odontologia.uc.edu.ve** (no son oficiales): oro `#D79C00`, púrpura `#850157`, verde `#008601`, amarillo `#FFFF01` y azul aproximado `#0045C8`. La copia de Wikimedia que aloja ing.uc.edu.ve trae otros tonos (oro `#A37413`, carmesí `#A41E36`, verde `#006953`), con el campo inferior carmesí en lugar de púrpura. Usamos los de odontología, porque coinciden con el texto oficial (púrpura).

### 1.2 FaCyT

- **No tiene paleta propia documentada.** No encontramos manual de identidad en su sitio ni en su biblioteca de medios.
- **Su color de hecho es el azul del logo, que el sitio usa como acento:**

| Color | HEX | De dónde sale |
|---|---|---|
| Azul FaCyT | `#0092D0` | Isotipo PNG oficial y CSS de www.facyt.uc.edu.ve (títulos, botones, enlaces). El JPG grande del logo da `#0093DD` |
| Azul noche | `#003A6A` | CSS del sitio: fondo del footer y del slider |
| Azul profundo | `#002858` | CSS del sitio: barra de copyright |
| Gris del isotipo | `#A9A9A9` | Logo oficial |

Detalle de cada archivo, URL y fecha en [`logos/FUENTES.md`](logos/FUENTES.md).

### 1.3 Decisión

Como la FaCyT no tiene paleta propia, **proponemos una combinación** basada en lo que sí es de las dos instituciones:

- **Azules de la FaCyT para la interfaz.** El azul noche `#003A6A` y el azul profundo `#002858` sirven de color primario: tienen contraste de sobra para texto y botones. El azul FaCyT `#0092D0` queda como acento de marca. Sobre blanco da 3,49:1, así que sirve para íconos, bordes, gráficos y texto de 24 px o más, pero no para texto normal.
- **Oro y púrpura de la UC como acentos universitarios.** El oro `#D79C00` da 2,43:1 sobre blanco: solo sirve como relleno con texto oscuro encima, en filetes o en insignias. El púrpura `#850157` da 9,82:1 y puede ser primario en una de las versiones.
- **El verde de la UC no se usa como color de marca.** En la interfaz, el verde significa "aprobado o completado" (tabla de estados de investigacion_usuarios.md §5.2), y mezclar los dos significados confunde.

Cuando consigamos el manual oficial, se reemplazan los HEX extraídos por los oficiales sin cambiar los roles.

## 2. Paleta por versión

Todos los pares se calcularon con la fórmula de luminancia relativa de WCAG 2.2 (script en el anexo). Cada versión cumple en claro y en oscuro: texto ≥ 4,5:1, bordes de campo y componentes ≥ 3:1, y texto sobre el color primario ≥ 4,5:1.

| Token | A claro | A oscuro | B claro | B oscuro | C claro | C oscuro | D claro | D oscuro |
|---|---|---|---|---|---|---|---|---|
| Fondo | `#F4F6F9` | `#0B1420` | `#F5F5F7` | `#111113` | `#FAF8F4` | `#141014` | `#FFFFFF` | `#05080F` |
| Superficie | `#FFFFFF` | `#13202F` | `#FFFFFF` | `#1C1C1E` | `#FFFFFF` | `#1F191E` | `#F1F4F8` | `#101826` |
| Texto | `#0F1B2D` | `#E8EEF5` | `#1D1D1F` | `#F5F5F7` | `#1E1A1D` | `#F3EEF1` | `#0A0F1A` | `#FFFFFF` |
| Texto secundario | `#4A5568` | `#A3B1C2` | `#5F5F66` | `#A1A1A8` | `#5B5560` | `#B8ADB5` | `#3D4757` | `#C4CEDB` |
| Borde de campo | `#7D8A9C` | `#5D6E84` | `#85858D` | `#68686F` | `#958C93` | `#786C75` | `#6B7686` | `#7D8A9C` |
| Primario | `#003A6A` | `#5CC0F0` | `#006CA3` | `#4BB5EE` | `#850157` | `#E486BF` | `#002858` | `#8FD3FF` |
| Texto sobre primario | `#FFFFFF` | `#04121F` | `#FFFFFF` | `#04121F` | `#FFFFFF` | `#2A0019` | `#FFFFFF` | `#001A33` |
| Acento de marca | `#0092D0` | `#0092D0` | `#0092D0` | `#0092D0` | `#D79C00` | `#F2B630` | `#F2B630` | `#F2B630` |
| Enlace | `#00609A` | `#7CCBF2` | `#006CA3` | `#6CC3F2` | `#850157` | `#EC9ACB` | `#003F87` | `#A9DDFF` |

Peores casos medidos: texto secundario 5,82:1 (B claro sobre el fondo); borde de campo 3,07:1 (C claro sobre el fondo); texto sobre primario 5,72:1 (B claro).

### Colores de estado (iguales en las cuatro versiones)

Siempre van con ícono y texto (WCAG 1.4.1).

| Estado | Claro | Oscuro | Peor contraste medido |
|---|---|---|---|
| Positivo (Aprobado, Ejecutado, En ejecución) | `#1E7B34` | `#5FD47F` | 4,83:1 |
| En espera (Pendiente, próximo a vencer, cerca del mínimo) | `#8A5A00` | `#F5B841` | 5,37:1 |
| Negativo (Rechazado, vencido, bajo el mínimo, fuera de servicio) | `#B42318` | `#FF8A80` | 5,96:1 |
| Informativo (avisos, reposición creada) | `#0B62A4` | `#7CC4FF` | 5,77:1 |
| Neutro (Borrador, Propuesta) | Texto secundario de cada versión | Ídem | ≥ 5,82:1 |

## 3. Tipografías

Todas son de Google Fonts y tienen licencia **SIL Open Font License 1.1** (OFL), verificada en el archivo `METADATA.pb` de cada familia en el repositorio oficial https://github.com/google/fonts. La OFL permite usarlas, incrustarlas y redistribuirlas gratis, también en proyectos comerciales. La única condición es no venderlas solas y no usar su nombre reservado en versiones modificadas. Todas incluyen el subconjunto latino, con acentos, ñ, ¿ y ¡.

| Versión | Títulos | Texto | Datos y códigos | Diseñador | Peso woff2 latino medido |
|---|---|---|---|---|---|
| A | Source Serif 4 | Source Sans 3 | Source Sans 3 (cifras tabulares) | Frank Grießhammer; Paul D. Hunt (Adobe) | 49 + 28 KiB |
| B | Inter Tight | Inter | Inter (cifras tabulares) | Rasmus Andersson | 43 + 47 KiB |
| C | IBM Plex Sans | IBM Plex Sans | IBM Plex Mono | Mike Abbink, Bold Monday (IBM) | 44 + 28 KiB |
| D | Atkinson Hyperlegible Next | Atkinson Hyperlegible Next | Atkinson Hyperlegible Next | Braille Institute, Applied Design Works y otros | 33 KiB |

Enlaces:
- Source Serif 4: https://fonts.google.com/specimen/Source+Serif+4. Licencia: https://github.com/google/fonts/blob/main/ofl/sourceserif4/OFL.txt
- Source Sans 3: https://fonts.google.com/specimen/Source+Sans+3. Licencia: https://github.com/google/fonts/blob/main/ofl/sourcesans3/OFL.txt
- Inter Tight: https://fonts.google.com/specimen/Inter+Tight. Licencia: https://github.com/google/fonts/blob/main/ofl/intertight/OFL.txt
- Inter: https://fonts.google.com/specimen/Inter. Licencia: https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt
- IBM Plex Sans: https://fonts.google.com/specimen/IBM+Plex+Sans. Licencia: https://github.com/google/fonts/blob/main/ofl/ibmplexsans/OFL.txt
- IBM Plex Mono: https://fonts.google.com/specimen/IBM+Plex+Mono. Licencia: https://github.com/google/fonts/blob/main/ofl/ibmplexmono/OFL.txt
- Atkinson Hyperlegible Next: https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next. Licencia: https://github.com/google/fonts/blob/main/ofl/atkinsonhyperlegiblenext/OFL.txt
- Texto de la licencia: https://openfontlicense.org/open-font-license-official-text/

**Por qué estas cuatro:**
- **A, académica.** La serifa en los títulos da el aire universitario, y la sans de la misma familia mantiene la lectura limpia.
- **B, la más cercana al estilo Apple.** Inter se diseñó para pantallas y se parece a San Francisco.
- **C, científica.** Plex Mono hace legibles los códigos (QUI-024, L-0425, SOL-118) y las cantidades. Plex Sans viene de una familia de corte técnico.
- **D, accesible.** El Braille Institute diseñó Atkinson Hyperlegible para lectores con baja visión: distingue bien caracteres parecidos como I, l, 1, O y 0.

**Cambio respecto al README.** El README (§6) y investigacion_usuarios.md fijaban la fuente del sistema. Las fuentes web cuestan entre 33 y 90 KiB por versión, menos del 14 % del presupuesto de 650 KiB de investigacion_usuarios.md §6. Se cargan autoalojadas en woff2, solo con el subconjunto latino y con `font-display: swap`, para que el texto se vea con la fuente del sistema mientras cargan. Cuando se elija la versión, se actualiza la fila "Estilo" del README.

## 4. Formas, espacio y elevación (comunes)

| Token | Valor |
|---|---|
| Radio | 6 px en campos e insignias, 10 px en botones, 14 px en tarjetas, 20 px en diálogos. La versión D usa la mitad de redondeo para más contraste de forma |
| Espaciado | Escala de 4 px: 4, 8, 12, 16, 24, 32, 48 |
| Texto | Base de 16 px, interlineado de 1,5; escala 13 / 14 / 16 / 18 / 22 / 28 / 36 |
| Controles | 44 px de alto en móvil y en las acciones principales; 36 px en tablas de escritorio (nunca menos de 24 px) |
| Foco | Anillo de 2 px del color primario con 2 px de separación |
| Sombra | Solo en menús, diálogos y elementos flotantes |
| Movimiento | 100 a 300 ms con *ease-out*; fundido o nada con `prefers-reduced-motion` |

## 5. Las cuatro direcciones de los mockups

Cada versión mantiene su paleta, su tipografía y su distribución en todas las vistas, para compararlas con coherencia.

| | A. FaCyT institucional | B. Claro estilo Apple | C. Escudo UC | D. Alto contraste |
|---|---|---|---|---|
| Idea | Sobrio, académico, con el azul noche del sitio de la FaCyT | Lo más fiel a RNF-03: aire, grises claros y azul de acción | Lo más universitario: púrpura y oro del escudo, aire editorial | Máxima legibilidad para cualquier usuario y cualquier pantalla |
| Distribución | Barra lateral fija azul noche con los logos arriba; contenido en tarjetas | Barra superior translúcida con navegación horizontal; tarjetas grandes | Riel lateral angosto de íconos con etiqueta y encabezado editorial con el escudo | Barra lateral clara en escritorio y pestañas inferiores en el teléfono; controles grandes |
| Tipografía | Source Serif 4 + Source Sans 3 | Inter Tight + Inter | IBM Plex Sans + Plex Mono | Atkinson Hyperlegible Next |
| Primario | Azul noche `#003A6A` | Azul FaCyT oscurecido `#006CA3` | Púrpura UC `#850157` | Azul profundo `#002858` |
| Acento | Azul FaCyT `#0092D0` | Azul FaCyT `#0092D0` | Oro UC `#D79C00` | Oro `#F2B630` con texto oscuro |

### 5.1 Diseño aprobado: distribución de C con la paleta de A

El 28/10/2026 el equipo eligió la distribución de C y los colores de la FaCyT. La versión E toma de C el riel de íconos, el encabezado editorial con el escudo, los rótulos en mayúsculas con Plex Mono, los radios chicos y la tipografía IBM Plex Sans + Plex Mono. De A toma la paleta completa: azul noche `#003A6A` como primario y azul FaCyT `#0092D0` como acento, que en C eran el púrpura y el oro de la UC.

| Token | E claro | E oscuro |
|---|---|---|
| Fondo | `#F4F6F9` | `#0B1420` |
| Superficie, riel y encabezado | `#FFFFFF` | `#13202F` |
| Superficie destacada y elemento activo del riel | `#E8F1F8` | `#183049` |
| Texto | `#0F1B2D` | `#E8EEF5` |
| Texto secundario | `#4A5568` | `#A3B1C2` |
| Borde de campo | `#7D8A9C` | `#5D6E84` |
| Primario (filete del encabezado, botones, marca del riel) | `#003A6A` | `#5CC0F0` |
| Acento (segundo filete del encabezado) | `#0092D0` | `#0092D0` |
| Enlace | `#00609A` | `#7CCBF2` |

Contraste medido: texto secundario 6,95:1 sobre el fondo claro y 6,18:1 sobre la superficie destacada oscura; enlace 5,85:1 sobre la superficie destacada clara; texto sobre primario 11,58:1 en claro y 9,22:1 en oscuro; borde de campo 3,51:1 en claro y 3,16:1 en oscuro. El acento solo se usa como filete decorativo, nunca como color de texto.

En el código de los mockups quedó solo este diseño: los tokens están en `.mk` dentro de `docs/mockups/_fuente/compartido/comun.css`, y las reglas de las direcciones descartadas se eliminaron el 28/10/2026.

## 6. Uso de los logos

Archivos en [`logos/`](logos/), descargados de dominios de la UC el 27/10/2026. **No se redibujan, no se recolorean y no se deforman.**

| Archivo | Uso en los mockups | Limitación |
|---|---|---|
| `facyt/facyt-isotipo_512x512_transparente.png` | Marca en barras y encabezados, en claro y en oscuro | Ninguna para pantalla |
| `facyt/facyt-logo-completo_3375x3375.jpg` | Pantalla de inicio de sesión, sobre fondo blanco | Fondo blanco, sin transparencia |
| `uc/escudo-uc-color_980x1287_odontologia.jpg` | Escudo de la UC, siempre sobre una placa blanca | Fondo blanco, sin transparencia ni vector |

**Pendiente: escudo de la UC en buena calidad.** No hay SVG ni PNG transparente del escudo de la UC en una fuente primaria oficial. El PNG transparente de ing.uc.edu.ve es una copia idéntica del archivo de Wikimedia, de autor desconocido, y no lo usamos. Hasta tener la versión oficial, el escudo va sobre una placa blanca, también en modo oscuro.

## Anexo. Verificación del contraste

Script en Python con la fórmula de WCAG 2.2 (luminancia relativa y relación (L1 + 0,05) / (L2 + 0,05)). Evalúa cada token de texto, borde y primario contra el fondo y contra la superficie de cada versión, en claro y en oscuro. Todos los pares de la §2 pasan. El acento de marca no se evalúa como texto, porque no se usa para texto normal.
