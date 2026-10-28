# Trazabilidad de los diagramas de flujo por módulo

Fecha: 27 de octubre de 2026. Estado: **versión 2**, pendiente de validación en MC Modeler.

Los diagramas están en MC Modeler, en el proyecto "Proyecto de Web". Cada nombre de diagrama lleva los RF que cubre. Esta tabla baja el rastreo al nivel de cada tarea.

- La columna **F** remite a la funcionalidad del documento de requisitos v0.1.
- La columna **RF** remite al requisito de trabajo de `requisitos_base.md`.
- La columna **UX** remite a la lección de `investigacion_ux.md` (L1 a L10) o de `investigacion_usuarios.md` (U1 a U14) que se aplicó en esa tarea.
- "Mejora UX aprobada" marca lo que no sale de un RF y que el usuario aprobó el 26/10/2026.
- La columna **Rev.** remite al cambio de [`revision_flujos.md`](revision_flujos.md), aprobado completo el 27/10/2026, que dio origen a la tarea o la modificó.

## Diagramas

La versión 2 aplica los cambios A1 a E4 de `revision_flujos.md`. La versión 1 queda en MC Modeler como historial y no se modificó.

| Módulo | Diagrama | RF | Versión 2 (vigente) | Versión 1 (historial) |
|---|---|---|---|---|
| 1 | Usuarios, catálogos y parámetros | RF-01, RF-02, RF-03 | https://mc-modeler.vercel.app/?d=3e6996e3-e831-5773-b390-7b0e1a16ef77 | https://mc-modeler.vercel.app/?d=d8ee47c3-aa63-5cf6-8ae1-1450b14afff0 |
| 2 | Proyectos y avance | RF-05, RF-11 a RF-16 | https://mc-modeler.vercel.app/?d=d59e7aa0-76f4-53e7-9bf4-acd392210903 | https://mc-modeler.vercel.app/?d=ea759e2b-779c-5ee1-9d56-39ac7eeb3ac1 |
| 3 | Inventario de materia prima y consumibles | RF-02, RF-03, RF-17, RF-18, RF-19, RF-36, RF-37, IA-01 | https://mc-modeler.vercel.app/?d=b49c4832-607e-5d10-b6ea-d66d8fb22c77 | https://mc-modeler.vercel.app/?d=fe39a5f7-5970-5974-a61e-0e5c0d23fede |
| 4 | Equipos y reservas | RF-03, RF-06, RF-21, RF-22, RF-29 | https://mc-modeler.vercel.app/?d=f1954045-3197-578e-b00e-aa4fff27c165 | https://mc-modeler.vercel.app/?d=41b2844d-7167-5242-8277-91abb2299a41 |
| 5 | Solicitudes y priorización | RF-07, RF-08, RF-10, RF-28, RF-29 | https://mc-modeler.vercel.app/?d=16d09129-9552-5790-aa89-4bec4ba4c0ca | https://mc-modeler.vercel.app/?d=d6eaa24c-7d54-5b9e-a216-fe03fad0fcd4 |
| 6 | Almacén | RF-06, RF-09, RF-18, RF-20, RF-23, RF-29, RF-35, RF-36 | https://mc-modeler.vercel.app/?d=35bb4942-3928-5b93-9153-e88f47b487de | https://mc-modeler.vercel.app/?d=d3e90268-ddeb-503c-b331-9dd3dee9235a |
| 7 | Cierre de período y prorrateo | RF-24 a RF-27, RF-38 | https://mc-modeler.vercel.app/?d=1a7df801-821e-5765-8d6f-94943cb1dab1 | https://mc-modeler.vercel.app/?d=2f150485-5f76-520a-9b3e-b2382de1e106 |
| 8 | Reportes y auditoría | RF-04, RF-30 a RF-34 | https://mc-modeler.vercel.app/?d=1903e350-b68f-50f2-b9ac-cf3e096fd005 | https://mc-modeler.vercel.app/?d=38442ec9-16df-556e-9d9e-7e6d35cc7dbb |

Los 8 diagramas de la versión 2 pasan la validación del conector sin errores. Queda una sugerencia de estilo en el Módulo 1: la tarea "Señala la cuenta que usa el correo" es larga para la guía del equipo. Se puede acortar a "Señala correo repetido" desde la aplicación, porque el conector no modifica diagramas.

## Cobertura

Cada requisito de trabajo aparece en al menos un diagrama.

| RF | Módulo | RF | Módulo | RF | Módulo |
|---|---|---|---|---|---|
| RF-01 | 1 | RF-14 | 2 | RF-27 | 7 |
| RF-02 | 1, 3 | RF-15 | 2 | RF-28 | 5 |
| RF-03 | 1, 3, 4 | RF-16 | 2 | RF-29 | 4, 5, 6 |
| RF-04 | 8 | RF-17 | 3 | RF-30 | 8 |
| RF-05 | 2 | RF-18 | 6 (actualiza), 3 (alerta) | RF-31 | 8 |
| RF-06 | 4, 6 | RF-19 | 3 | RF-32 | 8 |
| RF-07 | 5 | RF-20 | 6 | RF-33 | 8 |
| RF-08 | 5 | RF-21 | 4 | RF-34 | 8 |
| RF-09 | 5, 6 | RF-22 | 4 | RF-35 | 6 |
| RF-10 | 5 | RF-23 | 6 | RF-36 | 3, 6 |
| RF-11 | 2 | RF-24 | 7 | RF-37 | 3 |
| RF-12 | 2 | RF-25 | 7 | RF-38 | 7 |
| RF-13 | 2 | RF-26 | 7 | IA-01 | 3 |

---

## Módulo 1. Usuarios, catálogos y parámetros

| Tarea | F | RF | UX | Rev. |
|---|---|---|---|---|
| Crea cuenta de usuario | F1.1 | RF-01 | — | — |
| Valida correo único / Muestra la cuenta existente | F1.1 | RF-01 | L4 | — |
| Activa la cuenta con su rol | F1.1 | RF-01 | — | — |
| Edita datos o rol / Valida correo de la cuenta / Señala la cuenta que usa el correo | F1.2 | RF-01 | L4 | E1 |
| Muestra proyectos por reasignar / Conserva el rol actual / Marca proyectos por reasignar | F1.2 | RF-01 | L2 | E1 |
| Guarda cambios de la cuenta | F1.2 | RF-01 | — | — |
| Pide desactivar la cuenta / Muestra impacto de la desactivación | F1.3 | RF-01 | L2 | — |
| Conserva la cuenta activa / Bloquea el acceso | F1.3 | RF-01 | — | — |
| Registra ubicación / Valida nombre único / Señala la ubicación repetida / Activa la ubicación | F1.4 | RF-03 | L4 | — |
| Cambia parámetro general / Valida entero positivo / Señala error junto al campo / Aplica el valor nuevo | F1.5 | RF-02 | L4 | — |

El registro en el `audit_log` de estas acciones está en el proceso general del Módulo 8 (A4).

## Módulo 2. Proyectos y avance

| Tarea | F | RF | UX | Rev. |
|---|---|---|---|---|
| Registra proyecto / Valida código y presupuesto / Señala campos con error | F2.1 | RF-11, RF-12, RF-14, RF-16 | L4 | — |
| Crea proyecto en Propuesta | F2.1 | RF-13 | — | — |
| Asigna coordinador | F2.2 | RF-05 a RF-07 (alcance) | — | — |
| Avisa al coordinador | F2.2 | Mejora UX aprobada | L8 | — |
| Registra hitos con peso / Muestra suma de pesos / Confirma plan de hitos | F2.4 | RF-05, RF-15 | L4 | B2 |
| Pasa proyecto a En ejecución | F2.3 | RF-13 | — | A4 |
| Carga avance de hito / Valida rango 0 a 100 / Señala valor fuera de rango | F2.5 | RF-05 | L4 | — |
| Recalcula avance físico | F2.6 | RF-15 | — | — |
| Suspende proyecto / Excluye proyecto de activos | F2.3 | RF-13 (RN-05) | — | — |
| Reactiva proyecto | F2.3 | RF-13 `[POR CONFIRMAR]` | — | E2 |
| Finaliza proyecto / Bloquea solicitudes y reservas | F2.3 | RF-13 | — | — |
| Recalcula ejecución presupuestaria / Resalta sobreejecución / Actualiza ficha del proyecto | F2.7 | RF-16 | — | — |

## Módulo 3. Inventario de materia prima y consumibles

| Tarea | F | RF | UX | Rev. |
|---|---|---|---|---|
| Registra insumo y stock mínimo / Valida nombre y unidad / Muestra insumo existente / Crea insumo con stock cero | F3.1, F3.2 | RF-03, RF-17, RF-19 | L4, L10 | B1 |
| Evento "Stock actualizado en almacén" (el stock lo cambia el Módulo 6) | F3.3 | RF-18 | — | A1 |
| Marca alerta de stock mínimo / Retira alerta de stock | F3.4 | RF-19 | — | — |
| Crea reposición en Borrador / Conserva la reposición abierta | F3.5 | RF-37 | L6 | — |
| Avisa al aprobador / Revisa cantidad y pronóstico / Aprueba reposición / Registra transiciones de estado / Descarta reposición | F3.5 | RF-37 (RN-03) | L6 | B7 |
| Calcula estado de vencimiento | F3.6 | RF-36 | L5 | D1 |
| Revisa historial de despachos / Calcula pronóstico de consumo / Muestra pronóstico en ficha / Indica historial insuficiente | F3.7 | IA-01 | — | D2 |

"Calcula estado de vencimiento" deja cada lote como Vigente, Próximo a vencer (marcado) o Vencido (bloqueado para despacho). Conviene poner ese detalle como anotación en MC Modeler, porque el conector no crea anotaciones.

## Módulo 4. Equipos y reservas

| Tarea | F | RF | UX | Rev. |
|---|---|---|---|---|
| Registra equipo / Valida código de activo / Muestra equipo con ese código / Crea equipo Disponible | F4.1 | RF-03, RF-21 | L4 | — |
| Consulta calendario del equipo | F4.3 | RF-22 | L1 | — |
| Propone proyecto del coordinador | F4.3 | Mejora UX aprobada | L10 | — |
| Elige rango y proyecto | F4.3 | RF-22, RF-29 | — | — |
| Verifica cruces y estado | F4.4 | RF-22 | L1 | — |
| Muestra choque y rangos libres | F4.4 | RF-22 + mejora UX aprobada (rangos libres) | L1 | — |
| Registra reserva pendiente / Avisa al aprobador | F4.3 | RF-22, RF-29 | L8 | — |
| Revisa reserva pendiente / Aprueba reserva / Confirma reserva y avisa | F4.5 | RF-22 | L2 | — |
| Rechaza con motivo / Libera horario y avisa | F4.5 | RF-22 + mejora UX aprobada (motivo) | L2 | — |
| Inicia registro de uso / Marca equipo En uso / Cierra registro de uso / Devuelve equipo a Disponible | F4.6 | RF-06, RF-21 | — | — |
| Pasa equipo a mantenimiento / Lista reservas futuras afectadas / Avisa a coordinadores afectados | F4.2 | RF-21 | L1 | — |
| Registra fin del mantenimiento / Devuelve equipo a Disponible | F4.2 | RF-21 | — | E4 |

## Módulo 5. Solicitudes y priorización

| Tarea | F | RF | UX | Rev. |
|---|---|---|---|---|
| Propone proyecto del coordinador | F5.1, F5.2 | Mejora UX aprobada | L10 | — |
| Llena solicitud de gasto | F5.1 | RF-07 | — | — |
| Agrega insumos a retirar / Muestra stock disponible | F5.2 | RF-07 | L1 | — |
| Guarda borrador automáticamente | F5.1, F5.2 | RF-07 (RN-03) | U3 | B6 |
| Envía a aprobación / Valida datos obligatorios / Señala datos faltantes / Pasa a Pendiente de Aprobación | F5.3 | RF-07, RF-29 | L4 | — |
| Avisa al aprobador | F5.3 | Mejora UX aprobada | L8 | — |
| Revisa solicitud en bandeja / Aprueba solicitud / Pasa a Aprobado y avisa | F5.4 | RF-08, RF-29 | L2 | — |
| Rechaza con motivo / Pasa a Rechazado y avisa | F5.4 | RF-08 + mejora UX aprobada (motivo) | L2 | — |
| Registra monto real / Pasa a Ejecutado | F5.5 | RF-29 | — | — |
| Envía solicitud al almacén (sigue en el Módulo 6) | F6.2 | RF-09 | — | A2 |
| Cambia prioridad con justificación / Valida justificación / Exige justificación | F5.7 | RF-10 (RN-04) | L4 | B3 |
| Registra cambio en audit log | F5.7 | RF-10, RF-34 | — | — |
| Reordena lista de prioridad | F5.6 | RF-28 | — | — |

## Módulo 6. Almacén

| Tarea | F | RF | UX | Rev. |
|---|---|---|---|---|
| Registra datos del lote / Asocia solicitud de gasto | F6.1 | RF-09, RF-20 | L5 | — |
| Valida datos y vencimiento / Avisa lote vencido | F6.1 | RF-20, RF-36 | L5 | E3 |
| Registra lote y suma stock | F6.1, F3.3 | RF-09, RF-18, RNF-10 | — | A1 |
| Abre solicitud aprobada | F6.2 | RF-09, RF-29 | — | — |
| Sugiere lotes por vencimiento | F6.2 | RF-36 + mejora UX aprobada (FEFO) | L5 | — |
| Confirma lotes y quién retira | F6.2 | RF-09 | L10 | B4 |
| Registra despacho y descuenta stock | F6.2, F6.3, F3.3 | RF-09, RF-18, RF-23, RNF-10 | — | A1 |
| Pasa solicitud a Ejecutado | F6.2 | RF-29 | — | — |
| Registra uso de materia prima / Compara uso con lo despachado / Avisa la diferencia / Guarda registro de uso | F6.4 | RF-06 | — | — |
| Abre despacho en bitácora / Pide corrección con motivo / Valida motivo de la corrección / Exige motivo / Registra corrección pendiente | F6.5 | RF-35 | L3 | — |
| Avisa al aprobador | F6.5 | Mejora UX aprobada | L8 | — |
| Compara original y corrección / Aprueba corrección / Registra movimiento compensatorio | F6.6 | RF-35 | L3 | A3 |
| Deniega con nota / Avisa al coordinador | F6.6 | RF-35 + mejora UX aprobada (aviso) | L2 | — |

## Módulo 7. Cierre de período y prorrateo

| Tarea | F | RF | UX | Rev. |
|---|---|---|---|---|
| Abre revisión del período / Valida que no se solape / Muestra período en conflicto | F7.1, F7.2 | RF-24, RF-38 | L1, L7 | C1 |
| Envía cargos a coordinadores | F7.1 | RF-38 | L7 | — |
| Revisa cargos del período / Confirma cargos del proyecto / Actualiza confirmaciones / Revisa confirmaciones | F7.1 | RF-38 | L7 | — |
| Pide corrección de cargo | F7.1, F6.5 | RF-38, RF-35 | L3 | — |
| Envía recordatorio | F7.1 | Mejora UX aprobada | L7 | — |
| Cierra período / Bloquea movimientos del rango | F7.2 | RF-24 | L7 | — |
| Calcula ambos repartos | F7.3, F7.4 | RF-25, RF-26, RF-27 | — | B8 |
| Muestra repartos lado a lado | F7.3, F7.4 | Mejora UX aprobada (vista previa) | L7 | B8 |
| Confirma criterio de reparto / Aplica montos a cada proyecto | F7.3, F7.4 | RF-25 | — | B8 |
| Avisa a coordinadores | F7.3, F7.4 | Mejora UX aprobada | L8 | — |

## Módulo 8. Reportes y auditoría

| Tarea | F | RF | UX | Rev. |
|---|---|---|---|---|
| Calcula indicadores / Filtra por período o prioridad | F8.1 | RF-30 | — | — |
| Abre detalle del indicador / Muestra lista filtrada | F8.1 | RF-30 | L8 | — |
| Elige reporte, filtros y formato | F8.2, F8.3, F8.4 | RF-31, RF-32, RF-33 | — | B5 |
| Busca datos dentro del alcance | F8.2, F8.3, F8.4 | RF-31, RF-32, RF-33 (D12) | — | B5 |
| Avisa que no hay datos | F8.2, F8.3 | RF-31, RF-32 | L9 | — |
| Genera archivo | F8.2, F8.3, F8.4 | RF-31, RF-32, RF-33 | — | — |
| Guarda entrada en audit log (proceso general de todos los módulos) | F8.5 | RF-34 | — | A4 |
| Muestra registros recientes primero / Filtra auditoría (opcional) / Abre registro / Muestra valor anterior y nuevo | F8.6 | RF-04 | — | C2 |
