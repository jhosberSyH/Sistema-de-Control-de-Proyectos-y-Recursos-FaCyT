# Investigación de UX de los proyectos de referencia

Fecha de la investigación: 26 de octubre de 2026.

Investigué la experiencia de usuario de los proyectos de `benchmarking.md`, es decir cómo organizan sus flujos, cómo navega el usuario, qué pasos tiene cada proceso y qué opinan los usuarios. Al final están las lecciones que se aplican a los diagramas de flujo de nuestros módulos.

## Método

- **Fuentes revisadas:**
  - Documentación oficial y manuales: NEMO Feature Manual, doc.elabftw.net y docs.frappe.io.
  - Código fuente.
  - Issues y discussions de GitHub y GitLab.
  - Foros oficiales: Google Groups de NEMO y discuss.frappe.io.
  - Evaluaciones institucionales: Universidad de Duisburg-Essen y la comunidad ELN de Austria.
  - Los artículos de los casos publicados.
- **Etiquetas de cada hallazgo:**
  - **[DOC]**: lo que dice la documentación, el código o el propio artículo. Describe el flujo, no una opinión.
  - **[OPINIÓN]**: lo que dice un usuario o administrador real, en un foro, un issue, una reseña o una encuesta.
  - **[MANTENEDOR]**: respuesta del equipo que desarrolla el producto.
- **Citas:** van textuales en el idioma original, con su traducción.
- **Verificación por muestreo:** volví a abrir cuatro fuentes y las citas coinciden con el original:
  - NEMO #187.
  - eLabFTW #6514.
  - Foro de Frappe 150602.
  - Chimote et al. (2022) en PMC.

### Fuentes que fallaron

| Fuente | Qué pasó |
|---|---|
| G2, Capterra, TrustRadius, Software Advice | Error 403. Las dos citas de G2 y Capterra salen solo del fragmento del buscador y van marcadas "[fragmento, no verificado]" |
| Reddit (r/labrats, r/ERPNext, r/erp) | La herramienta no tiene acceso a reddit.com. No hay ninguna cita de Reddit |
| MDPI y repositorio de la Univ. de Parma (Gardella et al., 2024) | Error 403. Solo se leyó el resumen en Crossref, así que de ese artículo no hay opiniones |
| Comentarios de los issues de NEMO-CE en GitLab | Piden iniciar sesión. Solo se leyeron las descripciones de los issues |
| Regulski et al. (2024) y Opaliński et al. (2026) | Son prototipos de investigación sin interfaz publicada. No tienen hallazgos de UX y no se rellenan |

---

## 1. NEMO (NIST)

**Fuentes principales:**
- NEMO Feature Manual v7.0.1: https://nemo.nist.gov/public/NEMO_Feature_Manual.pdf
- Issues: https://github.com/usnistgov/NEMO/issues
- Foro: https://groups.google.com/a/list.nist.gov/g/nemo
- NEMO-CE: https://gitlab.com/nemo-community/nemo-ce

### 1.1 Flujos y navegación [DOC]

- **Menú superior** (Manual §4.1). Tiene Calendar, Tool Control, Status dashboard, Requests, Safety, Preferences y Logout. El personal ve además el menú Administration. Algunas opciones solo aparecen cuando tienen sentido para el usuario, como explica el mantenedor en el hilo "Main Menu Items" (https://groups.google.com/a/list.nist.gov/g/nemo/c/ClZjgQXJfrE).
- **Página de inicio** (§4.5–4.10). Muestra las tres próximas reservas, en amarillo si el usuario va tarde. También muestra alertas, interrupciones y accesos rápidos que configura el administrador.
- **Reservar un equipo** (§5.4.6). El calendario sigue estos pasos:
  1. El usuario elige el equipo en el árbol.
  2. Arrastra el rango de inicio a fin.
  3. Confirma, si la confirmación está activada.
  4. El sistema valida contra las políticas. Si hay conflictos, muestra la lista y no crea la reserva.
  5. El usuario elige el proyecto. Si tiene uno solo, se asigna solo.
  6. Responde las preguntas de la reserva.

  Mover o redimensionar la reserva cancela la anterior y crea una nueva enlazada, así que el historial queda completo (§5.4.7–5.4.8).
- **Usar un equipo** (§6.4.8–6.4.9). Se elige el proyecto y se pulsa "Start using the tool". El botón "Stop using" queda deshabilitado hasta que se responden las preguntas obligatorias de cierre.
- **Retirar consumibles** (§35.1). Funciona como un carrito:
  1. Elegir el cliente y el proyecto. El proyecto se asigna solo si hay uno.
  2. Agregar artículos con su cantidad.
  3. Confirmar.

  El retiro se registra y descuenta el stock. Si hay un error, el campo queda resaltado.
- **Solicitudes de ajuste de cargos** (§8.3):
  1. El usuario pulsa "Request an adjustment" en la fila del cargo, propone la corrección y escribe el motivo.
  2. El sistema avisa por correo y marca el menú Requests.
  3. El revisor puede responder antes de decidir, y luego aprueba o deniega con una nota.

  Si ya existe una solicitud para ese cargo, el botón queda deshabilitado con el aviso "An adjustment request already exists for this charge" (plantilla `NEMO/templates/usage/adjustment_request_button.html`). El plazo para pedir ajustes se configura y se muestra en la página de uso (§41.1).
- **Validación de cargos** en NEMO-CE. El usuario valida sus cargos, y los que no valida se auto-validan al vencer el plazo (https://gitlab.com/nemo-community/nemo-ce/-/wikis/Features/User-charges-validation).

### 1.2 Lo que les gusta [OPINIÓN]

| Hallazgo | Cita | Fuente |
|---|---|---|
| La facturación integrada ahorra trabajo | "it has saved our financial staff a lot of time" (le ha ahorrado mucho tiempo a nuestro personal financiero), Princeton | Hilo "Billing at UM LNF", https://groups.google.com/a/list.nist.gov/g/nemo/c/0FjuY9qIrSU |
| Buena adopción por personal y usuarios | "it has been a big success both with staff and labmembers" (ha sido un gran éxito con el personal y con los usuarios del laboratorio), Princeton, 2018 | https://mtl.mit.edu/pipermail/labnetwork/attachments/20181220/775e0362/attachment.html |
| Ver la próxima reserva en el control del equipo | "The new options for showing next upcoming reservation under tool control is great" (las nuevas opciones para mostrar la próxima reserva son geniales) | Issue #284, https://github.com/usnistgov/NEMO/issues/284 |
| La cadena de aprobación acorta las compras | "reduced our purchasing timeline (submission to order) from 14 days to one day" (redujo el tiempo de compra de 14 días a uno), NIST Boulder | Programa del NEMO User Meeting 2026, https://mitnano.mit.edu/sites/default/files/documents/NEMO%20User%20Meeting%20Program%20and%20Abstracts.pdf |

### 1.3 Lo que les frustra y dónde se traban [OPINIÓN]

| Tema | Hallazgo y cita | Fuente |
|---|---|---|
| Reservas por error | "People mistakenly click (frequently) and have to either cancel or modify the reservation" (la gente hace clic por error, con frecuencia, y tiene que cancelar o modificar la reserva), y cada cambio genera correos | Issue #187, https://github.com/usnistgov/NEMO/issues/187 |
| Reservas largas | Arrastrando no se puede reservar un fin de semana ni pasar de un mes al siguiente. Piden editar inicio y fin en un formulario | Issue #152, https://github.com/usnistgov/NEMO/issues/152 |
| No se sabe qué calendario está abierto | Piden "make it more obvious which tool calendar(s) is/are active" (dejar claro qué calendario está activo) | Issue #204, https://github.com/usnistgov/NEMO/issues/204 |
| No se ven varios equipos juntos | "It is the only reason we haven't fully switched over to Nemo" (es la única razón por la que no nos hemos cambiado del todo a NEMO) | Foro, https://groups.google.com/a/list.nist.gov/g/nemo/c/fhzwsSpv0Zw/m/Hh7UE5aJAwAJ |
| El mantenimiento no se ve al reservar | Piden mostrar en el calendario si el equipo está en mantenimiento y avisar al reservar | Issue #277, https://github.com/usnistgov/NEMO/issues/277 |
| Cambiar una respuesta obliga a rehacer la reserva | "a bit of a nuisance" (bastante molesto) | Issue #153, https://github.com/usnistgov/NEMO/issues/153 |
| Usos que nadie cierra | "We have an ongoing problem of users forgetting to 'Stop Using' tools" (los usuarios olvidan cerrar el uso del equipo) | Foro, https://groups.google.com/a/list.nist.gov/g/nemo/c/adeCYBaWJ6g |
| Campos obligatorios que no se notan | Los usuarios no veían que una pregunta era obligatoria y reportaban "kiosk not working" (el kiosco no funciona) | Issue #256, https://github.com/usnistgov/NEMO/issues/256 |
| Alerta que lleva a una vista sin filtrar | La alerta de cargos sin validar abría la página de uso con las fechas por defecto, "which most of the times does not contain the unvalidated charges" (que casi nunca muestra esos cargos) | NEMO-CE #33, https://gitlab.com/nemo-community/nemo-ce/-/work_items/33 |
| Consumo escondido fuera del menú | Un investigador principal no encontraba el consumo de su proyecto, porque "My usage" no está en el menú | Foro, https://groups.google.com/a/list.nist.gov/g/nemo/c/11fY_phVQ8M |
| Rechazo sin aviso | Al rechazar una solicitud no se envía correo, y el motivo queda en un historial que el usuario no identifica | NEMO-CE #39, https://gitlab.com/nemo-community/nemo-ce/-/work_items/39 |
| Correos sin contexto | Los correos solo traen el ID: "confusing and not useful to the email recipient" (confuso e inútil para quien lo recibe) | NEMO-CE #31, https://gitlab.com/nemo-community/nemo-ce/-/work_items/31 |
| Usuarios que no entran a diario | Piden avisar a quien tiene un equipo reservado cuando se reporta una falla: "Many of our users ... may not be checking NEMO daily" (muchos usuarios no revisan NEMO a diario) | Issue #166, https://github.com/usnistgov/NEMO/issues/166 |
| Borrado ambiguo | Un administrador borró un equipo completo creyendo que borraba sus documentos | Issue #99, https://github.com/usnistgov/NEMO/issues/99 |
| Cantidades fraccionarias | No se pueden retirar 5,6 unidades. El mantenedor aclara que la unidad debe definirse por artículo | Issue #93, https://github.com/usnistgov/NEMO/issues/93 |

---

## 2. eLabFTW

**Fuentes principales:**
- Documentación: https://doc.elabftw.net/
- Código e issues: https://github.com/elabftw/elabftw
- Evaluación de la Universidad de Duisburg-Essen (UDE): https://duepublico2.uni-due.de/servlets/MCRFileNodeServlet/duepublico_derivate_00077971/Hendriks_Evaluation_Einfuehrung_ELN_UDE.pdf
- Encuesta austriaca 2025: https://repository.tugraz.at/records/4863b-kjt77

### 2.1 Flujos y navegación [DOC]

- **Barra superior** (`src/templates/head.html`). Tiene Dashboard, Experiments, Resources, Scheduler, Team (con la pestaña de solicitudes de compra en beta) y Tools (con Inventory y Compounds). Tiene además un botón "Create new…". Equipos, reactivos e insumos son todos "Resources".
- **Reserva** (https://doc.elabftw.net/docs/usage/user-guide/scheduler):
  1. El dueño activa la reserva del recurso.
  2. El usuario busca el recurso en el Scheduler y arrastra un bloque en el calendario.
  3. Confirma en un modal.

  Las reglas se configuran por recurso: superposición, duración máxima, reservas futuras por usuario, días de anticipación y plazo de cancelación (`src/templates/booking-params-modal.html`). **No hay** aprobación de reservas (#5174, #7513) ni estado de mantenimiento (#5638).
- **Inventario** (https://doc.elabftw.net/docs/usage/inventory). El usuario arma un árbol de ubicaciones y agrega contenedores con cantidad y unidad. **No hay** lote, vencimiento, stock mínimo ni descuento de consumo (#5711, #7123).
- **Solicitudes de compra.** Siguen los estados Pending → Validated → Partially received → Received → Archived o Cancelled (`src/Enums/ProcurementState.php`). Cualquier miembro del equipo puede cambiar el estado, porque no hay rol aprobador (`src/Models/ProcurementRequests.php`). Borrar pasa la solicitud a "Cancelled" "so we can trust its log" (para poder confiar en su registro).
- **Auditoría** (https://doc.elabftw.net/docs/usage/traceability-and-auditability). Cada entrada tiene su historial de cambios. El audit log solo lo ve el superadministrador.

### 2.2 Lo que les gusta [OPINIÓN]

| Hallazgo | Cita | Fuente |
|---|---|---|
| La agenda de reservas | "teams I've recently onboarded … really like the scheduler/booking feature" (a los equipos que incorporé les gusta mucho la agenda) | Issue #5174, https://github.com/elabftw/elabftw/issues/5174 |
| Reservar es eficiente | "Planing of Bench usage booking is very efficient" (planificar las reservas de mesada es muy eficiente) | UDE, p. 15 |
| Fácil de empezar | "very user friendly - new group members don't take long to navigate the software" (muy amigable, los nuevos aprenden rápido a navegar) | UDE, p. 15–16 |
| Las plantillas ahorran tiempo | Las plantillas "save a lot of time" (ahorran mucho tiempo) | UDE, p. 15 |
| Valoración general | De 55 usuarios de 9 universidades, 38 % lo encuentra "very suitable" (muy adecuado), 45 % "suitable" (adecuado) y 0 % lo califica negativo | Encuesta austriaca 2025 |

### 2.3 Lo que les frustra y dónde se traban [OPINIÓN]

| Tema | Hallazgo y cita | Fuente |
|---|---|---|
| El conflicto se descubre tarde | "The error notice only occurs once you try to create a booking." (el aviso de error solo aparece al intentar crear la reserva) | Issue #6514, https://github.com/elabftw/elabftw/issues/6514 |
| No se ve qué está libre | Con 15 recursos, "the calender is really crowded" (el calendario está muy saturado) | Discussion #4927, https://github.com/elabftw/elabftw/discussions/4927 |
| El conflicto no dice con quién choca | Si un solo día choca se rechaza toda la reserva. Piden ver "Device booked by 'Person X' on DD.MM.YY" (equipo reservado por la persona X el día tal) | Issue #7203, https://github.com/elabftw/elabftw/issues/7203 |
| Se reserva un equipo fuera de servicio | "we market a equipment as down but then users are still able to book it" (marcamos el equipo fuera de servicio y aun así lo reservan) | Issue #5638, https://github.com/elabftw/elabftw/issues/5638 |
| Sin aprobación de reservas | Piden el flujo "Pending Approval → approved/declined with an optional reason" (pendiente, luego aprobada o rechazada con motivo) | Issue #7513, https://github.com/elabftw/elabftw/issues/7513 |
| Estado manual del equipo | "Users must manually change the item status … which can lead to inconsistencies and confusion" (hay que cambiar el estado a mano y eso genera inconsistencias) | Issue #6249, https://github.com/elabftw/elabftw/issues/6249 |
| El detalle de la reserva confunde | "most users do think that resource is the one booked, when it's not" (la mayoría cree que ese recurso es el reservado y no lo es) | Issue #7464, https://github.com/elabftw/elabftw/issues/7464 |
| Arrastrar en el celular | Reservar desde el teléfono es "schwierig bis nahezu unmöglich" (difícil, casi imposible) | Issue #6427, https://github.com/elabftw/elabftw/issues/6427 |
| Excel en paralelo por falta de lotes | Piden lote y usos por contenedor "in order to avoid the parallel use of a supplementary Excel sheet" (para no usar una planilla Excel en paralelo) | Issue #5711, https://github.com/elabftw/elabftw/issues/5711 |
| Consumo y alerta de agotado | [MANTENEDOR] "What our users are asking are for an automated way to track consumption… Also they ask for having an alert when a container is empty" (piden registrar el consumo automáticamente y una alerta cuando el contenedor se vacía) | Issue #7123, https://github.com/elabftw/elabftw/issues/7123 |
| Conceptos confusos | "It is unclear what the intended usage of Inventory, Resources, and Compounds is now" (no queda claro para qué sirve cada uno) | Issue #5647, https://github.com/elabftw/elabftw/issues/5647 |
| Ubicaciones desordenadas | "If I allow all my users to create locations as they like this will soon be a big mess" (si todos crean ubicaciones a su gusto, pronto será un desastre) | Discussion #5634, https://github.com/elabftw/elabftw/discussions/5634 |
| Botón de guardar escondido | "i frequently forget that the save button is at the bottom" (olvido que el botón guardar está abajo) | UDE, p. 17 |
| Exportación poco confiable | "zipped folder export often doesn't work - unclear why" (la exportación en ZIP falla a menudo y no se sabe por qué) | UDE, p. 15 |
| Guardado inconsistente | Algunos ajustes se aplican al instante y "Cancel" no los revierte, mientras otros sí | Issue #6835, https://github.com/elabftw/elabftw/issues/6835 |
| Acciones masivas sin vista previa | Una acción masiva cambió los permisos de todos los experimentos del administrador | Issue #6783, https://github.com/elabftw/elabftw/issues/6783 |
| Menús saturados | Demasiadas categorías en el menú, "difficult and overwhelming for users to navigate" (difícil y abrumador navegar) | Issue #6234, https://github.com/elabftw/elabftw/issues/6234 |
| Auditoría con puntos ciegos | Subir y borrar archivos no quedaba registrado. Piden una sola vista cronológica | Issue #5618, https://github.com/elabftw/elabftw/issues/5618 |

---

## 3. ERPNext (Frappe)

**Fuentes principales:**
- Documentación: https://docs.frappe.io/erpnext/
- Foro: https://discuss.frappe.io
- Issues: https://github.com/frappe/erpnext/issues

### 3.1 Flujos y navegación [DOC]

- **Navegación.** Cada módulo tiene un workspace con indicadores, accesos y enlaces (https://docs.frappe.io/erpnext/user/manual/en/workspace). La barra de búsqueda global (Ctrl+K) abre cualquier documento o reporte.
- **Ciclo de cada documento.** Todos los documentos pasan por Borrador → Enviado → Cancelado. Un documento enviado no se edita: se cancela y se crea una enmienda (https://docs.frappe.io/erpnext/user/manual/en/stock-entry).
- **Proyectos** (https://docs.frappe.io/erpnext/user/manual/en/project). El avance se calcula por uno de cuatro métodos, uno de ellos por peso de las tareas. El costo se llena solo desde horas, compras y salidas de stock.
- **Solicitud de material y reorden** (https://docs.frappe.io/erpnext/user/manual/en/material-request). Cuando el stock baja del nivel de reorden se crea una solicitud. La documentación advierte: "Review them before purchasing because a reorder rule can be outdated even when the calculation is correct" (revísalas antes de comprar, porque la regla de reorden puede estar desactualizada).
- **Recepción** (https://docs.frappe.io/erpnext/user/manual/en/purchase-receipt). Se crea desde la orden de compra. Por renglón se capturan la cantidad aceptada, la rechazada y el lote. Lo rechazado va a un almacén aparte.
- **Workflows de aprobación** (https://docs.frappe.io/erpnext/user/manual/en/workflows). Se configuran con una tabla de estados y transiciones por rol, con condiciones opcionales.
- **Cierre de período.** Hay dos objetos distintos:
  - Period Closing Voucher traslada el resultado, pero no bloquea fechas.
  - Accounting Period bloquea los documentos del rango.

  Fuentes: https://docs.frappe.io/erpnext/user/manual/en/period-closing-voucher y https://docs.frappe.io/erpnext/user/manual/en/accounting-period
- **Reparto de costos** (https://docs.frappe.io/erpnext/user/manual/en/cost-center-allocation). Los porcentajes deben sumar 100 %. Para cambiar el reparto se crea uno nuevo con fecha de vigencia, sin editar el anterior.

### 3.2 Lo que les gusta [OPINIÓN]

| Hallazgo | Cita | Fuente |
|---|---|---|
| Diseño sobrio y simple | "many of my clients really liked 'how simple and easy to use'" (a muchos clientes les gustó lo simple y fácil de usar) | Foro, 30-sep-2025, https://discuss.frappe.io/t/we-lost-a-big-deal-today-because-of-the-frappe-ui/154886 |
| Simple en superficie, potente debajo | "The simplicity on the surface and the raw power under the hood" (simplicidad en la superficie y potencia por debajo) | Foro, 6-oct-2026, https://discuss.frappe.io/t/overcomplicated-navigation-in-v16-and-a-user-experience-ux-disaster/165094 |
| El menú lateral ayuda | "we do like the app switcher and sidebar. It makes things more visible." (nos gustan el selector de apps y el menú lateral, hacen las cosas más visibles) | Mismo hilo |
| El workflow elimina el papel | "Workflow Feature the most" (lo que más me gusta es el workflow) | G2 [fragmento, no verificado], https://www.g2.com/products/erpnext/reviews |

### 3.3 Lo que les frustra y dónde se traban [OPINIÓN]

| Tema | Hallazgo y cita | Fuente |
|---|---|---|
| Abrumador al empezar | "in the early stages, it's just overwhelming" (al principio es abrumador) | Foro, https://discuss.frappe.io/t/if-you-were-to-abandon-erpnext-what-would-be-the-reason/88513?page=3 |
| Demasiados campos | "every simple screen is asking to fill a lot of fields" (cada pantalla simple pide llenar muchos campos) | Mismo hilo |
| Interfaz intimidante | "it looks too complicated" (se ve demasiado complicado). Para destrabar las demostraciones se ocultan módulos | Foro, https://discuss.frappe.io/t/erpnext-ui-intimidating-to-new-users-what-can-we-do-about-it/39536 |
| Destinos impredecibles | "Sometimes it opens modals, sometimes it opens pages, sometimes it takes you to a different module workspace" (a veces abre ventanas, a veces páginas, a veces te lleva a otro módulo) | Foro, https://discuss.frappe.io/t/overcomplicated-navigation-in-v16-and-a-user-experience-ux-disaster/165094 |
| Corregir algo enviado | "The only way to change something is to cancel and then amend" (la única forma de cambiar algo es cancelar y enmendar), con cancelaciones en cascada sobre los documentos ligados | Foro, https://discuss.frappe.io/t/architectural-problem-in-erpnext-no-change-on-submit/35246 |
| Proceso pesado para un cambio pequeño | "feels like a heavy process just for a small change" (se siente un proceso pesado para un cambio pequeño) | Foro, https://discuss.frappe.io/t/editing-fields-after-submit-in-erpnext-without-cancel-amend-like-sap/161234 |
| Aprobar por accidente | "it's easy to accidentally click on one of these actions… There's no confirmation prompt" (es fácil hacer clic por accidente; no hay confirmación) | Foro, https://discuss.frappe.io/t/implement-action-confirm-on-workflow-action/150602 |
| Botones repetidos | Un usuario con varios roles ve 3 botones Aprobar y 3 Rechazar | Foro, https://discuss.frappe.io/t/multiple-action-buttons-if-user-have-multiple-roles/22206 |
| Botón que no explica por qué falla | El botón Aprobar aparece y al pulsarlo sale "Self-Approve not allowed" (no se permite autoaprobar) | Foro, https://discuss.frappe.io/t/workflow-self-approval-bug/71131 |
| Workflow difícil de configurar | "its often confusing specially the state and transition table" (confunde, sobre todo la tabla de estados y transiciones) | Foro, https://discuss.frappe.io/t/easy-workflow-system-for-all-doctypes/29302 |
| Cambios después de enviar a aprobación | El usuario puede cambiar valores después de que el aprobador recibió el correo, y el cambio no se refleja | Issue #14695, https://github.com/frappe/erpnext/issues/14695 |
| Error sin mensaje | "it just beeps" (solo suena un pitido) | Foro, https://discuss.frappe.io/t/no-error-or-validation-message-display-in-development-mode/113401 |
| Error de pesos incomprensible | El sistema dice "Total of all weights should be 1" aunque el usuario está "100% sure" (seguro) de que suman 1 | Foro, https://discuss.frappe.io/t/task-weights-functionality-problem/36424 |
| Avance desactualizado | Tras borrar las tareas, el proyecto "still shows 6% completed" (sigue mostrando 6 % de avance) | Issue #7607, https://github.com/frappe/erpnext/issues/7607 |
| Reorden opaco | "No material request is created" (no se crea la solicitud) y nadie dice por qué | Foro, https://discuss.frappe.io/t/auto-reorder-not-creating-material-request/102643 |
| Solicitud automática gigante | Una sola solicitud agrupa todos los almacenes, "shows 12+ pages and after some time it stops responding" (ocupa más de 12 páginas y deja de responder) | Issue #35063, https://github.com/frappe/erpnext/issues/35063 |
| Vencimiento interpretado distinto | El mismo día, la lista dice "Expired" (vencido), la nota de entrega acepta el lote y el pick list lo rechaza | Issue #58735, https://github.com/frappe/erpnext/issues/58735 |
| Sin salida para lotes vencidos | No se pueden mover a cuarentena ni dar de baja | Issues #34728 y #43309, https://github.com/frappe/erpnext/issues/34728 |
| Vencimiento fuera de la recepción | "we cant add batch expiry date directly from purchase recipant" (no podemos poner el vencimiento en la recepción) | Foro, https://discuss.frappe.io/t/tracking-real-stock-of-expired-items/94761 |
| Lote escondido | "you now have to click on the SBB number to find the batch number" (hay que abrir otro documento para ver el lote); "one of the worst UX I have ever seen" (una de las peores UX que he visto) | Foro, https://discuss.frappe.io/t/v15-serial-and-batch-bundle-feature-any-idea-how-it-is-meant-to-work/106273 |
| Cierre sin vuelta atrás | "Thus you can never cancel a PCV" (nunca puedes cancelar un cierre) | Foro, https://discuss.frappe.io/t/cannot-cancel-period-closing-voucher/114575 |
| Documento irreversible en período cerrado | Una recepción con fecha en un año cerrado se puede enviar pero no cancelar: "the user is left with a submitted document that cannot be reverted" (el usuario queda con un documento que no puede revertir) | Issue #59563, https://github.com/frappe/erpnext/issues/59563 |
| Exportación bloqueada sin explicación | Solo exporta quien tiene el rol System Manager, y a los demás no se les dice por qué | Foro, https://discuss.frappe.io/t/user-cannot-export-accounts-receivable-summary-to-xlsx-csv-without-system-manager-role/54275 |

---

## 4. Chimote et al. (2022), sistemas de facturación de *core facilities*

**Fuente:** https://pmc.ncbi.nlm.nih.gov/articles/PMC10078833

### 4.1 Flujos [DOC]

- Reservas en calendario, limitadas a los usuarios capacitados.
- Pedidos de servicio.
- Inicio de sesión único para todas las instalaciones.
- **Prefacturación.** El investigador y el gestor revisan los cargos antes de cerrarlos. El artículo plantea dos preguntas de diseño: "How long should your charges be in this stage before they are finalized?" (¿cuánto tiempo deben quedar los cargos en esta etapa antes de cerrarse?) y "Who should be able to make changes during this stage…?" (¿quién puede hacer cambios en esta etapa?).
- **Correcciones y reembolsos.** Deben "remain auditable and reportable" (seguir siendo auditables y reportables). La pregunta clave es "How are your refunds going to be traced back to the original order?" (¿cómo se rastrea cada reembolso hasta el pedido original?).
- **Estado del pedido.** Otra pregunta del artículo: "is the customer updated on the order's status throughout the process?" (¿se informa al cliente el estado de su pedido durante todo el proceso?).

### 4.2 Opiniones (de los autores y el personal; no hay encuesta formal)

| Tipo | Cita |
|---|---|
| Positivo | "The user interface for laboratory members and investigators was simple and intuitive on both platforms" (la interfaz fue simple e intuitiva en ambas plataformas) |
| Frustración | "the time tracking software available was clunky and required too much clicking to log activity on a project" (el registro de tiempo era torpe y pedía demasiados clics) |
| Traba | "not all RSF personnel are aware of which budget number to select" (no todo el personal sabe qué número de presupuesto elegir) |
| Traba | El personal "did not recognize some of the capabilities" (no reconoció algunas funciones) del sistema nuevo. Recomiendan "access to a sandbox environment" (un entorno de pruebas) |

---

## 5. Smith et al. (2021), herramientas de gestión de *core facilities*

**Fuente:** https://pmc.ncbi.nlm.nih.gov/articles/PMC8174123/ (texto completo; el PDF de ScholarWorks dio 403).

- **[DOC]** Buscaban recolectar información "in a streamlined manner that did not lead to reporting fatigue" (sin provocar fatiga de reporte).
- **[DOC]** Para lograrlo:
  - Cada persona reporta "the same information … once" (la misma información una sola vez).
  - Los formularios dependen del rol.
  - "Some information from the previous year carries forward and autopopulates" (parte de la información del año anterior se arrastra y se autocompleta).
- **[DOC]** Los reportes se filtran por período, fuente de fondos, laboratorio, persona o equipo, y se exportan.
- **[OPINIÓN, reportada por los autores]** "feedback indicated that this approach was well received by faculty members" (los profesores recibieron bien el enfoque). No hay datos cuantitativos.

## 6. Gardella et al. (2024), almacén químico de la Universidad de Parma

**Fuente:** solo el resumen, en Crossref (https://api.crossref.org/works/10.3390/laboratories1010004).

- **[DOC]** El resumen destaca tres cosas:
  - "an intuitive web interface with a device-responsive layout to facilitate browsing and purchasing of products" (una interfaz web intuitiva y adaptable al dispositivo para consultar y comprar productos).
  - "an inventory transaction recording system to simplify the attribution of costs" (un registro de transacciones de inventario que simplifica la atribución de costos).
  - "a simple procedure to streamline the process of joint purchases" (un procedimiento sencillo para las compras conjuntas).
- **Opiniones:** no las hay, porque el texto completo no fue accesible.

## 7. LIME (2026)

**Fuente:** https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0336412

- **[DOC]** En el primer escaneo se capturan nombre, proveedor y catálogo. Después, "one only needs to input the updated quantity added/removed, date, inventory ID, and initials" (basta con capturar la cantidad, la fecha, el ID y las iniciales). Cada envío muestra si llegó o falló, y permite reenviarlo.
- **[OPINIÓN]** Encuesta con 8 usuarios:

| Tipo | Cita |
|---|---|
| Positivo | "87.5% as moderately easy to set up" (87,5 % lo encontró moderadamente fácil de configurar) |
| Positivo | "75% describing that they will continue to use LIME" (75 % seguirá usándolo) |
| Frustración | "the connectivity to the phone app cloud is slow" (la conexión de la app con la nube es lenta) |
| Traba | "the spreadsheets are prone to having incorrect information being inserted by inexperienced users" (las hojas reciben datos incorrectos de usuarios sin experiencia). Recomiendan que solo el personal de tiempo completo registre entradas y salidas |

## 8 y 9. Regulski et al. (2024) y Opaliński et al. (2026)

Son prototipos de predicción sin interfaz de usuario publicada. No hay flujos ni opiniones de usuarios que reportar.

---

## Lecciones para nuestros flujos

| # | Lección | Qué hacemos en los diagramas | Hallazgos que la respaldan | Módulos |
|---|---|---|---|---|
| L1 | Prevenir antes que rechazar | El calendario muestra lo ocupado y los equipos en mantenimiento antes de pedir. Si hay choque, dice con qué reserva choca y sugiere rangos libres | eLabFTW #6514, #7203, #4927 y #5638; NEMO #204 y #277 | 4 |
| L2 | Aprobación clara y con motivo | Una sola decisión, aprobar o rechazar, confirmada. El rechazo exige motivo, y al solicitante le llega un aviso con enlace | Frappe 150602, 22206 y 71131; NEMO-CE #39 y #31; eLabFTW #7513 | 4, 5, 6 |
| L3 | Corregir sin reescribir la historia | La corrección se pide desde el propio despacho, queda enlazada al original y se aplica como movimiento compensatorio | NEMO §8.3 y #187; Chimote ("traced back to the original order"); Frappe 35246 y 161234 | 6, 7 |
| L4 | Validación junto al campo, con la solución | El sistema dice qué falta y deja corregir en el mismo paso. Por ejemplo, la suma de pesos se ve en vivo, el código repetido muestra el registro existente y los campos obligatorios se marcan | Frappe 113401 y 36424; ERPNext #7607; NEMO #256 | 1, 2, 3, 5 |
| L5 | El lote y su vencimiento en el centro | El vencimiento se captura en la recepción. Al despachar se sugiere el lote que vence primero, y los vencidos se ven pero no se pueden elegir | ERPNext #58735, #34728 y 106273; foro 94761; eLabFTW #5711 y #7123 | 3, 6 |
| L6 | Automatismo transparente y revisable | La reposición automática nace en Borrador, marcada, una por insumo, y el aprobador la revisa con el pronóstico a la vista | Documentación de Material Request de ERPNext; foro 102643; #35063 | 3 |
| L7 | Pre-cierre visible y prorrateo con vista previa | Los coordinadores revisan los cargos y el aprobador ve quién confirmó y envía recordatorios. El cierre es un solo acto, y el prorrateo se ve antes de aplicarlo | Chimote (prefacturación); validación de cargos de NEMO-CE; Frappe 114575 y #59563 | 7 |
| L8 | Pendientes por rol y alertas que llevan al detalle | Cada asignación o decisión llega a la bandeja del rol. Los indicadores del dashboard abren la lista ya filtrada | NEMO-CE #33; foro NEMO "PI unable to view project usage"; Frappe 39536; eLabFTW #6234 | 2, 8 |
| L9 | Exportación que explica | Si el filtro no tiene datos, el sistema lo avisa y no genera un archivo vacío. El alcance por rol se aplica sin esconder la opción | Documentación de exportación de Frappe; foro 54275; UDE p. 15 | 8 |
| L10 | Capturar una vez | Si el coordinador tiene un solo proyecto, el sistema lo asigna solo. Los datos ya conocidos se autocompletan | NEMO §5.4.6 y §35.1; Smith 2021; LIME; Chimote ("too much clicking") | 4, 5, 6 |

### Mejoras aprobadas que no salen de un RF

Aprobadas por el usuario el 26/10/2026 para incluirlas en los diagramas.

| Mejora | Lección | Módulo |
|---|---|---|
| Motivo obligatorio al rechazar una reserva o una solicitud, con aviso al coordinador | L2 | 4, 5 |
| Sugerencia de rangos libres cuando una reserva choca | L1 | 4 |
| Proyecto asignado solo cuando el coordinador tiene uno | L10 | 4, 5 |
| Lotes sugeridos por fecha de vencimiento al despachar (FEFO) | L5 | 6 |
| Aviso al coordinador cuando se le asigna un proyecto o se resuelve su solicitud | L2, L8 | 2, 4, 5, 6 |
| Recordatorio a los coordinadores que no confirmaron sus cargos antes del cierre | L7 | 7 |
| Vista previa del prorrateo antes de aplicarlo | L7 | 7 |
