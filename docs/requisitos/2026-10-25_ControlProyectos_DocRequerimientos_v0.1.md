# Documento de requerimientos — Sistema de Control de Proyectos y Recursos FaCyT

**Versión:** 0.1 · **Fecha:** 25/10/2026 · **Elaborado por:** Equipo del proyecto, Desarrollo de Aplicaciones Web, Universidad de Carabobo · **Clasificación:** Uso interno

## Control de versiones

| Versión | Fecha | Autor | Descripción del cambio |
|---|---|---|---|
| 0.1 | 25/10/2026 | Equipo del proyecto | Borrador inicial con los requisitos del enunciado, las decisiones D1 a D13 y las propuestas aprobadas RF-35, RF-36, RF-37, IA-01 y RF-38 |

## Índice

> **[ESPACIO — Índice]**
> *En Google Docs, Insertar > Tabla de contenido. En Word, Referencias > Tabla de contenido.*

## Propósito

Una organización académica y empresarial lleva en hojas de cálculo el seguimiento de sus proyectos de física, química y biología. Con ese método no controla bien la materia prima, el uso de los equipos ni los consumibles, y no puede repartir entre los proyectos el costo de los consumibles compartidos que compra por lotes. El sistema registra los proyectos y sus recursos, aplica un flujo de aprobación a los gastos y a los retiros, ordena los proyectos por prioridad y reparte el costo de los consumibles compartidos al cerrar cada período contable.

## Alcance

**Incluye:**

- Cuentas de usuario de tres roles, catálogos y parámetros generales
- Proyectos con estatus, prioridad, hitos, avance físico y ejecución presupuestaria
- Inventario de materia prima y consumibles por lotes, con alertas de stock mínimo y de vencimiento, reposición automática y pronóstico de consumo
- Catálogo de equipos con estado operacional, reservas sin conflictos y registro de uso
- Solicitudes de gasto y de retiro con flujo de aprobación, y priorización de proyectos
- Recepción y despacho de lotes, bitácora inalterable de despachos y corrección de registros mediante solicitud
- Cierre de período contable y prorrateo de los consumibles compartidos
- Dashboard ejecutivo, exportación a PDF y Excel, y registro de auditoría

**No incluye:**

- Cuentas de usuario para los beneficiarios y para el personal general de los laboratorios, según RN-01
- Las 22 propuestas de `insumos/propuestas.md` que no se aprobaron, como el mantenimiento preventivo de equipos o la lectura de códigos QR
- La elección de la pila tecnológica, que el enunciado deja libre al equipo (ver RNF-02)

## Actores

| Rol | Descripción | Responsabilidad principal en el sistema |
|---|---|---|
| Administrador del Sistema | Responsable de la plataforma en toda la organización | Crea y desactiva cuentas, mantiene los catálogos y los parámetros generales, registra los proyectos, consulta el dashboard y la auditoría global |
| Coordinador de Proyecto | Responsable de uno o más proyectos asignados | Carga hitos y avances, registra el uso de materia prima y de equipos, y crea solicitudes de gasto o de retiro de insumos de sus proyectos |
| Aprobador / Gestor de Inventario | Responsable de inventario y finanzas | Aprueba o rechaza solicitudes, recibe y despacha lotes, ajusta prioridades, decide las reservas de equipos, cierra el período contable y ejecuta el prorrateo |

Los beneficiarios y el personal general de los laboratorios no tienen usuario en el sistema, según RN-01.

## Convenciones

Cada funcionalidad de este documento es obligatoria para la versión que se entrega, salvo que su prioridad diga otra cosa. Los códigos F, HU, RN y RNF son identificadores permanentes y no se reutilizan. Las marcas `[PROPUESTA]` y `[POR CONFIRMAR]` señalan lo que todavía no está validado.

La línea **Origen** de cada funcionalidad remite al requisito de trabajo de `insumos/requisitos_base.md` (RF-01 a RF-38, IA-01) y, cuando aplica, a la decisión que lo precisó (D1 a D13).

## Glosario

| Término | Significado |
|---|---|
| Audit log | Registro de auditoría que guarda cada creación, edición, eliminación y cambio de estado, con fecha y hora, usuario y dirección IP |
| Bitácora de despachos | Historial de salidas de almacén que registra fecha, hora, proyecto destino, insumo, cantidad despachada y usuario responsable del retiro |
| Consumible de uso general | Consumible que se compra por lotes institucionales sin asignarlo a un proyecto, por ejemplo guantes de nitrilo, papel absorbente o solventes multipropósito. También se le llama *overhead* |
| Hito | Etapa de un proyecto con un peso que indica cuánto aporta al avance físico total |
| Insumo | Elemento del catálogo unificado de materia prima y consumibles |
| Lote | Cantidad de un insumo que entra al almacén en una misma compra, con fecha de ingreso, costo unitario, proveedor y fecha de vencimiento |
| Período contable | Rango de fechas, mensual o trimestral, cuyo cierre habilita el prorrateo |
| Prorrateo | Reparto del costo de los lotes de consumibles de uso general entre los proyectos activos del período |
| Proyecto activo | Proyecto con estatus operativo "En ejecución", según RN-05 |
| Solicitud | Pedido de gasto o de retiro de insumos que sigue el flujo de estados de RN-03 |

## Referencias

| Insumo | Tipo | Fecha |
|---|---|---|
| `insumos/enunciado Control de Proyectos Quimicos.pdf` | Enunciado del proyecto final, Universidad de Carabobo | 25/10/2026 (fecha del archivo) |
| `insumos/requisitos_base.md` | Requisitos extraídos del enunciado y registro de decisiones D1 a D13 | 25/10/2026 |
| `insumos/benchmarking.md` | Investigación de nueve proyectos similares publicados o activos desde 2021 | 25/10/2026 |
| `insumos/propuestas.md` | Lista de 27 propuestas con su fuente, de las que se aprobaron cinco | 25/10/2026 |

---

# 1. Funcionalidades

## Módulo 1 — Usuarios, catálogos y parámetros

Cubre las cuentas de usuario, el catálogo de ubicaciones y los parámetros generales que usan los demás módulos. Lo usa solo el Administrador del Sistema. Empieza con la creación de la primera cuenta y termina con la desactivación de las cuentas que dejan de usarse. Los catálogos de insumos y de equipos los mantiene también el Administrador, pero se describen en los módulos 3 y 4.

### Diagrama de flujo

> **[ESPACIO — Diagrama BPMN del Módulo 1]**
> *Insertar aquí el diagrama de flujo del módulo.*
> Archivo: no encontrado en la carpeta

### Funcionalidades

#### F1.1 — El administrador crea cuentas de usuario con uno de los tres roles

**Qué:** Cubre el alta de una cuenta con nombre, correo y uno de estos roles, Administrador del Sistema, Coordinador de Proyecto o Aprobador / Gestor de Inventario. El correo es único. No se crean cuentas para beneficiarios ni para personal general de los laboratorios, según RN-01.

**Cómo:** El administrador abre el listado de usuarios y elige crear una cuenta. Llena los datos, elige el rol y guarda. Si el correo ya pertenece a otra cuenta, el sistema muestra esa cuenta y no deja duplicarla. Si todo es válido, la cuenta queda activa y el usuario puede entrar con el rol asignado.

**Para qué:** Cada acción del sistema depende del rol de quien la hace. Sin cuentas por persona y con un rol definido, no se puede saber quién aprobó un gasto ni limitar a cada coordinador a sus proyectos.

**Origen:** RF-01, `insumos/requisitos_base.md`.

#### F1.2 — El administrador cambia el rol o los datos de una cuenta

**Qué:** Cubre la edición del nombre, el correo y el rol de una cuenta existente. El cambio de rol aplica desde la siguiente acción del usuario. Cada cambio queda en el audit log, según RN-06.

**Cómo:** El administrador busca la cuenta en el listado, abre su ficha y modifica los datos. Al guardar, el sistema valida que el correo siga siendo único. Si el usuario era Coordinador y pasa a otro rol, el sistema avisa qué proyectos quedan sin coordinador para que se reasignen con F2.2.

**Para qué:** Las personas cambian de función durante la vida de un proyecto. Sin edición, habría que crear cuentas nuevas y el historial de una persona quedaría partido en dos.

**Origen:** RF-01, `insumos/requisitos_base.md`.

#### F1.3 — El administrador desactiva una cuenta de usuario

**Qué:** Cubre el bloqueo del acceso de una cuenta sin borrarla. Una cuenta desactivada no entra al sistema, pero sus registros históricos siguen asociados a ella.

**Cómo:** El administrador abre la ficha de la cuenta y la desactiva. El sistema pide confirmación porque el usuario pierde el acceso de inmediato. Si la cuenta es Coordinador de un proyecto activo, el sistema lo avisa antes de confirmar. La cuenta se puede reactivar desde la misma ficha.

**Para qué:** Borrar una cuenta rompería la trazabilidad de la bitácora y del audit log, que guardan quién hizo cada cosa. Desactivarla corta el acceso y conserva el historial.

**Origen:** RF-01, `insumos/requisitos_base.md`.

#### F1.4 — El administrador registra las ubicaciones de almacenamiento

**Qué:** Cubre el catálogo de ubicaciones, con nombre y descripción. Una ubicación con lotes asociados no se elimina, solo se desactiva.

**Cómo:** El administrador abre el catálogo de ubicaciones y agrega una nueva. El sistema impide dos ubicaciones activas con el mismo nombre. Las ubicaciones activas aparecen como opciones al registrar la recepción de un lote en F6.1.

**Para qué:** Hoy cada hoja de cálculo nombra los lugares de forma distinta. Un catálogo único evita que el mismo depósito aparezca escrito de varias maneras.

**Origen:** RF-03, `insumos/requisitos_base.md`.

#### F1.5 — El administrador configura los parámetros generales del sistema

**Qué:** Cubre los valores que el resto del documento declara configurables, que son los días de anticipación de la alerta de vencimiento (F3.6) y los meses mínimos de historial para mostrar un pronóstico (F3.7). `[POR CONFIRMAR: lista completa de parámetros generales, porque el enunciado no la detalla]`.

**Cómo:** El administrador abre la pantalla de parámetros, cambia un valor y guarda. El sistema valida que cada valor sea un número entero positivo. El valor nuevo aplica desde ese momento y el cambio queda en el audit log con el valor anterior y el nuevo.

**Para qué:** Los umbrales cambian según el tipo de laboratorio. Dejarlos configurables evita modificar el sistema cada vez que la organización ajusta una política.

**Origen:** RF-02, `insumos/requisitos_base.md`.

## Módulo 2 — Proyectos y avance

Cubre el registro de los proyectos, su estatus operativo, sus hitos y el cálculo de sus dos métricas, avance físico y ejecución presupuestaria. Lo usan el Administrador, que registra los proyectos y asigna su coordinador, y el Coordinador, que carga hitos y avances. Empieza con el registro de un proyecto en estatus "Propuesta" y termina cuando el proyecto pasa a "Finalizado".

### Diagrama de flujo

> **[ESPACIO — Diagrama BPMN del Módulo 2]**
> *Insertar aquí el diagrama de flujo del módulo.*
> Archivo: no encontrado en la carpeta

### Funcionalidades

#### F2.1 — El administrador registra un proyecto con sus atributos obligatorios

**Qué:** Cubre el alta de un proyecto con código único alfanumérico institucional, estatus operativo, nivel de prioridad y presupuesto asignado. Los cuatro datos son obligatorios. El estatus es uno de estos, Propuesta, En ejecución, Suspendido o Finalizado. La prioridad es una de estas, Crítica, Alta, Media o Baja.

**Cómo:** El administrador abre el listado de proyectos y elige registrar uno. Llena el código, el nombre, el presupuesto asignado y la prioridad, y el proyecto nace en estatus "Propuesta". Al guardar, el sistema valida que el código no exista y que el presupuesto sea mayor que cero. Si el código ya existe, muestra el proyecto que lo tiene y no deja duplicarlo.

**Para qué:** Hoy el mismo proyecto aparece con nombres distintos en varias hojas. Un código único y los atributos obligatorios permiten cruzar gastos, consumos y avances del mismo proyecto.

**Origen:** RF-11, RF-12, RF-13, RF-14 y RF-16, decisiones D3 y D9, `insumos/requisitos_base.md`.

#### F2.2 — El administrador asigna el coordinador de un proyecto

**Qué:** Cubre la asignación de una cuenta con rol Coordinador de Proyecto a cada proyecto. Un proyecto tiene un coordinador. Un coordinador puede tener más de un proyecto y solo opera sobre los suyos, según RN-07.

**Cómo:** Desde la ficha del proyecto, el administrador elige el coordinador entre las cuentas activas con ese rol. Si el proyecto ya tenía coordinador, el sistema muestra el cambio para confirmarlo. Desde ese momento el proyecto aparece en la bandeja del nuevo coordinador y desaparece de la del anterior.

**Para qué:** La matriz de roles limita al coordinador a "sus proyectos asignados". Sin una asignación explícita, ese límite no se puede aplicar.

**Origen:** RF-05 a RF-07 (alcance "Sus proyectos asignados"), decisión D3, `insumos/requisitos_base.md`.

#### F2.3 — El administrador cambia el estatus operativo de un proyecto

**Qué:** Cubre el paso de un proyecto entre Propuesta, En ejecución, Suspendido y Finalizado. El estatus "En ejecución" define qué proyectos son activos para el prorrateo y el dashboard, según RN-05. `[PROPUESTA]` Este documento asigna el cambio al Administrador porque él registra los proyectos. El enunciado no dice qué rol lo hace.

**Cómo:** El administrador abre la ficha del proyecto y elige el nuevo estatus. El sistema registra el cambio en el audit log con el estatus anterior y el nuevo. Un proyecto "Finalizado" ya no admite solicitudes nuevas ni reservas de equipos.

**Para qué:** El estatus decide qué proyectos reciben costo de overhead y cuáles aparecen en el dashboard. Si cambia sin registro, el reparto de un período no se puede explicar después.

**Origen:** RF-13, `insumos/requisitos_base.md`.

#### F2.4 — El coordinador registra los hitos de su proyecto con su peso

**Qué:** Cubre la lista de hitos de un proyecto, cada uno con nombre, fecha prevista y peso. La suma de los pesos de un proyecto es 100.

**Cómo:** El coordinador abre su proyecto y agrega los hitos. Al guardar, el sistema muestra la suma de pesos y no deja confirmar la lista si no llega a 100. Mientras la suma no sea 100, el proyecto muestra su avance físico como no disponible.

**Para qué:** El avance físico se calcula a partir de los hitos. Sin pesos, un hito menor pesaría lo mismo que la etapa principal del proyecto.

**Origen:** RF-05 y RF-15, decisión D9 (avance por hitos ponderados, tomado de ERPNext), `insumos/requisitos_base.md`.

#### F2.5 — El coordinador carga el avance de un hito

**Qué:** Cubre el registro del porcentaje completado de cada hito, de 0 a 100, con fecha y comentario opcional. Cada carga se guarda como un registro nuevo y no borra la anterior.

**Cómo:** El coordinador abre el hito y escribe el porcentaje alcanzado. El sistema rechaza valores fuera de 0 a 100. Al guardar, el sistema recalcula el avance físico del proyecto con F2.6 y muestra el historial de cargas del hito.

**Para qué:** Hoy el avance se reporta de palabra o en correos sueltos. Un historial de cargas por hito muestra cómo avanzó el proyecto en el tiempo.

**Origen:** RF-05, `insumos/requisitos_base.md`.

#### F2.6 — El sistema calcula el avance físico del proyecto por hitos ponderados

**Qué:** Cubre el porcentaje de avance físico, que es la suma del avance de cada hito multiplicado por su peso y dividido entre 100. El resultado va de 0 % a 100 %.

**Cómo:** Cada vez que el coordinador carga un avance o cambia los hitos, el sistema recalcula el porcentaje y lo muestra en la ficha del proyecto y en el listado. Por ejemplo, un hito de peso 60 completo al 50 % y uno de peso 40 completo al 100 % dan un avance de 70 %.

**Para qué:** El enunciado exige el porcentaje de avance físico como métrica obligatoria. Calcularlo con una regla fija evita que cada coordinador lo estime a su manera.

**Origen:** RF-15, decisión D9, `insumos/requisitos_base.md`.

#### F2.7 — El sistema calcula la ejecución presupuestaria del proyecto

**Qué:** Cubre el porcentaje de ejecución presupuestaria, que es el gasto ejecutado del proyecto dividido entre su presupuesto asignado. `[PROPUESTA]` El gasto ejecutado suma las solicitudes de gasto en estado "Ejecutado", el costo de los insumos despachados al proyecto y el overhead que el prorrateo le asignó.

**Cómo:** Cada vez que una solicitud pasa a "Ejecutado", que se registra un despacho o que se ejecuta un prorrateo, el sistema recalcula el porcentaje. La ficha del proyecto muestra el presupuesto asignado, el gasto ejecutado y el porcentaje. Si el gasto supera el presupuesto, el porcentaje pasa de 100 % y se muestra así, sin recortarlo.

**Para qué:** Hoy nadie sabe cuánto lleva gastado un proyecto hasta que se consolidan las hojas a fin de mes. El porcentaje al día deja ver a tiempo qué proyecto se está pasando de su presupuesto.

**Origen:** RF-16, decisión D9, `insumos/requisitos_base.md`.

## Módulo 3 — Inventario de materia prima y consumibles

Cubre el catálogo unificado de insumos, el stock por lote y los avisos que se derivan de él, es decir el stock mínimo, la reposición, el vencimiento y el pronóstico de consumo. Lo usan el Administrador, que mantiene el catálogo y el stock mínimo, y el Aprobador / Gestor de Inventario, que recibe los avisos. Empieza con el alta de un insumo en el catálogo y termina con los avisos que llevan a reponerlo. La entrada y la salida física de lotes están en el Módulo 6.

### Diagrama de flujo

> **[ESPACIO — Diagrama BPMN del Módulo 3]**
> *Insertar aquí el diagrama de flujo del módulo.*
> Archivo: no encontrado en la carpeta

### Funcionalidades

#### F3.1 — El administrador registra un insumo en el catálogo unificado

**Qué:** Cubre el alta de materia prima y de consumibles en un mismo catálogo, con nombre, unidad de medida y tipo. El tipo indica si el insumo es materia prima, consumible de un proyecto o consumible de uso general. Los consumibles de uso general siguen RN-02.

**Cómo:** El administrador abre el catálogo y agrega un insumo. Elige el tipo y la unidad de medida. El sistema impide dos insumos activos con el mismo nombre y la misma unidad. El insumo nace con stock cero, que solo cambia con recepciones y despachos.

**Para qué:** Hoy la materia prima y los consumibles viven en hojas distintas. Un catálogo único da un solo lugar para consultar existencias y marca qué insumos entran al prorrateo.

**Origen:** RF-03 y RF-17, `insumos/requisitos_base.md`.

#### F3.2 — El administrador configura el stock mínimo de cada insumo

**Qué:** Cubre la cantidad mínima de cada insumo, en su unidad de medida. Un insumo sin stock mínimo configurado no genera alertas ni reposiciones.

**Cómo:** Desde la ficha del insumo, el administrador escribe el stock mínimo y guarda. El sistema valida que sea un número positivo. Si el stock actual ya está por debajo del valor nuevo, la alerta de F3.4 aparece de inmediato.

**Para qué:** Cada insumo se consume a un ritmo distinto. Un mínimo por insumo hace que la alerta llegue a tiempo para los de alto consumo sin llenar de avisos los que casi no se usan.

**Origen:** RF-19, decisión D3, `insumos/requisitos_base.md`.

#### F3.3 — El sistema actualiza el stock en la misma operación que registra cada movimiento

**Qué:** Cubre el stock de cada insumo y de cada lote. Aumenta con cada recepción (F6.1) y disminuye con cada despacho (F6.2) en la misma operación que los registra, según RNF-10.

**Cómo:** Cuando el aprobador confirma una recepción o un despacho, el sistema guarda el movimiento y ajusta el stock al mismo tiempo. Si una de las dos cosas falla, no se guarda ninguna y el aprobador ve el error. La ficha del insumo muestra el stock total y el stock de cada lote.

**Para qué:** Hoy el stock de la hoja de cálculo se actualiza cuando alguien se acuerda. Un stock que cambia con el propio movimiento evita despachar lo que ya no hay.

**Origen:** RF-18, decisión D13, `insumos/requisitos_base.md`.

#### F3.4 — El sistema alerta cuando un insumo baja de su stock mínimo

**Qué:** Cubre el aviso que aparece cuando el stock total de un insumo queda por debajo de su stock mínimo. La alerta se mantiene mientras el stock siga por debajo y desaparece cuando una recepción lo devuelve al mínimo o más.

**Cómo:** Después de cada despacho, el sistema compara el stock con el mínimo. Si queda por debajo, el insumo aparece marcado en el listado del inventario y en las alertas críticas del dashboard (F8.1). La marca muestra el stock actual y el mínimo configurado.

**Para qué:** Hoy los faltantes se descubren cuando alguien va a buscar el insumo y no está. La alerta avisa antes de que el faltante detenga un experimento.

**Origen:** RF-19, `insumos/requisitos_base.md`.

#### F3.5 — El sistema crea una solicitud de reposición cuando un insumo baja de su mínimo

**Qué:** Cubre la creación automática de una solicitud de gasto en estado "Borrador" para reponer el insumo. No se crea una segunda solicitud mientras exista otra abierta para el mismo insumo. La solicitud sigue el flujo de RN-03 y no compra nada por sí sola.

**Cómo:** Cuando aparece la alerta de F3.4, el sistema crea la solicitud de reposición con el insumo y la marca "Reposición automática", y la deja en la bandeja del aprobador. El aprobador revisa la cantidad, la corrige si hace falta y la envía a aprobación, o la descarta. `[POR CONFIRMAR: qué rol aprueba una solicitud de reposición que el propio Aprobador envía]`.

**Para qué:** Una alerta que nadie atiende no evita el faltante. Convertirla en una solicitud la pone dentro del flujo de aprobación, donde alguien tiene que decidir. ERPNext advierte que una solicitud automática se revisa antes de comprar, porque la regla de reorden puede estar desactualizada.

**Origen:** RF-37, `insumos/propuestas.md`, basado en ERPNext (Material Request por nivel de reorden) y NEMO (aviso al cruzar el umbral).

#### F3.6 — El sistema alerta los lotes próximos a vencer

**Qué:** Cubre el aviso para cada lote cuya fecha de vencimiento cae dentro de los días de anticipación configurados en F1.5. Un lote vencido aparece con el estado "Vencido" y no se puede despachar, según F6.2.

**Cómo:** Cada día el sistema compara la fecha de vencimiento de cada lote con stock contra la fecha actual. Los lotes dentro del plazo aparecen marcados como "Próximo a vencer" en el inventario, con los días que faltan. Al pasar la fecha, el lote cambia a "Vencido". `[POR CONFIRMAR: días de anticipación iniciales]`.

**Para qué:** Reactivos, solventes y medios biológicos vencen. Hoy se puede despachar un lote caducado sin que nadie lo note, y eso arruina el experimento que lo usa.

**Origen:** RF-36, `insumos/propuestas.md`, basado en ERPNext (Batch con fecha de vencimiento).

#### F3.7 — El sistema pronostica el consumo de cada insumo para el próximo período

**Qué:** Cubre el cálculo del consumo esperado de cada insumo en el próximo período contable, a partir del historial de la bitácora de despachos. El pronóstico solo se muestra para insumos con al menos los meses de historial configurados en F1.5. El pronóstico no crea solicitudes ni compras.

**Cómo:** Al cerrar cada período, el sistema recalcula el pronóstico de cada insumo con los despachos registrados hasta ese momento. La ficha del insumo muestra el consumo esperado junto al stock actual y al stock mínimo. Si el insumo no tiene historial suficiente, la ficha dice "Sin historial suficiente para pronosticar".

**Para qué:** Hoy el stock mínimo se fija a ojo y la alerta llega cuando el insumo ya está bajo. El pronóstico da una base para anticipar el consumo con datos que el sistema ya guarda.

**Origen:** IA-01, `insumos/propuestas.md`, basado en Regulski et al. (2024), DOI 10.3390/app14062429, y Opaliński et al. (2026), DOI 10.3390/app16104865.

## Módulo 4 — Equipos y reservas

Cubre el catálogo de equipos y maquinaria, su estado operacional, las reservas previas y el registro de uso de cada equipo. Lo usan el Administrador, que mantiene el catálogo, el Coordinador, que pide reservas y registra el uso, y el Aprobador, que decide las reservas. Empieza con el alta de un equipo y termina con el registro de su uso, que alimenta la hoja de vida del equipo (F8.4).

### Diagrama de flujo

> **[ESPACIO — Diagrama BPMN del Módulo 4]**
> *Insertar aquí el diagrama de flujo del módulo.*
> Archivo: no encontrado en la carpeta

### Funcionalidades

#### F4.1 — El administrador registra un equipo en el catálogo de activos

**Qué:** Cubre el alta de un equipo o máquina con nombre, código de activo, ubicación y estado operacional inicial. El código de activo es único.

**Cómo:** El administrador abre el catálogo de equipos y agrega uno. Elige la ubicación entre las del catálogo de F1.4. El equipo nace en estado "Disponible". El sistema impide dos equipos con el mismo código de activo.

**Para qué:** Sin un catálogo, cada proyecto conoce solo los equipos que usa. Un catálogo único muestra qué equipos tiene la organización y dónde están.

**Origen:** RF-03 y RF-21, `insumos/requisitos_base.md`.

#### F4.2 — El administrador cambia el estado operacional de un equipo

**Qué:** Cubre el paso de un equipo entre Disponible, En uso y En mantenimiento. Un equipo En mantenimiento no admite reservas nuevas.

**Cómo:** El administrador abre la ficha del equipo y elige el nuevo estado. Si el equipo pasa a "En mantenimiento" y tiene reservas aprobadas a futuro, el sistema las lista y avisa a cada coordinador afectado. El cambio queda en el audit log.

**Para qué:** Hoy un coordinador se entera de que el equipo está en reparación cuando llega al laboratorio. El estado visible evita reservar o planificar sobre un equipo que no se puede usar.

**Origen:** RF-21, `insumos/requisitos_base.md`. El actor sale de la matriz de roles, porque el Administrador mantiene el catálogo de equipos.

#### F4.3 — El coordinador solicita la reserva de un equipo para su proyecto

**Qué:** Cubre la reserva previa de un equipo con fecha y hora de inicio y de fin, para uno de los proyectos del coordinador. La reserva sigue la regla de RF-29, según la cual toda asignación de recursos sigue el flujo de estados de RN-03.

**Cómo:** El coordinador abre el calendario del equipo, ve los horarios ya ocupados y elige un rango libre. Indica el proyecto y envía la solicitud. La reserva queda pendiente y aparece en la bandeja del aprobador.

**Para qué:** Hoy los equipos se reservan de palabra y dos proyectos llegan a la misma hora. La reserva previa ordena el uso de los equipos compartidos.

**Origen:** RF-22 y RF-29, decisiones D3 y D5, `insumos/requisitos_base.md`.

#### F4.4 — El sistema impide reservas superpuestas de un mismo equipo

**Qué:** Cubre la validación que rechaza una reserva cuyo rango se cruza con otra reserva pendiente o aprobada del mismo equipo. También rechaza reservas de un equipo En mantenimiento.

**Cómo:** Al enviar una reserva, el sistema compara el rango con las reservas existentes del equipo. Si hay cruce, no la guarda y muestra el horario que choca y los rangos libres más cercanos. Si el equipo está En mantenimiento, muestra ese estado y no deja enviar.

**Para qué:** El enunciado pide prevenir conflictos de agendamiento entre proyectos. Rechazar el cruce al momento de pedir evita que el conflicto aparezca el día del experimento.

**Origen:** RF-22, `insumos/requisitos_base.md`.

#### F4.5 — El aprobador aprueba o rechaza las reservas de equipos

**Qué:** Cubre la decisión sobre cada reserva pendiente. Una reserva rechazada no vuelve a pendiente, según RN-03.

**Cómo:** El aprobador ve en su bandeja las reservas pendientes, ordenadas por fecha de inicio, con el equipo, el proyecto y su prioridad. Al aprobar, la reserva queda firme en el calendario del equipo. Al rechazar, el horario se libera y el coordinador ve la reserva como rechazada.

**Para qué:** Cuando dos proyectos necesitan el mismo equipo en fechas cercanas, alguien con vista del conjunto tiene que decidir. La decisión registrada deja claro quién asignó el equipo y cuándo.

**Origen:** RF-22, decisión D3, `insumos/requisitos_base.md`.

#### F4.6 — El coordinador registra el uso de un equipo en su proyecto

**Qué:** Cubre el registro de cada uso real de un equipo, con fecha, hora de inicio y de fin, proyecto y observaciones. Un uso puede asociarse a una reserva aprobada o registrarse sin ella. `[POR CONFIRMAR: si se permite registrar uso sin reserva previa]`.

**Cómo:** El coordinador abre el equipo, elige su proyecto y registra el inicio y el fin del uso. Mientras el uso está abierto, el equipo aparece "En uso". Al cerrar el registro, el equipo vuelve a "Disponible", salvo que esté En mantenimiento.

**Para qué:** La hoja de vida del equipo y el reporte de uso (F8.4) necesitan saber cuántas horas usó cada proyecto. Hoy ese dato no existe.

**Origen:** RF-06, `insumos/requisitos_base.md`.

## Módulo 5 — Solicitudes y priorización

Cubre las solicitudes de gasto y de retiro de insumos, su paso por el flujo de estados y el orden de los proyectos por prioridad. Lo usan el Coordinador, que crea y envía las solicitudes, y el Aprobador, que las decide y ajusta las prioridades. Empieza con una solicitud en "Borrador" y termina cuando la solicitud queda en "Ejecutado" o en "Rechazado".

### Diagrama de flujo

> **[ESPACIO — Diagrama BPMN del Módulo 5]**
> *Insertar aquí el diagrama de flujo del módulo.*
> Archivo: no encontrado en la carpeta

### Funcionalidades

#### F5.1 — El coordinador crea una solicitud de gasto para su proyecto

**Qué:** Cubre la solicitud de una adquisición, con proyecto, descripción, insumo o servicio, cantidad y monto estimado. La solicitud nace en estado "Borrador" según RN-03 y solo para proyectos del coordinador, según RN-07.

**Cómo:** El coordinador elige "Nueva solicitud de gasto", selecciona uno de sus proyectos y llena los datos. Puede guardarla y volver a editarla mientras siga en "Borrador". El sistema no deja crear solicitudes para proyectos "Finalizado".

**Para qué:** Hoy los gastos se piden por correo o de palabra y no queda registro de qué se pidió. La solicitud deja el pedido escrito y atado a un proyecto.

**Origen:** RF-07, `insumos/requisitos_base.md`.

#### F5.2 — El coordinador crea una solicitud de retiro de insumos para su proyecto

**Qué:** Cubre el pedido de insumos del almacén, con proyecto, insumo y cantidad. La solicitud nace en "Borrador" según RN-03. Al ejecutarse, se convierte en un despacho (F6.2).

**Cómo:** El coordinador elige "Nueva solicitud de retiro", selecciona su proyecto y agrega los insumos con su cantidad. El sistema muestra el stock disponible de cada insumo mientras lo agrega. Si pide más de lo disponible, el sistema lo avisa pero deja guardar el borrador.

**Para qué:** Hoy los insumos salen del almacén sin un pedido previo. La solicitud permite revisar el retiro antes de que ocurra y saber a qué proyecto se carga.

**Origen:** RF-07, `insumos/requisitos_base.md`.

#### F5.3 — El coordinador envía una solicitud a aprobación

**Qué:** Cubre el paso de una solicitud de "Borrador" a "Pendiente de Aprobación". Una solicitud enviada ya no se edita.

**Cómo:** Desde el borrador, el coordinador elige enviar. El sistema valida que todos los datos obligatorios estén completos y pide confirmación. La solicitud pasa a "Pendiente de Aprobación" y aparece en la bandeja del aprobador.

**Para qué:** Separar el borrador del envío deja al coordinador preparar la solicitud con calma y fija el momento desde el que cuenta la espera de aprobación.

**Origen:** RF-07 y RF-29, `insumos/requisitos_base.md`.

#### F5.4 — El aprobador aprueba o rechaza una solicitud pendiente

**Qué:** Cubre la decisión sobre cada solicitud en "Pendiente de Aprobación". Solo una solicitud aprobada puede pasar a "Ejecutado", y una rechazada queda cerrada, según RN-03. La decisión queda asociada a quien la tomó.

**Cómo:** El aprobador ve las solicitudes pendientes ordenadas por la prioridad del proyecto y luego por antigüedad. Abre una y ve el proyecto, el detalle, el monto o la cantidad, y la ejecución presupuestaria actual del proyecto. Si la aprueba, pasa a "Aprobado". Si la rechaza, pasa a "Rechazado" y el coordinador la ve así en su bandeja.

**Para qué:** Hoy los gastos se autorizan sin registro y después nadie sabe quién aprobó cada uno. La decisión registrada da control del gasto y soporte para la auditoría.

**Origen:** RF-08 y RF-29, decisión D4, `insumos/requisitos_base.md`.

#### F5.5 — El aprobador marca como ejecutada una solicitud de gasto aprobada

**Qué:** Cubre el paso de una solicitud de gasto de "Aprobado" a "Ejecutado", con el monto real. Las solicitudes de retiro pasan a "Ejecutado" con su despacho en F6.2.

**Cómo:** Cuando la adquisición se concreta, el aprobador abre la solicitud aprobada, registra el monto real y la marca como ejecutada. Si la adquisición es de insumos, registra después la recepción del lote en F6.1. El monto real entra al gasto ejecutado del proyecto (F2.7).

**Para qué:** Una solicitud aprobada todavía no es un gasto. El estado "Ejecutado" distingue lo autorizado de lo que de verdad se gastó.

**Origen:** RF-29, decisión D4, `insumos/requisitos_base.md`.

#### F5.6 — El sistema muestra los proyectos ordenados por nivel de prioridad

**Qué:** Cubre la lista de proyectos ordenada de Crítica a Baja. Dentro de un mismo nivel, el orden es por código. La lista se puede filtrar por estatus operativo.

**Cómo:** Cualquier rol con acceso al proyecto abre la lista de priorización. El Coordinador ve solo sus proyectos, según RN-07. Cuando cambia la prioridad de un proyecto, la lista se reordena en la siguiente consulta.

**Para qué:** El enunciado pide un ordenamiento dinámico por prioridad. La lista ordenada dice qué proyecto atender primero cuando los recursos no alcanzan para todos.

**Origen:** RF-28, `insumos/requisitos_base.md`.

#### F5.7 — El aprobador ajusta la prioridad de un proyecto con una justificación

**Qué:** Cubre el cambio del nivel de prioridad de un proyecto. El cambio exige una justificación escrita que queda en el audit log, según RN-04.

**Cómo:** El aprobador abre el proyecto, elige el nuevo nivel y escribe la justificación. El sistema no deja guardar si la justificación está vacía. Al guardar, el audit log registra el nivel anterior, el nuevo, la justificación, el usuario y la fecha.

**Para qué:** Subir la prioridad de un proyecto lo pone delante de los demás en la aprobación de gastos. Exigir el motivo evita cambios sin explicación y deja la decisión a la vista de la auditoría.

**Origen:** RF-10, decisión D6, `insumos/requisitos_base.md`.

## Módulo 6 — Almacén

Cubre la entrada y la salida física de los insumos, la bitácora inalterable de despachos, el registro del uso de materia prima y la corrección de despachos mediante solicitud. Lo usan el Aprobador / Gestor de Inventario, que recibe y despacha, y el Coordinador, que registra el uso y pide correcciones. Empieza con la recepción de un lote y termina con su despacho a un proyecto o con la corrección aprobada de ese despacho.

### Diagrama de flujo

> **[ESPACIO — Diagrama BPMN del Módulo 6]**
> *Insertar aquí el diagrama de flujo del módulo.*
> Archivo: no encontrado en la carpeta

### Funcionalidades

#### F6.1 — El aprobador registra la recepción de un lote de compra

**Qué:** Cubre la entrada al almacén de un lote, con insumo, cantidad, fecha de ingreso, costo unitario, proveedor, fecha de vencimiento y ubicación. Los seis datos son obligatorios, salvo la fecha de vencimiento en insumos que no vencen. Un lote de consumible de uso general no se asigna a ningún proyecto, según RN-02.

**Cómo:** El aprobador elige registrar una recepción, selecciona el insumo y llena los datos del lote. Si la recepción corresponde a una solicitud de gasto, la asocia. Al guardar, el stock aumenta en la misma operación (F3.3). Si el lote ya está vencido a la fecha de ingreso, el sistema avisa y pide confirmación.

**Para qué:** El costo unitario y el proveedor de cada lote son la base del costo de cada despacho y del prorrateo. Hoy esos datos están en facturas sueltas y no se cruzan con el inventario.

**Origen:** RF-09 y RF-20, más RF-36 (fecha de vencimiento), `insumos/requisitos_base.md` y `insumos/propuestas.md`.

#### F6.2 — El aprobador despacha los insumos de una solicitud de retiro aprobada

**Qué:** Cubre la salida del almacén de los insumos de una solicitud en "Aprobado". El aprobador elige de qué lote sale cada cantidad. Un lote vencido no se despacha.

**Cómo:** El aprobador abre la solicitud aprobada y, para cada insumo, elige el lote entre los que tienen stock y no están vencidos. Indica quién retira. Al confirmar, el sistema descuenta el stock (F3.3), registra el despacho en la bitácora (F6.3) y pasa la solicitud a "Ejecutado". Si un lote está vencido, el sistema no lo muestra como opción.

**Para qué:** Hoy los insumos salen sin quedar asociados a un proyecto, y el consumo real de cada proyecto se desconoce. El despacho atado a la solicitud carga cada salida al proyecto que la pidió.

**Origen:** RF-09 y RF-29, más RF-36 (bloqueo de lotes vencidos), `insumos/requisitos_base.md` y `insumos/propuestas.md`.

#### F6.3 — El sistema registra cada despacho en la bitácora inalterable

**Qué:** Cubre el registro de cada salida de almacén con fecha, hora, proyecto destino, insumo, cantidad despachada y usuario responsable del retiro. Ningún usuario puede editar ni eliminar un registro de la bitácora, según RN-06.

**Cómo:** El registro se crea solo, al confirmar un despacho en F6.2. Cualquier rol puede consultar la bitácora y filtrarla por fecha, proyecto o insumo. El Coordinador solo ve los despachos de sus proyectos, según RN-07. Un error en un despacho se corrige con F6.5 y F6.6, nunca editando el registro.

**Para qué:** La bitácora es la prueba de qué salió del almacén y hacia dónde. Si se pudiera editar, el prorrateo y la ejecución presupuestaria perderían su respaldo.

**Origen:** RF-23, `insumos/requisitos_base.md`.

#### F6.4 — El coordinador registra el uso de materia prima en su proyecto

**Qué:** Cubre el registro de la materia prima que el proyecto consumió, con insumo, cantidad, fecha y observaciones. `[POR CONFIRMAR: si este registro descuenta stock o solo documenta el consumo de lo ya despachado]`.

**Cómo:** El coordinador abre su proyecto, elige registrar uso, selecciona el insumo y escribe la cantidad usada. El sistema muestra cuánto de ese insumo se despachó al proyecto y cuánto lleva registrado como usado. Si el uso registrado supera lo despachado, el sistema lo avisa.

**Para qué:** El enunciado pide registrar el uso de materia prima además de los despachos. Comparar lo despachado con lo usado deja ver sobrantes y pérdidas.

**Origen:** RF-06, `insumos/requisitos_base.md`.

#### F6.5 — El coordinador solicita la corrección de un despacho registrado

**Qué:** Cubre el pedido de corrección de un despacho de sus proyectos, con el valor original, el valor nuevo y el motivo. Se puede corregir la cantidad o el proyecto destino. La solicitud de corrección no modifica el despacho original, según RN-06.

**Cómo:** Desde la bitácora, el coordinador abre el despacho, elige solicitar corrección, indica el dato a cambiar, el valor nuevo y el motivo. El sistema no deja enviar sin motivo. La solicitud queda pendiente en la bandeja del aprobador.

**Para qué:** La bitácora y el audit log no se pueden editar. Sin este pedido, un error de cantidad o de proyecto quedaría para siempre y contaminaría el prorrateo y la ejecución presupuestaria.

**Origen:** RF-35, `insumos/propuestas.md`, basado en NEMO (AdjustmentRequest) y en Chimote et al. (2022), DOI 10.7171/3fc1f5fe.1a877626.

#### F6.6 — El aprobador aprueba o deniega una solicitud de corrección

**Qué:** Cubre la decisión sobre cada solicitud de corrección. Una corrección aprobada se registra como un movimiento nuevo que compensa el original, y los dos quedan visibles en la bitácora.

**Cómo:** El aprobador ve el despacho original, el valor pedido y el motivo. Si aprueba, el sistema registra el movimiento de corrección, ajusta el stock y recalcula la ejecución presupuestaria de los proyectos afectados. Si deniega, la solicitud queda cerrada y el coordinador la ve denegada.

**Para qué:** Permite arreglar errores sin borrar la historia. Quien revise la bitácora ve el error, la corrección, quién la pidió y quién la aprobó.

**Origen:** RF-35, `insumos/propuestas.md`, basado en NEMO (AdjustmentRequest con estados Pendiente, Aprobado y Denegado).

## Módulo 7 — Cierre de período y prorrateo

Cubre la revisión de los cargos del período, el cierre del período contable y el reparto del costo de los consumibles de uso general entre los proyectos activos. Lo usan el Coordinador, que confirma los cargos de sus proyectos, y el Aprobador, que cierra el período y ejecuta el prorrateo. Empieza cuando el aprobador abre la revisión del período y termina con el prorrateo aplicado a cada proyecto.

### Diagrama de flujo

> **[ESPACIO — Diagrama BPMN del Módulo 7]**
> *Insertar aquí el diagrama de flujo del módulo.*
> Archivo: no encontrado en la carpeta

### Funcionalidades

#### F7.1 — El coordinador confirma los cargos de su proyecto antes del cierre

**Qué:** Cubre la revisión, por parte de cada coordinador, de los gastos ejecutados y los despachos cargados a sus proyectos en el período. El coordinador confirma los cargos o pide la corrección de los que estén mal con F6.5. `[POR CONFIRMAR: si el cierre se bloquea mientras falte la confirmación de algún coordinador]`.

**Cómo:** Cuando el aprobador abre la revisión del período, cada coordinador ve en su bandeja la lista de cargos de cada proyecto, con fecha, concepto y monto. Puede confirmar la lista completa o abrir un cargo y pedir su corrección. El aprobador ve qué proyectos ya confirmaron y cuáles no.

**Para qué:** Un error detectado después del cierre obliga a reabrir el período. La revisión previa lo encuentra cuando todavía se corrige con una solicitud.

**Origen:** RF-38, `insumos/propuestas.md`, basado en Chimote et al. (2022), revisión de cargos antes de facturar.

#### F7.2 — El aprobador cierra un período contable

**Qué:** Cubre el cierre de un período mensual o trimestral. Un período cerrado no admite despachos, gastos ni correcciones con fecha dentro de su rango. Los períodos no se solapan.

**Cómo:** El aprobador elige el tipo de período y sus fechas, revisa el resumen de confirmaciones de F7.1 y confirma el cierre. El sistema valida que el período no se cruce con otro ya cerrado. Al cerrar, el período queda listo para el prorrateo.

**Para qué:** El prorrateo necesita un rango de fechas fijo. Si después del cierre siguieran entrando movimientos, el reparto calculado dejaría de coincidir con los datos.

**Origen:** RF-24, decisión D3, `insumos/requisitos_base.md`.

#### F7.3 — El aprobador prorratea el overhead en proporción al consumo de cada proyecto

**Qué:** Cubre el reparto del costo de los lotes de consumibles de uso general del período entre los proyectos activos, en proporción al consumo total de cada uno. El consumo total suma la materia prima y los insumos despachados al proyecto en el período. Solo participan los proyectos activos, según RN-05. `[POR CONFIRMAR: qué lotes entran en un período, si los recibidos o los consumidos en ese rango]`.

**Cómo:** Sobre un período cerrado, el aprobador elige el criterio proporcional y ejecuta el cálculo. El sistema muestra, para cada proyecto activo, su consumo, su porcentaje del total y el monto que le toca, y el aprobador confirma. Al confirmar, el monto de cada proyecto entra a su gasto ejecutado (F2.7). Un período ya prorrateado no se vuelve a prorratear.

**Para qué:** Hoy el costo de guantes, papel o solventes compartidos no se carga a ningún proyecto, así que su costo real queda subestimado. El reparto por consumo carga más a quien más consume.

**Origen:** RF-25 y RF-26, decisiones D7 y D8, `insumos/requisitos_base.md`.

#### F7.4 — El aprobador prorratea el overhead en partes iguales entre los proyectos activos

**Qué:** Cubre el reparto del costo de los lotes de consumibles de uso general del período en partes iguales entre los proyectos activos, según RN-05.

**Cómo:** Sobre un período cerrado, el aprobador elige el criterio equitativo y ejecuta el cálculo. El sistema divide el costo total entre el número de proyectos activos y muestra el monto de cada uno. Si queda un residuo por redondeo, el sistema lo muestra y lo asigna al proyecto de código menor. Al confirmar, cada monto entra al gasto ejecutado del proyecto.

**Para qué:** Cuando el consumo registrado no refleja el uso real del overhead, el reparto en partes iguales es la alternativa que el enunciado permite.

**Origen:** RF-25 y RF-27, decisión D7, `insumos/requisitos_base.md`.

## Módulo 8 — Reportes y auditoría

Cubre el dashboard ejecutivo, la exportación de reportes a PDF y Excel, y el registro y la consulta de la auditoría. Lo usan los tres roles, cada uno con el alcance que le da la matriz. Empieza con cualquier acción que el sistema registra y termina con su consulta o su exportación.

### Diagrama de flujo

> **[ESPACIO — Diagrama BPMN del Módulo 8]**
> *Insertar aquí el diagrama de flujo del módulo.*
> Archivo: no encontrado en la carpeta

### Funcionalidades

#### F8.1 — El administrador consulta el dashboard ejecutivo

**Qué:** Cubre la vista interactiva con estos indicadores, número de proyectos activos según RN-05, presupuesto global ejecutado y alertas críticas de stock (F3.4) y de vencimiento (F3.6). Cada indicador permite ver el detalle que lo forma.

**Cómo:** El administrador entra al dashboard y ve los indicadores al día. Al hacer clic en un indicador, el sistema muestra la lista de proyectos o insumos que lo componen. Puede filtrar por período y por nivel de prioridad.

**Para qué:** Hoy obtener estas cifras exige consolidar varias hojas de cálculo a mano. El dashboard las da en una sola vista y sin esperar al cierre.

**Origen:** RF-30, decisiones D3 y D7, `insumos/requisitos_base.md`.

#### F8.2 — El usuario exporta el análisis de gastos a PDF o Excel

**Qué:** Cubre el reporte de gastos por proyecto y por período, con gastos ejecutados, despachos valorizados y overhead prorrateado. El Aprobador y el Administrador exportan todos los proyectos. El Coordinador exporta solo los suyos, según RN-07.

**Cómo:** El usuario abre el reporte, elige período y proyectos, y elige PDF o Excel. El sistema genera el archivo con los filtros aplicados en el encabezado. Si el filtro no tiene datos, el sistema lo avisa y no genera un archivo vacío.

**Para qué:** El análisis de gastos se presenta a terceros y se trabaja fuera del sistema. Un reporte formal evita copiar datos a mano a otra hoja.

**Origen:** RF-31, decisión D12, `insumos/requisitos_base.md`.

#### F8.3 — El usuario exporta el resumen de prorrateo a PDF o Excel

**Qué:** Cubre el reporte de un período prorrateado, con el criterio usado, el costo total del overhead y el monto, el consumo y el porcentaje de cada proyecto. Rige el mismo alcance por rol de F8.2.

**Cómo:** El usuario elige un período ya prorrateado y el formato. El sistema genera el archivo. Si el período no está prorrateado, el sistema lo dice y no ofrece la exportación.

**Para qué:** Cada coordinador necesita poder explicar el overhead que se cargó a su proyecto. El resumen muestra cómo se calculó.

**Origen:** RF-32, decisión D12, `insumos/requisitos_base.md`.

#### F8.4 — El usuario exporta la hoja de vida y el uso de un equipo a PDF o Excel

**Qué:** Cubre el reporte de un equipo con sus datos, sus cambios de estado operacional, sus reservas y sus usos registrados por proyecto, en un rango de fechas. El Coordinador solo ve los usos de sus proyectos, según RN-07.

**Cómo:** El usuario abre la ficha del equipo, elige el rango de fechas y el formato. El sistema genera el archivo con el historial ordenado por fecha y el total de horas de uso por proyecto.

**Para qué:** Saber cuánto se usa cada equipo y cuánto tiempo pasa en mantenimiento sirve para decidir reparaciones y compras. Hoy ese historial no existe.

**Origen:** RF-33, decisión D12, `insumos/requisitos_base.md`.

#### F8.5 — El sistema registra cada acción en el audit log

**Qué:** Cubre el registro de cada creación, edición, eliminación y cambio de estado en el sistema, con fecha y hora, usuario y dirección IP. Ningún usuario puede editar ni eliminar el audit log, según RN-06.

**Cómo:** El registro se crea solo, en la misma operación que la acción registrada. Si el registro de auditoría falla, la acción tampoco se guarda. Cada entrada guarda el objeto afectado, el valor anterior y el nuevo.

**Para qué:** El enunciado exige trazabilidad completa. Sin ella no se puede responder quién cambió un dato, cuándo y desde dónde.

**Origen:** RF-34, `insumos/requisitos_base.md`.

#### F8.6 — El administrador consulta la auditoría global

**Qué:** Cubre la búsqueda en el audit log de todo el sistema, con filtros por fecha, usuario, tipo de acción y objeto afectado. La consulta es de solo lectura.

**Cómo:** El administrador abre la auditoría, aplica filtros y ve los registros ordenados del más reciente al más antiguo. Al abrir un registro ve el valor anterior y el nuevo. Puede llegar al objeto afectado desde el registro.

**Para qué:** Cuando aparece una diferencia en el inventario o en un gasto, la auditoría muestra la secuencia de acciones que la produjo.

**Origen:** RF-04, `insumos/requisitos_base.md`.

---

# 2. Historias de usuario

## Módulo 1 — Usuarios, catálogos y parámetros

### HU-01 — Control de cuentas
**Como** administrador del sistema,
**quiero** crear, modificar y desactivar cuentas con su rol,
**para** que cada persona entre solo con los permisos de su función.

*Funcionalidades relacionadas: F1.1, F1.2, F1.3*

**Criterios de aceptación**
- **Dado** que lleno los datos con un correo que no existe, **cuando** guardo, **entonces** la cuenta queda activa con el rol elegido.
- **Dado** que uso un correo que ya tiene otra cuenta, **cuando** guardo, **entonces** el sistema lo impide y me muestra esa cuenta.
- **Dado** que desactivo una cuenta, **cuando** ese usuario intenta entrar, **entonces** el sistema no le da acceso y sus registros históricos siguen visibles.

### HU-02 — Ubicaciones y parámetros
**Como** administrador del sistema,
**quiero** mantener las ubicaciones y los parámetros generales en un solo lugar,
**para** no tener que cambiar el sistema cada vez que cambia una política.

*Funcionalidades relacionadas: F1.4, F1.5*

**Criterios de aceptación**
- **Dado** que existe una ubicación activa llamada "Depósito A", **cuando** registro otra con el mismo nombre, **entonces** el sistema lo impide.
- **Dado** que cambio los días de anticipación de vencimiento de 30 a 15, **cuando** guardo, **entonces** las alertas usan 15 días desde ese momento y el audit log guarda ambos valores.
- **Dado** que escribo un valor negativo en un parámetro, **cuando** guardo, **entonces** el sistema lo rechaza.

## Módulo 2 — Proyectos y avance

### HU-03 — Registro de proyecto
**Como** administrador del sistema,
**quiero** registrar cada proyecto con su código, prioridad, presupuesto y coordinador,
**para** que todos sus gastos y avances queden atados a un solo registro.

*Funcionalidades relacionadas: F2.1, F2.2*

**Criterios de aceptación**
- **Dado** que lleno los datos obligatorios con un código nuevo, **cuando** guardo, **entonces** el proyecto queda en estatus "Propuesta".
- **Dado** que el código ya existe, **cuando** guardo, **entonces** el sistema lo impide y me muestra el proyecto existente.
- **Dado** que asigno un coordinador, **cuando** ese coordinador entra, **entonces** ve el proyecto en su bandeja.

### HU-04 — Cambio de estatus
**Como** administrador del sistema,
**quiero** cambiar el estatus operativo de un proyecto,
**para** que el prorrateo y el dashboard consideren solo los proyectos que de verdad están en ejecución.

*Funcionalidades relacionadas: F2.3*

**Criterios de aceptación**
- **Dado** que paso un proyecto de "Propuesta" a "En ejecución", **cuando** consulto el dashboard, **entonces** el proyecto cuenta como activo.
- **Dado** que un proyecto está "Finalizado", **cuando** su coordinador intenta crear una solicitud, **entonces** el sistema lo impide.

### HU-05 — Avance por hitos
**Como** coordinador de proyecto,
**quiero** definir los hitos con su peso y cargar su avance,
**para** que el avance físico de mi proyecto se calcule igual que el de los demás.

*Funcionalidades relacionadas: F2.4, F2.5, F2.6*

**Criterios de aceptación**
- **Dado** que mis hitos suman 90 de peso, **cuando** intento confirmar la lista, **entonces** el sistema no lo permite y me muestra la suma.
- **Dado** un hito de peso 60 al 50 % y otro de peso 40 al 100 %, **cuando** consulto el proyecto, **entonces** veo un avance físico de 70 %.
- **Dado** que cargo un avance de 120 %, **cuando** guardo, **entonces** el sistema lo rechaza.

### HU-06 — Ejecución presupuestaria
**Como** coordinador de proyecto,
**quiero** ver cuánto de mi presupuesto llevo gastado,
**para** frenar los gastos antes de pasarme.

*Funcionalidades relacionadas: F2.7*

**Criterios de aceptación**
- **Dado** un presupuesto de 10 000 y un gasto ejecutado de 2500, **cuando** consulto el proyecto, **entonces** veo una ejecución de 25 %.
- **Dado** que una solicitud de gasto de mi proyecto pasa a "Ejecutado", **cuando** vuelvo a consultar, **entonces** el porcentaje ya incluye su monto real.
- **Dado** que el gasto supera el presupuesto, **cuando** consulto, **entonces** veo el porcentaje por encima de 100 %.

## Módulo 3 — Inventario de materia prima y consumibles

### HU-07 — Catálogo y stock mínimo
**Como** administrador del sistema,
**quiero** registrar cada insumo con su tipo y su stock mínimo,
**para** saber qué insumos entran al prorrateo y cuándo hay que reponerlos.

*Funcionalidades relacionadas: F3.1, F3.2*

**Criterios de aceptación**
- **Dado** que registro un insumo de tipo "Consumible de uso general", **cuando** guardo, **entonces** el insumo queda con stock cero y marcado para el prorrateo.
- **Dado** que ya existe un insumo activo con el mismo nombre y unidad, **cuando** guardo, **entonces** el sistema lo impide.
- **Dado** que configuro un mínimo mayor que el stock actual, **cuando** guardo, **entonces** la alerta de stock mínimo aparece de inmediato.

### HU-08 — Stock al día
**Como** aprobador y gestor de inventario,
**quiero** que el stock cambie con cada recepción y cada despacho,
**para** no despachar lo que ya no hay.

*Funcionalidades relacionadas: F3.3*

**Criterios de aceptación**
- **Dado** un stock de 50 unidades, **cuando** confirmo un despacho de 10, **entonces** la siguiente consulta muestra 40.
- **Dado** que el registro de un despacho falla, **cuando** consulto el stock, **entonces** sigue igual que antes del intento.

### HU-09 — Alerta y reposición
**Como** aprobador y gestor de inventario,
**quiero** que un insumo bajo su mínimo me genere un borrador de reposición,
**para** reponerlo antes de que falte en un proyecto.

*Funcionalidades relacionadas: F3.4, F3.5*

**Criterios de aceptación**
- **Dado** un mínimo de 20 y un stock de 25, **cuando** se despachan 10, **entonces** el insumo aparece con alerta y se crea una solicitud de reposición en "Borrador".
- **Dado** que ya existe una solicitud de reposición abierta para ese insumo, **cuando** el stock vuelve a bajar, **entonces** el sistema no crea otra.
- **Dado** un borrador de reposición, **cuando** lo descarto, **entonces** no se compra nada y la alerta sigue visible.

### HU-10 — Vencimiento de lotes
**Como** aprobador y gestor de inventario,
**quiero** ver qué lotes están por vencer,
**para** usarlos primero o retirarlos antes de que arruinen un experimento.

*Funcionalidades relacionadas: F3.6*

**Criterios de aceptación**
- **Dado** una anticipación de 30 días y un lote que vence en 20, **cuando** consulto el inventario, **entonces** el lote aparece como "Próximo a vencer" con 20 días restantes.
- **Dado** un lote cuya fecha de vencimiento ya pasó, **cuando** consulto el inventario, **entonces** aparece como "Vencido".

### HU-11 — Pronóstico de consumo
**Como** aprobador y gestor de inventario,
**quiero** ver el consumo esperado de cada insumo para el próximo período,
**para** fijar el stock mínimo con datos y no a ojo.

*Funcionalidades relacionadas: F3.7*

**Criterios de aceptación**
- **Dado** un insumo con historial suficiente, **cuando** se cierra un período, **entonces** su ficha muestra el consumo esperado del período siguiente.
- **Dado** un insumo sin historial suficiente, **cuando** abro su ficha, **entonces** veo "Sin historial suficiente para pronosticar".
- **Dado** un pronóstico mayor que el stock actual, **cuando** lo consulto, **entonces** el sistema no crea ninguna solicitud por sí solo.

## Módulo 4 — Equipos y reservas

### HU-12 — Catálogo y estado de equipos
**Como** administrador del sistema,
**quiero** registrar los equipos y mantener su estado operacional,
**para** que nadie planifique sobre un equipo que no se puede usar.

*Funcionalidades relacionadas: F4.1, F4.2*

**Criterios de aceptación**
- **Dado** un código de activo nuevo, **cuando** registro el equipo, **entonces** queda en estado "Disponible".
- **Dado** un equipo con reservas aprobadas a futuro, **cuando** lo paso a "En mantenimiento", **entonces** el sistema me lista esas reservas y avisa a sus coordinadores.

### HU-13 — Reserva sin choques
**Como** coordinador de proyecto,
**quiero** reservar un equipo en un horario libre,
**para** llegar al laboratorio sabiendo que el equipo es para mi proyecto.

*Funcionalidades relacionadas: F4.3, F4.4, F4.5*

**Criterios de aceptación**
- **Dado** un horario libre, **cuando** envío la reserva, **entonces** queda pendiente en la bandeja del aprobador.
- **Dado** un horario que se cruza con otra reserva del mismo equipo, **cuando** envío, **entonces** el sistema la rechaza y me muestra el choque y los rangos libres cercanos.
- **Dado** un equipo "En mantenimiento", **cuando** intento reservarlo, **entonces** el sistema no me deja enviar.
- **Dado** que el aprobador rechaza mi reserva, **cuando** reviso mis reservas, **entonces** la veo rechazada y el horario queda libre.

### HU-14 — Uso de equipos
**Como** coordinador de proyecto,
**quiero** registrar cuándo uso un equipo,
**para** que las horas de uso queden cargadas a mi proyecto.

*Funcionalidades relacionadas: F4.6*

**Criterios de aceptación**
- **Dado** que inicio el uso de un equipo, **cuando** otro usuario lo consulta, **entonces** lo ve "En uso".
- **Dado** que cierro el uso, **cuando** consulto el equipo, **entonces** vuelve a "Disponible" y el uso aparece en su historial con mi proyecto.

## Módulo 5 — Solicitudes y priorización

### HU-15 — Solicitudes del coordinador
**Como** coordinador de proyecto,
**quiero** preparar mis solicitudes de gasto y de retiro y enviarlas cuando estén completas,
**para** que el aprobador reciba pedidos claros y atados a mi proyecto.

*Funcionalidades relacionadas: F5.1, F5.2, F5.3*

**Criterios de aceptación**
- **Dado** que guardo una solicitud sin enviarla, **cuando** vuelvo a abrirla, **entonces** sigue en "Borrador" y la puedo editar.
- **Dado** una solicitud con datos obligatorios vacíos, **cuando** intento enviarla, **entonces** el sistema lo impide y marca los datos faltantes.
- **Dado** que envío una solicitud, **cuando** intento editarla, **entonces** el sistema no lo permite.
- **Dado** que intento crear una solicitud para un proyecto que no es mío, **cuando** busco el proyecto, **entonces** no aparece entre las opciones.

### HU-16 — Decisión del aprobador
**Como** aprobador y gestor de inventario,
**quiero** decidir las solicitudes pendientes en orden de prioridad y registrar cuándo se ejecutan,
**para** que los proyectos críticos no esperen detrás de los demás.

*Funcionalidades relacionadas: F5.4, F5.5*

**Criterios de aceptación**
- **Dado** solicitudes pendientes de un proyecto "Crítica" y de uno "Baja", **cuando** abro la bandeja, **entonces** veo primero la del proyecto "Crítica".
- **Dado** que rechazo una solicitud, **cuando** intento marcarla como ejecutada, **entonces** el sistema lo impide.
- **Dado** una solicitud de gasto aprobada, **cuando** registro el monto real y la marco ejecutada, **entonces** pasa a "Ejecutado" y su monto entra al gasto del proyecto.

### HU-17 — Priorización justificada
**Como** aprobador y gestor de inventario,
**quiero** cambiar la prioridad de un proyecto dejando el motivo escrito,
**para** que el cambio se pueda explicar en cualquier revisión.

*Funcionalidades relacionadas: F5.6, F5.7*

**Criterios de aceptación**
- **Dado** que subo un proyecto de "Media" a "Alta" con justificación, **cuando** guardo, **entonces** la lista de priorización lo muestra en su nuevo nivel y el audit log guarda el cambio y el motivo.
- **Dado** que dejo la justificación vacía, **cuando** guardo, **entonces** el sistema no aplica el cambio.

## Módulo 6 — Almacén

### HU-18 — Recepción de lotes
**Como** aprobador y gestor de inventario,
**quiero** registrar cada lote con su costo, proveedor y vencimiento,
**para** que el costo de los despachos y del prorrateo salga de datos reales.

*Funcionalidades relacionadas: F6.1*

**Criterios de aceptación**
- **Dado** que registro un lote de 100 unidades a costo unitario 3, **cuando** guardo, **entonces** el stock del insumo aumenta en 100.
- **Dado** que la fecha de vencimiento es anterior a la de ingreso, **cuando** guardo, **entonces** el sistema me avisa y pide confirmación.

### HU-19 — Despacho con bitácora
**Como** aprobador y gestor de inventario,
**quiero** despachar los insumos de una solicitud aprobada eligiendo el lote,
**para** que cada salida quede cargada al proyecto y registrada sin posibilidad de alterarla.

*Funcionalidades relacionadas: F6.2, F6.3*

**Criterios de aceptación**
- **Dado** una solicitud de retiro aprobada, **cuando** confirmo el despacho, **entonces** la solicitud pasa a "Ejecutado" y la bitácora muestra fecha, hora, proyecto, insumo, cantidad y responsable.
- **Dado** un lote vencido, **cuando** elijo el lote a despachar, **entonces** ese lote no aparece entre las opciones.
- **Dado** un registro de la bitácora, **cuando** cualquier usuario intenta editarlo o borrarlo, **entonces** el sistema no lo permite.

### HU-20 — Uso de materia prima
**Como** coordinador de proyecto,
**quiero** registrar la materia prima que uso,
**para** comparar lo que recibí con lo que de verdad consumí.

*Funcionalidades relacionadas: F6.4*

**Criterios de aceptación**
- **Dado** que se despacharon 10 unidades a mi proyecto, **cuando** registro un uso de 4, **entonces** veo 10 despachadas y 4 usadas.
- **Dado** que registro un uso mayor que lo despachado, **cuando** guardo, **entonces** el sistema me avisa de la diferencia.

### HU-21 — Corrección de despachos
**Como** coordinador de proyecto,
**quiero** pedir la corrección de un despacho mal registrado,
**para** que mi proyecto no cargue un consumo que no tuvo.

*Funcionalidades relacionadas: F6.5, F6.6*

**Criterios de aceptación**
- **Dado** un despacho de mi proyecto, **cuando** pido corregir la cantidad sin escribir motivo, **entonces** el sistema no me deja enviar.
- **Dado** que el aprobador aprueba la corrección, **cuando** consulto la bitácora, **entonces** veo el despacho original y el movimiento de corrección.
- **Dado** que el aprobador deniega la corrección, **cuando** consulto la bitácora, **entonces** el despacho original sigue sin cambios.

## Módulo 7 — Cierre de período y prorrateo

### HU-22 — Revisión de cargos
**Como** coordinador de proyecto,
**quiero** revisar los cargos de mi proyecto antes del cierre,
**para** corregir errores mientras todavía se puede.

*Funcionalidades relacionadas: F7.1*

**Criterios de aceptación**
- **Dado** que el aprobador abrió la revisión del período, **cuando** entro a mi bandeja, **entonces** veo la lista de cargos de cada uno de mis proyectos.
- **Dado** que confirmo los cargos de un proyecto, **cuando** el aprobador revisa el resumen, **entonces** ve ese proyecto como confirmado.

### HU-23 — Cierre y prorrateo
**Como** aprobador y gestor de inventario,
**quiero** cerrar el período y repartir el overhead con el criterio que elija,
**para** que cada proyecto activo cargue su parte del costo compartido.

*Funcionalidades relacionadas: F7.2, F7.3, F7.4*

**Criterios de aceptación**
- **Dado** un período que se cruza con otro ya cerrado, **cuando** intento cerrarlo, **entonces** el sistema lo impide.
- **Dado** un overhead de 900 y tres proyectos activos, **cuando** ejecuto el reparto equitativo, **entonces** cada proyecto recibe 300.
- **Dado** dos proyectos activos con consumos de 300 y 100 y un overhead de 800, **cuando** ejecuto el reparto proporcional, **entonces** reciben 600 y 200.
- **Dado** un proyecto "Suspendido" durante el período, **cuando** ejecuto cualquier reparto, **entonces** ese proyecto no recibe monto.
- **Dado** un período ya prorrateado, **cuando** intento prorratearlo otra vez, **entonces** el sistema no lo permite.

## Módulo 8 — Reportes y auditoría

### HU-24 — Dashboard ejecutivo
**Como** administrador del sistema,
**quiero** ver en una sola pantalla los proyectos activos, el presupuesto ejecutado y las alertas críticas,
**para** saber el estado de la organización sin consolidar hojas de cálculo.

*Funcionalidades relacionadas: F8.1*

**Criterios de aceptación**
- **Dado** cuatro proyectos "En ejecución" y uno "Suspendido", **cuando** abro el dashboard, **entonces** veo cuatro proyectos activos.
- **Dado** un insumo bajo su mínimo, **cuando** abro el dashboard, **entonces** aparece entre las alertas críticas y puedo abrir su detalle.

### HU-25 — Exportación de reportes
**Como** coordinador de proyecto,
**quiero** exportar a PDF o Excel los reportes de mis proyectos,
**para** presentarlos fuera del sistema sin copiar datos a mano.

*Funcionalidades relacionadas: F8.2, F8.3, F8.4*

**Criterios de aceptación**
- **Dado** que elijo un período y uno de mis proyectos, **cuando** exporto el análisis de gastos a Excel, **entonces** recibo un archivo con los filtros en el encabezado.
- **Dado** que soy coordinador, **cuando** abro el reporte de gastos, **entonces** solo puedo elegir mis proyectos.
- **Dado** un período sin prorratear, **cuando** busco su resumen de prorrateo, **entonces** el sistema me dice que no está prorrateado.
- **Dado** un filtro sin datos, **cuando** exporto, **entonces** el sistema me avisa y no genera el archivo.

### HU-26 — Auditoría
**Como** administrador del sistema,
**quiero** buscar en el registro de auditoría quién hizo cada cambio,
**para** explicar cualquier diferencia en el inventario o en un gasto.

*Funcionalidades relacionadas: F8.5, F8.6*

**Criterios de aceptación**
- **Dado** que un aprobador cambió la prioridad de un proyecto, **cuando** filtro la auditoría por ese proyecto, **entonces** veo el cambio con fecha, hora, usuario, dirección IP y justificación.
- **Dado** un registro de auditoría, **cuando** cualquier usuario intenta editarlo o borrarlo, **entonces** el sistema no lo permite.

---

# 3. Base de datos

> **[ESPACIO — Diagrama de base de datos]**
> *Insertar aquí el modelo entidad-relación del sistema.*
> Archivo: no encontrado en la carpeta

> **[ESPACIO — Enlace al documento de base de datos]**
> *Insertar aquí el enlace al documento donde están las tablas, los campos, los tipos y las reglas de integridad.*

## Notas

> **[ESPACIO — Observaciones sobre el modelo de datos]**

---

# 4. Arquitectura

> **[ESPACIO — Diagrama de arquitectura]**
> *Insertar aquí el diagrama de componentes del sistema.*
> Archivo: no encontrado en la carpeta

> **[ESPACIO — Enlace al documento de arquitectura]**
> *Insertar aquí el enlace al documento técnico, si existe.*

## Requisitos de calidad

La Tabla 1 lista los requisitos de calidad que da el enunciado y los que se derivan de sus funcionalidades.

**Tabla 1**
*Requisitos de calidad*

| Código | Categoría | Requisito | Criterio de medición |
|---|---|---|---|
| RNF-01 | Mantenibilidad | El sistema sigue una arquitectura cliente-servidor con módulos separados | El cliente y el servidor se ejecutan como componentes separados y cada módulo de este documento corresponde a un componente identificable del código (verificación por inspección) |
| RNF-03 | Capacidad de interacción | La interfaz es responsive y sigue las guías de diseño estilo Apple, con espacio en blanco, bordes redondeados, paleta de colores neutra y modo claro y oscuro | La interfaz ofrece modo claro y modo oscuro y se usa sin desplazamiento horizontal en `[POR CONFIRMAR: anchos de pantalla de verificación]` |
| RNF-04 | Flexibilidad | La aplicación está empaquetada o configurada para desplegarse en un servidor local o en la nube, simulando un ambiente de producción | La aplicación se instala y se ejecuta siguiendo solo los pasos del README en `[POR CONFIRMAR: entorno de verificación, local o nube]` |
| RNF-10 | Adecuación funcional | El stock se actualiza en la misma operación que registra cada recepción o despacho | Al confirmar una recepción o un despacho, la siguiente consulta del stock ya muestra la cantidad nueva, y ninguna operación deja el stock pendiente de actualizar |
| RNF-11 | Seguridad de la información | Ningún usuario, incluido el Administrador, puede editar ni eliminar un registro de la bitácora de despachos | Cada intento de edición o eliminación desde la aplicación es rechazado (verificación por prueba) |
| RNF-12 | Seguridad de la información | Ningún usuario, incluido el Administrador, puede editar ni eliminar un registro del audit log | Cada intento de edición o eliminación desde la aplicación es rechazado (verificación por prueba) |

## Restricciones de diseño y entregables

La Tabla 2 lista las restricciones y los entregables que fija el enunciado. No son atributos de calidad del sistema, pero condicionan su construcción y su evaluación.

**Tabla 2**
*Restricciones de diseño y entregables*

| Código | Restricción | Cómo se verifica |
|---|---|---|
| RNF-02 | El equipo elige libremente la pila tecnológica de frontend, backend y base de datos, con la condición de que la base de datos sea relacional | Inspección de la base de datos entregada |
| RNF-05 | El repositorio separa con claridad el frontend del backend | Inspección del repositorio |
| RNF-06 | Se entregan los scripts SQL de creación de la estructura y un script de datos semilla con proyectos ficticios, inventario inicial y usuarios con roles preconfigurados para la evaluación | Ejecución de los scripts sobre una base vacía |
| RNF-07 | Se entrega un README.md con la guía paso a paso para instalar, configurar y ejecutar el entorno local, más el alcance y las limitaciones | Seguimiento de la guía en un equipo sin instalaciones previas del proyecto |
| RNF-08 | Los integrantes del equipo pueden defender la lógica del código y las decisiones de arquitectura, aunque hayan usado herramientas de IA generativa | Defensa oral del proyecto |
| RNF-09 | Se adjunta el archivo de texto o historial con los prompts principales usados durante el desarrollo | Inspección de la entrega |

## Notas

> **[ESPACIO — Stack, integraciones, seguridad y despliegue]**

---

# Anexos

## A. Matriz de trazabilidad

| Funcionalidad | Historias de usuario | Reglas | Diagrama | Estado |
|---|---|---|---|---|
| F1.1 | HU-01 | RN-01 | Módulo 1 | Borrador |
| F1.2 | HU-01 | RN-06 | Módulo 1 | Borrador |
| F1.3 | HU-01 | — | Módulo 1 | Borrador |
| F1.4 | HU-02 | — | Módulo 1 | Borrador |
| F1.5 | HU-02 | — | Módulo 1 | Borrador |
| F2.1 | HU-03 | — | Módulo 2 | Borrador |
| F2.2 | HU-03 | RN-07 | Módulo 2 | Borrador |
| F2.3 | HU-04 | RN-05 | Módulo 2 | Borrador |
| F2.4 | HU-05 | — | Módulo 2 | Borrador |
| F2.5 | HU-05 | — | Módulo 2 | Borrador |
| F2.6 | HU-05 | — | Módulo 2 | Borrador |
| F2.7 | HU-06 | — | Módulo 2 | Borrador |
| F3.1 | HU-07 | RN-02 | Módulo 3 | Borrador |
| F3.2 | HU-07 | — | Módulo 3 | Borrador |
| F3.3 | HU-08 | — | Módulo 3 | Borrador |
| F3.4 | HU-09 | — | Módulo 3 | Borrador |
| F3.5 | HU-09 | RN-03 | Módulo 3 | Borrador |
| F3.6 | HU-10 | — | Módulo 3 | Borrador |
| F3.7 | HU-11 | — | Módulo 3 | Borrador |
| F4.1 | HU-12 | — | Módulo 4 | Borrador |
| F4.2 | HU-12 | — | Módulo 4 | Borrador |
| F4.3 | HU-13 | RN-03, RN-07 | Módulo 4 | Borrador |
| F4.4 | HU-13 | — | Módulo 4 | Borrador |
| F4.5 | HU-13 | RN-03 | Módulo 4 | Borrador |
| F4.6 | HU-14 | RN-07 | Módulo 4 | Borrador |
| F5.1 | HU-15 | RN-03, RN-07 | Módulo 5 | Borrador |
| F5.2 | HU-15 | RN-03, RN-07 | Módulo 5 | Borrador |
| F5.3 | HU-15 | RN-03 | Módulo 5 | Borrador |
| F5.4 | HU-16 | RN-03 | Módulo 5 | Borrador |
| F5.5 | HU-16 | RN-03 | Módulo 5 | Borrador |
| F5.6 | HU-17 | RN-07 | Módulo 5 | Borrador |
| F5.7 | HU-17 | RN-04 | Módulo 5 | Borrador |
| F6.1 | HU-18 | RN-02 | Módulo 6 | Borrador |
| F6.2 | HU-19 | RN-03 | Módulo 6 | Borrador |
| F6.3 | HU-19 | RN-06, RN-07 | Módulo 6 | Borrador |
| F6.4 | HU-20 | RN-07 | Módulo 6 | Borrador |
| F6.5 | HU-21 | RN-06, RN-07 | Módulo 6 | Borrador |
| F6.6 | HU-21 | RN-06 | Módulo 6 | Borrador |
| F7.1 | HU-22 | RN-07 | Módulo 7 | Borrador |
| F7.2 | HU-23 | — | Módulo 7 | Borrador |
| F7.3 | HU-23 | RN-02, RN-05 | Módulo 7 | Borrador |
| F7.4 | HU-23 | RN-02, RN-05 | Módulo 7 | Borrador |
| F8.1 | HU-24 | RN-05 | Módulo 8 | Borrador |
| F8.2 | HU-25 | RN-07 | Módulo 8 | Borrador |
| F8.3 | HU-25 | RN-07 | Módulo 8 | Borrador |
| F8.4 | HU-25 | RN-07 | Módulo 8 | Borrador |
| F8.5 | HU-26 | RN-06 | Módulo 8 | Borrador |
| F8.6 | HU-26 | — | Módulo 8 | Borrador |

## B. Reglas de negocio

| Código | Regla | Funcionalidades que la aplican |
|---|---|---|
| RN-01 | Los beneficiarios y el personal general de los laboratorios no tienen usuario en el sistema | F1.1 |
| RN-02 | Los consumibles de uso general no se asignan a un proyecto al comprarlos. Se compran por lotes institucionales y su costo se reparte en partes iguales o en proporción al consumo | F3.1, F6.1, F7.3, F7.4 |
| RN-03 | Toda solicitud sigue el flujo Borrador, Pendiente de Aprobación, Aprobado o Rechazado, y Ejecutado. Solo una solicitud "Aprobado" pasa a "Ejecutado". "Rechazado" es un estado final | F3.5, F4.3, F4.5, F5.1 a F5.5, F6.2 |
| RN-04 | Todo cambio de prioridad de un proyecto exige una justificación escrita que queda en el audit log | F5.7 |
| RN-05 | Un proyecto es activo solo si su estatus operativo es "En ejecución" | F2.3, F7.3, F7.4, F8.1 |
| RN-06 | Los registros de la bitácora de despachos y del audit log no se editan ni se eliminan. Un error se corrige con un registro nuevo | F1.2, F6.3, F6.5, F6.6, F8.5 |
| RN-07 | El Coordinador de Proyecto solo ve y opera sobre sus proyectos asignados | F2.2, F4.3, F4.6, F5.1, F5.2, F5.6, F6.3, F6.4, F6.5, F7.1, F8.2 a F8.4 |

## C. Supuestos y puntos por confirmar

| Código | Tipo | Descripción | Responsable |
|---|---|---|---|
| SP-01 | `[PROPUESTA]` | El Administrador cambia el estatus operativo de los proyectos (F2.3). El enunciado no asigna esa acción a ningún rol | Equipo del proyecto |
| SP-02 | `[PROPUESTA]` | El gasto ejecutado de F2.7 suma las solicitudes de gasto ejecutadas, el costo de los despachos al proyecto y el overhead prorrateado | Equipo del proyecto |
| SP-03 | `[POR CONFIRMAR]` | Lista completa de los parámetros generales del Administrador (F1.5) | Profesor de la asignatura |
| SP-04 | `[POR CONFIRMAR]` | Días de anticipación iniciales de la alerta de vencimiento (F3.6) y meses mínimos de historial para el pronóstico (F3.7) | Equipo del proyecto |
| SP-05 | `[POR CONFIRMAR]` | Qué rol aprueba una solicitud de reposición automática que el propio Aprobador envía (F3.5) | Equipo del proyecto |
| SP-06 | `[POR CONFIRMAR]` | Si se puede registrar el uso de un equipo sin reserva previa (F4.6) | Equipo del proyecto |
| SP-07 | `[POR CONFIRMAR]` | Si el registro de uso de materia prima descuenta stock o solo documenta el consumo de lo ya despachado (F6.4) | Equipo del proyecto |
| SP-08 | `[POR CONFIRMAR]` | Si el cierre del período se bloquea mientras falte la confirmación de algún coordinador (F7.1) | Equipo del proyecto |
| SP-09 | `[POR CONFIRMAR]` | Qué lotes de consumibles de uso general entran en un período, si los recibidos o los consumidos en ese rango (F7.3, F7.4) | Profesor de la asignatura |
| SP-10 | `[POR CONFIRMAR]` | Anchos de pantalla en que se verifica el diseño responsive (RNF-03) y entorno en que se verifica el despliegue (RNF-04) | Profesor de la asignatura |
| SP-11 | Hallazgo | El enunciado no define el atributo "presupuesto asignado". Se agregó por la decisión D9 para poder calcular la ejecución presupuestaria | Equipo del proyecto |
| SP-12 | Hallazgo | La propuesta RF-38 incluía revisar el overhead prorrateado antes del cierre, pero el prorrateo se calcula después del cierre (RF-24). F7.1 revisa solo los cargos directos del período | Equipo del proyecto |
