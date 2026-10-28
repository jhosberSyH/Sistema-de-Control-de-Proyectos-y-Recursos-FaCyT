# Benchmarking: proyectos similares al Sistema de Control de Proyectos y Recursos FaCyT

Fecha de la investigación: 25 de octubre de 2026.

## Criterios de selección

- Publicados o con versiones activas y documentadas de 2021 en adelante.
- Fuente citable: artículo con DOI, caso publicado en revista o repositorio de código serio (licencia, releases y mantenimiento activo).
- Se excluyen tutoriales, demos, proyectos de curso y páginas de marketing sin respaldo.

La columna "Criterio 2021+" distingue dos casos:

- **Sí:** la publicación es de 2021 o posterior.
- **Parcial:** el proyecto nació antes de 2021, pero tiene versiones publicadas y documentación vigente entre 2021 y 2026. Lo incluyo porque es de los pocos repositorios serios que cubren las mismas funciones. Tú decides si se queda o no.

Cuando fue posible verifiqué las funcionalidades en la fuente primaria: el abstract en Crossref o en la revista, la documentación oficial o el código fuente. Si algo no se pudo verificar, lo dice en el texto.

## Resumen

| # | Proyecto | Año | Tipo de fuente | Criterio 2021+ | Usa IA |
|---|---|---|---|---|---|
| 1 | NEMO (NIST) | 2016, versión 8.1.5 de oct. 2026 | Repositorio de código | Parcial | No |
| 2 | eLabFTW | 2012 (JOSS 2017), versión 5.6.15 de oct. 2026 | Repositorio de código + artículo | Parcial | No |
| 3 | ERPNext (Frappe) | 2011, versión 15.124.1 de oct. 2026 | Repositorio de código + documentación | Parcial | No documentada |
| 4 | Sistemas de facturación de *core facilities* (Chimote et al.) | 2022 | Caso publicado (JBT) | Sí | No |
| 5 | Herramientas de gestión de *core facilities* (Smith et al.) | 2021 | Caso publicado (JBT) | Sí | No |
| 6 | Almacén químico departamental, Univ. de Parma (Gardella et al.) | 2024 | Artículo (MDPI *Laboratories*) | Sí | No |
| 7 | LIME (Salinas et al.) | 2026 | Artículo (PLOS ONE) | Sí | No |
| 8 | Predicción ML en red de laboratorios diagnósticos (Regulski et al.) | 2024 | Artículo (MDPI *Applied Sciences*) | Sí | **Sí** |
| 9 | Predicción de demanda y control de calidad (Opaliński et al.) | 2026 | Artículo (MDPI *Applied Sciences*) | Sí | **Sí** |

---

## 1. NEMO (NanoFab Equipment Management & Operations)

- **Año:** repositorio creado en 2016. Última versión 8.1.5, publicada el 6 de octubre de 2026. Existe además una edición comunitaria, NEMO-CE 8.1.5, publicada el 24 de octubre de 2026.
- **Fuentes:**
  - Repositorio: https://github.com/usnistgov/NEMO
  - Paquete: https://pypi.org/project/NEMO/
  - Edición comunitaria: https://gitlab.com/nemo-community/nemo-ce
  - Anuncio de NIST como código abierto: https://www.nist.gov/node/1306441
- **Qué hace:** aplicación web de logística de laboratorio para instalaciones compartidas. Gestiona reservas de equipos, acceso a herramientas, consumibles, mantenimiento y facturación por proyecto. Está hecha en Python con Django y se despliega con Docker.
- **Funcionalidades principales** (verificadas en `NEMO/models.py` y `NEMO/policy.py`):
  - **Reservas de equipos** en calendario. El sistema rechaza una reserva que se superpone con otra ("Your reservation coincides with another reservation that already exists").
  - **Calificación obligatoria:** solo pueden reservar o usar un equipo los usuarios calificados (`Qualification`).
  - **Registro de uso** de equipos (`UsageEvent`), facturable a un proyecto.
  - **Catálogo de consumibles** con cantidad en stock, umbral de reorden (`reminder_threshold`) y correo automático cuando el stock baja de ese umbral. Distingue consumibles reutilizables, que no descuentan stock.
  - **Retiros de consumibles** (`ConsumableWithdraw`). Registran el usuario que consume, el miembro del staff que despacha, el consumible, la cantidad, la fecha y hora y el proyecto al que se carga el costo. Tienen validación (`validated_by`) y exoneración del cargo (`waived_by`).
  - **Cargos recurrentes** de consumibles (`RecurringConsumableCharge`).
  - **Solicitudes de ajuste** (`AdjustmentRequest`) de cargos ya registrados. Permiten cambiar cantidad, proyecto o tiempos. Sus estados son Pendiente, Aprobado, Denegado y Expirado. Guardan el revisor, una nota del gestor que se envía al usuario si la solicitud se deniega y el usuario que aplicó el cambio.
  - **Paradas programadas** (`ScheduledOutage`) de equipos o áreas, con categoría ("para analítica de tendencias") y recordatorios por correo.
  - **Tareas de mantenimiento** y reporte de problemas por equipo (`Task`).
  - **Incidentes de seguridad** (`SafetyIssue`), alertas (`Alert`) y notificaciones (`Notification`).
  - **Control de acceso a áreas** con lector de credenciales y kiosco.
  - **Roles:** usuario regular, staff, *user office*, contabilidad y superadministrador.
  - **Auditoría:** audit log y seguimiento de cambios (página de la wiki "Audit log and tracking changes").
  - **API REST de facturación** e importación de datos desde Excel.
- **IA:** no.

## 2. eLabFTW

- **Año:** repositorio creado en 2012 y artículo en JOSS en 2017 (DOI 10.21105/joss.00146). Última versión 5.6.15, publicada el 21 de octubre de 2026. Licencia AGPL-3.0.
- **Fuentes:**
  - Repositorio: https://github.com/elabftw/elabftw
  - Sitio oficial: https://www.elabftw.net/
  - Artículo: https://joss.theoj.org/papers/10.21105/joss.00146
- **Qué hace:** cuaderno electrónico de laboratorio (ELN) con gestión de recursos e inventario (LIMS) y agenda de reserva de equipos, pensado para grupos de investigación.
- **Funcionalidades principales** (verificadas en el sitio oficial y en `src/sql/structure.sql`):
  - **Inventario de recursos** (reactivos, plásmidos, anticuerpos, equipos), vinculados a los experimentos donde se usan.
  - **Unidades de almacenamiento y contenedores**, con cantidad y unidad (`qty_stored`, `qty_unit`) y monitoreo de productos peligrosos.
  - **Base de compuestos químicos** con importación desde PubChem y datos CAS, SMILES e InChI.
  - **Agenda de reservas** con reglas configurables por tipo de recurso: duración máxima (`book_max_minutes`), número máximo de reservas (`book_max_slots`), permitir o no reservas superpuestas (`book_can_overlap`), si la reserva se puede cancelar y con cuántos minutos de antelación (`book_is_cancellable`, `book_cancel_minutes`), y si se permiten reservas en el pasado.
  - **Solicitudes de compra** (`procurement_requests`) con solicitante, cantidad pedida, cantidad recibida, cotización y estado.
  - **Historial de cambios por entidad** (tablas `*_changelog`), audit log, sellado de tiempo confiable y firmas verificables criptográficamente.
  - **Permisos** por equipo y por entrada. Varios equipos comparten una instancia.
  - **Exportación** a PDF, ZIP, CSV, JSON y formato ELN.
  - API, autenticación LDAP o SAML2, doble factor e interfaz responsive.
- **IA:** no mencionada en la documentación revisada.

## 3. ERPNext (Frappe)

- **Año:** repositorio creado en 2011. Última versión 15.124.1, publicada el 22 de octubre de 2026. Licencia GPL-3.0 y unas 40 600 estrellas en GitHub.
- **Fuentes:**
  - Repositorio: https://github.com/frappe/erpnext
  - Documentación de proyectos: https://docs.frappe.io/erpnext/project
  - Solicitudes de material: https://docs.frappe.io/erpnext/material-request
  - Reparto de costos: https://docs.frappe.io/erpnext/cost-center-allocation
  - Lotes: https://docs.frappe.io/erpnext/batch
  - Mantenimiento de activos: https://docs.frappe.io/erpnext/asset-maintenance
- **Qué hace:** ERP de código abierto. Los módulos de proyectos, inventario, compras, contabilidad y activos cubren el mismo problema de fondo que el nuestro: costear proyectos con los materiales que consumen y repartir costos compartidos.
- **Funcionalidades principales:**
  - **Proyectos con tareas** y cuatro métodos para calcular el % de avance:
    - Manual.
    - Por tareas completadas.
    - Promedio del progreso de las tareas.
    - Ponderado por peso de cada tarea.
  - **Costeo del proyecto:** costo estimado, costo de material consumido (tomado de las salidas de stock), costo de compras, horas registradas y margen.
  - **Estados del proyecto:** Open, Completed y Cancelled, más un indicador "Is Active".
  - **Solicitudes de material** (Material Request) de tipo compra, transferencia o salida. Sus estados son Draft, Pending, Ordered, Received, Issued, Stopped y Cancelled. Se pueden vincular a un proyecto.
  - **Reorden automático:** se genera una solicitud cuando el stock cae bajo el nivel de reorden configurado en el artículo.
  - **Lotes** (Batch) con número de lote y fecha de vencimiento, consulta de stock por lote y división de lotes.
  - **Reparto de costos** (Cost Center Allocation). Un gasto registrado en un centro de costo principal se reparte por porcentajes, que deben sumar 100 %, entre centros receptores. El reparto tiene fecha de vigencia. Para cambiar los porcentajes se crea un reparto nuevo en lugar de editar el anterior. La documentación sugiere basar el reparto en una medida defendible, como el uso o la cantidad de personal.
  - **Mantenimiento de activos:** planes con tareas periódicas (inspección, calibración, limpieza), un equipo asignado y bitácoras de ejecución. Las reparaciones no planificadas se registran aparte, con su costo y el tiempo fuera de servicio.
- **IA:** no documentada en las páginas revisadas.

## 4. Implementing Research Shared (Core) Facility Billing Systems

- **Año:** 2022.
- **Fuente:** Chimote, A. A.; Mayhew, C.; Thornton, S.; Wetzel, C.; White, A. N. *Journal of Biomolecular Techniques*, 33(4). DOI 10.7171/3fc1f5fe.1a877626. https://pmc.ncbi.nlm.nih.gov/articles/PMC10078833
- **Qué hace:** relata la implantación de dos sistemas centralizados de pedidos, reservas y facturación para los laboratorios compartidos de una institución. Reemplazaron el control manual en Excel. El primero se implantó en 2014 y el segundo entró en producción en julio de 2020. El artículo no nombra los productos.
- **Funcionalidades principales:**
  - Pedidos de reactivos y servicios, también por API.
  - Reserva de equipos en calendario, limitada a los usuarios capacitados para cada equipo.
  - Registro de horas de trabajo contra números de presupuesto.
  - Seguimiento del estado de pedidos y proyectos, con notificación al finalizar y gestión de hitos.
  - Integración con el sistema financiero: los números de presupuesto llegan desde finanzas y la facturación vuelve a contabilidad.
  - Revisión de los cargos por investigadores y gestores antes de facturar.
  - Correcciones y reembolsos por usuarios autorizados, con los cambios auditables.
  - Cálculo automático de subsidios.
  - Reportes estándar de uso, facturación, ingresos y costos, además de reportes personalizados.
  - Inicio de sesión único y control de acceso a las cuentas de presupuesto.
  - Ambiente de pruebas (*sandbox*) para validar flujos.
- **IA:** no.

## 5. Data Management Tools to Measure the Impact of Core Facilities

- **Año:** 2021.
- **Fuente:** Smith, D. B.; Yarnell, T. L.; Jibben, B. J.; Liou, L. E.; Hovde, C. J.; Oxford, J. T. *Journal of Biomolecular Techniques*, 32(2), 63-73. DOI 10.7171/jbt.20-3203-002. https://scholarworks.boisestate.edu/bio_facpubs/700/
- **Qué hace:** caso del Biomolecular Research Center de Boise State University. Consolidaron en un solo sistema la gestión del laboratorio compartido, la facturación y los reportes, y midieron el impacto del laboratorio en la institución.
- **Funcionalidades principales:**
  - Gestión, facturación y reportes en un único sistema.
  - Recolección de reportes anuales de investigadores, personal y estudiantes, diseñada para no saturarlos.
  - Análisis de la relación entre la estrategia de gestión y el éxito de los investigadores.

  El resumen no detalla las funciones del software a nivel técnico.
- **IA:** no.

## 6. Development of a Low-Cost Web-Based Information System for Managing a University Department Chemical Warehouse

- **Año:** 2024 (publicado el 14 de mayo de 2024).
- **Fuente:** Gardella, M.; Carrieri, P.; Salvadeo, P.; Pavone, S.; Giombi, G.; Ramigni, M.; Rivetti, C. *Laboratories*, 1(1), 59-71. DOI 10.3390/laboratories1010004. https://www.mdpi.com/2813-8856/1/1/4
- **Qué hace:** sistema web para gestionar el almacén de productos químicos de un departamento universitario (Universidad de Parma), construido sobre la plataforma Campusnet. Lo usan estudiantes, investigadores y personal técnico de varios grupos de investigación y docencia.
- **Funcionalidades principales** (tomadas del abstract):
  1. Catálogo del amplio surtido de productos del almacén.
  2. Interfaz web responsive para consultar y comprar productos.
  3. Registro de transacciones de inventario que simplifica la atribución de costos.
  4. Procedimiento para agilizar las compras conjuntas.
  5. Bajo costo de despliegue y de mantenimiento.

  Incluye además consideraciones de cumplimiento normativo y de seguridad química.
- **IA:** no.

## 7. LIME: Laboratory Inventory Management Engine

- **Año:** 2026 (mayo).
- **Fuente:** Salinas, T. M.; Tornes, L.; Solís, C. *PLOS ONE*, 21(5). DOI 10.1371/journal.pone.0336412. https://ideas.repec.org/a/plo/pone00/0336412.html
- **Qué hace:** herramienta gratuita para gestionar el inventario de laboratorios académicos pequeños y startups. Combina hojas de cálculo en la nube con escaneo desde el teléfono. Su objetivo es evitar quiebres de stock, compras de más y malos pronósticos.
- **Funcionalidades principales:**
  - Escaneo de códigos de barras y QR desde el teléfono.
  - Actualización del inventario en tiempo real.
  - Integración automática con hojas de cálculo en la nube.
  - Alta de artículos nuevos clasificados en categorías predefinidas del catálogo, por ejemplo por ubicación ("nevera 4 °C") o por tipo.
- **IA:** no.

## 8. Machine Learning Prediction Techniques in the Optimization of Diagnostic Laboratories' Network Operations

- **Año:** 2024 (publicado el 13 de marzo de 2024).
- **Fuente:** Regulski, K.; Opaliński, A.; Swadźba, J.; Sitkowski, P.; Wąsowicz, P.; Kwietniewska-Śmietana, A. *Applied Sciences*, 14(6), 2429. DOI 10.3390/app14062429. https://www.mdpi.com/2076-3417/14/6/2429
- **Qué hace:** prototipo para optimizar la gestión de inventario de una red de laboratorios diagnósticos en Polonia, a partir de los resultados de los pacientes.
- **Funcionalidades principales:**
  - Predicción del número de pedidos a corto plazo (horas y minutos) y a largo plazo (hasta mensual).
  - Planificación del stock de reactivos.
  - Prevención de pruebas no realizadas por falta de reactivos, sobrecarga de analizadores o calibración inadecuada.
- **IA:** **sí.** Usa aprendizaje automático para pronosticar la demanda y, a partir de ella, planificar el stock de reactivos y la capacidad de los equipos.

## 9. Optimizing Laboratory Workflow Through Prediction of Test Demand and Quality Control

- **Año:** 2026 (publicado el 13 de mayo de 2026).
- **Fuente:** Opaliński, A.; Regulski, K.; Swadźba, J.; Wąsowicz, P.; Kwietniewska-Śmietana, A.; Sitkowski, P. *Applied Sciences*, 16(10), 4865. DOI 10.3390/app16104865. https://www.mdpi.com/2076-3417/16/10/4865
- **Qué hace:** es la continuación del proyecto 8. Integra más de 140 millones de pruebas de unos 11 millones de pacientes en un marco analítico único.
- **Funcionalidades principales:**
  1. Predicción del número de pruebas.
  2. Estimación de la demanda de reactivos.
  3. Detección de sobrecarga de analizadores.
  4. Evaluación de la estabilidad de los métodos de medición dentro del control de calidad.
- **IA:** **sí.** Combina perfilado de pacientes, análisis de patrones secuenciales, redes neuronales y modelos clásicos (ARIMA y suavizado exponencial). Los autores reportan:
  - Coeficientes de determinación superiores al 90 % al pronosticar la carga de trabajo.
  - Más del 98 % de exactitud al detectar recalibraciones innecesarias.

  Son métricas reportadas por los propios autores.

---

## Candidatos descartados

| Candidato | Motivo |
|---|---|
| Scispot (pronóstico de uso y reorden automático) | Solo hay páginas de marketing del proveedor, sin documentación técnica ni fuente independiente. |
| Labguru, Quartzy, eLabNext | Solo aparecen en blogs comparativos. No encontré documentación verificable de las funciones relevantes. |
| LabTrack, LabU-Reserve, IoTLab y otros repositorios de reservas | Son proyectos de curso o tesis sin adopción documentada, es decir, demos. |
| openBIS (ETH Zürich) | No encontré una publicación de 2021 en adelante. Está orientado a la gestión de datos de investigación más que a costos y recursos. |
| Chemotion ELN / LabIMotion | El artículo base es de 2017 y la extensión de 2025 es de flujos de ELN químico, no de gestión de recursos. |
| Open Enventory, Chemical Management System (Sandia) | No encontré una publicación de 2021 en adelante con fecha confirmada. |
| Predicción de consumibles en urgencias (BMIJ, Ankara) | No pude verificar el texto completo. |

## Limitaciones de esta investigación

- Las páginas de MDPI devolvieron error 403. Los datos de los artículos 6, 8 y 9 salen de los metadatos y abstracts de Crossref, no del texto completo.
- Las funcionalidades de NEMO y eLabFTW se verificaron en su código fuente público, porque la documentación en línea no las detalla.
