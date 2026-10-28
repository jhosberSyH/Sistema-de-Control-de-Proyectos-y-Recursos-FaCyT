---
name: formato-documento-requisitos
description: Define el formato visual y de maquetación de los documentos de requerimientos de software (SRS, PRD, especificación funcional, documento de requisitos), es decir tamaño de página, márgenes, tipografía, interlineado, jerarquía de títulos, portada, control de versiones, índices, encabezados y pies, viñetas, tablas, figuras, diagramas, identificadores y marcas especiales. Úsala siempre que se vaya a producir, maquetar, exportar o revisar un documento de requerimientos en Markdown, Google Docs, Word (.docx) o PDF, y también cuando el usuario pregunte qué márgenes, letra o estilo de tablas y viñetas debe llevar un documento de requisitos o una entrega académica de software. Complementa a la skill documento-de-requisitos, que define el contenido, mientras esta define cómo se ve.
---

# Formato de documentos de requerimientos

Esta skill dice **cómo se ve** un documento de requerimientos. No dice qué contiene. El contenido (módulos, funcionalidades, historias de usuario, base de datos, arquitectura) lo define la skill `documento-de-requisitos`. Si las dos están disponibles, se usan juntas. Primero se redacta el contenido con esa skill y después se aplica este formato.

Cada regla viene con su razón. Cuando una situación no esté cubierta, se decide con la razón y no con el gusto personal.

---

## 0. Principios que están detrás de todas las reglas

1. **Un documento de requerimientos se consulta, no se lee de corrido.** La gente salta a un requisito concreto, lo cita en una reunión o lo compara con otro. Todo el formato sirve para encontrar rápido y citar sin ambigüedad. Por eso hay numeración, identificadores, índices y encabezados repetidos.
2. **La consistencia vale más que la estética.** Un mismo tipo de elemento se ve igual en todo el documento. Si en el Módulo 1 la funcionalidad va en negrita con código, en el Módulo 5 también.
3. **El formato no debe competir con el contenido.** Pocas fuentes, pocos colores, sin adornos. El énfasis solo marca lo que de verdad importa.
4. **Se imprime y se revisa en pantalla.** El documento tiene que funcionar en papel, en PDF y en un monitor, y también en blanco y negro.

---

## 1. Perfiles de formato

No existe una norma única de márgenes para documentos de requerimientos. La norma vigente es ISO/IEC/IEEE 29148:2018, que reemplazó a IEEE 830-1998 desde su edición de 2011. Define la **estructura** y el contenido del documento, pero no su maquetación. IEEE 830 se sigue citando en plantillas universitarias y su numeración decimal sigue siendo la convención, pero no se presenta como norma vigente. En la práctica se usa uno de estos tres perfiles, según el destino del documento.

| Perfil | Cuándo se usa | Papel | Márgenes | Letra del cuerpo | Interlineado |
|---|---|---|---|---|---|
| **A. Técnico** (por defecto) | Documento de trabajo del equipo, entrega a cliente, repositorio | Carta (21,59 × 27,94 cm) en Venezuela y América; A4 (21 × 29,7 cm) en Europa | 2,5 cm en los cuatro lados | Calibri, Arial o Aptos de 11 pt | 1,15 |
| **B. Académico UPEL** | Entrega impresa y encuadernada en universidades venezolanas que siguen el Manual UPEL | Carta, papel bond blanco | 4 cm izquierdo; 3 cm superior, derecho e inferior; 5 cm superior en la primera página de cada capítulo | Times New Roman o Arial de 12 pt | 1,5 |
| **C. Académico APA 7** | Entrega a una cátedra que exige APA | Carta | 2,54 cm en los cuatro lados | Times New Roman 12, Calibri 11, Arial 11 o Georgia 11 | 2,0 (doble) |

Cómo elegir.

- Si el usuario no dice nada, se usa el **perfil A**.
- Si el documento es una entrega de la universidad y el profesor pide normas UPEL, se usa el **perfil B**. El margen izquierdo es mayor porque el documento se encuaderna por ese lado.
- Si la cátedra pide APA, se usa el **perfil C**. APA fija márgenes, letra e interlineado, pero su interlineado doble alarga mucho un documento lleno de tablas. Se permite interlineado sencillo dentro de las tablas, como lo admite APA.
- Si el documento se va a encuadernar con cualquier otro perfil, se suma 1 cm al margen izquierdo (margen de encuadernación).

Los valores que siguen en esta skill corresponden al **perfil A**. Cuando el perfil B o C fija otro valor, manda el perfil.

---

## 2. Página

### 2.1 Tamaño y orientación

- **Tamaño.** Carta en Venezuela y el resto de América, porque es el papel disponible en las impresoras. A4 solo si el cliente o la institución lo piden.
- **Orientación vertical** en todo el documento.
- **Horizontal solo por sección.** Una tabla muy ancha o un diagrama BPMN extenso van en una sección aparte con orientación horizontal, separada con salto de sección y no con salto de página. La razón es que un diagrama reducido para caber en vertical deja de leerse.

### 2.2 Márgenes

| Margen | Perfil A | Por qué |
|---|---|---|
| Superior | 2,5 cm | Deja espacio para el encabezado sin pegarlo al texto |
| Inferior | 2,5 cm | Deja espacio para el número de página |
| Izquierdo | 2,5 cm (3,5 cm si se encuaderna) | La encuadernación se come parte del margen |
| Derecho | 2,5 cm | Espacio para anotaciones a mano en revisiones impresas |
| Encabezado | 1,25 cm desde el borde | Queda dentro del margen superior |
| Pie | 1,25 cm desde el borde | Queda dentro del margen inferior |

Nunca se reducen los márgenes para que "quepa" una tabla. Se reduce la tabla, se parte o se pasa a una página horizontal.

---

## 3. Tipografía

### 3.1 Fuentes

- **Una sola familia** para títulos y cuerpo. Se permite una segunda fuente monoespaciada (Consolas, Cascadia Mono o Courier New) solo para código, rutas y nombres técnicos.
- **Sin serifa en pantalla** (Calibri, Arial, Aptos, Segoe UI). **Con serifa** solo si el perfil académico lo exige (Times New Roman).
- No se usan fuentes decorativas, manuscritas ni condensadas.

### 3.2 Tamaños y estilos

| Elemento | Tamaño | Estilo | Espacio antes / después |
|---|---|---|---|
| Título del documento (portada) | 24–28 pt | Negrita | — |
| Título 1 (apartado principal, ej. "1. Funcionalidades") | 16 pt | Negrita | 24 pt / 12 pt |
| Título 2 (módulo, ej. "1.1 Módulo 1 — Identidad") | 14 pt | Negrita | 18 pt / 6 pt |
| Título 3 (funcionalidad o historia, ej. "F1.1 — …") | 12 pt | Negrita | 12 pt / 6 pt |
| Título 4 (subdivisión excepcional) | 11 pt | Negrita cursiva | 12 pt / 4 pt |
| Cuerpo | 11 pt (12 pt en perfiles B y C) | Normal | 0 pt / 6 pt |
| Texto de tabla | 10 pt | Normal; encabezado en negrita | 2 pt / 2 pt |
| Título de tabla o figura | 10 pt | Negrita para el número, cursiva para el título | 6 pt / 4 pt |
| Nota al pie de tabla o figura | 9 pt | Normal | 2 pt / 12 pt |
| Encabezado y pie de página | 9 pt | Normal, color gris oscuro | — |

Razón de los espacios. El espacio antes de un título es siempre mayor que el espacio después. Así el título queda visualmente pegado a lo que encabeza y separado de lo anterior.

### 3.3 Párrafo

- **Interlineado** 1,15 en el perfil A, 1,5 en el B y 2,0 en el C.
- **Separación entre párrafos** con espacio después (6 pt), no con líneas en blanco. Las líneas en blanco rompen la paginación y se acumulan.
- **Alineación a la izquierda** en el perfil A, porque el texto justificado abre huecos entre palabras en líneas con códigos largos. **Justificado** en el perfil B, porque lo exige el Manual UPEL. APA también pide alineación a la izquierda.
- **Sangría de primera línea** solo en perfiles académicos (1,27 cm o 5 espacios). En el perfil A no se usa sangría, porque el espacio entre párrafos ya los separa.
- **Control de líneas viudas y huérfanas** activado. Un párrafo no deja una sola línea suelta al final o al inicio de una página.
- **Conservar con el siguiente** activado en todos los títulos. Un título nunca queda solo al pie de una página.

### 3.4 Énfasis

| Recurso | Se usa para | No se usa para |
|---|---|---|
| **Negrita** | Etiquetas fijas (**Qué**, **Cómo** y **Para qué** en el cuadro de funcionalidad, **Dado**, **Cuando**, **Entonces**), términos definidos la primera vez, encabezados de tabla | Frases enteras o párrafos |
| *Cursiva* | Títulos de tablas y figuras, palabras en otro idioma, notas de relleno de plantilla | Énfasis general |
| `Monoespaciada` | Identificadores técnicos, nombres de archivo, marcas `[PROPUESTA]` y `[POR CONFIRMAR]` | Texto normal |
| Subrayado | Solo hipervínculos | Énfasis, porque se confunde con un enlace |
| MAYÚSCULAS SOSTENIDAS | Nunca en el cuerpo | Se leen como gritos y son más lentas de leer |

---

## 4. Jerarquía de títulos y numeración

- **Numeración decimal** en todos los títulos: 1, 1.1, 1.1.1. Es la forma que siguen ISO/IEC/IEEE 29148 y la antigua IEEE 830, y permite citar "ver 1.3.2" sin ambigüedad.
- **Máximo tres niveles numerados.** Un cuarto nivel es señal de que el apartado debe partirse. Si hace falta, el cuarto nivel va sin número.
- **Los títulos se generan con estilos**, nunca con texto en negrita y tamaño manual. Sin estilos no hay índice automático ni navegación.
- **Salto de página antes de cada Título 1.** Cada apartado principal (Funcionalidades, Historias de usuario, Base de datos, Arquitectura, Anexos) empieza en página nueva.
- **Los módulos no llevan salto de página obligatorio.** Se permite si el módulo empieza en el último tercio de la página.
- **Formato del título.** Solo la primera letra en mayúscula, además de nombres propios. Sin punto final. Ejemplo correcto: "1.2 Módulo 2 — Publicaciones". Ejemplo incorrecto: "1.2 MÓDULO 2 — PUBLICACIONES."

Correspondencia con la estructura de la skill de contenido.

| Elemento del contenido | Nivel de título | Ejemplo |
|---|---|---|
| Apartado principal | Título 1 | 1. Funcionalidades |
| Módulo | Título 2 | 1.3 Módulo 3 — Muro y búsqueda |
| Subsección fija del módulo | Título 3 sin número | Diagrama de flujo · Funcionalidades |
| Funcionalidad | Título 3 con su código, seguido de su cuadro (ver 8.5) | F3.2 — El sistema entrega solo las publicaciones que la audiencia permite |
| Historia de usuario | Título 3 con su código | HU-13 — Muro por fecha y por audiencia |

El código de la funcionalidad o de la historia reemplaza la numeración decimal en ese nivel, porque es el identificador que se cita en todo el proyecto.

---

## 5. Partes preliminares

Van antes del primer apartado y se numeran con **números romanos en minúscula** (i, ii, iii). El cuerpo empieza en la página 1 con números arábigos.

### 5.1 Portada

Una sola página, sin encabezado ni pie, con este orden de arriba hacia abajo.

1. Logotipo de la institución o del cliente, arriba a la izquierda o centrado, de no más de 3 cm de alto.
2. Nombre de la institución, facultad o empresa.
3. Tipo de documento, por ejemplo "Documento de requerimientos".
4. Nombre del sistema, en el tamaño más grande de la página.
5. Versión y fecha.
6. Autores o equipo.
7. Clasificación, si aplica, por ejemplo "Uso interno".

Todo centrado en los perfiles académicos. En el perfil A se permite alineación a la izquierda.

### 5.2 Control de versiones

Tabla obligatoria en la segunda página. Permite saber qué cambió entre la versión que alguien imprimió y la vigente.

| Versión | Fecha | Autor | Descripción del cambio |
|---|---|---|---|
| 0.1 | 15/09/2026 | Nombre | Borrador inicial |
| 1.0 | 22/09/2026 | Nombre | Versión aprobada para la Entrega 1 |

Reglas de numeración de versiones.
- **0.x** para borradores no aprobados.
- **1.0** para la primera versión aprobada.
- **Cambio menor** (redacción, corrección) sube el decimal, por ejemplo de 1.0 a 1.1.
- **Cambio mayor** (se agregan, quitan o cambian requisitos) sube el entero, por ejemplo de 1.3 a 2.0.

### 5.3 Aprobaciones (opcional)

Tabla con nombre, rol, fecha y firma de quienes aprueban el documento. Es necesaria cuando el documento funciona como acuerdo con un cliente o patrocinador.

### 5.4 Índices

- **Índice general** automático, con los niveles 1 a 3 y números de página alineados a la derecha con puntos guía.
- **Índice de tablas** e **índice de figuras** automáticos, solo si el documento tiene cinco o más de cada tipo.
- Los índices se actualizan justo antes de exportar a PDF.

---

## 6. Encabezado y pie de página

| Zona | Izquierda | Centro | Derecha |
|---|---|---|---|
| Encabezado | Nombre del sistema | — | Tipo de documento y versión, ej. "Doc. de requerimientos v1.0" |
| Pie | Clasificación, ej. "Uso interno" | — | "Página X de Y" |

- La portada no lleva encabezado ni pie.
- Las páginas preliminares llevan número romano.
- Una línea fina gris (0,5 pt) separa el encabezado del texto. Es opcional.
- "Página X de Y" se usa porque permite saber, en una copia impresa, si falta alguna hoja.

---

## 7. Listas y viñetas

### 7.1 Cuándo usar cada tipo

| Tipo | Se usa cuando | Ejemplo |
|---|---|---|
| **Viñetas** | Los elementos no tienen orden ni prioridad | Actores, supuestos, exclusiones del alcance |
| **Numerada** | El orden importa o hay que citar un paso concreto | Pasos de instalación, secuencia de un proceso |
| **De definición** | Cada elemento tiene un término y su explicación | Término en negrita, seguido de la explicación en la misma línea |
| **Tabla** | Cada elemento tiene tres o más atributos comparables | Requisitos con código, prioridad y responsable |

Si una lista necesita más de dos atributos por elemento, se convierte en tabla.

### 7.2 Símbolos y sangrías

| Nivel | Viñeta | Numeración | Sangría izquierda | Sangría francesa |
|---|---|---|---|---|
| 1 | • (punto) | 1. 2. 3. | 0,63 cm | 0,63 cm |
| 2 | – (guion corto) | a. b. c. | 1,27 cm | 0,63 cm |
| 3 | No se usa | No se usa | — | — |

- **Máximo dos niveles.** Un tercer nivel indica que el contenido debe reorganizarse en subtítulos o en una tabla.
- Los símbolos son siempre los mismos en todo el documento. No se usan flechas, emojis, casillas ni símbolos decorativos.
- El texto de las líneas siguientes de un elemento se alinea con el texto de la primera línea, no con la viñeta. Eso es la sangría francesa.

### 7.3 Redacción de los elementos

- **Entre 2 y 7 elementos.** Una lista de un solo elemento no es lista. Una de más de siete se parte en grupos con subtítulo.
- **Construcción paralela.** Todos los elementos empiezan con la misma clase de palabra, todos con sustantivo o todos con verbo. Incorrecto: "Registro de usuarios", "Se valida el correo", "Contraseñas seguras". Correcto: "Registro de usuarios", "Validación del correo", "Protección de contraseñas".
- **Mayúscula inicial** en cada elemento.
- **Puntuación.** Si los elementos son frases sin verbo, no llevan punto final. Si son oraciones completas, todos llevan punto final. No se mezclan.
- **La frase que introduce la lista** es una oración completa. Se termina con punto, porque la skill de contenido evita los dos puntos en la prosa. Por ejemplo, "El módulo cubre estos casos." y luego la lista.
- **Espacio.** Sin espacio extra entre elementos (0 pt), y 6 pt después del último.

---

## 8. Tablas

### 8.1 Cuándo usar una tabla

Se usa una tabla cuando el lector necesita **comparar** elementos por los mismos atributos. Ejemplos son los actores con su rol, el glosario, la matriz de permisos por rol, la trazabilidad entre requisitos e historias, y el control de versiones. No se usa una tabla para maquetar texto corrido en columnas.

### 8.2 Anatomía

```
Tabla 3                                   ← número en negrita, arriba
Matriz de visibilidad por rol y audiencia ← título en cursiva, arriba
┌─────────────────┬───────────┬──────────┐
│ Audiencia       │ Visitante │ Profesor │ ← fila de encabezado, negrita y fondo gris
├─────────────────┼───────────┼──────────┤
│ Pública         │    Sí     │    Sí    │
│ Solo profesores │    No     │    Sí    │
└─────────────────┴───────────┴──────────┘
Nota. Fuente, aclaraciones o abreviaturas. ← nota debajo, 9 pt
```

### 8.3 Reglas de formato

| Aspecto | Regla | Por qué |
|---|---|---|
| Número y título | Arriba de la tabla, con la forma "Tabla N" y el título descriptivo debajo | Es la convención de APA y de la mayoría de guías técnicas. El lector sabe qué es la tabla antes de leerla |
| Numeración | Consecutiva en todo el documento (Tabla 1, Tabla 2…), o por apartado (Tabla 2.1) en documentos de más de 30 tablas | Permite citarla desde el texto |
| Mención en el texto | Toda tabla se menciona en el texto antes de aparecer, ej. "según la Tabla 3" | Una tabla sin mención es una tabla que nadie sabe por qué está ahí |
| Ancho | 100 % del ancho útil de la página, salvo tablas de dos columnas cortas | Da un aspecto uniforme |
| Fila de encabezado | Negrita, fondo gris claro (#D9D9D9 o #E7E6E6) y **repetida en cada página** si la tabla se parte | Al pasar de página el lector no pierde el significado de cada columna |
| Filas | **No se permite que una fila se parta** entre dos páginas | Una fila partida se lee como dos registros |
| Bordes | Bordes finos (0,5 pt) grises, o solo líneas horizontales | Los bordes gruesos y dobles recargan la página |
| Filas alternas | Sombreado alterno opcional, muy claro (#F2F2F2), solo en tablas de más de 10 filas | Ayuda a seguir la fila con la vista |
| Relleno de celda | 0,1 cm arriba y abajo, 0,19 cm a los lados | El texto no toca los bordes |
| Letra | 10 pt, interlineado sencillo | Cabe más información sin perder legibilidad |
| Alineación del texto | A la izquierda | Es la lectura natural |
| Alineación de números | A la derecha, con los decimales alineados | Permite comparar magnitudes |
| Alineación de valores cortos | Centrados (Sí/No, códigos cortos, íconos) | Se ven como marcas, no como texto |
| Alineación vertical | Arriba en todas las celdas | Si una celda tiene varias líneas, las demás no quedan flotando en medio |
| Celdas vacías | Se escribe "—" (raya) o "No aplica", nunca se deja vacía | Una celda vacía no dice si falta el dato o si no corresponde |
| Celdas combinadas | Se evitan | Rompen la exportación, la lectura en pantalla y el ordenamiento |
| Nota | Debajo, 9 pt, empieza con "*Nota.*" | Explica abreviaturas, fuentes o condiciones |

### 8.4 Tablas propias de un documento de requerimientos

| Tabla | Columnas recomendadas |
|---|---|
| Control de versiones | Versión · Fecha · Autor · Descripción del cambio |
| Actores | Rol · Descripción · Responsabilidad principal en el sistema |
| Glosario | Término · Significado (orden alfabético) |
| Matriz de permisos | Acción o recurso · una columna por rol, con Sí/No |
| Referencias | Insumo · Tipo · Fecha |
| Trazabilidad | Funcionalidad · Historias de usuario · Reglas · Diagrama · Estado |
| Requisitos de calidad (no funcionales) | Código · Categoría ISO/IEC 25010 · Requisito · Criterio de medición |
| Reglas de negocio | Código · Regla · Funcionalidades que la aplican |
| Supuestos y pendientes | Código · Tipo (`[PROPUESTA]` / `[POR CONFIRMAR]`) · Descripción · Responsable |

### 8.5 Cuadro de funcionalidad (obligatorio)

El **Qué**, el **Cómo** y el **Para qué** de cada funcionalidad van **siempre dentro de un cuadro**, nunca como párrafos sueltos. La razón es que la funcionalidad es la unidad que más se consulta del documento. En un cuadro, el lector distingue de un vistazo dónde empieza y termina cada una, y encuentra el mismo dato siempre en la misma posición.

Esta regla reemplaza la presentación en párrafos con etiquetas **Qué:**, **Cómo:** y **Para qué:** de la skill `documento-de-requisitos`. El texto de cada parte se redacta igual que allí. Solo cambia dónde va.

**Anatomía**

```
F2.4 — El autor adjunta imágenes a la publicación      ← Título 3 con el código, fuera del cuadro
┌────────────┬──────────────────────────────────────┐
│ Aspecto    │ Descripción                          │ ← fila de encabezado, negrita, fondo gris
├────────────┼──────────────────────────────────────┤
│ Qué        │ Alcance, reglas, límites y lo que    │
│            │ no cubre.                            │
├────────────┼──────────────────────────────────────┤
│ Cómo       │ Recorrido práctico en lenguaje       │
│            │ natural.                             │
├────────────┼──────────────────────────────────────┤
│ Para qué   │ Problema que elimina.                │
└────────────┴──────────────────────────────────────┘
```

**Reglas del cuadro**

| Aspecto | Regla |
|---|---|
| Posición | Justo debajo del título de la funcionalidad. El título queda fuera del cuadro y con "Conservar con el siguiente", para que nunca se separe de su cuadro |
| Estructura | Dos columnas y tres filas de contenido, siempre en el orden Qué, Cómo, Para qué. Debajo pueden ir los atributos opcionales de ISO/IEC/IEEE 29148, en el orden Prioridad, Origen, Verificación, y solo los que tengan información real |
| Fila de encabezado | "Aspecto" y "Descripción", en negrita con fondo gris claro (#D9D9D9) |
| Primera columna | Etiqueta en negrita sin dos puntos, ancho fijo de 2,5 a 3 cm (15 % a 20 % del ancho) y fondo gris muy claro (#F2F2F2) |
| Segunda columna | El texto de esa parte, 10 pt, alineado a la izquierda, ocupa el resto del ancho |
| Ancho | 100 % del ancho útil de la página |
| Bordes | Finos (0,5 pt) y grises en todas las celdas |
| Paginación | Las filas no se parten entre páginas. Si el cuadro no cabe completo, pasa entero a la página siguiente |
| Numeración | El cuadro **no** lleva "Tabla N" ni entra al índice de tablas, porque el código de la funcionalidad ya lo identifica. Si hay 40 funcionalidades, el índice de tablas no puede tener 40 cuadros iguales |
| Contenido anidado | Nunca se mete una tabla, una lista larga ni una figura dentro de una celda. Si el Qué necesita una tabla (por ejemplo una matriz de permisos), la celda dice "según la Tabla N" y la tabla va numerada justo debajo del cuadro |
| Marcas | `[PROPUESTA]` y `[POR CONFIRMAR: …]` se mantienen dentro de la celda donde aplican |

**En Markdown**

```markdown
#### F2.4 — El autor adjunta imágenes a la publicación

| Aspecto | Descripción |
|:---|:---|
| **Qué** | Cubre la carga de imágenes en la publicación. … |
| **Cómo** | En el formulario, el autor elige una o varias imágenes. … |
| **Para qué** | Un muro institucional sin imágenes no compite con … |
```

Cada celda es una sola línea de Markdown, sin saltos de línea dentro. Si el texto contiene una barra vertical, se escribe `\|`.

**En Word (.docx)**

- Tabla de 2 × 4 con el estilo de tabla del documento, ancho total del área útil (9 638 twips con márgenes de 2,5 cm en carta).
- Primera columna de 1 701 twips (3 cm) y segunda con el resto.
- Fila 1 marcada como "Repetir como fila de encabezado" y "Permitir que las filas se dividan entre páginas" desmarcado en todas.
- 6 pt de espacio después del cuadro, antes del título de la siguiente funcionalidad.

---

## 9. Figuras y diagramas

- **Número y título arriba**, con la misma forma que las tablas, "Figura N" en negrita y el título en cursiva debajo. La nota o la fuente van debajo de la figura.
- **Toda figura se menciona en el texto antes de aparecer.**
- **Centrada**, con el ancho máximo del área útil de la página.
- **Texto legible.** Ningún texto dentro de la figura puede verse más pequeño que 8 pt una vez impresa. Si un diagrama no cumple eso en vertical, va en una página horizontal o se parte en varias figuras.
- **Resolución.** Formatos vectoriales (SVG, EMF, PDF) para diagramas en Word y PDF. PNG a 300 ppp como mínimo si no hay vector. **En Google Docs solo PNG**, porque no admite SVG; se exporta al doble de tamaño (`--scale 2` en `bpmn-to-image`) para que se lea al imprimir. Nunca capturas de pantalla borrosas ni JPG para diagramas.
- **Funciona en blanco y negro.** Si el diagrama usa colores para distinguir elementos, también los distingue por forma, patrón o etiqueta.
- **Texto alternativo.** Toda figura lleva un texto alternativo de una o dos oraciones que diga qué muestra, por ejemplo "Diagrama BPMN del Módulo 2, desde la apertura de la orden hasta su cierre o anulación". Lo exige el criterio 1.1.1 de WCAG 2.2 para lectores de pantalla, y se conserva al exportar a PDF. En Word y en Google Docs se pone con clic derecho > Texto alternativo.
- **Diagramas BPMN.** Cada módulo lleva su diagrama después de la descripción y antes de las funcionalidades. Si el diagrama está en un archivo aparte (.bpmn), se inserta la imagen exportada y, en la nota, la ruta o enlace al archivo editable.
- **Espacios para diagramas pendientes.** Van como un cuadro destacado (ver sección 10), nunca como un hueco en blanco sin rótulo.

---

## 10. Cuadros destacados y marcas especiales

Algunos contenidos necesitan distinguirse del cuerpo sin interrumpir la lectura. Se marcan con un **cuadro destacado**, que es un párrafo con borde izquierdo de color y fondo muy claro.

| Tipo de cuadro | Uso | Borde izquierdo | Fondo |
|---|---|---|---|
| **Espacio pendiente** | Lugar reservado para un diagrama, enlace o contenido que otra persona inserta | Gris (#7F7F7F), 3 pt | #F2F2F2 |
| **Nota** | Aclaración que el lector debe ver | Azul (#2F5597), 3 pt | #DEEAF6 |
| **Advertencia** | Riesgo o restricción que no se puede pasar por alto | Ámbar (#BF8F00), 3 pt | #FFF2CC |

Marcas en línea.

| Marca | Significado | Formato |
|---|---|---|
| `[POR CONFIRMAR: …]` | Falta un dato y se sabe con quién se confirma | Monoespaciada, fondo amarillo muy claro (#FFF2CC) |
| `[PROPUESTA]` | Decisión que propuso quien redacta y que el usuario todavía no validó | Monoespaciada, fondo azul muy claro (#DEEAF6) |

- Máximo **una nota o advertencia seguida**. Dos o más juntas pierden su efecto. Los espacios pendientes sí pueden ir seguidos, como el diagrama y el enlace de la base de datos, porque no son énfasis sino lugares reservados.
- En la versión final aprobada no debe quedar ninguna marca `[POR CONFIRMAR]` sin resolver, o quedan todas listadas en la sección de pendientes.

---

## 11. Identificadores y referencias cruzadas

- **Todo requisito tiene un código único e inmutable.** Si un requisito se elimina, su código no se reutiliza. Se marca como "Eliminado en v1.2" para que las referencias antiguas no apunten a otra cosa.
- **Formatos de código** coherentes con la skill de contenido.

| Elemento | Formato | Ejemplo |
|---|---|---|
| Funcionalidad | F + módulo + punto + consecutivo | F2.4 |
| Historia de usuario | HU + guion + dos dígitos | HU-09 |
| Requisito no funcional | RNF + guion + dos dígitos | RNF-03 |
| Regla de negocio | RN + guion + dos dígitos | RN-02 |
| Supuesto o pendiente | SP + guion + dos dígitos | SP-04 |
| Pregunta abierta | OQ + guion + rol + guion + número | OQ-B-6 |

- El código se escribe **en negrita** en su título y **sin formato especial** cuando se cita en el texto, por ejemplo "según F2.4".
- **Referencias cruzadas automáticas** (campo de referencia en Word, enlace interno en Markdown), nunca escritas a mano. Si se renumera una tabla, la referencia se actualiza sola.
- **Hipervínculos** con texto descriptivo, nunca la URL suelta en medio de la prosa. En la versión impresa se agregan las URL completas en la sección de referencias.
- **Sin enlaces relativos fuera del repositorio.** Un enlace como `../docs/arquitectura.md` funciona en el repositorio y se rompe en Google Docs, Word y PDF. En esos formatos, el archivo se enlaza con su URL de Drive o del repositorio, o se escribe su ruta como texto monoespaciado.

---

## 12. Números, fechas, unidades y color

### 12.1 Números y fechas

- **Separador de miles con espacio**, desde las cinco cifras (12 500; 1 250 000). Es lo que recomienda la *Ortografía de la lengua española* (RAE, 2010) y coincide con el Sistema Internacional, porque el punto y la coma ya sirven como separador decimal en distintos países y se prestan a confusión. Con cuatro cifras no se separa (2458). En Word y en Google Docs se usa un espacio de no separación para que el número no se parta entre dos líneas.
- **Separador decimal con coma**, como se usa en Venezuela y en el español de América del Sur, por ejemplo 1 250,5. La RAE también admite el punto. Si el documento es para un público que usa el punto decimal, se usa el punto de forma consistente.
- Los números que identifican y no cuentan no se separan, como páginas, años, códigos o versiones (página 1250, año 2026).
- **Fechas** en el texto con la forma DD/MM/AAAA (22/09/2026). En tablas técnicas y nombres de archivo se permite AAAA-MM-DD (2026-09-22, formato ISO 8601), porque se ordena bien.
- **Números del cero al nueve** en letra dentro de la prosa, y en cifra desde el 10. En tablas siempre en cifra.
- **Unidades** separadas del número por un espacio, ej. 5 MB, 2,5 cm, 30 s.

### 12.2 Color

- **Máximo dos colores de acento** además del negro y los grises. Por ejemplo, un azul institucional para títulos y el ámbar para advertencias.
- **Contraste mínimo 4,5 a 1** entre el texto y su fondo, según las pautas de accesibilidad WCAG. El texto gris claro sobre blanco no cumple.
- El color nunca es la única forma de transmitir un significado. Un estado "Rechazado" se escribe, no solo se pinta de rojo.

---

## 13. Cómo aplicar el formato en cada herramienta

Antes de producir el documento, lee `references/herramientas.md`. Tiene la sección de la herramienta de destino, con los valores exactos y lo que esa herramienta no permite.

| Destino | Qué cubre la referencia |
|---|---|
| Markdown | Sintaxis de cada elemento, cuadro de funcionalidad como tabla, enlaces internos |
| Word (.docx) | Estilos integrados, secciones, títulos de tablas, valores en twips |
| PDF | Exportación con marcadores, fuentes incrustadas y nombre del archivo |
| Google Docs | Valores en puntos, correspondencia de estilos y pasos que el API no permite y quedan manuales |

---

## 14. Revisión final del formato

Antes de entregar, se revisa en este orden.

- [ ] El perfil de formato (A, B o C) es el que pidió el usuario o el A por defecto, y se aplica en todo el documento.
- [ ] Tamaño de papel, márgenes y orientación coinciden con el perfil. Las páginas horizontales solo contienen tablas o diagramas anchos.
- [ ] Una sola familia tipográfica, con los tamaños de la tabla de la sección 3.2.
- [ ] Todos los títulos usan estilos, están numerados hasta el tercer nivel y ninguno queda solo al final de una página.
- [ ] Cada Título 1 empieza en página nueva.
- [ ] Portada, control de versiones e índice están presentes. El índice está actualizado.
- [ ] El encabezado y el pie muestran el nombre del sistema, la versión y "Página X de Y". La portada no los lleva.
- [ ] Las listas tienen entre dos y siete elementos, máximo dos niveles, construcción paralela y puntuación uniforme.
- [ ] Cada funcionalidad tiene su Qué, Cómo y Para qué dentro de un cuadro de dos columnas, sin tablas anidadas y sin partirse entre páginas.
- [ ] Toda tabla y toda figura tiene número, título arriba y mención previa en el texto. Los cuadros de funcionalidad son la única excepción.
- [ ] Las tablas tienen encabezado repetido, filas que no se parten y ninguna celda vacía.
- [ ] Los diagramas se leen impresos (texto de 8 pt o más) y en blanco y negro, y cada uno tiene texto alternativo.
- [ ] En Google Docs, el documento está en modo páginas, la tabla de contenido y los números de página están insertados, y no queda ningún espacio de diagrama sin su imagen o sin su marca de pendiente.
- [ ] Los códigos de requisitos son únicos y las referencias cruzadas son automáticas.
- [ ] Las marcas `[POR CONFIRMAR]` y `[PROPUESTA]` están resaltadas y también listadas en la sección de pendientes.
- [ ] Las fechas, los números y las unidades siguen un único formato, con espacio como separador de miles.
- [ ] El PDF final tiene marcadores, fuentes incrustadas y nombre de archivo según la convención.

---

## Fuentes consultadas

- ISO/IEC/IEEE 29148:2018, *Systems and software engineering — Life cycle processes — Requirements engineering*. Norma vigente. Estructura de los documentos de requisitos (StRS, SyRS, SRS), características de un buen requisito y atributos de cada requisito. https://www.iso.org/standard/72089.html
- IEEE Std 830-1998, *Recommended Practice for Software Requirements Specifications*. Reemplazada por ISO/IEC/IEEE 29148. Se conserva como antecedente de la numeración por secciones, el control de versiones y el glosario. https://standards.ieee.org/ieee/830/1222/
- Universidad de Cantabria, plantilla de especificación de requisitos según IEEE 830, en español. https://ocw.unican.es/pluginfile.php/2168/course/section/1988/plantilla_formato_ieee830.pdf
- Real Academia Española, *Ortografía de la lengua española* (2010). Espacio como separador de millares desde las cinco cifras. Resumen de FundéuRAE en https://www.swissinfo.ch/spa/fund%C3%A9urae-miles-y-millones-claves-de-escritura/48566582
- W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*, criterio 1.1.1 Contenido no textual y criterio 1.4.3 Contraste mínimo. https://www.w3.org/TR/WCAG22/
- Google, referencia del API de Google Docs (`documents.batchUpdate`, `DocumentStyle`, `TableRowStyle`, `PinTableHeaderRowsRequest`). https://developers.google.com/workspace/docs/api/reference/rest/v1/documents
- bpmn.io, `bpmn-to-image`, exportación de diagramas BPMN a PNG, SVG o PDF desde la línea de comandos. https://www.npmjs.com/bpmn-to-image
- Plantillas de ReqView basadas en ISO/IEC/IEEE 29148. https://www.reqview.com/doc/iso-iec-ieee-29148-templates/
- Plantilla SRS en Markdown basada en IEEE 830 e ISO/IEC/IEEE 29148. https://github.com/jam01/SRS-Template
- Universidad Pedagógica Experimental Libertador, *Manual de Trabajos de Grado de Especialización y Maestría y Tesis Doctorales* (2006). Márgenes de 4 cm izquierdo y 3 cm en los demás lados, 5 cm superior al inicio de capítulo, papel carta, letra de 12 pt e interlineado 1,5. https://padron.entretemas.com.ve/documentos/ManualUPEL2006.pdf
- Normas APA 7.ª edición. Márgenes de 2,54 cm, fuentes aceptadas, interlineado doble y formato de tablas y figuras con número en negrita y título en cursiva. https://normasapa.in/formato/ y https://citaapa.com/formato-apa/margenes-interlineado/
- Microsoft Writing Style Guide, secciones de listas y números. Viñetas por defecto y numeración solo cuando el orden importa; cifras en tablas y alineación de decimales. https://learn.microsoft.com/en-us/style-guide/scannable-content/lists y https://learn.microsoft.com/en-us/style-guide/numbers
