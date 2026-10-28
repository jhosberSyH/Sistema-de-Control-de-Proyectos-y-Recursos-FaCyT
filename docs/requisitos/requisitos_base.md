# Requisitos base: Sistema de Control de Proyectos y Recursos FaCyT

**Fuente:** `enunciado Control de Proyectos Quimicos.pdf` (Universidad de Carabobo, Escuela de Computación, asignatura Desarrollo de Aplicaciones Web), 4 páginas.

**Fecha:** 25 de octubre de 2026.

## Convenciones de este archivo

- **Granularidad.** Sigue la regla del skill `documento-de-requisitos`. Cada RF tiene una sola capacidad y un solo verbo. Las reglas de negocio van como RN y los requisitos no funcionales como RNF.
- **Columna "Texto original".** Copia literal del PDF. Cuando un párrafo del PDF se dividió en varios requisitos, cada uno conserva su fragmento literal.
- **Columna "Precisión acordada".** Recoge lo que se decidió en las dudas del 25/10/2026. Si está vacía, el requisito queda tal cual el PDF.
- **Códigos definitivos.** Los IDs RF, RN y RNF son de trabajo. En el documento final, el skill asigna los códigos F<módulo>.<n> y la trazabilidad se mantiene contra estos IDs.

## Contexto (sección 1 del PDF, no es requisito)

> Una organización académica y empresarial requiere un sistema integral para el control, estatus y manejo de información asociada a sus proyectos de **física, química y biología**.
>
> Actualmente, se necesita dar seguimiento a múltiples proyectos simultáneos, controlando exhaustivamente la materia prima, el uso de maquinaria y los consumibles. Un desafío fundamental es que los consumibles compartidos (*overhead*) se compran en lotes y deben prorratearse entre distintos proyectos. El sistema debe gestionar estas asignaciones, el flujo de aprobación de gastos y la priorización de los proyectos, superando las limitaciones actuales del manejo en hojas de cálculo.

**Alcance disciplinar:** física, química y biología, tal cual el texto. Decisión D2.

---

## Requisitos funcionales

### 2.1 Gestión de Catálogos y Usuarios: roles

| ID | Rol | Texto original | Alcance (original) | Precisión acordada |
|---|---|---|---|---|
| RF-01 | Administrador del Sistema | Gestión integral de usuarios | Todo el sistema | |
| RF-02 | Administrador del Sistema | [Gestión integral de] parámetros generales | Todo el sistema | Incluye configurar el stock mínimo de RF-19 (D3) |
| RF-03 | Administrador del Sistema | [Gestión integral de] catálogos (ubicaciones, consumibles, equipos) | Todo el sistema | |
| RF-04 | Administrador del Sistema | [Gestión integral de] auditoría global | Todo el sistema | |
| RF-05 | Coordinador de Proyecto | Carga de avances e hitos | Sus proyectos asignados | Los hitos alimentan el cálculo de avance de RF-15 (D9) |
| RF-06 | Coordinador de Proyecto | Registro de uso de materia prima y equipos | Sus proyectos asignados | |
| RF-07 | Coordinador de Proyecto | Creación de solicitudes de gasto o retiro de insumos | Sus proyectos asignados | Siguen el flujo de RN-03 |
| RF-08 | Aprobador / Gestor de Inventario | Aprobación/rechazo de solicitudes de gasto | Inventario y Finanzas | |
| RF-09 | Aprobador / Gestor de Inventario | Gestión de almacén (recepción y despacho de lotes) | Inventario y Finanzas | |
| RF-10 | Aprobador / Gestor de Inventario | Ajuste de prioridades | Inventario y Finanzas | Sujeto a RN-04 |

### 2.1 Estructura de Proyectos

| ID | Texto original | Precisión acordada |
|---|---|---|
| RF-11 | Los proyectos registrados en la plataforma deben contar obligatoriamente con los siguientes atributos | El Administrador registra los proyectos y les asigna su Coordinador (D3) |
| RF-12 | **Código Único:** Identificador alfanumérico institucional. | |
| RF-13 | **Estatus Operativo:** Propuesta, En ejecución, Suspendido, Finalizado. | |
| RF-14 | **Nivel de Prioridad:** Crítica, Alta, Media, Baja. | |
| RF-15 | **Métricas:** Porcentaje de avance físico | Se calcula a partir de los hitos completados, ponderados por su peso (D9) |
| RF-16 | **Métricas:** [Porcentaje de] ejecución presupuestaria | Se agrega el atributo obligatorio "presupuesto asignado" como base del cálculo (D9) |

### 2.2 Control de Recursos e Inventario

| ID | Texto original | Precisión acordada |
|---|---|---|
| RF-17 | **Materia Prima y Consumibles:** Catálogo unificado | |
| RF-18 | [Materia Prima y Consumibles:] control de stock en tiempo real | Atributo de calidad derivado en RNF-10 (D10) |
| RF-19 | [Materia Prima y Consumibles:] alertas de stock mínimo configurable | El Administrador configura el mínimo (D3) |
| RF-20 | [Materia Prima y Consumibles:] registro detallado de lotes de compra (fecha de ingreso, costo unitario y proveedor) | |
| RF-21 | **Equipos y Maquinaria:** Catálogo de activos indicando estado operacional (Disponible, En uso, En mantenimiento). | |
| RF-22 | [Equipos y Maquinaria:] Módulo de reserva previa para prevenir conflictos de agendamiento entre proyectos. | El Aprobador / Gestor de Inventario gestiona las reservas (D3). Para saber si pasan por el flujo de RN-03 rige la redacción literal de RF-29 (D5) |
| RF-23 | **Bitácora de Despachos:** Historial inalterable de salidas de almacén que registre fecha, hora, proyecto destino, insumo, cantidad despachada y usuario responsable del retiro. | Atributo de calidad derivado en RNF-11 (D10) |

### 2.3 Prorrateo de Consumibles Compartidos (Overhead)

| ID | Texto original | Precisión acordada |
|---|---|---|
| RF-24 | El sistema debe permitir cerrar un período contable (mensual o trimestral) | Lo cierra el Aprobador / Gestor de Inventario (D3) |
| RF-25 | [El sistema debe permitir] ejecutar el cálculo automático para prorratear el costo de los lotes compartidos entre los proyectos activos durante dicho rango de tiempo | Lo ejecuta el Aprobador / Gestor de Inventario (D3). "Proyectos activos" significa estatus "En ejecución" (D7) |
| RF-26 | [permitiendo criterios de reparto:] 1. Proporcional al nivel de consumo registrado. | El consumo es el total del proyecto en el período, es decir materia prima más insumos (D8) |
| RF-27 | [permitiendo criterios de reparto:] 2. Reparto equitativo en partes iguales entre proyectos activos. | "Proyectos activos" significa estatus "En ejecución" (D7) |

### 2.4 Ciclo de Solicitudes y Priorización

| ID | Texto original | Precisión acordada |
|---|---|---|
| RF-28 | **Priorización de Proyectos:** Módulo de ordenamiento dinámico de proyectos según su nivel de prioridad. | |
| RF-29 | **Aprobación de Gastos:** Toda adquisición o asignación de recursos debe seguir estrictamente el flujo de estados mostrado en el diagrama superior. | Redacción literal sin detallar más (D5). El flujo es RN-03 |

### 2.5 Reportes y Auditoría

| ID | Texto original | Precisión acordada |
|---|---|---|
| RF-30 | **Dashboard Ejecutivo:** Visualización interactiva con indicadores clave de rendimiento (KPIs) sobre proyectos activos, presupuesto global ejecutado y alertas críticas de stock. | Lo consulta el Administrador (D3). "Proyectos activos" significa estatus "En ejecución" (D7) |
| RF-31 | **Exportación de Datos:** Generación de reportes formalizados en formato PDF y Excel para análisis de gastos | El Aprobador y el Administrador exportan todos los proyectos. El Coordinador exporta solo sus proyectos asignados (D12) |
| RF-32 | [Generación de reportes formalizados en formato PDF y Excel para] resúmenes de prorrateo | Igual que RF-31 (D12) |
| RF-33 | [Generación de reportes formalizados en formato PDF y Excel para] hoja de vida/uso de equipos | Igual que RF-31 (D12) |
| RF-34 | **Auditoría del Sistema:** Registro inmutable (`audit_log`) que almacene la trazabilidad completa de acciones (creación, edición, eliminación, cambios de estado), incluyendo `timestamp`, `user_id` e `ip_address`. | Atributo de calidad derivado en RNF-12 (D10) |

---

## Reglas de negocio

| ID | Texto original | Precisión acordada | Afecta a |
|---|---|---|---|
| RN-01 | Nota: Los beneficiarios y el personal general de los laboratorios NO tendrán usuario en el sistema. | | RF-01 |
| RN-02 | Los consumibles de uso general (ej. guantes de nitrilo, papel absorbente, solventes multipropósito) no se asignan directamente a un solo proyecto durante la compra. Se adquieren por lotes institucionales y su costo debe distribuirse equitativamente o de forma proporcional. | | RF-20, RF-24 a RF-27 |
| RN-03 | Flujo de estados: [Borrador] ──> [Pendiente de Aprobación] ──> [Aprobado / Rechazado] ──> [Ejecutado] | Solo una solicitud "Aprobado" pasa a "Ejecutado". "Rechazado" es un estado final (D4) | RF-07, RF-08, RF-29 |
| RN-04 | **Regla de negocio:** Todo cambio en la prioridad de un proyecto requiere obligatoriamente una justificación textual que quedará asentada en la bitácora. | La justificación se guarda en el `audit_log` de RF-34 (D6) | RF-10, RF-28 |

---

## Requisitos no funcionales

### Sección 3: Arquitectura y Stack Tecnológico

| ID | Texto original | Precisión acordada |
|---|---|---|
| RNF-01 | El sistema debe diseñarse e implementarse bajo un patrón de arquitectura cliente-servidor, garantizando modularidad y mantenibilidad. | |
| RNF-02 | **Tecnología Libre:** Los equipos tienen total libertad para seleccionar la pila tecnológica (Frontend, Backend y Base de Datos Relacional) que mejor se adapte a sus capacidades técnicas. | |
| RNF-03 | **Diseño de Interfaz:** Se requiere un diseño de interfaz de usuario (UI) moderno, limpio y responsive, alineado con las guías de diseño estilo *Apple* (uso de espacio en blanco, bordes redondeados, paleta de colores neutra y soporte nativo para modo claro/oscuro). | |
| RNF-04 | **Despliegue:** La aplicación debe estar empaquetada o configurada para desplegarse en un entorno de servidor local o nube, simulando un ambiente de producción real. | |

### Sección 4: Entregables del Proyecto

| ID | Texto original | Precisión acordada |
|---|---|---|
| RNF-05 | **Código Fuente:** Repositorio estructurado con la separación clara entre Frontend y Backend. | |
| RNF-06 | **Base de Datos:** Scripts SQL de creación de estructura y script de datos semilla (*seeders*) cargado con proyectos ficticios, inventario inicial y usuarios con roles preconfigurados para evaluación. | |
| RNF-07 | **Documentación:** Archivo `README.md` exhaustivo con la guía paso a paso para la instalación, configuración y ejecución del entorno local. Alcance y limitaciones. | |
| RNF-08 | **Uso de Inteligencia Artificial:** Se permite y fomenta el uso de herramientas de IA generativa como asistentes de desarrollo. Los integrantes del equipo deben estar capacitados para defender la lógica del código y las decisiones arquitectónicas adoptadas. | |
| RNF-09 | **Requisito Indispensable:** Adjuntar el archivo de texto o historial con los **PROMPTS** principales utilizados durante el desarrollo. | |

La nota "Canal Oficial" (Telegram) se excluye porque no aporta requisitos más allá del PDF (D11).

### Atributos de calidad derivados de RF (D10)

| ID | Deriva de | Texto original que lo origina | Requisito | Criterio de medición |
|---|---|---|---|---|
| RNF-10 | RF-18 | "control de stock en tiempo real" | El stock se actualiza en la misma operación que registra cada recepción o despacho. | Al confirmar una recepción o un despacho, la siguiente consulta del stock ya muestra la cantidad nueva. Ninguna operación deja el stock pendiente de actualizar (D13) |
| RNF-11 | RF-23 | "Historial inalterable de salidas de almacén" | Ningún usuario, incluido el Administrador, puede editar ni eliminar un registro de la bitácora de despachos. | Ningún intento de edición o eliminación tiene efecto (verificación por prueba) |
| RNF-12 | RF-34 | "Registro inmutable (`audit_log`)" | Ningún usuario, incluido el Administrador, puede editar ni eliminar un registro del `audit_log`. | Ningún intento de edición o eliminación tiene efecto (verificación por prueba) |

---

## Registro de decisiones (25/10/2026)

| # | Duda | Decisión |
|---|---|---|
| D1 | Granularidad de los IDs | Como la define el skill `documento-de-requisitos`. Un requisito por capacidad, reglas como RN y no funcionales como RNF |
| D2 | Alcance disciplinar | Física, química y biología, tal cual el texto |
| D3 | Acciones sin rol | Asignar según la matriz. Registrar proyectos, configurar el stock mínimo y ver el dashboard le corresponden al Administrador. Cerrar el período, ejecutar el prorrateo y gestionar las reservas le corresponden al Aprobador / Gestor de Inventario |
| D4 | Flujo de estados | Solo "Aprobado" pasa a "Ejecutado". "Rechazado" es final |
| D5 | Qué entra en el flujo | Redacción literal ("toda adquisición o asignación de recursos") |
| D6 | Bitácora de prioridad | El `audit_log` |
| D7 | Proyecto activo | Solo estatus "En ejecución" |
| D8 | Consumo para el prorrateo | Consumo total del proyecto en el período |
| D9 | Métricas | Se agrega "presupuesto asignado". El avance físico se calcula por hitos ponderados, tomado de ERPNext "Task Weight" (ver `benchmarking.md`) |
| D10 | Atributos de calidad dentro de RF | Se quedan en su RF y además se crean RNF derivados |
| D11 | Sección 4 y Telegram | Solo cuenta lo que está en el PDF. Telegram no aporta nada y se excluye |
| D12 | Rol que exporta los reportes | Como en NEMO (`NEMO/views/usage.py`). Aprobador y Administrador exportan todo. El Coordinador exporta solo lo de sus proyectos asignados |
| D13 | Criterio de "tiempo real" del stock | Como en NEMO (`NEMO/views/consumables.py`). El stock cambia en la misma operación que registra el movimiento. Ninguna fuente da un tiempo en segundos |

## Propuestas aprobadas (25/10/2026)

De `propuestas.md` se aprobaron RF-35, RF-36, RF-37, IA-01 y RF-38. Las demás no entran en esta versión.
