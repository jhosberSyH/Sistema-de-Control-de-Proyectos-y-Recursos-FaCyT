# Revisión de los diagramas de flujo antes del diseño

Fecha: 27 de octubre de 2026. Estado: **aprobada completa el 27/10/2026 y aplicada** en los diagramas v2 (enlaces en [`flujos_trazabilidad.md`](flujos_trazabilidad.md)) y en el Markdown del documento de requisitos (versión 0.1.1).

Revisé los 8 diagramas de MC Modeler (versiones del 27/10/2026, leídas con el conector) contra el documento de requisitos v0.1, el README y las lecciones L1 a L10 de `investigacion_ux.md`. Busqué cuatro cosas: pasos que se repiten entre diagramas, tareas que en pantalla son un solo formulario, decisiones que se descubren tarde y diferencias con lo que ya decidimos en el stack.

Las propuestas no quitan ningún RF: cada uno sigue cubierto en al menos un diagrama. Si se aprueban, se crea un diagrama "… v2" por módulo afectado y se actualizan `flujos_trazabilidad.md` y el documento de requisitos.

## A. Pasos repetidos entre diagramas

| # | Cambio propuesto | Por qué | Diagramas | F / RF |
|---|---|---|---|---|
| A1 | El stock se actualiza una sola vez, en el Almacén. M6 queda con "Registra lote y suma stock" y "Registra despacho y descuenta stock". M3 ya no repite "Actualiza stock del lote e insumo": su proceso empieza en "Stock actualizado" y solo revisa la alerta y la reposición | Hoy el mismo movimiento aparece dos veces (M6 "Suma stock…" / "Descuenta stock…" y M3 "Actualiza stock…"). RNF-10 y la decisión D13 dicen que el stock cambia en la misma operación que registra el movimiento, así que es un solo paso | M3, M6 | F3.3, F6.1, F6.2 / RF-18, RNF-10 |
| A2 | M5 no dibuja el despacho. La rama "Retiro" termina en un evento de mensaje "Solicitud lista para despacho" que arranca el proceso de M6 | "Despacha insumos del almacén" y "Pasa a Ejecutado" están en M5 y otra vez en M6, con más detalle (FEFO, bitácora). Dos versiones del mismo paso se desfasan | M5, M6 | F5.5, F6.2 / RF-09, RF-29 |
| A3 | La corrección aprobada termina en "Registra movimiento compensatorio". Se quita "Recalcula stock y presupuesto", porque ese movimiento ya dispara A1 (stock) y el recálculo de M2 (ejecución presupuestaria) | Es el mismo cálculo que ya hacen M3 y M2 cuando entra cualquier movimiento | M6 | F6.6 / RF-35 |
| A4 | El `audit_log` queda solo en M8, como proceso general ("Acción registrada en el sistema"). Se quitan "Registra acción en audit log" (M1) y "Registra estatus en audit log" (M2). Se mantiene "Registra cambio en audit log" de la priorización (M5), porque RN-04 exige guardar ahí la justificación | Hoy está en unos flujos sí y en otros no. Por ejemplo, en M2 se audita el paso a "En ejecución" pero no la suspensión ni la finalización, y eso hace creer que esas acciones no se registran. F8.5 ya dice que **toda** acción se registra | M1, M2, M8 | F8.5 / RF-34 |

## B. Tareas que en pantalla son un solo paso

| # | Cambio propuesto | Por qué | Diagramas | F / RF |
|---|---|---|---|---|
| B1 | "Registra insumo" incluye el stock mínimo. Se quita la tarea aparte "Configura stock mínimo" del alta. F3.2 sigue existiendo para cambiarlo después | Es el mismo formulario. Capturar una vez (L10) y no dejar insumos sin mínimo, que nunca alertarían | M3 | F3.1, F3.2 / RF-17, RF-19 |
| B2 | "Muestra suma de pesos" ya dice cuánto falta. Se quita "Indica peso faltante", y la rama "No" vuelve directo a "Registra hitos con peso" | La suma en vivo (L4) ya muestra el faltante. Son dos tareas para el mismo mensaje | M2 | F2.4 / RF-15 |
| B3 | "Elige nuevo nivel de prioridad" y "Escribe justificación" se unen en "Cambia prioridad con justificación" | En pantalla es un solo diálogo con dos campos. La validación de la justificación queda igual | M5 | F5.7 / RF-10, RN-04 |
| B4 | "Elige lote por insumo" e "Indica quién retira" se unen en "Confirma lotes y quién retira" | Es la misma pantalla de despacho, con los lotes FEFO ya sugeridos | M6 | F6.2 / RF-09, RF-36 |
| B5 | "Elige reporte y filtros" incluye el formato: el formulario termina con dos botones, "Descargar PDF" y "Descargar Excel". Se quita la tarea "Elige PDF o Excel". "Aplica alcance del rol" y "Busca datos del filtro" se unen en "Busca datos dentro del alcance del rol" | Un clic menos y una tarea de sistema menos, sin perder el aviso de "no hay datos" (L9) | M8 | F8.2 a F8.4 / RF-31 a RF-33 |
| B6 | "Guarda borrador" pasa de tarea del coordinador a guardado automático del sistema. El coordinador puede enviar a aprobación sin pulsar antes "Guardar" | Hoy el flujo obliga a guardar antes de enviar. El estado Borrador de RN-03 se mantiene: la solicitud nace en Borrador y pasa a Pendiente al enviarla | M5 | F5.1 a F5.3 / RF-07, RN-03 |
| B7 | La reposición automática se decide en un solo paso. El aprobador abre el borrador con el pronóstico y elige entre "Aprueba reposición" y "Descarta". El sistema registra las dos transiciones (Borrador → Pendiente → Aprobado) en el `audit_log` | Hoy el aprobador "envía a aprobación" una reposición que después aprueba él mismo en M5: dos pasos del mismo rol sobre el mismo documento. La solicitud la creó el sistema, así que no es una autoaprobación de lo que el aprobador pidió | M3 | F3.5 / RF-37, RN-03 |
| B8 | El prorrateo calcula los dos criterios a la vez y muestra los repartos lado a lado. El aprobador elige uno y confirma en un solo paso. Se quitan la compuerta "¿Criterio?" antes del cálculo, el regreso "No → Elige criterio" y la tarea "Confirma prorrateo", que repite la decisión de la compuerta | La vista previa (mejora aprobada) se vuelve una comparación y evita ir y volver entre criterios. Así se calcula una sola vez y se decide una sola vez (L7) | M7 | F7.3, F7.4 / RF-25 a RF-27 |

## C. Decisiones que llegan tarde o en otro orden

| # | Cambio propuesto | Por qué | Diagramas | F / RF |
|---|---|---|---|---|
| C1 | El solapamiento del período se valida en "Abre revisión del período" y no en "Cierra período" | Hoy se descubre después de que todos los coordinadores confirmaron sus cargos, y hay que rehacer la revisión. Es "prevenir antes que rechazar" (L1) | M7 | F7.1, F7.2 / RF-24 |
| C2 | La auditoría abre con los registros recientes primero, y el filtro es opcional. Orden nuevo: "Muestra registros recientes primero" → "Filtra auditoría" | Hoy el flujo obliga a filtrar antes de ver algo | M8 | F8.6 / RF-04 |

## D. Diferencias con el stack aprobado

| # | Cambio propuesto | Por qué | Diagramas | F / RF |
|---|---|---|---|---|
| D1 | El vencimiento se calcula al consultar o despachar un lote, sin temporizador diario. "Revisa vencimiento", "Marca próximos" y "Bloquea vencidos" se unen en "Calcula estado de vencimiento del lote" (Vigente, Próximo a vencer o Vencido). Hay que cambiar el Cómo de F3.6, que hoy dice "Cada día…" | El README decidió "Tareas en segundo plano: ninguna. Los vencimientos se calculan al consultar". El diagrama y F3.6 todavía tienen un proceso diario que el stack no va a tener | M3 | F3.6 / RF-36 |
| D2 | El pronóstico se calcula a pedido, al abrir la ficha del insumo, y no al cerrar el período. Hay que cambiar el Cómo de F3.7 | El README dice "Se calcula a pedido desde la bitácora de despachos". El diagrama y F3.7 dicen "al cerrar cada período" | M3 | F3.7 / IA-01 |

## E. Huecos encontrados (no son simplificaciones; los dejo anotados)

| # | Hueco | Propuesta |
|---|---|---|
| E1 | Al editar una cuenta (M1), "Valida correo y cambio de rol" no tiene rama de error. Además, el cambio de rol "Lista proyectos por reasignar" y guarda igual, así que puede dejar proyectos sin coordinador | Usar el mismo patrón de la desactivación: "Muestra impacto y pide confirmación", con una rama de error si el correo ya existe |
| E2 | Un proyecto suspendido (M2) termina en "Proyecto suspendido" y no puede volver a "En ejecución" | Agregar la reactivación, si el profesor la acepta. Queda `[POR CONFIRMAR]` |
| E3 | En la recepción (M6), un lote vencido se avisa y después se confirma su ingreso al stock, donde M3 lo bloquea | Que el aviso regrese a "Registra datos del lote", para corregir la fecha si fue un error de captura o para no recibir el lote |
| E4 | Un equipo en mantenimiento (M4) no tiene el camino de vuelta a "Disponible" | Agregar "Devuelve equipo a Disponible" al terminar el mantenimiento |

## Efecto

- Salen 16 tareas y 1 compuerta (contando A a D, sin los huecos de E, que agregan pasos).
- Los RF siguen cubiertos. La cobertura de `flujos_trazabilidad.md` no cambia; solo se mueven tareas de fila.
- Cambia el Cómo de F2.4, F3.1, F3.5, F3.6, F3.7, F5.1, F5.3, F5.5, F5.7, F6.2, F6.6, F7.2, F7.3, F7.4, F8.2 a F8.4 y F8.6, y el de F1.2 si se aprueba E1.
