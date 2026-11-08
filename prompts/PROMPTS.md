# Prompts principales

Prompts principales que el equipo usó con herramientas de IA generativa durante el análisis y el desarrollo del proyecto, como lo exige el enunciado (RNF-09).

Cada prompt aparece con un título que dice para qué se usó y su texto tal como se escribió. Las rutas que mencionan algunos prompts son las que tenían los archivos en ese momento; la ubicación actual está en la [estructura del proyecto](../README.md#8-estructura-del-proyecto).

## Contenido

1. [Documento de requisitos y benchmarking](#1-documento-de-requisitos-y-benchmarking)
2. [Investigación UX y diagramas de flujo por módulo](#2-investigación-ux-y-diagramas-de-flujo-por-módulo)
3. [Stack tecnológico y README](#3-stack-tecnológico-y-readme)
4. [Diagrama de arquitectura en draw.io](#4-diagrama-de-arquitectura-en-drawio)
5. [Estructura de carpetas del repositorio](#5-estructura-de-carpetas-del-repositorio)
6. [Prompt para identidad visual y mockups](#6-prompt-para-identidad-visual-y-mockups)
7. [Implementación del Módulo 1: Usuarios, catálogos y parámetros](#7-implementación-del-módulo-1-usuarios-catálogos-y-parámetros)
8. [Consolidación del Modelo de Datos Relacional Completo (Módulos 1 al 8) y Seeders](#8-consolidación-del-modelo-de-datos-relacional-completo-módulos-1-al-8-y-seeders)
9. [Implementación del Módulo 3: Inventario de materia prima y consumibles](#9-implementación-del-módulo-3-inventario-de-materia-prima-y-consumibles)
10. [Implementación del Módulo 6: Almacén y Bitácora Inalterable](#10-implementación-del-módulo-6-almacén-y-bitácora-inalterable)

---

## 1. Documento de requisitos y benchmarking

> Necesito que me ayudes a armar el documento de requisitos del proyecto. El PDF con los requisitos está en "C:\Users\jynojosa\Documents\Proyectos Personales\Proyecto Web Nuevo\enunciado Control de Proyectos Quimicos.pdf" y el skill de documentos que vamos a usar al final es /documento-de-requisitos.
>
> Primero lee el PDF completo y saca todos los requisitos funcionales y no funcionales, sin resumir ni dejar nada por fuera. Ponles un ID (RF-01, RNF-01, etc.) y respeta la redacción original. Si algo no está claro, no lo interpretes por tu cuenta. Pregúntame qué enfoque le damos y dame dos o tres propuestas concretas de cómo podría quedar redactado, explicando en una línea qué implica cada una, para que yo elija. Junta todas las dudas y pregúntamelas en un solo bloque, no una por una. Cuando te responda, guarda todo en requisitos_base.md.
>
> Después quiero que investigues en internet proyectos parecidos al nuestro. Que sean de 2021 para acá, que estén citados o bien documentados (papers, casos publicados, repos serios) y que no sean tutoriales ni demos de juguete. De cada uno anota el nombre, el año, la fuente, qué hace, sus funcionalidades principales y si usa IA y para qué. Guarda todo en benchmarking.md.
>
> Con eso compara sus funcionalidades contra las nuestras y dime qué tienen ellos que nosotros no. A partir de ahí propónme nuevos requisitos funcionales y no funcionales. Aparte, si alguno de esos proyectos tiene un módulo de IA, toma el que más aplique y adáptalo a nuestro proyecto: qué resolvería, cómo encaja con lo que ya tenemos y qué requisitos nuevos implica.
>
> Pásame todas las propuestas en una sola lista ordenada de la que más aporta a la que menos, con el ID propuesto, si es RF, RNF o IA, la propuesta, por qué aporta y de qué proyecto sale. Guárdala en propuestas.md. No inventes nada, cada propuesta tiene que venir de un proyecto real con su fuente.
>
> Cuando tengas la lista para ahí, no generes el documento todavía. Yo te digo cuáles aprobamos y cuáles no.
>
> Ya con eso definido, usas /documento-de-requisitos, lees el skill completo y armas el documento final con todos los requisitos del PDF más las propuestas que aprobemos, siguiendo el formato del skill al pie de la letra.

## 2. Investigación UX y diagramas de flujo por módulo

> Ahora con los requisitos que ya tenemos en el proyecto quiero que trabajes como un experto en UI/UX con experiencia y me ayudes a armar los diagramas de flujo de cada módulo.
>
> Antes de diseñar nada, investiga en los proyectos que tomamos como referencia en benchmarking.md cómo es su experiencia de usuario: cómo están organizados los flujos, cómo navega el usuario, qué pasos tiene cada proceso. Busca también en foros, reseñas y comunidades qué opinan los usuarios de la interacción con esas aplicaciones, qué les gusta, qué les frustra y dónde se traban. No inventes opiniones, cada hallazgo tiene que tener su fuente. Guarda todo en investigacion_ux.md y dime en pocas líneas qué aprendimos que nos sirva para nuestro proyecto.
>
> Con eso y los requisitos, arma los diagramas de flujo de cada módulo aplicando lo bueno que encontraste y evitando lo que a los usuarios no les gusta. Cada flujo tiene que poder rastrearse a los requisitos que cubre, así que anota los IDs (RF-XX) que toca cada uno.
>
> Genera los diagramas con el MCP de MC Modeler en la carpeta del proyecto "C:\Users\jynojosa\Documents\Proyectos Personales\Proyecto Web Nuevo", un diagrama por módulo.
>
> Cuando los tengas para ahí. Yo los reviso y los valido en MC Modeler. Si te pido cambios, los ajustas sobre el mismo diagrama.
>
> Una vez que te diga que están validados, los mueves a la carpeta diagramas dentro del proyecto y los agregas al documento de requisitos en la sección que corresponda a cada módulo, respetando el formato del skill /documento-de-requisitos.

## 3. Stack tecnológico y README

> Ahora con base en los requisitos y todo lo que ya tenemos en el proyecto (requisitos_base.md, benchmarking.md, propuestas aprobadas, investigacion_ux.md y los diagramas), quiero que me propongas el stack tecnológico y armemos el README.
>
> Primero revisa el PDF "C:\Users\jynojosa\Documents\Proyectos Personales\Proyecto Web Nuevo\enunciado Control de Proyectos Quimicos.pdf" y ubica el requisito obligatorio que tiene que ver con el README o la documentación del stack. Dime cuál es y qué exige exactamente, porque todo lo que hagamos tiene que cumplirlo al pie de la letra. Si el PDF pide alguna tecnología, lenguaje o restricción en particular, también respétala.
>
> Después investiga en internet cómo lo hacen otros proyectos: qué stack usan los proyectos de benchmarking.md (si está documentado) y cómo estructuran sus README los proyectos serios y bien mantenidos. Quiero fuentes reales, nada inventado.
>
> Con eso propónme el stack completo (frontend, backend, base de datos, autenticación, IA si aplica, despliegue y lo que haga falta). Para cada pieza dime por qué la elegiste, qué requisitos cubre (RF/RNF) y una alternativa por si no me convence. Si hay que decidir entre dos opciones que pesan parecido, plantéamelas para que yo elija.
>
> Cuando tengas la propuesta para ahí, no escribas el README todavía. Yo reviso el stack y te digo qué va y qué cambiamos.
>
> Ya con el stack aprobado, genera el README.md en la raíz del proyecto con todo lo fundamental: descripción del proyecto, objetivo, módulos, resumen de los requisitos principales, stack tecnológico con su justificación, estructura del proyecto y cómo levantarlo. Que quede claro, profesional y que cumpla con lo que pide el PDF.

## 4. Diagrama de arquitectura en draw.io

> Ahora vamos a generar un diagrama de arquitectura del sistema usando el MCP de draw.io. La idea es representarla de forma simple, que se entienda de un vistazo sin tener que ser técnico.
>
> Organízalo por carriles (swimlanes), uno por cada capa: Frontend, Backend, Datos y Servicios externos. Cada componente va en el carril que le corresponde, así queda claro qué vive en cada capa y si el sistema depende de algo de afuera. Si no hay servicios externos, igual deja el carril y me avisas.
>
> Básate en el stack que aprobamos en el README.md y en los módulos del documento de requisitos. Muestra las piezas principales (usuario, frontend, backend, base de datos, autenticación, módulo de IA si lo incluimos y cualquier API o servicio de terceros) y conéctalas con flechas claras y etiquetas cortas que digan qué se comunica (por ejemplo: peticiones HTTP, consultas, archivos, llamadas a la API de IA). Nada de detalle de más: si algo no aporta a entender cómo funciona el sistema, déjalo fuera.
>
> Usa los íconos o formas estándar de draw.io para cada tecnología cuando existan, un color por carril y una distribución ordenada.
>
> Guárdalo en la carpeta diagramas del proyecto como arquitectura.drawio y para ahí. Yo lo reviso en draw.io y si te pido cambios los haces sobre el mismo archivo.
>
> Cuando te lo valide, agrégalo al README.md en la sección del stack tecnológico y al documento de requisitos donde corresponda según el skill /documento-de-requisitos.

## 5. Estructura de carpetas del repositorio

> Ahora vamos a armar la estructura de carpetas de todo el repositorio para dejarlo organizado y empezar a trabajar sobre él.
>
> Básate en el stack que aprobamos en el README.md y en la arquitectura de diagramas/arquitectura.drawio. Investiga cómo estructuran sus repos los proyectos serios que usan ese mismo stack y sigue las convenciones oficiales de cada framework, nada inventado.
>
> La idea es que quede bien separado dónde va el frontend, dónde va el backend y dónde va todo lo demás: documentación (requisitos, benchmarking, investigación UX, propuestas), diagramas, configuración, scripts y lo que haga falta. Si tiene sentido organizar por módulos dentro del frontend y del backend según los módulos de los requisitos, hazlo así para que cada cosa se pueda ubicar fácil.
>
> Primero muéstrame el árbol completo de carpetas con una línea explicando qué va en cada una y para ahí. No crees nada todavía. Yo lo reviso y te digo qué cambiamos.
>
> Cuando te lo apruebe, crea la estructura completa en el repositorio. Mueve los archivos que ya tenemos (los .md de documentación y los diagramas) a donde les toque sin perder nada. Pon un .gitkeep en las carpetas vacías para que se suban, arma un .gitignore adecuado para el stack y un .env.example con las variables que vamos a necesitar, sin valores reales. Actualiza la sección de estructura del README.md para que refleje cómo quedó.
>
> No hagas commit ni push. Cuando termines dime qué creaste y qué moviste, y yo me encargo de subirlo.

## 6. Prompt para identidad visual y mockups

> Ahora quiero que trabajes como un experto en UI/UX y armemos la identidad visual y los mockups de todas las vistas del aplicativo.
>
> Empieza por los usuarios. Van a ser estudiantes universitarios y personal de la universidad, así que investiga cómo son, qué esperan de una herramienta así, desde qué dispositivos entran, qué les cuesta y qué necesidades de accesibilidad hay que cubrir. Con eso define la ingeniería de personalidad del aplicativo: qué transmite, qué colores, qué formas, qué tono y qué criterios de accesibilidad vamos a seguir (contraste, tamaños, navegación con teclado, etc.). Guarda todo en investigacion_usuarios.md con sus fuentes.
>
> Después investiga la paleta de colores de la Universidad de Carabobo, específicamente de la Facultad FaCyT. Si FaCyT tiene una paleta propia, la adaptamos y la usamos; si no tiene, propón una combinación que vaya con la universidad y con el proyecto. La idea es que se vea muy universitario. Vamos a usar los logos de la universidad y de la facultad: búscalos en fuentes oficiales y, si no los consigues en buena calidad, pídemelos y yo te los paso. No los redibujes ni los inventes.
>
> Investiga también tipografías gratuitas, sin copyright ni restricciones de uso (Google Fonts o similares con licencia abierta), y dime la licencia de cada una. Quiero que las letras varíen entre las versiones.
>
> Antes de diseñar, revisa los diagramas de flujo de cada módulo. Si ves pasos redundantes o algo que se pueda simplificar, propónme el cambio explicando por qué y para ahí. Cuando te lo apruebe, lo aplicas en el diagrama y en el documento de requisitos.
>
> Con eso diseña los mockups de cada una de las vistas que va a tener la página. Por cada vista hazme máximo cuatro versiones donde cambien el estilo, la combinación de colores, la tipografía y la distribución. Genéralos como artifacts de Claude para que los pueda ver y comparar directamente. Si no puedes generar artifacts desde aquí, hazlos en HTML para abrirlos en el navegador y dímelo. En cualquier caso guarda una copia en una carpeta mockups con una subcarpeta por vista.
>
> Cuando estén listos para ahí y yo te digo cuál versión queda de cada vista.

## 7. Implementación del Módulo 1: Usuarios, catálogos y parámetros

> Actúa como un Ingeniero de Software Fullstack Senior. Vamos a implementar el **Módulo 1: Usuarios, catálogos y parámetros** del "Sistema de Control de Proyectos y Recursos".
>
> ### FASE 1: INSPECCIÓN OBLIGATORIA DEL PROYECTO ACTUAL (NO ESCRIBAS CÓDIGO AÚN)
> Antes de generar o modificar cualquier archivo, inspecciona la estructura actual del workspace y verifica lo siguiente:
> 1. **Stack y Estructura (`RNF-01`, `RNF-05`):** Revisa los archivos de configuración (`package.json`, variables de entorno, configuración de Supabase/ORM/Base de Datos, estructura de carpetas Frontend y Backend) para identificar qué tecnologías, librerías de UI, manejadores de estado y enrutadores están implementados.
> 2. **Esquema de Base de Datos y Auth:** Verifica si ya existen migraciones, tablas o modelos para `users` (cuentas), `locations` (ubicaciones), `system_parameters` (parámetros), `projects` (proyectos) y `audit_log` (auditoría), así como el middleware de autenticación y roles.
> 3. **Estilo Visual (`RNF-03`):** Revisa los estilos globales o componentes existentes para respetar el diseño estilo Apple (espacio en blanco, bordes redondeados, colores neutros y soporte nativo para modo claro/oscuro).
>
> **Acción requerida al finalizar la Fase 1:** Muéstrame un resumen breve de lo que encontraste en el repositorio y el plan de archivos que vas a crear o modificar para que coincida 100% con la arquitectura existente. Luego procede con la implementación de la Fase 2 siguiendo ese patrón.
>
> ---
>
> ### FASE 2: ESPECIFICACIONES DE IMPLEMENTACIÓN DEL MÓDULO 1
>
> **Convenciones de Código:**
> - Escribe nombres de variables, funciones, tablas/columnas y comentarios de código en **inglés**, aplicando buenas prácticas de Clean Code.
> - Todos los textos visibles en la interfaz de usuario (etiquetas, mensajes de error, alertas, botones) deben estar en **español**.
> - **Alcance de Rol:** Todo este módulo es de acceso exclusivo para el rol `Administrador del Sistema`. Protege tanto las rutas del frontend como los endpoints/políticas del backend.
>
> #### 1. Auditoría Transaccional Inmutable (`F8.5`, `RN-06`, `RNF-12`)
> Cada creación, edición o cambio de estado en este módulo DEBE registrarse en la tabla/colección `audit_log` dentro de la **misma operación/transacción** (si falla el registro en `audit_log`, la operación principal debe hacer rollback).
> - Campos requeridos en `audit_log`: `timestamp`, `user_id` (actor), `ip_address`, `target_object` (entidad/ID afectado), `action_type`, `old_value` (JSON/texto) y `new_value` (JSON/texto).
> - Ningún usuario (incluido el Administrador) puede editar ni eliminar registros del `audit_log`.
>
> #### 2. Funcionalidades de Cuentas de Usuario (`F1.1`, `F1.2`, `F1.3` | `HU-01`)
> - **F1.1 Crear cuenta de usuario:**
>   - Campos obligatorios: Nombre, Correo electrónico (único) y Rol.
>   - Roles permitidos únicamente (`RN-01`): `Administrador del Sistema`, `Coordinador de Proyecto`, `Aprobador / Gestor de Inventario` (no existen cuentas para beneficiarios ni personal general).
>   - Validación: Si el correo ya pertenece a otra cuenta, impedir el duplicado y mostrar en la UI la cuenta existente a la que pertenece ese correo. La cuenta nueva nace activa (`is_active = true`).
> - **F1.2 Editar datos o rol de una cuenta:**
>   - Permite editar nombre, correo (validando unicidad) y rol.
>   - **Regla de impacto en proyectos:** Si el usuario tenía el rol `Coordinador de Proyecto` y se cambia a otro rol, el sistema debe verificar si tiene proyectos asignados; de ser así, debe mostrar un aviso listando qué proyectos quedarán sin coordinador para que sean reasignados.
>   - Registrar en `audit_log` el valor anterior y el nuevo.
> - **F1.3 Desactivar / Reactivar cuenta (Borrado lógico estricto):**
>   - Las cuentas NUNCA se eliminan físicamente (`DELETE` prohibido) para conservar la trazabilidad histórica en bitácoras y auditoría.
>   - Al pedir desactivar, mostrar confirmación advirtiendo que el usuario perderá el acceso de inmediato.
>   - Si la cuenta a desactivar es `Coordinador de Proyecto` con proyectos activos (`En ejecución`), mostrar una advertencia con el impacto (proyectos afectados por reasignar) antes de confirmar.
>   - Bloquear el inicio de sesión y el uso de sesión activa a cuentas desactivadas. Permitir reactivar la cuenta desde su misma ficha.
>
> #### 3. Catálogo de Ubicaciones de Almacenamiento (`F1.4` | `HU-02`)
> - **F1.4 Registrar y gestionar ubicaciones:**
>   - Campos: Nombre (único entre ubicaciones activas), Descripción y Estado (`is_active`).
>   - Validación: Si se intenta registrar o activar una ubicación con un nombre que ya tiene otra ubicación activa, rechazar y señalar la ubicación repetida junto al campo.
>   - Regla de integridad: Una ubicación que tenga lotes asociados no se puede eliminar físicamente; solo se puede desactivar. Las ubicaciones activas serán las que alimenten los selectores de recepción de lotes y equipos.
>
> #### 4. Parámetros Generales del Sistema (`F1.5` | `HU-02`)
> - **F1.5 Configurar parámetros generales:**
>   - Crear la gestión de parámetros configurables del sistema. Incluir como mínimo (y dejar pre-cargados en seeders si no existen):
>     1. Días de anticipación para la alerta de vencimiento de lotes (ej. valor inicial `30`).
>     2. Meses mínimos de historial de despachos para mostrar pronóstico de consumo (ej. valor inicial `3`).
>   - Validación estricta: Cada valor debe ser un **número entero positivo** (`> 0`). Si se ingresa un valor negativo, cero o no entero, rechazar y mostrar el error junto al campo correspondiente.
>   - Al guardar, el nuevo valor aplica de inmediato y se registra en `audit_log` tanto el valor anterior (`old_value`) como el valor nuevo (`new_value`).

## 8. Consolidación del Modelo de Datos Relacional Completo (Módulos 1 al 8) y Seeders

> Actúa como un Arquitecto de Base de Datos e Ingeniero Backend Senior. Vamos a consolidar el **Modelo de Datos Relacional Completo (Módulos 1 al 8)** del "Sistema de Control de Proyectos y Recursos" para que mi compañero de equipo y yo podamos trabajar en paralelo sobre el mismo esquema.
>
> ### FASE 1: INSPECCIÓN DE LO IMPLEMENTADO EN EL MÓDULO 1
> 1. Revisa los archivos de base de datos, migraciones, modelos/esquemas o tipos TypeScript que ya creaste durante la implementación del Módulo 1 (`users`, `locations`, `system_parameters`, `audit_logs`).
> 2. Verifica cómo están nombradas las tablas y columnas actualmente en el código del Módulo 1 para **NO romper ninguna consulta, servicio ni componente** que ya esté funcionando.
>
> ### FASE 2: CREACIÓN DEL MODELO DE DATOS COMPLETO Y SEEDERS (`RNF-06`)
> Genera y aplica las migraciones / scripts SQL (`database/schema.sql` y `database/seeders.sql`, además de actualizar los modelos/tipos del proyecto) abarcando las 16 tablas de los 8 módulos, manteniendo nombres de tablas, columnas y comentarios en **inglés**:
>
> 1. **Módulo 1 (Conservar compatibilidad con lo ya creado):**
>    - `users` (con los 3 roles estrictos de `RN-01` y borrado lógico `is_active`).
>    - `locations` (catálogo de ubicaciones con `is_active`).
>    - `system_parameters` (valores enteros positivos `> 0`, incluyendo días de alerta de vencimiento y meses mínimos de historial para pronóstico).
> 2. **Módulo 2 (Proyectos y Avance):**
>    - `projects` (`code` único, `operational_status` ['Propuesta', 'En ejecución', 'Suspendido', 'Finalizado'], `priority_level` ['Crítica', 'Alta', 'Media', 'Baja'], `allocated_budget`, `executed_budget`, `physical_progress_pct`, `coordinator_id`).
>    - `project_milestones` (hitos con `weight` y `current_progress_pct`).
>    - `milestone_progress_logs` (historial de cargas de avance por hito).
> 3. **Módulo 3 (Inventario de Materia Prima y Consumibles):**
>    - `items` (catálogo unificado con `name`, `unit_of_measure`, `item_type` ['Materia prima', 'Consumible de proyecto', 'Consumible de uso general'], `current_stock`, `min_stock`, `forecasted_consumption`, restricción única por nombre+unidad).
> 4. **Módulo 4 (Equipos y Reservas):**
>    - `equipments` (`asset_code` único, `name`, `location_id`, `operational_status` ['Disponible', 'En uso', 'En mantenimiento']).
>    - `equipment_reservations` (rango `start_time` y `end_time`, `project_id`, `status` siguiendo `RN-03`).
>    - `equipment_usages` (registro de horas reales de uso por proyecto).
> 5. **Módulo 5 (Solicitudes y Priorización):**
>    - `requests` (`request_type` ['Gasto', 'Retiro', 'Reposición automática'], `project_id`, `status` ['Borrador', 'Pendiente de Aprobación', 'Aprobado', 'Rechazado', 'Ejecutado'], `estimated_amount`, `actual_amount`).
>    - `request_items` (detalle de insumos y cantidades por solicitud).
> 6. **Módulo 6 (Almacén y Bitácora Inalterable):**
>    - `batches` (lotes de compra con `item_id`, `location_id`, `initial_quantity`, `available_quantity`, `unit_cost`, `supplier`, `received_date`, `expiration_date`, `expiration_status`).
>    - `dispatches` (bitácora inalterable con `batch_id`, `project_id`, `dispatched_quantity`, `unit_cost_snapshot`, `dispatched_by`, `received_by_name`, `is_compensatory`, `original_dispatch_id`).
>    - `raw_material_usages` (consumo real reportado por el coordinador frente a lo despachado).
>    - `dispatch_corrections` (solicitudes de corrección de despacho con `status` ['Pendiente', 'Aprobado', 'Denegado']).
> 7. **Módulo 7 (Cierre de Período y Prorrateo):**
>    - `accounting_periods` (`period_type` ['Mensual', 'Trimestral'], `start_date`, `end_date`, `status` ['Abierto', 'En revisión', 'Cerrado', 'Prorrateado'], `proration_criterion` ['Proporcional', 'Equitativo'], `total_overhead_cost`).
>    - `period_project_confirmations` (confirmación de cargos pre-cierre por cada coordinador).
>    - `overhead_allocations` (resultado del prorrateo por proyecto activo).
> 8. **Módulo 8 (Auditoría Inmutable):**
>    - `audit_logs` (`user_id`, `ip_address`, `action_type`, `target_table`, `target_id`, `old_value`, `new_value`, `justification`).
>    - Incluye triggers o reglas de base de datos que impidan `UPDATE` y `DELETE` tanto en `dispatches` (`RNF-11`) como en `audit_logs` (`RNF-12`).
>
> 9. **Script de Seeders (`database/seeders.sql`):**
>    - Crea datos semilla realistas de laboratorios de física, química y biología: al menos 1 usuario por cada uno de los 3 roles, 3 ubicaciones, los 2 parámetros generales del sistema, 3 proyectos ficticios, catálogo inicial de insumos (materia prima, consumibles y overhead con sus lotes) y 3 equipos de laboratorio.
>
> Al finalizar, confirma que el Módulo 1 sigue funcionando sin errores sobre este esquema unificado.

## 9. Implementación del Módulo 3: Inventario de materia prima y consumibles

> Actúa como un Ingeniero de Software Fullstack Senior y Arquitecto de Sistemas. Vamos a implementar el **Módulo 3: Inventario de materia prima y consumibles** (`F3.1` a `F3.7` | `HU-07` a `HU-11`) del "Sistema de Control de Proyectos y Recursos".
>
> Dado que no tienes acceso a los documentos de especificación originales, este prompt contiene **todas las reglas de negocio, flujos BPMN y criterios de aceptación oficiales**. Síguelos al pie de la letra.
>
> ---
>
> ### FASE 1: AUDITORÍA DE COMPATIBILIDAD (NO ESCRIBAS CÓDIGO AÚN)
> Antes de crear o modificar archivos, inspecciona exhaustivamente el workspace actual para garantizar un acoplamiento 100% limpio con lo ya desarrollado:
> 1. **Inspección del Módulo 1 (Ya implementado):**
>    - Verifica cómo están implementados el middleware de autenticación/autorización por roles (`Administrador del Sistema`, `Coordinador de Proyecto`, `Aprobador / Gestor de Inventario`).
>    - Revisa cómo se consultan los **Parámetros Generales del Sistema (`F1.5`)** en la base de datos (específicamente: *días de anticipación para alerta de vencimiento de lotes* y *meses mínimos de historial para el pronóstico de consumo*).
>    - Revisa la función, servicio o trigger que registra eventos en el **`audit_log` (`F8.5` / `RN-06`)** para reutilizar exactamente el mismo mecanismo transaccional.
> 2. **Inspección del Módulo 2 (Proyectos y Avance - Ya implementado):**
>    - Revisa la estructura de controladores/servicios, rutas del backend, manejo de errores, modelos/esquemas de base de datos (`items`, `batches`, `dispatches`, `requests`, `request_items`, `projects`) y cómo se conectan con el Frontend.
> 3. **Inspección del Frontend y UI (`RNF-03`):**
>    - Verifica el sistema de navegación (Sidebar/Navbar), el manejo de estado, los componentes reutilizables (tablas, modales, badges de alerta, formularios, notificaciones/toasts) y el cumplimiento del diseño estilo Apple (espacio en blanco, bordes redondeados, colores neutros y soporte nativo para modo claro/oscuro).
>
> **Acción al finalizar la Fase 1:** Muéstrame un resumen breve de cómo están estructurados los Módulos 1 y 2 y qué archivos crearás o editarás para el Módulo 3. Inmediatamente después, ejecuta la implementación de la Fase 2.
>
> ---
>
> ### FASE 2: ESPECIFICACIONES DETALLADAS DEL MÓDULO 3
>
> #### Convenciones Estrictas de Código e Interfaz
> - **Código (Backend, Frontend, DB):** Nombres de variables, funciones, métodos, rutas de API, modelos y comentarios de código estrictamente en **inglés**, aplicando Clean Code y separación de responsabilidades (`RNF-01`).
> - **Interfaz de Usuario (UI) y Mensajes:** Todo texto visible para el usuario (etiquetas, tablas, estados, alertas, errores de validación) estrictamente en **español**.
> - **Auditoría Transaccional (`F8.5`, `RN-06`, `RNF-12`):** Toda creación, edición o cambio de estado en este módulo debe guardarse en `audit_log` dentro de la **misma transacción** (incluyendo `timestamp`, `user_id`, `ip_address`, entidad afectada, `old_value` y `new_value`). Si el registro en `audit_log` falla, toda la operación debe hacer rollback.
>
> ---
>
> #### 1. Catálogo Unificado de Insumos (`F3.1` | `HU-07`)
> - **Actor permitido:** Exclusivamente `Administrador del Sistema` para crear/editar; `Aprobador / Gestor de Inventario` y `Coordinador de Proyecto` pueden consultar el catálogo.
> - **Qué hace:** Permite dar de alta materia prima y consumibles en un único catálogo unificado.
> - **Campos obligatorios:**
>   - `name` (Nombre del insumo).
>   - `unit_of_measure` (Unidad de medida: ej. mL, L, g, kg, unidades, cajas).
>   - `item_type` (Tipo de insumo), que debe ser estrictamente uno de estos tres valores:
>     1. `'Materia prima'`
>     2. `'Consumible de proyecto'`
>     3. `'Consumible de uso general'` *(Nota RN-02: estos son los insumos de overhead que se compran por lotes institucionales sin asignarse a un proyecto y entran al prorrateo).*
> - **Reglas y Validaciones (Flujo BPMN):**
>   - **Unicidad compuesta:** El sistema debe impedir que existan dos insumos activos con el mismo `name` y la misma `unit_of_measure`. Si ya existe, debe bloquear el guardado y mostrar en la UI el insumo existente.
>   - **Stock inicial:** Todo insumo nuevo nace obligatoriamente con `current_stock = 0` (el stock solo puede cambiar mediante recepciones y despachos de lotes).
>
> ---
>
> #### 2. Configuración de Stock Mínimo (`F3.2` | `HU-07`)
> - **Actor permitido:** Exclusivamente `Administrador del Sistema`.
> - **Qué hace:** Permite configurar o actualizar la cantidad mínima (`min_stock`) de cada insumo en su unidad de medida.
> - **Reglas y Validaciones:**
>   - Si un insumo no tiene `min_stock` configurado (`null`), no genera alertas de stock mínimo ni solicitudes de reposición automática.
>   - Al configurar un `min_stock`, validar que sea un número positivo (`> 0`).
>   - **Evaluación inmediata (Criterio HU-07):** Si al guardar el nuevo `min_stock`, el `current_stock` actual del insumo ya está por debajo de ese nuevo valor (`current_stock < min_stock`), el sistema debe activar de inmediato la alerta de stock mínimo (`F3.4`) y disparar la lógica de reposición automática (`F3.5`).
>
> ---
>
> #### 3. Actualización Transaccional de Stock y Vista de Lotes (`F3.3` | `HU-08` | `RNF-10`)
> - **Actor permitido:** `Aprobador / Gestor de Inventario` y `Administrador del Sistema`.
> - **Qué hace:** Garantiza que el stock total de cada insumo (`items.current_stock`) y el stock disponible de cada lote (`batches.available_quantity`) se mantengan sincronizados en tiempo real.
> - **Reglas de Negocio y Servicio Transaccional:**
>   - Crea o expón en el servicio de inventario el método transaccional atómico (`RNF-10`) para registrar movimientos de stock (aumentar en recepciones de lotes y disminuir en despachos). Si falla la actualización del stock o el registro del movimiento/bitácora, debe hacerse **rollback completo** de la transacción para que el stock quede intacto.
>   - **Ficha del Insumo en el Frontend:** Al abrir el detalle/ficha de un insumo en la UI, se debe mostrar:
>     1. Datos del insumo (nombre, unidad, tipo).
>     2. Stock total actual (`current_stock`), stock mínimo configurado (`min_stock`) y el pronóstico de consumo (`F3.7`).
>     3. Tabla/desglose de todos sus **lotes asociados** (`batches`), mostrando por cada lote: ID/código, fecha de ingreso, proveedor, costo unitario, ubicación, cantidad inicial, cantidad disponible actual, fecha de vencimiento y estado de vencimiento.
>
> ---
>
> #### 4. Alerta de Stock Mínimo (`F3.4` | `HU-09`)
> - **Qué hace:** Detecta y señaliza visualmente cuando el `current_stock` total de un insumo es menor que su `min_stock` configurado (`current_stock < min_stock`).
> - **Comportamiento (Flujo BPMN):**
>   - Después de cada movimiento (o cambio de `min_stock`), el sistema compara `current_stock` contra `min_stock`.
>   - **Si `current_stock < min_stock`:** El insumo queda marcado con alerta activa de "Stock bajo el mínimo". En el listado de inventario y en su ficha debe mostrarse un indicador visual claro (badge de alerta) indicando tanto el stock actual como el mínimo configurado. *(Además, asegúrate de que este estado sea fácilmente consultable por el Dashboard Ejecutivo).*
>   - **Si `current_stock >= min_stock` (tras una recepción):** La alerta de stock mínimo se retira automáticamente.
>
> ---
>
> #### 5. Solicitud de Reposición Automática (`F3.5` | `HU-09` | `RN-03`)
> - **Actores:** Generada automáticamente por el `Sistema`; gestionada por el `Aprobador / Gestor de Inventario`.
> - **Qué hace (Flujo BPMN):**
>   - Cuando se activa la alerta de stock mínimo (`F3.4`) para un insumo, el sistema verifica primero: **¿Ya existe una solicitud de reposición abierta (en estado `'Borrador'` o `'Pendiente de Aprobación'`) para este mismo insumo?**
>   - **Si YA existe una abierta:** Conserva la solicitud abierta y **NO crea una segunda solicitud** duplicada.
>   - **Si NO existe una abierta:** Crea automáticamente un registro en la tabla de solicitudes (`requests` y su detalle en `request_items`) con:
>     - Tipo/Marca: `'Reposición automática'` (solicitud de gasto para reponer el insumo).
>     - Estado inicial (`RN-03`): `'Borrador'`.
>     - Cantidad sugerida inicial: por ejemplo, la diferencia para alcanzar o superar el stock mínimo (o basada en el pronóstico si existe), editable por el Aprobador.
> - **Acciones del Aprobador en la UI (Bandeja / Vista de Reposiciones en Inventario):**
>   - El `Aprobador / Gestor de Inventario` recibe el aviso y puede abrir la reposición en `'Borrador'`, revisar la cantidad y el pronóstico del insumo, modificar la cantidad si hace falta y tomar una de dos decisiones:
>     1. **Enviar a aprobación:** Pasa la solicitud de `'Borrador'` a `'Pendiente de Aprobación'` dentro del flujo de solicitudes (`RN-03`).
>     2. **Descartar reposición:** Cancela/descarta el borrador sin comprar nada; la alerta de stock mínimo (`F3.4`) debe seguir visible mientras el stock físico continúe bajo el mínimo.
>
> ---
>
> #### 6. Alerta y Bloqueo de Lotes por Vencimiento (`F3.6` | `HU-10`)
> - **Qué hace (Flujo BPMN):** Evalúa la fecha de vencimiento (`expiration_date`) de cada lote con stock disponible (`available_quantity > 0`) contra la fecha actual y el parámetro general de **"días de anticipación de alerta de vencimiento"** configurado en el Módulo 1 (`F1.5`, por defecto 30 días si no se ha editado).
> - **Reglas de Clasificación y Bloqueo:**
>   1. **Lote Vencido (`expiration_date < CURRENT_DATE`):**
>      - El lote pasa a estado `'Vencido'`.
>      - **Bloqueo estricto:** Un lote `'Vencido'` queda bloqueado para despacho (no puede despacharse en el Módulo 6).
>   2. **Lote Próximo a Vencer (`CURRENT_DATE <= expiration_date <= CURRENT_DATE + days_threshold`):**
>      - El lote se marca como `'Próximo a vencer'`.
>      - En la interfaz del inventario, debe mostrarse la etiqueta `'Próximo a vencer'` junto con el cálculo exacto de **cuántos días faltan** para su vencimiento (ej. *"Próximo a vencer (20 días restantes)"*).
>   3. **Lote Vigente:** Cuando supera el umbral de anticipación o no perece (`expiration_date IS NULL`).
> - **Ejecución:** Implementa una función/servicio de verificación de vencimientos que se ejecute automáticamente al consultar el inventario/lotes (o mediante job/endpoint de sincronización diaria) para garantizar que los estados y días restantes estén siempre al día.
>
> ---
>
> #### 7. Pronóstico de Consumo de Insumos (`F3.7` / `IA-01` | `HU-11`)
> - **Qué hace (Flujo BPMN):** Calcula el consumo esperado de cada insumo para el próximo período contable basándose en el historial real de la bitácora de despachos (`dispatches`).
> - **Reglas de Negocio:**
>   - Consulta el parámetro general del Módulo 1 (`F1.5`): **"meses mínimos de historial para mostrar un pronóstico"** (ej. 3 meses).
>   - Verifica si el insumo tiene registros de despachos que abarquen al menos esa cantidad de meses de antigüedad/historial:
>     - **Si NO tiene historial suficiente:** `forecasted_consumption` queda en `null` y en la ficha del insumo se debe mostrar textualmente: **"Sin historial suficiente para pronosticar"**.
>     - **Si SÍ tiene historial suficiente:** Calcula el pronóstico de consumo para el próximo período (por ejemplo, promedio móvil / media ponderada del consumo mensual o por período de los despachos netos registrados en `dispatches`, descontando movimientos compensatorios si existen) y guárdalo/muéstralo en la ficha del insumo junto al stock actual y al stock mínimo.
>   - **Restricción (`HU-11`):** El pronóstico es puramente informativo para ayudar a ajustar el stock mínimo con datos; por sí solo **nunca crea solicitudes ni compras automáticas** aunque el pronóstico supere al stock actual.
>   - Deja expuesto el método `recalculateConsumptionForecasts()` en el servicio del Módulo 3 para que se ejecute tanto al cerrar un período contable como bajo demanda al abrir la ficha o actualizar el catálogo.

## 10. Implementación del Módulo 6: Almacén y Bitácora Inalterable

> Actúa como un Ingeniero de Software Fullstack Senior y Arquitecto de Sistemas. Vamos a implementar el **Módulo 6: Almacén** (`F6.1` a `F6.6` | `HU-18` a `HU-21`) del "Sistema de Control de Proyectos y Recursos".
>
> Dado que no tienes acceso a los documentos de especificación ni a los diagramas BPMN originales, este prompt contiene **todas las reglas de negocio, flujos de proceso y criterios de aceptación oficiales**. Síguelos estrictamente.
>
> ---
>
> ### FASE 0: CONTROL DE VERSIONES (RAMA DE DESARROLLO OBLIGATORIA)
> Antes de analizar o tocar cualquier archivo:
> 1. Verifica el estado actual de Git (`git status`, `git branch`).
> 2. Crea y cámbiate a una nueva rama de desarrollo dedicada exclusivamente a este módulo (`feature/module-6-warehouse`).
> 3. Confirma en qué rama estás trabajando antes de pasar a la Fase 1.
>
> ---
>
> ### FASE 1: REVISIÓN Y ANÁLISIS EXHAUSTIVO DEL PROYECTO ACTUAL (NO MODIFIQUES NADA AÚN)
> Realiza una inspección profunda del código fuente actual (Backend, Frontend y Base de Datos) para asegurar que el Módulo 6 se acople con 0 fricciones a lo ya construido:
> 1. **Inspección del Módulo 1 (Usuarios, Ubicaciones, Parámetros y Auditoría):**
>    - Revisa cómo funcionan la autenticación, los middlewares de roles (`Administrador del Sistema`, `Coordinador de Proyecto`, `Aprobador / Gestor de Inventario`) y cómo se obtiene el catálogo de ubicaciones activas (`locations` de `F1.4`).
>    - Revisa el servicio/utilidad que escribe en `audit_log` (`F8.5` / `RN-06` / `RNF-12`) para reutilizarlo en todas las transacciones del Módulo 6.
> 2. **Inspección del Módulo 3 (Inventario de Materia Prima y Consumibles):**
>    - Revisa cómo están implementados el catálogo unificado de insumos (`items`), la actualización transaccional de stock (`F3.3` / `RNF-10`), la evaluación de alertas de stock mínimo + solicitud de reposición automática (`F3.4` y `F3.5`), y la lógica de estados de vencimiento de lotes (`F3.6`: `'Vigente'`, `'Próximo a vencer'`, `'Vencido'`).
> 3. **Inspección de los Módulos 2 y 5 (Proyectos, Ejecución Presupuestaria y Solicitudes):**
>    - Verifica el modelo/esquema de proyectos (`projects`), cómo se calcula o actualiza la ejecución presupuestaria (`F2.7`: suma gastos ejecutados + costo de insumos despachados + overhead), y cómo están estructuradas las solicitudes (`requests` y `request_items`, específicamente las de tipo `'Gasto'` y `'Retiro'`).
> 4. **Inspección del Esquema de Base de Datos y Frontend (`RNF-03`):**
>    - Revisa las definiciones actuales de las tablas `batches` (lotes), `dispatches` (bitácora de despachos), `raw_material_usages` (uso de materia prima) y `dispatch_corrections` (solicitudes de corrección), así como los triggers de inmutabilidad (`RNF-11`).
>
> ---
>
> ### FASE 2: ESPECIFICACIONES DETALLADAS DEL MÓDULO 6 (ALMACÉN)
>
> #### 1. Recepción de Lotes de Compra (`F6.1` | `HU-18`)
> - **Actor permitido:** Exclusivamente `Aprobador / Gestor de Inventario` y `Administrador del Sistema`.
> - **Qué hace:** Registra la entrada física al almacén de un lote de compra con insumo, cantidad (`> 0`), fecha de ingreso, costo unitario (`>= 0`), proveedor, ubicación y fecha de vencimiento (opcional si no perece).
> - **Regla de Overhead (`RN-02`):** Consumibles de uso general entran al almacén institucional y no se asignan directamente a proyectos.
> - **Validación de vencimiento (`HU-18`):** Si la fecha de vencimiento ya pasó, advierte explícitamente y requiere confirmación.
> - **Efecto Transaccional:** Inserta en `batches`, actualiza `items.current_stock` y audita en `audit_log`.
>
> #### 2. Despacho de Insumos desde Solicitud de Retiro Aprobada (`F6.2` | `HU-19`)
> - **Actor permitido:** Exclusivamente `Aprobador / Gestor de Inventario`.
> - **Sugerencia FEFO:** Sugiere lotes ordenados por vencimiento (primero los que vencen antes).
> - **Bloqueo estricto de vencidos (`F3.6`, `HU-19`):** Lotes vencidos no son seleccionables y se rechaza su despacho.
> - **Atómico:** Descuenta stock, genera `dispatches` inmutable, pasa solicitud a `'Ejecutado'`, actualiza `project.executed_budget` y dispara reposición automática si cae bajo stock mínimo.
>
> #### 3. Bitácora Inalterable de Despachos (`F6.3` | `HU-19` | `RN-06` | `RNF-11`)
> - Inmutable por trigger en BD (no editable ni eliminable).
> - Alcance por rol (`RN-07`): Coordinador solo ve despachos de sus proyectos asignados; Administrador y Aprobador ven todos.
>
> #### 4. Registro de Uso de Materia Prima (`F6.4` | `HU-20`)
> - Coordinador documenta uso real de material despachado a su proyecto.
> - Compara cantidad usada vs despachada; si supera lo despachado, advierte la diferencia pero permite registrar.
>
> #### 5. Solicitud y Aprobación de Corrección Compensatoria (`F6.5`, `F6.6` | `HU-21` | `RF-35`)
> - Coordinador solicita corrección con justificación obligatoria (mínimo 5 caracteres).
> - Aprobador decide: si deniega, el despacho original queda intacto; si aprueba, se genera un movimiento compensatorio enlazado en `dispatches` (`is_compensatory = true`), ajustando stock y presupuesto ejecutado.
