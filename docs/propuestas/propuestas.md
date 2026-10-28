# Propuestas de nuevos requisitos

**Base:** `requisitos_base.md` (RF-01 a RF-34, RN-01 a RN-04, RNF-01 a RNF-12) y `benchmarking.md`.

**Fecha:** 25 de octubre de 2026.

**Estado:** pendiente de aprobación. Nada de lo que está aquí entra al documento final hasta que se apruebe.

Cada propuesta viene de una funcionalidad verificada en un proyecto real del benchmark. Los IDs continúan la numeración de `requisitos_base.md`. Las propuestas de IA llevan el prefijo IA.

---

## 1. Qué tienen ellos que nosotros no

| Funcionalidad | Dónde está | ¿La tenemos? |
|---|---|---|
| Corrección de cargos ya registrados mediante una solicitud que se aprueba | NEMO (`AdjustmentRequest`), Chimote et al. 2022 | No. La bitácora y el `audit_log` son inalterables y no hay forma prevista de corregir un error |
| Fecha de vencimiento por lote | ERPNext (Batch) | No. RF-20 registra la fecha de ingreso, el costo y el proveedor, pero no el vencimiento |
| Solicitud de reposición automática al bajar del mínimo | ERPNext (reorden automático), NEMO (correo al cruzar el umbral) | Parcial. RF-19 solo alerta |
| Pronóstico de demanda de reactivos con aprendizaje automático | Regulski et al. 2024, Opaliński et al. 2026 | No |
| Revisión de cargos por el responsable antes de facturar o cerrar | Chimote et al. 2022 | No |
| Costo del proyecto desglosado por origen frente a lo estimado | ERPNext (Project costing) | Parcial. RF-16 da un porcentaje, sin desglose |
| Plan de mantenimiento preventivo con tareas periódicas | ERPNext (Asset Maintenance), NEMO (`Task`) | No. Solo existe el estado "En mantenimiento" |
| Paradas programadas que bloquean el uso del equipo | NEMO (`ScheduledOutage`) | No |
| Importación de datos desde Excel | NEMO (wiki "Importing data in Excel") | No. RNF-06 cubre los datos semilla, no la migración desde hojas de cálculo |
| Nota obligatoria del gestor al denegar | NEMO (`manager_note`) | No |
| Aviso al solicitante cuando cambia el estado | Chimote et al. 2022 | No |
| Reglas de reserva por equipo (duración máxima, cupos, cancelación) | eLabFTW (`book_*`) | No. RF-22 solo previene conflictos |
| Recepción parcial (cantidad pedida frente a recibida) | eLabFTW (`procurement_requests`), ERPNext (Partially Received) | No |
| Registro de quién despacha y de quién recibe | NEMO (`merchant` y `customer`) | Parcial. RF-23 registra solo al responsable del retiro |
| Despliegue en contenedores | NEMO, eLabFTW | No especificado. RNF-04 dice "empaquetada o configurada" |
| Ubicación de almacenamiento por contenedor con cantidad | eLabFTW (storage units), LIME | Parcial. Existe el catálogo de ubicaciones (RF-03), pero el stock no está ligado a una ubicación |
| Detección de sobrecarga de equipos | Opaliński et al. 2026 | No |
| Identificación química (CAS) y marca de producto peligroso | eLabFTW (compounds), Gardella et al. 2024 | No |
| Lectura de código de barras o QR | LIME | No |
| Sellado de tiempo confiable del registro de auditoría | eLabFTW | No |
| Reparto de costos por porcentajes fijos con fecha de vigencia | ERPNext (Cost Center Allocation) | No. Solo existen los criterios proporcional y equitativo |
| Calificación previa para reservar o usar un equipo | NEMO (`Qualification`), Chimote et al. 2022 | No |
| Doble factor de autenticación | eLabFTW | No |
| Accesibilidad WCAG 2.1 | eLabFTW | No |
| Registro de incidentes de seguridad | NEMO (`SafetyIssue`) | No |
| Ambiente de pruebas separado | Chimote et al. 2022 | No |

---

## 2. Módulo de IA adaptado

**Proyecto elegido:** predicción de demanda de reactivos de Regulski et al. (2024), *Applied Sciences* 14(6):2429, DOI 10.3390/app14062429. Lo complementa la continuación de Opaliński et al. (2026), *Applied Sciences* 16(10):4865, DOI 10.3390/app16104865.

**Por qué este y no otro:** es el único módulo de IA del benchmark con publicación verificable, y ataca el mismo problema que nuestro inventario. Los autores lo plantean para evitar que una prueba no se haga por falta de reactivos y para planificar el stock. Los otros candidatos con IA eran de marketing (Scispot) y quedaron descartados.

**Qué resolvería en nuestro proyecto:**

- Hoy, RF-19 avisa cuando el stock ya bajó del mínimo. El pronóstico anticipa cuándo va a bajar.
- Hoy, el mínimo lo fija a mano el Administrador. El pronóstico da una base para fijarlo.
- La continuación de 2026 detecta la sobrecarga de analizadores. En nuestro caso eso se traduce en avisar cuándo la demanda de reservas de un equipo supera su disponibilidad.

**Cómo encaja con lo que ya tenemos:**

- **Datos de entrada:** la bitácora de despachos (RF-23) da el consumo histórico por insumo, proyecto y fecha. Los lotes de compra (RF-20) dan los tiempos y costos de reposición. Las reservas (RF-22) dan la demanda histórica de cada equipo. No hace falta capturar datos nuevos.
- **Salida:** el pronóstico no compra ni despacha nada. Si se aprueba RF-37, la sugerencia se convierte en una solicitud en estado "Borrador" que sigue el flujo de RN-03. ERPNext recomienda revisar las solicitudes automáticas antes de comprar, porque una regla de reorden puede estar desactualizada.
- **Método:** los artículos usan modelos clásicos de series de tiempo (ARIMA y suavizado exponencial) junto con redes neuronales. Los modelos clásicos alcanzan para un volumen de datos académico.

**Requisitos que implica:** IA-01, IA-02 e IA-03 en la lista de abajo.

**Puntos por confirmar:**

- [POR CONFIRMAR: meses mínimos de historial antes de mostrar un pronóstico.]
- Los resultados de los artículos (R² superior al 90 % y exactitud superior al 98 %) se obtuvieron con más de 140 millones de pruebas. No son extrapolables a un laboratorio académico con poco historial.

---

## 3. Lista de propuestas, de la que más aporta a la que menos

| # | ID propuesto | Tipo | Propuesta | Por qué aporta | Proyecto fuente |
|---|---|---|---|---|---|
| 1 | RF-35 | RF | El Coordinador solicita la corrección de un despacho o cargo ya registrado, indicando el valor original, el nuevo valor y el motivo. El Aprobador la aprueba o la deniega, y la corrección queda como un registro nuevo, sin modificar el original. | La bitácora (RF-23) y el `audit_log` (RF-34) son inalterables. Sin este mecanismo, un error de cantidad o de proyecto destino no se puede corregir y contamina el prorrateo y la ejecución presupuestaria. | NEMO, `AdjustmentRequest` con estados Pendiente, Aprobado y Denegado (https://github.com/usnistgov/NEMO). Chimote et al. 2022, correcciones auditables (DOI 10.7171/3fc1f5fe.1a877626) |
| 2 | RF-36 | RF | El sistema registra la fecha de vencimiento de cada lote, alerta los lotes próximos a vencer e impide despachar lotes vencidos. | Reactivos, solventes y medios biológicos vencen. RF-20 no guarda el vencimiento y hoy se puede despachar un lote caducado. | ERPNext, Batch con fecha de vencimiento y estado "Expired" (https://docs.frappe.io/erpnext/batch) |
| 3 | RF-37 | RF | Cuando el stock de un insumo baja del mínimo, el sistema crea una solicitud de reposición en estado "Borrador" para que el Aprobador la revise. | Convierte la alerta de RF-19 en una acción dentro del flujo de RN-03. Evita que la alerta se ignore. | ERPNext, Material Request automático por nivel de reorden (https://docs.frappe.io/erpnext/material-request). NEMO, correo automático al cruzar `reminder_threshold` |
| 4 | IA-01 | IA | El sistema pronostica el consumo de cada insumo para el próximo período a partir de la bitácora de despachos. | Pasa de reaccionar al faltante a anticiparlo. Usa datos que el sistema ya guarda. | Regulski et al. 2024, *Applied Sciences* 14(6):2429 (DOI 10.3390/app14062429). Opaliński et al. 2026, *Applied Sciences* 16(10):4865 (DOI 10.3390/app16104865) |
| 5 | RF-38 | RF | Antes de cerrar el período contable, el Coordinador revisa y confirma los cargos de su proyecto, incluido el overhead prorrateado. | Detecta errores antes de que el cierre los vuelva definitivos. Reduce las correcciones de RF-35. | Chimote et al. 2022, revisión de cargos por investigadores y gestores antes de facturar (DOI 10.7171/3fc1f5fe.1a877626) |
| 6 | RF-39 | RF | El sistema muestra el costo del proyecto desglosado en materia prima consumida, compras directas y overhead prorrateado, frente al presupuesto asignado. | RF-16 da un solo porcentaje. El desglose explica de dónde sale el gasto y hace defendible la ejecución presupuestaria. | ERPNext Project: costo estimado, costo de material consumido, costo de compras (https://docs.frappe.io/erpnext/project) |
| 7 | RF-40 | RF | El Aprobador define planes de mantenimiento preventivo por equipo, con tareas periódicas como calibración o inspección, y registra su ejecución. | Hoy "En mantenimiento" es un estado sin historia. El plan alimenta la hoja de vida del equipo (RF-33). | ERPNext Asset Maintenance (https://docs.frappe.io/erpnext/asset-maintenance). NEMO, tareas de mantenimiento |
| 8 | RF-41 | RF | El Aprobador programa paradas de un equipo con fecha de inicio y fin, y el sistema impide reservarlo en ese rango. | Evita reservas sobre equipos que van a estar fuera de servicio. Complementa RF-22. | NEMO, `ScheduledOutage` con categoría y recordatorios (https://github.com/usnistgov/NEMO) |
| 9 | RF-42 | RF | El Administrador importa desde Excel el inventario y los proyectos existentes. | El enunciado parte de que hoy todo está en hojas de cálculo. Sin importación, la carga inicial es manual. | NEMO, "Importing data in Excel" (https://github.com/usnistgov/NEMO/wiki). Chimote et al. 2022 y Gardella et al. 2024 parten de reemplazar hojas de cálculo |
| 10 | RF-43 | RF | El Aprobador escribe una observación obligatoria al rechazar una solicitud. | Como "Rechazado" es final (RN-03, D4), el Coordinador necesita saber por qué para crear una nueva solicitud correcta. | NEMO, `manager_note` enviada al usuario cuando la solicitud se deniega |
| 11 | RF-44 | RF | El sistema notifica al Coordinador cuando su solicitud cambia de estado. | Evita que el Coordinador tenga que entrar a revisar cada solicitud. Acorta los tiempos del flujo. | Chimote et al. 2022, aviso al cliente cuando el pedido se finaliza |
| 12 | IA-02 | IA | El sistema muestra la fecha estimada de agotamiento de cada insumo y sugiere un stock mínimo calculado a partir del pronóstico de IA-01. | Le da al Administrador una base objetiva para configurar RF-19. | Regulski et al. 2024, pronóstico de largo plazo para planificar el stock de reactivos |
| 13 | RF-45 | RF | El Administrador configura por equipo la duración máxima de una reserva, el número máximo de reservas por proyecto y la antelación mínima para cancelar. | RF-22 previene choques, pero no impide que un proyecto acapare un equipo. | eLabFTW, `book_max_minutes`, `book_max_slots`, `book_cancel_minutes` (https://github.com/elabftw/elabftw) |
| 14 | RF-46 | RF | El Aprobador registra recepciones parciales de una compra, indicando la cantidad pedida y la recibida. | Los proveedores entregan por partes. Sin esto, el stock y el costo del lote quedan mal. | eLabFTW, `qty_ordered` y `qty_received`. ERPNext, estado "Partially Received" |
| 15 | RF-47 | RF | La bitácora de despachos registra también al usuario que despacha, además del responsable del retiro. | Separa quién entregó de quién recibió. Mejora la trazabilidad de RF-23. | NEMO, `ConsumableWithdraw` con `merchant` (staff que despacha) y `customer` (quien usa) |
| 16 | RNF-13 | RNF | La aplicación se entrega en contenedores (Docker) con un solo comando de arranque. | Hace verificable RNF-04 ("empaquetada") y facilita que el evaluador levante el entorno de RNF-07. | NEMO, imágenes Docker. eLabFTW, despliegue con Docker o Podman |
| 17 | RF-48 | RF | El sistema registra el stock de cada lote por ubicación de almacenamiento. | Usa el catálogo de ubicaciones de RF-03, que hoy no se conecta con el stock. Permite encontrar el insumo. | eLabFTW, storage units con cantidad y unidad. LIME, categorías por ubicación (DOI 10.1371/journal.pone.0336412) |
| 18 | IA-03 | IA | El sistema avisa cuando la demanda prevista de reservas de un equipo supera su disponibilidad en el próximo período. | Anticipa cuellos de botella en equipos compartidos entre proyectos. | Opaliński et al. 2026, detección de sobrecarga de analizadores (DOI 10.3390/app16104865) |
| 19 | RF-49 | RF | El catálogo registra el número CAS de cada sustancia y marca las peligrosas. | Proyectos de química y biología manejan sustancias peligrosas. Ayuda al cumplimiento de seguridad. | eLabFTW, compuestos con CAS y monitoreo de productos peligrosos. Gardella et al. 2024, cumplimiento normativo y seguridad (DOI 10.3390/laboratories1010004) |
| 20 | RF-50 | RF | El Aprobador registra despachos leyendo el código de barras o QR del lote. | Reduce errores de digitación en la bitácora. | LIME, escaneo de códigos de barras y QR (DOI 10.1371/journal.pone.0336412) |
| 21 | RNF-14 | RNF | Cada registro del `audit_log` lleva un sellado de tiempo que permite detectar alteraciones. | Hace verificable la "inmutabilidad" de RF-34 y RNF-12. | eLabFTW, *trusted timestamping* y firmas verificables (https://www.elabftw.net/) |
| 22 | RF-51 | RF | El Aprobador puede prorratear un lote compartido por porcentajes fijos por proyecto, con fecha de vigencia. | Agrega un tercer criterio a RF-26 y RF-27 para casos acordados de antemano. | ERPNext, Cost Center Allocation (https://docs.frappe.io/erpnext/cost-center-allocation) |
| 23 | RF-52 | RF | El sistema solo permite reservar un equipo a coordinadores calificados para ese equipo. | Seguridad en equipos delicados. Aporta menos aquí porque el personal de laboratorio no tiene usuario (RN-01). | NEMO, `Qualification` (bloquea reservas de usuarios no calificados). Chimote et al. 2022, reserva limitada a usuarios capacitados |
| 24 | RNF-15 | RNF | Las cuentas de Administrador y Aprobador usan doble factor de autenticación. | Son los roles que aprueban gastos y cierran períodos. | eLabFTW, autenticación de doble factor |
| 25 | RNF-16 | RNF | La interfaz cumple WCAG 2.1. | Complementa RNF-03 con un criterio medible de accesibilidad. | eLabFTW, cumplimiento WCAG 2.1 y RGAA v4 |
| 26 | RF-53 | RF | El Coordinador registra incidentes de seguridad asociados a un equipo o a un área. | Deja historial de incidentes en laboratorios con riesgos químicos y biológicos. | NEMO, `SafetyIssue` |
| 27 | RNF-17 | RNF | Existe un ambiente de pruebas separado del de producción. | Permite validar flujos sin tocar datos reales. Aporta poco en un proyecto académico. | Chimote et al. 2022, *sandbox* para validar flujos |
