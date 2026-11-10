# Revisión a fondo de las vistas del frontend

Fecha: 02/11/2026. Versión revisada: el frontend completo de los pasos 0 a 26, con `npm run dev:mock`.

Durante la revisión no se cambió código de la app. Los hallazgos se corrigieron después, en una sola ejecución: ver «Correcciones aplicadas» al final.

## Resumen

**Resultado general:**

- **Fidelidad con los mockups:** las 25 vistas con mockup reproducen sus estados. Las diferencias que quedan son de datos de la semilla, decisiones ya registradas o detalles menores.
- **Lógica y requisitos:**
  - Los flujos completos entre roles funcionan de punta a punta.
  - Las guardas por rol están todas conformes.
  - Ningún doble clic duplica un registro.
  - El aviso de sesión por expirar cumple WCAG 2.2.1.

**Hallazgos.** Hay 27 hallazgos:

| Gravedad   | Cantidad | Qué son                                                                                             |
| ---------- | -------- | --------------------------------------------------------------------------------------------------- |
| Bloqueante | 0        | —                                                                                                   |
| Alta       | 4        | Una regresión del paso 25, dos problemas de accesibilidad graves y la búsqueda global sin construir |
| Media      | 7        | —                                                                                                   |
| Baja       | 16       | —                                                                                                   |

**Cobertura:**

| Qué                                               | Cantidad                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| Estados de comparador de los mockups capturados   | 66 (198 capturas: 1280 px claro, 390 px claro y 1280 px oscuro)        |
| Estados de la app reproducidos con la semilla     | 87, incluidos los que no tienen mockup                                 |
| Capturas de la app                                | 325 (1280 claro, 390 claro, 1280 oscuro y medición a 320 px)           |
| Corridas de axe-core (WCAG 2.2 A y AA)            | 163 a 1280 px (claro y oscuro) y 80 a 390 px                           |
| Rutas probadas con cada rol (guardas)             | 24 × 3                                                                 |
| Vistas probadas con error 500 y con demora de 3 s | 25                                                                     |
| Flujos completos entre roles                      | 5, con 19 comprobaciones                                               |
| Requisitos                                        | F1.1 a F8.6, HU-01 a HU-26 y RN-01 a RN-07, con su estado en la matriz |

## Cómo se revisó

- **Revisión A, fidelidad.**
  - Un guion abre cada mockup, pulsa cada botón del comparador y captura el marco. Otro guion reproduce el mismo estado en la app con la semilla, por ejemplo escribir mal la contraseña, elegir un horario ocupado o usar un código repetido.
  - Las dos capturas se juntan lado a lado (`capturas/NN-*.png`, mockup a la izquierda).
  - Además se compara el texto visible de `main` línea por línea, sin contar cifras ni fechas, para encontrar etiquetas o mensajes que falten.
- **Revisión B, requisitos.** Cada criterio de aceptación de las 26 HU se comprobó en la app, en los handlers de MSW (el contrato del backend) o en las pruebas de Vitest.
- **Revisión C, accesibilidad.**
  - axe-core en cada estado, en claro y oscuro a 1280 px y otra vez a 390 px.
  - Medición de scroll horizontal a 390 y 320 px (reflujo, 1.4.10) y de objetivos táctiles chicos.
  - Revisión del foco en diálogos y en el aviso de sesión.
- **Revisión D, UI/UX.** Heurísticas de Nielsen (H1 a H10), lecciones L1 a L10 de `docs/investigacion-ux/investigacion_ux.md`, los ajustes "→" del §7 del plan, lenguaje claro y consistencia entre vistas.
  - Para los estados de carga y error se reemplazaron los handlers de MSW en la página: un 500 en los datos de la vista y una demora de 3 s.
- **Revisión E, flujos.** Varios roles en una sola pestaña, sin recargar, para que los datos en memoria pasen de un rol al otro.

**Herramientas:** Chrome sin interfaz manejado por Playwright, igual que en los pasos anteriores. La extensión de Chrome no llegaba al servidor local en esta sesión.

**Guiones:** están en `revision/scripts/`. Necesitan `playwright-core` y `axe-core` instalados fuera del proyecto, en una carpeta que se indica con `MODULOS` (por ejemplo `MODULOS=C:/herramientas/node_modules`). Con `npm run dev:mock` corriendo, se ejecutan así: `node scripts/mockups.mjs`, `node scripts/app.mjs t1` … `t5`, `node scripts/axe390.mjs`, `node scripts/transversal.mjs` y `node scripts/flujos.mjs`.

## Hallazgos

**Revisión:** A fidelidad · B requisitos · C accesibilidad · D UI/UX · E flujos.

**Gravedad:**

- **Bloqueante:** impide una tarea o incumple una RN.
- **Alta:** incumple un requisito o WCAG A/AA, o falta un estado del mockup.
- **Media:** diferencia visible con el mockup, o una heurística afectada.
- **Baja:** detalle de texto, espaciado o datos.

### Alta

**REV-001 · 02 Inicio del Administrador, "Actividad reciente" · Revisiones B y E**

- **Qué pasa:** muestra "Carmen Pérez cambió la prioridad de FIS-008 de Baja a Media" (03/09) en lugar de "Carmen Pérez registró la recepción del lote L-0431" (ayer).
- **Causa:** es una regresión del paso 25. El filtro que excluye las sesiones se combinó con `orderBy` + `take` de `@msw/data`, y se corta antes de ordenar.
- **Referencia:** mockup 02, rol Administrador. La lista debe mostrar lo más reciente.
- **Corrección:** ordenar por fecha a mano y cortar en 3 (`handlers/inicio.ts`). Agregar una prueba en el inicio del administrador.

**REV-002 · 10 Ficha de insumo (tabla "Lotes") y 03 Dashboard (alertas de stock y detalle, en el teléfono) · Revisión C**

- **Qué pasa:** las tablas que se desplazan en horizontal no se pueden enfocar. Con teclado no se llega a las columnas ocultas (axe `scrollable-region-focusable`, grave).
- **Referencia:** WCAG 2.1.1 Teclado.
- **Corrección:** en `TablaDatos`, el contenedor `.tabla-env` lleva `tabIndex={0}`, `role="region"` y el nombre de la tabla. Aplicarlo también a las tablas del dashboard, que no usan `TablaDatos`.

**REV-003 · 18 Despacho, lista de lotes · Revisión C**

- **Qué pasa:** los `<li>` de cada lote están dentro de un elemento con `role="radiogroup"`, así que pierden su lista (axe `listitem`, grave).
- **Referencia:** WCAG 1.3.1 Información y relaciones.
- **Corrección:** usar `<div role="radiogroup">` con hijos `<div>`, o mantener `<ul>` y poner el `radiogroup` en un contenedor externo.

**REV-004 · Marco: búsqueda de la barra superior · Revisiones A y D (H3)**

- **Qué pasa:** el campo "Buscar proyecto, insumo, equipo o solicitud" está en todas las vistas, pero lleva a `/buscar`, que muestra "Vista en construcción".
- **Referencia:** todos los mockups dibujan la búsqueda. El plan no le asignó un paso.
- **Corrección:** construir la búsqueda (proyectos, insumos, equipos y solicitudes del alcance del rol, RN-07) u ocultar el campo hasta tenerla.

### Media

**REV-005 · Campana de avisos (coordinador) · Revisiones B y D (H1)**

- **Qué pasa:**
  - El aviso dice "Confirma los cargos de **noviembre** de QUI-024", pero el período en revisión es octubre. La semilla arma el mes con la fecha de hoy.
  - La misma reserva aparece como "Mar 03/11" en el aviso y "Lun 02/11" en el inicio.
- **Referencia:** mockup 02. Los avisos deben coincidir con los datos.
- **Corrección:** armar el aviso con el período en revisión (`mesEnRevision`) y con la fecha real de la reserva (`datos/avisos.ts`).

**REV-006 · 02 Inicio del Coordinador, saludo · Revisión D (H1, H2)**

- **Qué pasa:** el saludo dice "El período de octubre cierra el sábado 31/10", una fecha que ya pasó. El pendiente de al lado dice "en cuanto confirmen todos".
- **Referencia:** la misma regla del paso 22 para fechas vencidas.
- **Corrección:** usar en el saludo la frase de fecha vencida, como el encabezado ("El cierre de octubre está en revisión").

**REV-007 · 02 Inicio del Coordinador (acciones rápidas) y 12 Reservas ("Solicitar reserva") · Revisiones C (1.4.10) y D**

- **Qué pasa:**
  - A 320 px las dos vistas desbordan la página (338 y 339 px contra 320).
  - A 390 px, tres de las cuatro acciones rápidas quedan cortadas, como en el mockup.
- **Referencia:** WCAG 1.4.10 Reflujo.
- **Corrección:**
  - Que la fila de acciones pase a varias líneas, o a dos columnas en el teléfono.
  - Que los campos de la tarjeta de reserva no tengan ancho mínimo fijo.

**REV-008 · 15 Bandeja, detalle de una solicitud de gasto · Revisiones B (F5.4) y D (H6)**

- **Qué pasa:** la cotización adjunta es texto plano ("cotizacion-quimica-valencia.pdf"). El aprobador no la puede abrir.
- **Referencia:** el mockup 15 la enlaza. El aprobador decide con ella.
- **Corrección:** enlace de descarga (`GET /api/solicitudes/:id/cotizacion`); en los mocks, un PDF de muestra.

**REV-009 · 07 Ficha de proyecto, "Movimientos recientes" · Revisiones A y B (F2.5, F2.7)**

- **Qué pasa:** solo lista cargos, es decir despachos y gastos.
- **Referencia:** el mockup 07 mezcla también las cargas de avance de hitos ("Avance del hito 3 cargado: 70 % «DRX de 4 de 6 muestras»") y los gastos compartidos ("Gastos compartidos de septiembre (según consumo)").
- **Corrección:** unir cargos y avances en la lista, ordenados por fecha.

**REV-010 · 12 Reservas (coordinador) · Revisión B (HU-13, criterio 4)**

- **Qué pasa:** una reserva rechazada solo llega como aviso en la campana. El calendario solo muestra las pendientes y aprobadas, así que el coordinador no la "ve rechazada" en sus reservas.
- **Referencia:** HU-13: "cuando reviso mis reservas, la veo rechazada y el horario queda libre".
- **Corrección:** mostrar las rechazadas recientes del coordinador (por ejemplo, en "Próximas reservas" del inicio o en una lista bajo el calendario) con el motivo, sin ocupar el horario.

**REV-011 · 18 Despacho, error al cargar · Revisión D (H9)**

- **Qué pasa:** con un error del servidor muestra "Falla simulada" y "Volver al almacén", pero no "Reintentar". Las otras 24 vistas sí lo ofrecen.
- **Referencia:** plan §7.1, errores del servidor.
- **Corrección:** usar `ErrorCarga` con `alReintentar`.

### Baja

**REV-012 · 24 Reportes, resumen del reparto · Revisión B (HU-25, criterio 3)**

- **Qué pasa:** un período cerrado pero sin repartir no aparece en "Período repartido" y nada lo explica.
- **Referencia:** HU-25: "el sistema me dice que no está prorrateado".
- **Corrección:** listar los cerrados sin repartir como opciones desactivadas, "(sin repartir)", o con una nota bajo el selector.

**REV-013 · 18 Despacho, lote vencido · Revisión B (HU-19, criterio 2)**

- **Qué pasa:** el lote vencido se ve, bloqueado, como en el mockup 18. La HU dice que "no aparece entre las opciones".
- **Referencia:** conflicto entre la HU y el mockup.
- **Corrección:** confirmar el criterio. La app sigue el mockup, que además explica por qué no se puede usar.

**REV-014 · 08 Plan de hitos, cargar avance · Revisión D (H5)**

- **Qué pasa:** un avance menor que el actual (60 % con el hito en 70 %) se guarda sin aviso y baja el avance físico (62 → 59 %).
- **Referencia:** F2.5 lo permite, pero conviene prevenir el error.
- **Corrección:** aviso "warn" antes de guardar, con el mismo patrón que el uso de materia prima.

**REV-015 · 02 Inicio del Aprobador · Revisión A**

- **Qué pasa:**
  - La tabla de la bandeja ordena por prioridad y deja fuera REP-014 (reposición automática) por el límite de 5.
  - El riel dice 11 y el saludo "9 decisiones", porque el riel también suma "por ejecutar" (§7.2).
- **Referencia:** mockup 02, rol Aprobador.
- **Corrección:** aclarar el contador del riel (nombre accesible "9 por decidir y 2 por ejecutar"), o mostrar la reposición en el inicio.

**REV-016 · 02 Inicio del Coordinador · Revisión A**

- **Qué pasa:** el aviso de rechazo dice "Puedes crear una nueva solicitud con lo que faltaba."
- **Referencia:** el mockup dice "Puedes crear una nueva con la cotización adjunta."
- **Corrección:** ajustar el texto.

**REV-017 · 03 Dashboard · Revisión A**

- **Qué pasa:** en la escala de las barras, "100 %" y "120 %" se superponen. Es un defecto heredado del mockup.
- **Referencia:** mockup 03.
- **Corrección:** quitar la marca de 120 % o separarla.

**REV-018 · 04 Usuarios · Revisión A**

- **Qué pasa:** la lista va en orden alfabético. El mockup agrupa: administrador, aprobadora y coordinadores.
- **Referencia:** mockup 04. Además, el mockup muestra una cuenta desactivada con el filtro "Activas".
- **Corrección:** decidir el orden. El alfabético es defendible.

**REV-019 · 05 Ubicaciones · Revisión A**

- **Qué pasa:** en el alta, el campo Nombre es más angosto que en el mockup y corta el texto.
- **Referencia:** mockup 05.
- **Corrección:** misma proporción de columnas que el mockup.

**REV-020 · 07 Ficha de proyecto (teléfono) · Revisión D (H6)**

- **Qué pasa:** la pestaña "Historial" queda fuera de la vista y no hay ninguna pista de que hay más pestañas.
- **Referencia:** —
- **Corrección:** degradado o flecha al borde de la barra de pestañas.

**REV-021 · 10 Ficha de insumo · Revisión A**

- **Qué pasa:** la leyenda del gráfico ocupa dos líneas ("Stock mínimo" pasa abajo).
- **Referencia:** mockup 10.
- **Corrección:** reducir el espacio entre los elementos de la leyenda.

**REV-022 · 18 Despacho registrado · Revisión A**

- **Qué pasa:** desaparece el subtítulo "Retiro aprobado para QUI-024, Daniela Rivas · aprobado hoy a las 08:15".
- **Referencia:** mockup 18, estado "Despacho registrado".
- **Corrección:** mantener el subtítulo.

**REV-023 · 19 Bitácora · Datos de la semilla**

- **Qué pasa:** hay cantidades fraccionadas de insumos que se cuentan por unidad, como "0,4 unidades" de pasta térmica (DES-0206).
- **Referencia:** coherencia de los datos.
- **Corrección:** redondear a enteros los insumos en unidades, bolsas, cajas o rollos (`datos/despachos.ts`).

**REV-024 · 19 Bitácora · Revisión A**

- **Qué pasa:** la semilla no trae un movimiento de corrección aprobado. El mockup lo muestra ("Corrige a DES-0297, aprobada por Carmen Pérez").
- **Referencia:** mockup 19.
- **Corrección:** agregar una corrección aprobada a la semilla.

**REV-025 · 25 Auditoría · Revisión A**

- **Qué pasa:**
  - "Solicitud SOL-119" aparece sin "a Pendiente de Aprobación", porque su registro no guarda el valor nuevo.
  - No hay registros del "Sistema", como la reposición automática.
- **Referencia:** mockup 25.
- **Corrección:** completar los valores en la semilla y auditar la reposición automática con usuario Sistema e IP "—".

**REV-026 · 19 Bitácora y 25 Auditoría (teléfono) · Revisiones A y D**

- **Qué pasa:**
  - En las tablas apiladas, algunos datos van sin su etiqueta (fecha, proyecto, usuario).
  - La fila elegida o resaltada se ve fragmentada, línea por línea.
- **Referencia:** patrón `data-e` del mockup.
- **Corrección:** etiquetas `data-e` en todas las celdas y el resaltado en la tarjeta entera.

**REV-027 · 19 Bitácora · Revisión A**

- **Qué pasa:** el movimiento de corrección no muestra el código del lote.
- **Referencia:** mockup 19.
- **Corrección:** mostrar el lote del despacho corregido.

## Lo que se verificó conforme

- **Guardas.**
  - Las 24 rutas, abiertas con cada uno de los tres roles, dan el resultado esperado: la vista o "Esta sección no está disponible para tu cuenta".
  - Un coordinador que abre un proyecto ajeno (BIO-011) ve "no está asignado a ti" (RN-07).
- **Errores y carga.**
  - Con un 500 en sus datos, 24 de 25 vistas muestran el error en lenguaje claro y "Reintentar"; la excepción es el despacho (REV-011).
  - Con una demora de 3 s, todas muestran esqueletos o `aria-busy`.
- **Sesión por expirar.** A los 28 min y 30 s aparece "Tu sesión está por cerrarse" con la cuenta regresiva, y el foco queda en "Seguir trabajando" (WCAG 2.2.1).
- **Doble clic.** Confirmar un despacho dos veces crea un solo DES. Aprobar una reserva dos veces la aprueba una sola vez.
- **Flujos completos:**
  1. **Retiro:** el coordinador envía el retiro, el aprobador lo aprueba (la bandeja baja de 12 a 11) y lo despacha. La campana del coordinador avisa. La solicitud queda Ejecutada y el despacho aparece en la bitácora. El coordinador registra el uso y pide una corrección; al aprobarla, la bitácora muestra el movimiento enlazado ("Corrige a DES-0319" / "Corregido por DES-0320").
  2. **Gasto:** marcar SOL-114 como ejecutada por US$ 100 sube el gasto de BIO-011 de 11.160,00 a 11.260,00.
  3. **Stock bajo:** se aprueba REP-014 y se recibe el lote. La acetona pasa a "Al día".
  4. **Cierre:** la coordinadora confirma (el tablero pasa a 3 de 7), se cierra y se reparte. La auditoría muestra "Período octubre de 2026 a Repartido" y los inicios de sesión.
  5. **Administración:** una cuenta desactivada no puede iniciar sesión.
- **Teléfono.** La bandeja muestra primero la lista y el detalle al tocar, con "Volver a la bandeja", igual que el mockup.
- **Tema oscuro.** Sin fallas de contraste en ningún estado (axe en oscuro a 1280 px).
- **Consola.** Sin errores de JavaScript en las 325 capturas. Solo aparece el 401 esperado al abrir la pantalla de inicio de sesión sin sesión.

## Diferencias que son decisiones registradas (no son hallazgos)

| Vista  | Diferencia con el mockup                                                                       | Dónde se decidió |
| ------ | ---------------------------------------------------------------------------------------------- | ---------------- |
| Marco  | El cierre de sesión, el selector de tema y el avatar van en "Mi perfil", no en el pie del riel | Paso 2           |
| 05, 17 | Las ubicaciones incluyen los laboratorios (la nota dice "lotes o equipos")                     | Paso 11          |
| 07     | "Coordina Daniela Rivas" (sin género) y "Cambiar coordinador" cuando ya tiene uno              | Pasos 7 y 22     |
| 07     | Enlaces "Bitácora" y "Registrar uso" en la ficha del coordinador                               | Paso 20          |
| 09, 10 | El Aprobador no ve "Cambiar stock mínimo"                                                      | §7.3             |
| 14     | Borrador automático ("Se guarda sola mientras escribes") y "Descartar borrador"                | HU-15, paso 14   |
| 15     | "Por ejecutar" como segmento propio                                                            | §7.2             |
| 18     | Columnas de lotes más anchas                                                                   | Paso 18          |
| 21     | "Pedir corrección" solo en despachos                                                           | Paso 21          |
| 22     | "Sin coordinador: lo asigna el Administrador" en lugar de "Asignar coordinador"                | Paso 22          |
| 23     | Consumo por proyecto según los despachos de la semilla (el mockup choca con el 21)             | Paso 23          |
| 03     | Barras de ejecución en HTML y mes en curso casi vacío a principios de mes                      | Paso 26          |
| Todas  | Cifras, fechas y montos según la semilla relativa a hoy                                        | Plan §2          |

## Matriz de requisitos

**Estados:**

- **Cumple:** verificado en la app y, cuando corresponde, con su prueba.
- **Parcial:** falta una parte; se indica el hallazgo.
- **Decisión:** la app sigue al mockup donde choca con el texto.

### Funcionalidades

| F           | Vista           | Pruebas (Vitest)                             | Estado                         |
| ----------- | --------------- | -------------------------------------------- | ------------------------------ |
| F1.1 a F1.3 | 04 Usuarios, 01 | usuarios, iniciar-sesion                     | Cumple                         |
| F1.4, F1.5  | 05              | ubicaciones-parametros, equipos              | Cumple                         |
| F2.1 a F2.3 | 06, 07          | proyectos, ficha-proyecto                    | Cumple                         |
| F2.4 a F2.6 | 08              | plan-hitos, avance                           | Cumple (sugerencia: REV-014)   |
| F2.7        | 07, 03          | ficha-proyecto, proyectos                    | Cumple                         |
| F3.1 a F3.6 | 09, 10, 17      | inventario, ficha-insumo, recepcion, bandeja | Cumple                         |
| F3.7        | 10              | ficha-insumo, pronostico                     | Cumple                         |
| F4.1, F4.2  | 11              | equipos                                      | Cumple                         |
| F4.3, F4.4  | 12              | reservas, horarios                           | Cumple                         |
| F4.5        | 15              | bandeja                                      | Parcial (REV-010)              |
| F4.6        | 13              | uso-equipo                                   | Cumple                         |
| F5.1 a F5.3 | 14              | solicitudes                                  | Cumple                         |
| F5.4        | 15              | bandeja                                      | Parcial (REV-008)              |
| F5.5        | 15              | bandeja                                      | Cumple                         |
| F5.6, F5.7  | 16              | priorizacion                                 | Cumple                         |
| F6.1        | 17              | recepcion                                    | Cumple                         |
| F6.2, F6.3  | 18, 19          | despacho                                     | Cumple (REV-013 como decisión) |
| F6.4 a F6.6 | 20, 19, 15      | despacho, bandeja                            | Cumple                         |
| F7.1, F7.2  | 21, 22          | cierre                                       | Cumple                         |
| F7.3, F7.4  | 23              | reparto                                      | Cumple                         |
| F8.1        | 03              | dashboard                                    | Cumple                         |
| F8.2, F8.4  | 24              | reportes                                     | Cumple                         |
| F8.3        | 24              | reportes                                     | Parcial (REV-012)              |
| F8.5, F8.6  | 25              | auditoria                                    | Cumple (detalles en REV-025)   |

### Historias de usuario

**Cumplen todos sus criterios:** HU-01 a HU-09, HU-11, HU-12, HU-14 a HU-18 y HU-20 a HU-24.

Notas sobre criterios concretos:

- **HU-04:** el coordinador no puede crear solicitudes para un proyecto Finalizado. El handler lo rechaza y el proyecto no aparece en el selector.
- **HU-09:** el despacho revisa la reposición automática (`revisarReposicion`) y no crea una segunda reposición abierta.
- **HU-23:** comprobado en el reparto: residuo de redondeo, proyecto Suspendido excluido y el 409 al intentar repartir dos veces.

**Con observaciones:**

| HU    | Estado   | Detalle                                                                                                      |
| ----- | -------- | ------------------------------------------------------------------------------------------------------------ |
| HU-10 | Cumple   | "Próximo a vencer" con los días que quedan, y "Vencido"                                                      |
| HU-13 | Parcial  | El criterio 4 no se cumple (REV-010)                                                                         |
| HU-19 | Decisión | El lote vencido se ve bloqueado en lugar de no aparecer (REV-013)                                            |
| HU-25 | Parcial  | El criterio 3 no se cumple (REV-012)                                                                         |
| HU-26 | Cumple   | Filtrar por "BIO-011" muestra el cambio con fecha, hora, usuario, IP y justificación. No hay edición posible |

### Reglas de negocio

| RN    | Dónde se comprobó                                                                                       | Estado |
| ----- | ------------------------------------------------------------------------------------------------------- | ------ |
| RN-01 | Los nombres de quien retira son texto libre, sin cuenta (despacho)                                      | Cumple |
| RN-02 | Los consumibles de uso general se despachan sin proyecto y se reparten en el paso 23                    | Cumple |
| RN-03 | Transiciones de solicitudes y reservas. Rechazado es final. La reposición aprobada guarda los dos pasos | Cumple |
| RN-04 | La priorización exige justificación (estado "Sin justificación")                                        | Cumple |
| RN-05 | Solo los proyectos En ejecución cuentan como activos en el dashboard y el reparto (FIS-006 excluido)    | Cumple |
| RN-06 | La bitácora y la auditoría no se pueden editar; las correcciones son movimientos nuevos                 | Cumple |
| RN-07 | Guardas, selectores y reportes limitados a los proyectos del coordinador                                | Cumple |

### Puntos por confirmar (SP) que afectan a la UI

Siguen marcados en el código:

- **SP-06:** uso de equipo sin reserva.
- **SP-07:** el uso de materia prima no descuenta stock.
- **SP-08:** se puede cerrar el período sin todas las confirmaciones.
- **SP-09:** los gastos compartidos son los lotes recibidos en el período.
- **SP-13:** reactivar un proyecto suspendido.

## Capturas

Están en `capturas/`.

- **Mockup y app lado a lado:** `NN-*.png`, con el número de la vista. Por ejemplo `02-coo.png`, `12-choque.png`, `23-comp.png`.
- **Hojas del teléfono por tanda:** `t1-telefono.png`, `t2-tel.png`, `t3-tel.png`, `t4-tel.png` y `tel-t5.png`.
- **Vistas sin mockup:** `t1-otros.png` y `t1-otros2.png` (404, sin permiso, perfil, búsqueda, crear contraseña y cuenta desactivada).
- **Estados transversales:** `X-error_bandeja.png` (error con "Reintentar"), `X-carga_proyectos.png` (esqueletos) y `X-sesion.png` (aviso de sesión).

## Correcciones propuestas, por tandas

1. **Alta:** REV-001, REV-002, REV-003. REV-004 depende de decidir entre construir la búsqueda u ocultarla.
2. **Media:** REV-005 a REV-011.
3. **Baja:** REV-012 a REV-027. Varias son de una línea o de la semilla.

Cada corrección lleva su prueba de Vitest si corresponde, se vuelve a capturar con los guiones de `scripts/` y queda anotada en `plan_frontend.md` con su ID.

## Correcciones aplicadas (02/11/2026)

Todas se aplicaron en una sola ejecución, por tandas, y se repitieron los guiones de `scripts/`. Capturas posteriores en `capturas/post/`.

| ID      | Qué se hizo                                                                                                                                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REV-001 | `handlers/inicio.ts` ordena por fecha a mano y corta en 3. Prueba en el inicio del administrador                                                                                                                                                                                |
| REV-002 | `EnvTabla` (`components/ui/tabla.tsx`): cuando la tabla desborda, el contenedor es una región con foco y el nombre de su `caption`. La usan `TablaDatos` y las tablas del dashboard, el reparto, la auditoría y la bandeja del inicio. Las tres del dashboard ganaron `caption` |
| REV-003 | Los lotes del despacho son `div` dentro del `radiogroup`                                                                                                                                                                                                                        |
| REV-004 | Búsqueda construida: `GET /api/buscar`, ruta `/buscar`, proyectos, insumos, equipos y solicitudes con el alcance de cada rol (RN-07)                                                                                                                                            |
| REV-005 | El aviso usa `mesEnRevision` y el horario real de RES-050                                                                                                                                                                                                                       |
| REV-006 | Con el mes terminado, el saludo dice «El cierre de octubre está en revisión»                                                                                                                                                                                                    |
| REV-007 | Acciones rápidas en dos columnas, `.lista` y la tarjeta de reserva sin ancho mínimo: sin desborde a 320 px                                                                                                                                                                      |
| REV-008 | La cotización es un botón de descarga (`EnlaceCotizacion`) en la bandeja y en Mis solicitudes; los mocks arman un PDF de muestra                                                                                                                                                |
| REV-009 | Los movimientos recientes incluyen el avance y los gastos compartidos más recientes                                                                                                                                                                                             |
| REV-010 | «Reservas rechazadas» (últimos 30 días, con motivo) bajo el calendario del coordinador. Las reservas guardan `motivoRechazo`                                                                                                                                                    |
| REV-011 | El despacho ofrece «Reintentar»                                                                                                                                                                                                                                                 |
| REV-012 | Los períodos cerrados sin repartir salen como «(sin repartir)», desactivados, con una nota                                                                                                                                                                                      |
| REV-013 | Sin cambios: sigue como decisión (el lote vencido se ve bloqueado, como el mockup). Falta que el equipo confirme el criterio de la HU-19                                                                                                                                        |
| REV-014 | Ya existía el aviso «Es menos que la última carga» en el diálogo (se ve al escribir); se agregó la prueba                                                                                                                                                                       |
| REV-015 | El contador de la bandeja se lee «9 por decidir y 2 por ejecutar» para lectores de pantalla. La tabla del inicio sigue sin REP-014                                                                                                                                              |
| REV-016 | Texto: «Puedes crear una nueva con lo que faltaba.»                                                                                                                                                                                                                             |
| REV-017 | Sin la marca de 120 %: ya no se superpone con el 100 %                                                                                                                                                                                                                          |
| REV-018 | Usuarios: activas primero, luego administrador, aprobador y coordinadores, y por nombre                                                                                                                                                                                         |
| REV-019 | Alta de ubicaciones con nombre y descripción del mismo ancho                                                                                                                                                                                                                    |
| REV-020 | Degradado al borde de las pestañas cuando hay más                                                                                                                                                                                                                               |
| REV-021 | Leyenda del gráfico en una línea                                                                                                                                                                                                                                                |
| REV-022 | El despacho registrado mantiene el subtítulo                                                                                                                                                                                                                                    |
| REV-023 | Los insumos que se cuentan por pieza no se despachan en fracciones (la serie de guantes pasó a enteros)                                                                                                                                                                         |
| REV-024 | La semilla trae DES-0297 y su corrección aprobada DES-0298 (en QUI-031, para no cambiar los cargos de QUI-024)                                                                                                                                                                  |
| REV-025 | SOL-119 con su estado nuevo; la reposición automática se audita con el usuario «Sistema» y sin IP, en la semilla y en `revisarReposicion`                                                                                                                                       |
| REV-026 | Etiquetas «Fecha:», «Usuario:» y «Proyecto:» y resaltado de la tarjeta entera en el teléfono                                                                                                                                                                                    |
| REV-027 | El movimiento de corrección muestra el lote                                                                                                                                                                                                                                     |

**Resultado de la nueva corrida:** 146 pruebas pasan; lint, tipos y Prettier sin fallos; axe sin hallazgos en ficha de insumo, dashboard a 390 px, despacho, búsqueda y reservas a 390 px; 25 de 25 vistas con «Reintentar»; guardas conformes; los 5 flujos completos pasan.

## Seguimiento (03/11/2026)

- **REV-013:** cerrado como decisión del equipo (el lote vencido se ve bloqueado); la HU-19 y F6.2 se ajustaron en la v0.1.3 de los requisitos.
- **REV-015:** corregido. La tabla del inicio del Aprobador incluye una reposición y un enlace «Ver los N pedidos».
- **Esqueleto del inicio del Administrador:** falso positivo del guion de carga.
- **Tableta a 768 px** (`scripts/tableta.mjs`): 40 vistas, sin scroll horizontal tras corregir la causa y apilar columnas a menos de 960 px.
- **Revisión con la extensión de Chrome (03/11/2026):** ya conectó con `localhost`. En el navegador real se comprobaron la búsqueda de la barra superior (resultados para «cerio»), las reservas rechazadas con su motivo y los movimientos recientes de la ficha. La extensión no cambia el ancho de la ventana, así que lo del teléfono y la tableta sigue con Playwright.
