---
name: documento-de-requisitos
description: Redacta documentos de requerimientos de software alineados con ISO/IEC/IEEE 29148, con funcionalidades por módulo (qué, cómo y para qué), historias de usuario, base de datos y arquitectura. Lee todos los insumos de una carpeta del proyecto, asigna cada diagrama de flujo a su espacio y genera el documento en Google Docs con el MCP de Google Drive y Docs. Usar cuando se pida un documento de requerimientos, especificación funcional, SRS, PRD, levantamiento o alcance funcional, cuando se quiera convertir notas, actas, entrevistas o una idea en un documento listo para desarrollo, o cuando se actualice un documento de requerimientos existente. También aplica aunque no se diga "requerimientos", si se pide definir los módulos de un sistema, listar sus funcionalidades o escribir historias de usuario.
---

# Documento de requerimientos

Esta skill produce un documento con cuatro apartados, siempre en este orden.

1. Funcionalidades, organizadas por módulos
2. Historias de usuario
3. Base de datos
4. Arquitectura

El documento se escribe en español neutro, en presente y en tercera persona, salvo que el usuario pida otra cosa.

---

## Qué escribe la skill y qué no

La skill redacta el texto del documento, es decir los módulos, las funcionalidades, las historias de usuario y los encabezados de todos los apartados.

La skill **no dibuja diagramas**. No genera el diagrama BPMN de los módulos, ni el modelo entidad-relación, ni el diagrama de arquitectura, ni inventa el stack tecnológico. En cada uno de esos lugares deja un espacio marcado para que la persona inserte su propio diagrama, su enlace o su contenido.

Tampoco inventa el contenido de los apartados de base de datos y arquitectura. Ahí solo arma la estructura con los espacios en blanco rotulados. La excepción son los requisitos de calidad que el usuario o los insumos dieron, que se escriben en arquitectura tal como se dijeron (ver Paso 6).

### Cómo se marcan los espacios

Usa siempre esta forma, tal que el espacio se vea de inmediato al hojear el documento.

```markdown
> **[ESPACIO — Diagrama BPMN del Módulo 1]**
> *Insertar aquí el diagrama de flujo del módulo.*
> Archivo: `diagramas/modulo-01-registro-de-flota.png`
```

La línea `Archivo:` dice qué archivo de la carpeta va en ese espacio (ver Paso 0). Si no hay ninguno, se escribe `Archivo: no encontrado en la carpeta`. Si no se trabaja con carpeta, la línea se omite.

Cuatro reglas sobre los espacios.

- No los rellenes con una descripción del diagrama escrita en palabras. El espacio se queda vacío.
- No generes un diagrama "de apoyo" en Mermaid ni en ningún otro formato, ni siquiera comentado.
- No insertes la imagen del diagrama aunque exista en la carpeta. La persona la pega, porque el MCP de Google Docs solo inserta imágenes con URL pública.
- Si el usuario pide de forma explícita que sí dibujes alguno, hazlo en ese caso puntual y mantén los demás espacios vacíos.

---

## Reglas de redacción

Estas reglas aplican a todo el documento que produzcas.

- **Nada de dos puntos en oraciones normales.** Reescribe con "tal que", "porque", "donde", "es decir", o parte la idea en dos oraciones. Los dos puntos solo sobreviven en las etiquetas de la plantilla, como **Qué:**, y dentro de tablas.
- Oraciones cortas y gramática normal. Nada de metáforas, frases hechas ni expresiones largas de relleno.
- Sin muletillas de guía de estudio, como "es importante destacar", "cabe mencionar" o "en resumen".
- Si una oración dice lo mismo con menos palabras, usa la versión corta.
- El texto debe sonar a persona que escribe bien, no a manual ni a redacción literaria.

### Palabras que vuelven un requisito imposible de verificar

Según la guía de redacción de requisitos de INCOSE, ninguna de estas palabras puede probarse en una prueba de aceptación. Cuando aparecen, se reemplazan por el dato concreto. Si el dato no se conoce, se escribe `[POR CONFIRMAR: ...]`.

| Tipo | Ejemplos | Se reemplaza por |
|---|---|---|
| Adjetivos vagos | rápido, fácil, intuitivo, amigable, moderno, robusto, flexible, adecuado, suficiente, eficiente | El número o la condición observable ("responde en menos de 2 s", "se completa en tres pasos") |
| Cantidades sin número | varios, algunos, muchos, la mayoría, aproximadamente, como mínimo, como máximo | La cantidad ("hasta 5 archivos de 10 MB cada uno") |
| Cláusulas de escape | en lo posible, si es necesario, según corresponda, cuando aplique, de ser posible | La condición exacta, o se elimina |
| Listas abiertas | etc., entre otros, y/o, tales como | La lista cerrada, o "solo estos" |
| Verbos que no dicen qué pasa | gestionar, manejar, administrar, procesar, soportar | El verbo de la acción ("crea", "aprueba", "anula") |
| Adverbios de frecuencia | normalmente, generalmente, usualmente, a veces | La regla y su excepción, escritas por separado |

Un término que el negocio usa de verdad y que no admite reemplazo se define en el glosario. Así deja de ser ambiguo.

---

## Paso 0 — Carpeta del proyecto

El documento se arma a partir de una carpeta ordenada. Si el usuario indica una carpeta, se trabaja sobre ella. Si no indica ninguna, se propone esta estructura y se crea solo cuando el usuario la acepta.

```
requerimientos/
├── insumos/      todo lo que se lee para redactar
├── diagramas/    los diagramas que la persona pega en el documento
└── salida/       el documento generado y sus archivos de trabajo
```

### Insumos

Se lee **todo** el contenido de `insumos/` y sus subcarpetas, en orden alfabético, antes de escribir una sola funcionalidad.

| Tipo | Cómo se lee |
|---|---|
| `.md`, `.txt`, `.csv` | Directamente |
| `.docx` | Con la skill `docx`, o con `pandoc` si está instalado |
| `.pdf` | Con la skill `pdf` |
| `.xlsx` | Con la skill `xlsx` |
| Enlaces a Google Docs o Drive, en un archivo `enlaces.txt` | Con `read_file_content` del MCP de Google Drive |
| Imágenes o capturas | Se miran, y lo que muestran se usa como insumo |
| `.bpmn` | Se leen los nombres de carriles, tareas y compuertas del XML. Sirven para nombrar actores y funcionalidades. Nunca se redibuja el diagrama |

Cada insumo leído entra en la sección **Referencias** del documento, con su nombre de archivo y su fecha. Si un archivo no se puede leer, se avisa al usuario y no se adivina su contenido.

Si los insumos se contradicen, por ejemplo dos actas con un límite distinto, no se elige uno en silencio. Se escribe `[POR CONFIRMAR: el acta del 03/09 dice 5 días y la del 10/09 dice 3]`.

### Diagramas

Los nombres de archivo dicen a qué espacio va cada diagrama. El número de módulo siempre lleva dos dígitos, para que la carpeta se ordene sola.

| Archivo | Espacio |
|---|---|
| `modulo-01-<nombre>.png` | Diagrama BPMN del Módulo 1 |
| `modulo-01-<nombre>-b.png` | Segundo diagrama del Módulo 1, en otro espacio seguido del primero |
| `base-de-datos.png` | Diagrama de base de datos |
| `arquitectura.png` | Diagrama de arquitectura |

Se reconoce el número de módulo con o sin cero a la izquierda (`modulo-1-...` y `modulo-01-...`), y también se aceptan diagramas en una carpeta `bpmn/` en lugar de `diagramas/`, porque muchos proyectos ya los guardan así. Al crear archivos nuevos se usan los dos dígitos.

- El diagrama que se pega va en PNG, porque Google Docs no admite SVG. El `.bpmn` o el `.svg` editable se guarda con el mismo nombre al lado del PNG. Para pasar un `.bpmn` a PNG está `bpmn-to-image` (`npx bpmn-to-image modulo-01.bpmn:modulo-01.png --scale 2`), y solo se ejecuta si el usuario lo pide.
- Si la carpeta usa otros nombres, se arma una tabla con la asignación propuesta de cada archivo a su espacio y se confirma con el usuario una sola vez antes de seguir.
- Un diagrama que no corresponde a ningún módulo se lista al usuario. No se crea un módulo para darle lugar.
- Un módulo sin diagrama conserva su espacio con `Archivo: no encontrado en la carpeta`.

---

## Paso 1 — Reunir contexto antes de escribir

Un documento inventado es peor que no tener documento, porque el equipo lo toma como referencia y arrastra los errores hasta producción.

1. Lee primero todo lo que el usuario ya entregó, es decir los insumos de la carpeta del Paso 0, notas, transcripciones, capturas, un proceso AS-IS o una conversación previa. De ahí salen los módulos, los actores, las reglas y el vocabulario. Usa las palabras del negocio, no unas genéricas.
2. Si falta información esencial, pregunta una sola vez y en bloque, con un máximo de seis preguntas. Lo esencial suele ser qué problema resuelve el sistema, quiénes lo usan y con qué rol, dónde empieza y termina el alcance, qué sistemas externos toca y qué queda fuera.
3. No inventes en silencio. Cuando falte un dato y el usuario prefiera avanzar, escribe `[POR CONFIRMAR: ...]` en el punto exacto. Cuando propongas algo que el usuario no dijo, márcalo `[PROPUESTA]`. Esa distinción es lo que permite revisar el documento con confianza.

Si el usuario pide un borrador rápido sin preguntas, avanza con supuestos y reúnelos todos en una sección corta al final, en lugar de dejarlos regados.

---

## Paso 2 — Definir los módulos

Un módulo agrupa funcionalidades que comparten un propósito de negocio y, casi siempre, un mismo grupo de usuarios. Se numeran Módulo 1, Módulo 2, y así.

Criterios para cortarlos bien.

- Divide por proceso o dominio del negocio, como Solicitudes, Aprobaciones, Despacho o Facturación. No dividas por pantalla ni por tabla.
- Un módulo con una sola funcionalidad casi siempre pertenece a otro módulo. Uno con más de diez suele ser dos.
- Lo normal son de 4 a 8 módulos, con 3 a 8 funcionalidades cada uno.
- Incluye los módulos transversales que se olvidan con frecuencia, como administración de usuarios y permisos, configuración o parámetros, y reportes.

Cada módulo se presenta con esta estructura.

1. Título con la forma `Módulo N — [Nombre]`
2. Descripción de 2 a 4 oraciones que diga qué abarca, quién lo usa, dónde empieza y dónde termina
3. Espacio rotulado para el diagrama BPMN del módulo
4. Las funcionalidades del módulo

El espacio del diagrama va entre la descripción y las funcionalidades, porque la persona que inserte el diagrama necesita que quede antes del detalle.

---

## Paso 3 — Escribir las funcionalidades

Esta es la parte más importante del documento. Cada funcionalidad se escribe con esta estructura, sin excepción.

```markdown
#### F1.1 — [La funcionalidad, como oración de sujeto, verbo y predicado]

**Qué:** [1 a 3 oraciones]

**Cómo:** [2 a 5 oraciones, en lenguaje natural]

**Para qué:** [1 a 2 oraciones]
```

El código `F<módulo>.<consecutivo>` es obligatorio, porque es lo que permite que las historias de usuario y el diagrama del módulo apunten a algo concreto.

En la entrega, el qué, el cómo y el para qué van dentro de un cuadro de dos columnas, como lo define la skill `formato-documento-requisitos`. En el Markdown se pueden escribir como párrafos con su etiqueta, porque `scripts/md_a_html.py` los convierte en cuadro al generar el Google Doc.

### Atributos opcionales

ISO/IEC/IEEE 29148 recomienda que cada requisito tenga atributos que permitan gestionarlo. El "para qué" ya cumple el papel de la justificación (*rationale*). Los demás se agregan como líneas al final del cuadro, en este orden, y solo cuando hay información real para llenarlos.

| Atributo | Cuándo se agrega | Ejemplo |
|---|---|---|
| **Prioridad:** | Solo si el usuario trabaja con prioridades. Se usa su escala, o MoSCoW (Debe, Debería, Podría, No por ahora) si él la elige | Debe |
| **Origen:** | Cuando la funcionalidad sale de un insumo concreto de la carpeta | Acta de reunión del 10/09/2026, `insumos/acta-2026-09-10.md` |
| **Verificación:** | Cuando el usuario pide plan de pruebas o trazabilidad formal. Valores de la norma: prueba, demostración, inspección o análisis | Prueba |

### El enunciado de la funcionalidad

Una oración corta con sujeto explícito, verbo en presente activo y predicado. El sujeto es quien ejecuta, como el sistema, el vendedor, el supervisor o el administrador. Máximo unas quince palabras.

Para revisarlo, fíjate en dos cosas. Si hay una "y" que une dos verbos, son dos funcionalidades y hay que separarlas. Si no hay verbo, es un título de módulo disfrazado.

| ❌ Mal | Por qué | ✅ Bien |
|---|---|---|
| Gestión de usuarios | Es un título, no una capacidad | El administrador crea cuentas de usuario, y aparte, el administrador desactiva cuentas de usuario |
| El sistema debe permitir que los usuarios puedan gestionar sus pedidos y ver su historial | Relleno y dos capacidades en una | El vendedor registra un pedido nuevo |
| Notificaciones | Demasiado vago | El sistema notifica al vendedor cuando su solicitud cambia de estado |

### El "qué"

Delimita el alcance de esa funcionalidad, es decir qué entra, qué información maneja y, cuando importe, qué no cubre. Es el lugar para las reglas duras, como obligatoriedad, límites y estados posibles.

No repitas el enunciado con otras palabras. Si el "qué" se lee igual que el título, está mal escrito.

**Reglas de negocio compartidas.** Cuando una misma regla condiciona dos o más funcionalidades, por ejemplo "una solicitud solo se aprueba una vez" o "el límite de la zona es configurable", no se copia en cada "qué". Se escribe una sola vez en el anexo **Reglas de negocio** con un código `RN-01`, y cada "qué" la cita ("según RN-01"). Así, cuando la regla cambia, se corrige en un solo lugar y no quedan dos versiones distintas. Una regla que solo afecta a una funcionalidad se queda en su "qué".

### El "cómo"

Un recorrido práctico de la funcionalidad, contado como se lo explicarías a alguien del negocio que nunca ha visto el sistema. Debe quedar claro qué dispara la acción, qué ve el usuario, qué decide y qué pasa después.

- Incluye roles, bandejas o pantallas, estados y sus transiciones, validaciones visibles, y qué ocurre tanto en el camino normal como en el alterno.
- Deja fuera nombres de frameworks, tablas, endpoints, lenguajes y librerías. Eso pertenece al apartado de arquitectura.

Si alguien del negocio no puede imaginarse usando la funcionalidad después de leer el "cómo", falta detalle. Si aparece la palabra "API" o "tabla", sobra técnica.

### El "para qué"

La razón de existir, es decir qué problema, pérdida de tiempo, error o riesgo elimina. Funciona mejor cuando menciona el dolor actual, como que hoy algo se lleva en un cuaderno o se aprueba por mensajería sin registro.

Si el "para qué" serviría igual para cualquier otra funcionalidad del documento, es relleno. Si no puedes escribirlo, la funcionalidad probablemente no debería existir.

### Ejemplo de una funcionalidad completa

```markdown
#### F2.3 — El supervisor aprueba o devuelve las solicitudes pendientes de su zona

**Qué:** Cubre la decisión sobre cada solicitud cargada por los vendedores de la zona
a cargo del supervisor. Una solicitud solo puede aprobarse una vez y siempre queda
asociada a quien la aprobó. No cubre las excepciones por encima del límite de la zona,
que corresponden a F2.4.

**Cómo:** Cuando un vendedor envía una solicitud, esta queda en estado "Por aprobar" y
aparece en la bandeja del supervisor de su zona, ordenada por antigüedad. El supervisor
ve el cliente, el monto y la condición pedida frente a la condición estándar, y decide
si la aprueba o la devuelve. Si la aprueba, la solicitud pasa a "Aprobada" y el vendedor
recibe el aviso. Si la devuelve, tiene que escribir una observación y la solicitud vuelve
a "En edición" con el comentario visible para el vendedor.

**Para qué:** Hoy las aprobaciones se piden por mensajería y no queda rastro de quién
autorizó cada excepción ni por qué. Centralizar la decisión reduce el tiempo de espera
del vendedor y deja el soporte que auditoría necesita para revisar condiciones fuera de
lo estándar.
```

### Checklist para no dejar funcionalidades fuera

Recorre esta lista módulo por módulo antes de cerrar el apartado. No todo aplica siempre, pero cada omisión tiene que ser una decisión y no un olvido.

- Registrar, modificar y anular o desactivar los objetos del módulo
- Consultar, buscar y filtrar
- Validaciones y reglas que bloquean
- Estados y transiciones, con quién los cambia y bajo qué condición
- Permisos por rol, es decir quién ve qué y quién puede hacer qué
- Notificaciones y avisos
- Reportes, exportaciones y consolidados
- Trazabilidad de lo que queda registrado, con autor y fecha
- Parámetros configurables, como límites, plazos y listas
- Carga inicial o migración de datos existentes
- Integraciones con otros sistemas

---

## Paso 4 — Historias de usuario

Cada historia usa el formato clásico y apunta a una o más funcionalidades.

```markdown
### HU-07 — Aprobación de solicitudes
**Como** supervisor de zona,
**quiero** revisar en una sola bandeja las solicitudes pendientes de mi zona,
**para** responderlas el mismo día sin buscarlas en mensajes sueltos.

*Funcionalidades relacionadas: F2.3, F2.5*

**Criterios de aceptación**
- **Dado** que existen solicitudes en estado "Por aprobar" de mi zona, **cuando** entro a la bandeja, **entonces** las veo ordenadas de la más antigua a la más reciente.
- **Dado** que devuelvo una solicitud, **cuando** no escribo observación, **entonces** el sistema no me deja completar la devolución.
```

Reglas para este apartado.

- Escribe desde la perspectiva del rol y con sus palabras. El beneficio nunca es "para poder usar el sistema".
- De 2 a 5 criterios de aceptación por historia, en formato Dado, Cuando, Entonces, todos verificables. Incluye al menos un caso negativo o de borde.
- Toda funcionalidad debería estar cubierta por alguna historia. Si una funcionalidad no le sirve a ningún rol, cuestiónala.
- Agrupa las historias por módulo y en el mismo orden del apartado anterior.
- Agrega prioridad solo si el usuario trabaja con prioridades. Si no la pidió, no la inventes.
- Los criterios de aceptación describen lo que el usuario observa, no la pantalla ni el componente. "Veo la solicitud en la bandeja" sirve. "Se muestra un modal verde" ata la historia a un diseño que todavía no existe.

Revisa cada historia con el criterio INVEST de Bill Wake.

| Letra | Pregunta | Si falla |
|---|---|---|
| Independiente | ¿Se puede entregar sin esperar otra historia? | Une las dos o reparte el valor |
| Negociable | ¿Dice qué necesita el rol, sin fijar la solución? | Quita los detalles de diseño |
| Valiosa | ¿El "para" nombra un beneficio que el rol reconoce? | Reescribe el beneficio con sus palabras |
| Estimable | ¿El equipo sabría cuánto cuesta? | Falta información, márcala `[POR CONFIRMAR]` |
| Pequeña | ¿Cabe en una iteración? | Pártela por camino normal y alterno, o por regla |
| Comprobable | ¿Sus criterios Dado, Cuando, Entonces se pueden probar? | Reescribe los criterios con datos concretos |

---

## Paso 5 — Base de datos

Este apartado se entrega como estructura vacía. No modeles entidades, no escribas tablas de campos y no dibujes el diagrama.

Arma el apartado así.

```markdown
# 3. Base de datos

> **[ESPACIO — Diagrama de base de datos]**
> *Insertar aquí el modelo entidad-relación del sistema.*

> **[ESPACIO — Enlace al documento de base de datos]**
> *Insertar aquí el enlace al documento donde están las tablas, los campos, los tipos y las reglas de integridad.*

## Notas
> **[ESPACIO — Observaciones sobre el modelo de datos]**
```

Si durante la redacción de las funcionalidades detectas que hace falta un dato que no tiene dónde vivir, anótalo como hallazgo en la sección de supuestos y puntos por confirmar. No lo resuelvas creando entidades.

---

## Paso 6 — Arquitectura

Mismo criterio que el apartado anterior. Estructura vacía, sin proponer stack ni componentes.

```markdown
# 4. Arquitectura

> **[ESPACIO — Diagrama de arquitectura]**
> *Insertar aquí el diagrama de componentes del sistema.*

> **[ESPACIO — Enlace al documento de arquitectura]**
> *Insertar aquí el enlace al documento técnico, si existe.*

## Requisitos de calidad

| Código | Categoría | Requisito | Criterio de medición |
|---|---|---|---|
| RNF-01 | [Categoría] | [Lo que dijo el usuario] | [Número verificable] |

## Notas
> **[ESPACIO — Stack, integraciones, seguridad y despliegue]**
```

Si el usuario ya definió tecnologías o integraciones y quiere dejarlas escritas, escríbelas tal como las dijo. No agregues las que no mencionó.

### Requisitos de calidad

Son los requisitos no funcionales, es decir cuán rápido, seguro, disponible o accesible debe ser el sistema. Van en este apartado, como en la sección 10 de arc42, porque son los que más condicionan la arquitectura. Se escriben con el mismo criterio de no inventar.

- Solo se escriben los que el usuario o los insumos dicen. No se completan con valores "típicos" de la industria.
- Cada uno lleva un **criterio de medición** con número, unidad y condición, por ejemplo "el muro carga en menos de 2 s con 200 usuarios simultáneos en una conexión de 10 Mbps". Si el usuario dio la intención pero no el número, el criterio dice `[POR CONFIRMAR: tiempo máximo aceptable]`.
- La categoría sale del modelo de calidad ISO/IEC 25010:2023. Sus nueve características son adecuación funcional, eficiencia de desempeño, compatibilidad, capacidad de interacción (antes usabilidad), fiabilidad, seguridad de la información, mantenibilidad, flexibilidad (antes portabilidad) y protección (*safety*).
- Si no hay ninguno, la tabla se reemplaza por un espacio rotulado, y en los supuestos se agrega un `[POR CONFIRMAR]` que lista las categorías que el usuario debería revisar, como mínimo rendimiento, seguridad de la información, disponibilidad y accesibilidad. Un documento sin requisitos de calidad se entrega así, pero nunca en silencio.
- Las leyes y normas que el sistema debe cumplir, como protección de datos personales o accesibilidad, se escriben aquí con su nombre exacto y solo si el usuario las mencionó.

---

## Paso 7 — Revisión final

Antes de entregar, revisa en este orden.

- Cada historia de usuario apunta a funcionalidades que existen con ese código.
- Cada módulo tiene su descripción y su espacio de diagrama rotulado.
- Los espacios de los apartados 3 y 4 están vacíos y bien rotulados, sin contenido inventado. Lo único escrito ahí son tecnologías y requisitos de calidad que el usuario dio.
- Los términos del negocio se escriben igual en todo el documento. Si en el módulo 1 es "solicitud", en el módulo 3 no es "pedido".
- Ninguna oración usa dos puntos para unir ideas normales, salvo las etiquetas **Qué:**, **Cómo:**, **Para qué:**, **Archivo:**, los atributos opcionales y el contenido de las tablas.
- Cada espacio de diagrama tiene su línea `Archivo:` cuando se trabajó con carpeta, y ningún archivo de `diagramas/` quedó sin asignar ni sin avisar.
- Cada insumo de la carpeta aparece en Referencias.
- Ninguna palabra de la tabla de términos ambiguos quedó en un "qué", un criterio de aceptación o un requisito de calidad.
- Cada requisito de calidad tiene un criterio de medición con número o un `[POR CONFIRMAR]`. Si no hay requisitos de calidad, los supuestos lo dicen.

Después, revisa cada funcionalidad con las características de un buen requisito de ISO/IEC/IEEE 29148. Una funcionalidad que falla en alguna se reescribe o se marca `[POR CONFIRMAR]`.

| Característica | Pregunta de revisión |
|---|---|
| Necesaria | ¿El "para qué" nombra un problema real que desaparece si se quita? |
| Singular | ¿El enunciado tiene un solo verbo principal? |
| No ambigua | ¿El "qué" admite una sola lectura, sin "rápido", "fácil", "adecuado" ni "etc."? |
| Verificable | ¿Se puede escribir al menos un criterio Dado, Cuando, Entonces que la pruebe? |
| Factible | ¿Se puede construir con lo que el usuario dijo que tiene? |
| Completa | ¿El "cómo" cubre el camino normal y el alterno? |
| Correcta | ¿Coincide con lo que dicen los insumos? |
| Conforme | ¿Sigue la plantilla y los códigos de esta skill? |
| Apropiada | ¿Describe qué hace el sistema y no cómo se programa? |

Y revisa el conjunto. Ninguna funcionalidad contradice a otra, ninguna está repetida con otro nombre, la matriz de trazabilidad no tiene filas sin historia, y cada regla de negocio citada existe en su anexo.

---

## Actualizar un documento existente

Un documento de requerimientos aprobado es una línea base. Otros documentos, pruebas, tickets y diagramas citan sus códigos, así que actualizarlo exige cuidado.

1. Lee el documento vigente completo antes de cambiar nada, y lee los insumos nuevos.
2. **Los códigos no se renumeran nunca.** Una funcionalidad nueva toma el siguiente número libre de su módulo, aunque quede al final. Una funcionalidad eliminada conserva su título con la marca "Eliminada en vX.Y" y su código no se reutiliza. Lo mismo vale para HU, RN y RNF.
3. Una funcionalidad que cambia de módulo conserva su código anterior y anota "Movida al Módulo N en vX.Y", y en el módulo nuevo se crea con código nuevo y una referencia al anterior.
4. Sube la versión con la regla de la skill de formato. Un cambio de redacción sube el decimal. Agregar, quitar o cambiar el alcance de un requisito sube el entero.
5. Agrega una fila al control de versiones que diga qué códigos se agregaron, cambiaron o eliminaron, por ejemplo "Agrega F2.6 y HU-14, cambia el alcance de F1.3, elimina F4.2".
6. Si el documento ya está en Google Docs y tiene comentarios o revisiones, no se vuelve a generar desde cero, porque se perderían. Los cambios se hacen sobre el documento con el MCP, siguiendo las reglas de edición de la skill `google-workspace`, y el Markdown de `salida/` se actualiza igual para que no queden dos versiones.

---

## Formato de entrega

El documento abre con un encabezado breve antes de los cuatro apartados, con el control de versiones, el espacio del índice, el nombre del sistema, el propósito en un párrafo, el alcance de lo que entra y lo que queda fuera, los actores, las convenciones y las referencias. Agrega un glosario corto si hay términos propios del negocio.

**Convenciones.** Las funcionalidades se escriben en presente ("el supervisor aprueba"), que describe el sistema que se construirá. Para que eso no se lea como una descripción opcional, el documento lo declara una vez, con este texto o uno equivalente. "Cada funcionalidad de este documento es obligatoria para la versión que se entrega, salvo que su prioridad diga otra cosa. Los códigos F, HU, RN y RNF son identificadores permanentes y no se reutilizan. Las marcas [PROPUESTA] y [POR CONFIRMAR] señalan lo que todavía no está validado."

Cierra con los anexos, es decir la matriz de trazabilidad, las reglas de negocio compartidas si las hay, y los supuestos y puntos por confirmar. La matriz se arma con lo que el documento ya contiene, una fila por funcionalidad con sus historias, sus reglas y su diagrama, así que no inventa nada.

Esta estructura sigue la de ISO/IEC/IEEE 29148, que reemplazó a IEEE 830, pero conserva los cuatro apartados de la skill.

| Parte del documento | Parte equivalente de 29148 |
|---|---|
| Propósito, Alcance, Glosario, Referencias | Introducción |
| Actores | Características de los usuarios |
| 1. Funcionalidades | Requisitos funcionales, organizados por módulo |
| 2. Historias de usuario | Escenarios de uso y criterios de verificación |
| 3. Base de datos | Requisitos de datos lógicos |
| 4. Arquitectura | Restricciones de diseño, interfaces y requisitos de calidad |
| Anexos | Trazabilidad, reglas de negocio, supuestos y dependencias |

### Dónde se entrega

1. **Google Docs**, cuando está conectado el MCP de Google Drive y Google Docs y el usuario no pidió otro formato. Se escribe primero el Markdown en `salida/` y después se genera el Google Doc siguiendo `references/google-docs.md`. Ese flujo aplica el formato de la skill `formato-documento-requisitos` con `scripts/gdocs_formato.py`.
2. **Documento editable de la sesión**, cuando no hay MCP de Google pero la sesión ofrece otro tipo de documento editable.
3. **Archivo `.md`** en `salida/`, si no hay ninguna de las dos opciones.
4. Si el usuario pide Word, PDF o PowerPoint por nombre, se usa la skill de ese formato.

En todos los casos el documento se puede comentar en equipo y la persona puede pegar sus diagramas en los espacios.

No entregues el documento solo dentro del chat, porque es material de referencia que se vuelve a abrir.

---

## Archivos de referencia

- `references/plantilla.md` es el esqueleto vacío del documento, con todos los espacios ya rotulados. Cópialo cuando empieces desde cero.
- `references/ejemplo-completo.md` es un documento corto pero terminado. Consúltalo cuando dudes del nivel de detalle o del tono.
- `references/google-docs.md` es el flujo paso a paso para generar el documento en Google Docs con el MCP. Léelo antes de la primera llamada a Drive o Docs.
- `scripts/md_a_html.py` convierte el Markdown en el HTML que Drive transforma en Google Doc.
- `scripts/gdocs_formato.py` lee el documento creado y produce los lotes de peticiones de formato para `update_doc`, y los saltos de página para cuadros partidos.
- `scripts/revisar_paginas.py` revisa el PDF exportado y dice qué cuadros de funcionalidad quedaron partidos entre páginas.
