# Plantilla — Documento de requerimientos

Copia este esqueleto y reemplaza lo que está entre corchetes. Los bloques marcados como ESPACIO se dejan vacíos, porque los llena la persona que inserta los diagramas, los enlaces y el índice. La línea `Archivo:` se llena con el archivo de `diagramas/` que corresponde a cada espacio, o se omite si no se trabaja con carpeta.

---

# Documento de requerimientos — [Nombre del sistema]

**Versión:** [1.0] · **Fecha:** [DD/MM/AAAA] · **Elaborado por:** [nombre o equipo] · **Clasificación:** [Uso interno]

## Control de versiones

| Versión | Fecha | Autor | Descripción del cambio |
|---|---|---|---|
| [0.1] | [DD/MM/AAAA] | [Nombre] | Borrador inicial |

## Índice

> **[ESPACIO — Índice]**
> *En Google Docs, Insertar > Tabla de contenido. En Word, Referencias > Tabla de contenido.*

## Propósito
[Un párrafo con el problema que resuelve el sistema y para quién.]

## Alcance
**Incluye:** [lista corta]

**No incluye:** [lista corta, que es la parte que evita discusiones después]

## Actores
| Rol | Descripción | Responsabilidad principal en el sistema |
|---|---|---|
| [Rol] | [Quién es] | [Qué hace aquí] |

## Convenciones
Cada funcionalidad de este documento es obligatoria para la versión que se entrega, salvo que su prioridad diga otra cosa. Los códigos F, HU, RN y RNF son identificadores permanentes y no se reutilizan. Las marcas `[PROPUESTA]` y `[POR CONFIRMAR]` señalan lo que todavía no está validado.

## Glosario
| Término | Significado |
|---|---|
| [Término del negocio] | [Definición] |

## Referencias
| Insumo | Tipo | Fecha |
|---|---|---|
| [insumos/acta-2026-09-10.md] | [Acta de reunión] | [10/09/2026] |

---

# 1. Funcionalidades

## Módulo 1 — [Nombre del módulo]

[Descripción de 2 a 4 oraciones con lo que abarca el módulo, quién lo usa, dónde empieza y dónde termina.]

### Diagrama de flujo

> **[ESPACIO — Diagrama BPMN del Módulo 1]**
> *Insertar aquí el diagrama de flujo del módulo.*
> Archivo: `diagramas/modulo-01-[nombre].png`

### Funcionalidades

#### F1.1 — [Oración de sujeto, verbo y predicado]

**Qué:** [Alcance de la funcionalidad, con lo que cubre, la información que maneja y lo que no cubre.]

**Cómo:** [Recorrido práctico en lenguaje natural, con lo que dispara la acción, lo que ve el usuario, lo que decide y lo que pasa después. Sin tecnología.]

**Para qué:** [Problema que elimina y valor que aporta.]

**Origen:** [Solo si sale de un insumo concreto. Prioridad y Verificación van aquí también, solo si aplican.]

#### F1.2 — [...]

**Qué:**

**Cómo:**

**Para qué:**

## Módulo 2 — [Nombre del módulo]

[Descripción.]

### Diagrama de flujo

> **[ESPACIO — Diagrama BPMN del Módulo 2]**
> *Insertar aquí el diagrama de flujo del módulo.*
> Archivo: `diagramas/modulo-02-[nombre].png`

### Funcionalidades

#### F2.1 — [...]

**Qué:**

**Cómo:**

**Para qué:**

---

# 2. Historias de usuario

## Módulo 1 — [Nombre del módulo]

### HU-01 — [Título corto]
**Como** [rol],
**quiero** [acción],
**para** [beneficio].

*Funcionalidades relacionadas: F1.1*

**Criterios de aceptación**
- **Dado** [contexto], **cuando** [acción], **entonces** [resultado esperado].
- **Dado** [contexto], **cuando** [acción inválida], **entonces** [el sistema lo impide y avisa].

---

# 3. Base de datos

> **[ESPACIO — Diagrama de base de datos]**
> *Insertar aquí el modelo entidad-relación del sistema.*
> Archivo: `diagramas/base-de-datos.png`

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
| RNF-01 | [Categoría de ISO/IEC 25010] | [Solo lo que dijo el usuario o los insumos] | [Número, unidad y condición, o `[POR CONFIRMAR: ...]`] |

## Notas

> **[ESPACIO — Stack, integraciones, seguridad y despliegue]**

---

# Anexos

## A. Matriz de trazabilidad

| Funcionalidad | Historias de usuario | Reglas | Diagrama | Estado |
|---|---|---|---|---|
| F1.1 | HU-01 | RN-01 | Módulo 1 | [Propuesta] |

## B. Reglas de negocio

Solo las reglas que condicionan dos o más funcionalidades. Si no hay, este anexo se elimina.

| Código | Regla | Funcionalidades que la aplican |
|---|---|---|
| RN-01 | [Regla en una oración, con sus números] | [F1.1, F2.3] |

## C. Supuestos y puntos por confirmar

| Código | Tipo | Descripción | Responsable |
|---|---|---|---|
| SP-01 | `[PROPUESTA]` | [Decisión propuesta que el usuario todavía no validó.] | [Quién la valida] |
| SP-02 | `[POR CONFIRMAR]` | [Dato que falta.] | [Con quién se confirma] |
