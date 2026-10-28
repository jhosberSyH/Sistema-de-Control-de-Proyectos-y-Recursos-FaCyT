# Ejemplo completo — Sistema de control de mantenimiento de flota

Ejemplo reducido a dos módulos para mostrar el nivel de detalle y el tono esperados. Un documento real conserva esta misma forma con todos sus módulos.

Fíjate en que los apartados 3 y 4 están vacíos a propósito, porque los diagramas y los enlaces los coloca la persona. La única excepción son los requisitos de calidad, que se escriben cuando el usuario los dio y, si no, quedan como pendiente explícito.

---

# Documento de requerimientos — Sistema de control de mantenimiento de flota

**Versión:** 1.0 · **Fecha:** 12/03/2026 · **Elaborado por:** Coordinación de Operaciones · **Clasificación:** Uso interno

## Control de versiones

| Versión | Fecha | Autor | Descripción del cambio |
|---|---|---|---|
| 0.1 | 05/03/2026 | Coordinación de Operaciones | Borrador inicial a partir de las entrevistas con talleres |
| 1.0 | 12/03/2026 | Coordinación de Operaciones | Versión aprobada para desarrollo |

## Índice

> **[ESPACIO — Índice]**
> *En Google Docs, Insertar > Tabla de contenido. En Word, Referencias > Tabla de contenido.*

## Propósito
La empresa opera 48 camiones de reparto cuyo mantenimiento se lleva hoy en un cuaderno por taller y en hojas de cálculo sueltas. El sistema centraliza el historial de cada vehículo, avisa cuándo toca un servicio preventivo y deja registro de qué se hizo, quién lo autorizó y cuánto costó.

## Alcance
**Incluye:** registro de vehículos, planificación y ejecución de mantenimientos preventivos y correctivos, autorización de gastos, historial por vehículo y reportes de costos.

**No incluye:** compra de repuestos, control de inventario del taller, nómina de mecánicos y seguimiento GPS de la flota.

## Actores
| Rol | Descripción | Responsabilidad principal en el sistema |
|---|---|---|
| Operador de flota | Personal administrativo de transporte | Registra vehículos y abre órdenes de mantenimiento |
| Jefe de taller | Responsable del taller propio | Ejecuta y cierra las órdenes |
| Coordinador de operaciones | Supervisa la flota completa | Autoriza gastos y revisa reportes |

## Glosario
| Término | Significado |
|---|---|
| Orden de mantenimiento | Documento que agrupa los trabajos hechos a un vehículo en una visita al taller |
| Preventivo | Mantenimiento programado por kilometraje o por tiempo |
| Correctivo | Mantenimiento originado por una falla reportada |

## Convenciones
Cada funcionalidad de este documento es obligatoria para la versión que se entrega, salvo que su prioridad diga otra cosa. Los códigos F, HU, RN y RNF son identificadores permanentes y no se reutilizan. Las marcas `[PROPUESTA]` y `[POR CONFIRMAR]` señalan lo que todavía no está validado.

## Referencias
| Insumo | Tipo | Fecha |
|---|---|---|
| `insumos/entrevista-jefes-de-taller.md` | Notas de entrevista | 02/03/2026 |
| `insumos/cuaderno-taller-norte.pdf` | Registro actual escaneado | 28/02/2026 |
| `insumos/flota-2026.xlsx` | Listado de vehículos | 01/03/2026 |

---

# 1. Funcionalidades

## Módulo 1 — Registro de flota

Concentra la información maestra de cada vehículo, es decir sus datos de identificación, su kilometraje actual y su plan de mantenimiento preventivo. Lo usa el operador de flota y es la base sobre la que trabajan los demás módulos. Empieza cuando un vehículo se incorpora a la flota y termina cuando se da de baja.

### Diagrama de flujo

> **[ESPACIO — Diagrama BPMN del Módulo 1]**
> *Insertar aquí el diagrama de flujo del módulo.*
> Archivo: `diagramas/modulo-01-registro-de-flota.png`

### Funcionalidades

#### F1.1 — El operador de flota registra un vehículo nuevo

**Qué:** Cubre el alta de un vehículo con sus datos de identificación, que son placa, marca, modelo, año y tipo de carrocería, más su kilometraje inicial y el taller al que queda asignado. La placa es única, así que no pueden existir dos vehículos activos con la misma.

**Cómo:** El operador entra al listado de flota y elige registrar un vehículo. Llena la ficha y, al guardar, el sistema valida que la placa no exista y que el kilometraje sea un número positivo. Si todo está bien, el vehículo queda en estado "Activo" y aparece en el listado disponible para asignarle órdenes. Si la placa ya existe, el sistema muestra el vehículo que la tiene y no deja duplicarla.

**Para qué:** Hoy cada taller lleva su propia lista y la misma placa aparece escrita de tres formas distintas, así que es imposible consolidar el historial de un camión que rotó de taller. Un registro único define de una vez qué vehículos existen y dónde están.

**Origen:** Entrevista con jefes de taller del 02/03/2026, `insumos/entrevista-jefes-de-taller.md`.

#### F1.2 — El operador de flota actualiza el kilometraje de un vehículo

**Qué:** Cubre el registro periódico de la lectura del odómetro. Cada lectura guarda el valor, la fecha y quién la cargó, y nunca sobrescribe la anterior.

**Cómo:** El operador abre la ficha del vehículo y carga la lectura del día. El sistema rechaza valores menores a la última lectura registrada, salvo que se indique que el odómetro fue reemplazado, caso en el que pide una nota y reinicia el conteo desde el valor nuevo. Cada vez que se carga una lectura, el sistema recalcula cuánto falta para el próximo preventivo.

**Para qué:** El kilometraje dispara casi todo el mantenimiento preventivo. Sin lecturas frecuentes y confiables, los avisos llegan tarde y los servicios se hacen cuando el camión ya falló, que cuesta varias veces más.

#### F1.3 — El sistema alerta cuando un vehículo se acerca a su próximo preventivo

**Qué:** Cubre el aviso automático por proximidad al servicio programado, calculado por kilometraje o por tiempo transcurrido, según lo que ocurra primero. El umbral de aviso es configurable.

**Cómo:** Cada vez que se actualiza el kilometraje, el sistema compara la lectura contra el plan de mantenimiento del vehículo. Cuando faltan menos kilómetros o días que el umbral configurado, el vehículo se marca en el listado como "Próximo a servicio" y aparece en el tablero del operador ordenado por urgencia. Si se pasa la fecha o el kilometraje sin que exista una orden asociada, la marca cambia a "Vencido".

**Para qué:** Los servicios preventivos se olvidan porque nadie revisa el cuaderno todos los días. Un aviso que aparece solo, en el lugar donde el operador ya trabaja, convierte el preventivo en rutina y no en excepción.

## Módulo 2 — Órdenes de mantenimiento

Cubre el ciclo completo de una visita al taller, desde que se abre la orden hasta que se cierra con los trabajos ejecutados y su costo. Lo usan el operador de flota, el jefe de taller y el coordinador de operaciones. Empieza con la apertura de la orden y termina con su cierre o su anulación.

### Diagrama de flujo

> **[ESPACIO — Diagrama BPMN del Módulo 2]**
> *Insertar aquí el diagrama de flujo del módulo.*
> Archivo: no encontrado en la carpeta

### Funcionalidades

#### F2.1 — El operador de flota abre una orden de mantenimiento

**Qué:** Cubre la creación de la orden asociada a un vehículo, con el tipo preventivo o correctivo, el taller donde se atenderá y la lista de trabajos solicitados. Una orden nace en estado "Abierta".

**Cómo:** Desde la ficha del vehículo o desde el tablero de alertas, el operador abre una orden. Si el origen es una alerta de preventivo, el sistema precarga los trabajos del plan para que solo se revisen. Si es correctiva, el operador describe la falla que reportó el conductor. Al guardar, la orden queda visible en la bandeja del taller asignado y el vehículo pasa a "En mantenimiento".

**Para qué:** Hoy los trabajos se piden por teléfono y el taller anota lo que entendió. Dejar la solicitud escrita y asociada al vehículo evita trabajos rehechos y permite comparar después lo pedido con lo ejecutado.

#### F2.2 — El coordinador de operaciones autoriza las órdenes que superan el monto límite

**Qué:** Cubre la autorización de gastos por encima del monto configurado para el taller. Una orden sin autorización no puede cerrarse. La autorización queda asociada a quien la otorgó y al momento en que lo hizo.

**Cómo:** Cuando el jefe de taller carga un presupuesto que supera el límite, la orden pasa a "Por autorizar" y aparece en la bandeja del coordinador con el detalle de trabajos, el monto y el gasto del vehículo en los últimos doce meses. El coordinador autoriza o devuelve con una observación. Si la devuelve, la orden regresa al taller con el comentario visible y el trabajo no avanza hasta que se ajuste el presupuesto.

**Para qué:** Los gastos grandes se aprueban hoy de palabra y después nadie sabe quién autorizó reparar un motor que quizá no valía la pena frente al valor del camión. La autorización registrada da control del gasto y soporte para auditoría.

#### F2.3 — El jefe de taller cierra la orden con los trabajos ejecutados

**Qué:** Cubre el registro final de lo que realmente se hizo, el costo por trabajo, la fecha de salida del vehículo y el kilometraje de salida. Una orden cerrada no se modifica, y solo puede corregirse con una nueva orden de ajuste.

**Cómo:** El jefe de taller marca cada trabajo solicitado como ejecutado, no ejecutado o reemplazado por otro, y carga su costo. Al cerrar, el sistema exige el kilometraje de salida, actualiza la ficha del vehículo, lo devuelve a estado "Activo" y, si la orden era preventiva, recalcula la fecha y el kilometraje del próximo servicio.

**Para qué:** El cierre es lo que convierte la orden en historial. Sin él, el sistema sabe qué se pidió pero no qué se hizo, y el costo real por vehículo, que es el dato que define cuándo conviene reemplazar un camión, nunca se puede construir.

---

# 2. Historias de usuario

## Módulo 1 — Registro de flota

### HU-01 — Alta de vehículo
**Como** operador de flota,
**quiero** registrar un vehículo nuevo con sus datos y su kilometraje inicial,
**para** que desde el primer día tenga historial y plan de mantenimiento propio.

*Funcionalidades relacionadas: F1.1*

**Criterios de aceptación**
- **Dado** que lleno la ficha con una placa que no existe, **cuando** guardo, **entonces** el vehículo queda activo y visible en el listado de flota.
- **Dado** que ingreso una placa ya registrada en un vehículo activo, **cuando** guardo, **entonces** el sistema lo impide y me muestra el vehículo existente.

### HU-02 — Aviso de servicio próximo
**Como** operador de flota,
**quiero** ver qué camiones están por cumplir su mantenimiento preventivo,
**para** programar el taller antes de que el servicio se venza.

*Funcionalidades relacionadas: F1.2, F1.3*

**Criterios de aceptación**
- **Dado** que cargo una lectura que deja al vehículo dentro del umbral configurado, **cuando** vuelvo al tablero, **entonces** el vehículo aparece marcado como "Próximo a servicio".
- **Dado** que se venció la fecha del preventivo sin orden asociada, **cuando** entro al tablero, **entonces** el vehículo aparece como "Vencido" y de primero en la lista.

## Módulo 2 — Órdenes de mantenimiento

### HU-03 — Autorización de gasto
**Como** coordinador de operaciones,
**quiero** revisar en una bandeja las órdenes que superan el monto límite,
**para** decidir con el historial del vehículo a la vista y dejar constancia de mi autorización.

*Funcionalidades relacionadas: F2.2*

**Criterios de aceptación**
- **Dado** que una orden supera el límite del taller, **cuando** el jefe de taller carga el presupuesto, **entonces** la orden pasa a "Por autorizar" y aparece en mi bandeja.
- **Dado** que devuelvo una orden, **cuando** no escribo observación, **entonces** el sistema no me deja completar la devolución.
- **Dado** que una orden está "Por autorizar", **cuando** el jefe de taller intenta cerrarla, **entonces** el sistema lo impide.

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
> Archivo: `diagramas/arquitectura.png`

> **[ESPACIO — Enlace al documento de arquitectura]**
> *Insertar aquí el enlace al documento técnico, si existe.*

## Requisitos de calidad

| Código | Categoría | Requisito | Criterio de medición |
|---|---|---|---|
| RNF-01 | Fiabilidad | El historial de cada vehículo se conserva aunque el vehículo se dé de baja | Las órdenes de un vehículo dado de baja siguen disponibles en consulta durante al menos 5 años |
| RNF-02 | Capacidad de interacción | El jefe de taller usa el sistema desde la tableta del taller | `[POR CONFIRMAR: modelo y tamaño de pantalla de la tableta]` |

## Notas

> **[ESPACIO — Stack, integraciones, seguridad y despliegue]**

---

# Anexos

## A. Matriz de trazabilidad

| Funcionalidad | Historias de usuario | Reglas | Diagrama | Estado |
|---|---|---|---|---|
| F1.1 | HU-01 | — | Módulo 1 | Aprobada |
| F1.2 | HU-02 | — | Módulo 1 | Aprobada |
| F1.3 | HU-02 | — | Módulo 1 | Aprobada |
| F2.1 | — | — | Módulo 2 | Aprobada |
| F2.2 | HU-03 | — | Módulo 2 | Aprobada |
| F2.3 | — | — | Módulo 2 | Aprobada |

*Nota.* F2.1 y F2.3 no tienen historia en este ejemplo reducido. En un documento real, toda fila sin historia se completa o se cuestiona antes de aprobar.

## B. Supuestos y puntos por confirmar

| Código | Tipo | Descripción | Responsable |
|---|---|---|---|
| SP-01 | `[PROPUESTA]` | El umbral de aviso por proximidad se fija al inicio en 1000 km o 15 días | Coordinación de Operaciones |
| SP-02 | `[POR CONFIRMAR]` | Monto límite de autorización por taller | Coordinación de Operaciones |
| SP-03 | `[POR CONFIRMAR]` | Si los talleres externos tendrán acceso al sistema o cargarán sus órdenes a través del operador de flota | Coordinación de Operaciones |
| SP-04 | `[POR CONFIRMAR]` | F2.3 exige el kilometraje de salida, pero no está definido dónde se guarda frente a las lecturas normales del odómetro | Jefe de taller |
| SP-05 | `[POR CONFIRMAR]` | Requisitos de rendimiento, seguridad de la información y disponibilidad, que no se mencionaron en las entrevistas | Coordinación de Operaciones |
