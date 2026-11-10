# Revisión del backend, la base de datos y la integración con el frontend

Fecha: 9 de noviembre de 2026 · Rama de trabajo: `integracion-backend` (sale de `origin/main` 0aca260 + fusión de `frontend-con-datos-mock`).

## 1. Veredicto (actualizado el 10 de noviembre de 2026)

**La aplicación ya funciona completa contra PostgreSQL**: los 8 módulos del backend cumplen el contrato del frontend y se probaron de punta a punta en Chrome con los tres roles (§3.2). **Todavía no se puede subir a producción** por tres motivos:

1. **No hay piezas de despliegue** (B9): faltan Dockerfile de `api` y `web`, `docker-compose.yml`, `frontend/nginx/default.conf.template` y `railway.toml`, y no hay un bucket de Supabase Storage creado.
2. **Faltan datos demo para la presentación**: el seed actual alcanza para probar cada pantalla, pero sus montos son mínimos (D11).
3. **El equipo debe validar** las 8 decisiones del §6 y los matices de §4.1, sobre todo la fecha de la devolución en una corrección.

Criterios cumplidos:
- Contrato completo y vigilado: 71 tipos comparados en `src/types/contrato.ts`.
- Pruebas de backend sobre PostgreSQL real: 160.
- E2E por rol en Chrome sin errores de consola.

Falta: despliegue de prueba en Railway + Supabase y CI que corra ambas suites.

## 2. Qué había en el repositorio

| Rama | Contenido | Estado |
|---|---|---|
| `main` (remoto) | Backend M1–M8, esquema SQL y seeds. M1, M3, M6 y M7 son de alex; M2, M4, M5, M8, `main.py` y `requirements` son de urondon. | Base de esta revisión |
| `feature/database-global-schema`, `feature/module-1/3/6/7-*` | Ya fusionadas en `main` (0 commits por delante) | Se pueden borrar |
| `frontend-con-datos-mock` | Frontend completo con MSW. Va 2 commits por delante y 14 por detrás de `main`. | El PR #2 se cerró sin fusionar |

El `main` tenía en `frontend/` solo `api.ts` sueltos (almacén, inventario, prorrateo) y `src/types/index.ts`, escritos contra el contrato del backend en snake_case. Nadie los importaba y rompían `typecheck`, `lint` y `build`, así que se retiraron en esta rama. El contrato vigente es el de los handlers MSW (§5).

## 3. Pruebas: antes y después

| Suite | Antes | Ahora |
|---|---|---|
| Backend, SQLite (pruebas de servicio de los compañeros) | 39, y dejaban `backend/local_dev.db` en cada corrida | 45 (las de PostgreSQL se saltan) |
| Backend, PostgreSQL con el esquema real (`TEST_DATABASE_URL=… pytest`) | No existía | **160** |
| Frontend `vitest` | 147 | **151** |
| Frontend `typecheck` / `lint` / `build` | Fallaban por los `api.ts` huérfanos | En verde |
| Guardián de contrato (`src/types/contrato.ts`) | No existía | 71 tipos idénticos al OpenAPI; se comprobó que un campo de más hace fallar `typecheck` |

Pruebas de PostgreSQL por área:
- autenticación y sesión
- M1 a M8 (`tests/modulos/*/test_contrato.py`)
- base de datos: ORM frente al esquema, enums, inalterabilidad, EXCLUDE e id inválido → 404
- las 8 decisiones (`tests/base_datos/test_decisiones.py`)
- almacenamiento de archivos (`tests/almacenamiento`)

### 3.1 Piloto (9 de noviembre)
Sesión y M1 en Chrome: crear, editar, desactivar y reactivar cuentas; restablecer clave; clave temporal → crear contraseña; ubicaciones y parámetros; CSRF 403.

### 3.2 E2E completo en Chrome (10 de noviembre), backend real + PostgreSQL, sin mocks

| Rol | Función probada | Resultado |
|---|---|---|
| Administrador | Inicio, dashboard (KPIs, alertas de stock y vencimientos), proyectos (lista, filtros, registrar, exportar CSV, ficha con pestañas, cambio de coordinador con historial y avisos, bloqueo de transición sin plan), insumos (registrar → reposición automática, ficha con lotes y FEFO, pronóstico Holt-Winters, cambiar mínimo, exportar), equipos (registrar, mantenimiento → cancela la reserva y avisa, fin de mantenimiento), búsqueda global, auditoría, usuarios, ubicaciones | ✅ |
| Coordinadora (QUI-024) | Retiro con dos insumos (autoguardado y envío), gasto con **cotización PDF subida al almacenamiento**, reserva con detección de choque y horarios libres, registro de uso (inicio y cierre), carga de avance de hito (45 % → 54 %), avisos (ver y marcar leídos), reportes (vista previa, PDF y XLSX reales, 404 para un proyecto ajeno) | ✅ |
| Coordinadora (BIO-011) | Confirmación de cargos (bloqueada con una corrección pendiente), corrección de despacho (COR-001), plan de hitos nuevo (pesos 100 % → confirmar), uso de materia prima con saldo | ✅ |
| Aprobador | Bandeja (retiro, gasto con cotización, reserva, reposición), ejecutar gasto con monto real, despacho FEFO (lote vencido bloqueado), recepción de lote que cierra la reposición, corrección → línea `devolucion` positiva con signo −, priorización con justificación, abrir período, recordatorio, cerrar con confirmaciones pendientes (SP-08), reparto (dos criterios, residuo al código menor), resumen PDF | ✅ |

Verificado también en PostgreSQL:
- Gasto ejecutado de cada proyecto igual a la vista `v_project_spend`; por ejemplo, BIO-011 = 153,70 de despachos + 745,00 del reparto.
- 26 avisos con sus enlaces.
- 52 registros de auditoría.
- 0 tablas en `public`.

Defectos encontrados en el e2e y **corregidos**:
- Se mostraban UUID a las personas en el mensaje de reserva creada, en la bandeja, en el inicio del aprobador, en el aviso de choque y en el título de la pestaña de despacho.
- El enlace del aviso de reposición usaba el número en vez del UUID.
- El inicio del coordinador decía "1 cargos".

## 4. Hallazgos

Estado: ✅ corregido en esta rama · ⏳ pendiente.

### Bloqueantes

| # | Hallazgo | Dónde | Estado |
|---|---|---|---|
| B1 | Los modelos no usan el esquema `app`. Con PostgreSQL, `create_all` creaba 21 tablas paralelas en `public` y la app trabajaba ahí: se saltaba los triggers, CHECK, enums, EXCLUDE y seeds de `database/`. | `core/database.py`, `main.py` (lifespan) | ✅ Se fija `search_path=app,public` en cada conexión. `create_all` y la semilla quedan solo para SQLite. |
| B2 | Los ids son `String(36)` en el ORM y `UUID` en la base. | `modulos/usuarios/models.py`, `auditoria/models.py` | ✅ Tipo `IdType` (UUID en PostgreSQL, texto en SQLite) |
| B3 | Los enums se comparaban como `VARCHAR` (`operator does not exist: workflow_status = character varying`): daban 500 en `/proyectos`, `/solicitudes`, `/priorizacion`, `/reportes/dashboard`, el calendario de equipos y al crear un período. | Todas las columnas enum | ✅ `EnumBD(...)` con los tipos de `schema.sql`. Una prueba compara los valores con la base. |
| B4 | La vista previa del reparto siempre daba 500 (`NameError`: falta el import de `AccountingPeriod`). | `prorrateo/router.py` (`api_proration_preview`) | ✅ + prueba |
| B5 | Cerrar un período siempre daba 500 (`TypeError` en la llamada a `recalculate_consumption_forecasts`). Además, esa función hacía commit en medio del cierre. | `prorrateo/service.py` (`close_accounting_period`), `inventario/service.py` | ✅ Firma corregida y `commit=False` para mantener la atomicidad. Con prueba. |
| B6 | Copiar `.env.example` como dice el README rompía el arranque (`SettingsError` en `ALLOWED_ORIGINS`). | `.env.example` | ✅ Formato JSON |
| B7 | El hash argon2 de `seeders.sql` es inventado (`VerificationError: Decoding failed`). Nadie podía entrar con la base cargada por los scripts, y el error salía como 500, no como 401. | `database/seeders.sql`, `core/security.py` | ✅ Hash real de `Demo2026*`. Un hash corrupto ahora responde 401. |
| B8 | El contrato del frontend no coincide con el backend: rutas, nombres (camelCase frente a snake_case), roles cortos frente a largos, formatos de error y paginación. | Todos los módulos | ✅ Los 8 módulos conectados y probados en Chrome (§3.2, §5) |
| B9 | No hay despliegue: faltan el Dockerfile de `api` y de `web`, `docker-compose.yml`, `frontend/nginx/default.conf.template` y `railway.toml`. `scripts/` solo tiene utilidades de logos. | Raíz | ⏳ |

### Seguridad

| # | Hallazgo | Dónde | Estado |
|---|---|---|---|
| S1 | El CSRF no se verificaba. El token se generaba pero nadie lo comparaba, aunque el README dice que sí. | `autenticacion/dependencies.py` | ✅ Patrón synchronizer token en toda escritura con cookie (403). Con prueba y verificado en el e2e. |
| S2 | La cookie `__Host-sesion` se emitía con `secure=False` en desarrollo, y los navegadores la rechazan. | `autenticacion/router.py` | ✅ Siempre `Secure` (los navegadores la aceptan en `http://localhost`) |
| S3 | Había un acceso por `Authorization: Bearer` sin documentar, y cerrar sesión no lo invalidaba. | `dependencies.py` | ✅ Solo fuera de producción (lo usan las pruebas); cerrar sesión lo invalida |
| S4 | La contraseña por defecto de las cuentas nuevas era `Demo2026*`. | `usuarios/service.py`, `schemas.py` | ✅ En la API nueva, clave temporal aleatoria con cambio obligatorio (F1.1). ⏳ `create_user` del servicio sigue teniendo el valor por defecto. |
| S5 | El reporte de equipos muestra reservas de proyectos ajenos al coordinador (RN-07). | `reportes/service.py` ~618 | ⏳ |
| S6 | Un id que no es UUID en la ruta llegaba a PostgreSQL y daba 500 en M2–M8. El frontend usa códigos como `QUI-024`. | Todas las rutas con id | ✅ Manejador global → 404, con prueba. ⏳ Las rutas de M2 deben aceptar el código del proyecto. |
| S7 | `requirements.txt` sin versiones fijas: se instalaron FastAPI 0.162 y SQLAlchemy 2.1.8. Las pruebas mezclan dependencias de ejecución y de test. | `backend/requirements.txt` | ⏳ Fijar versiones (o `uv.lock`) |

### Base de datos (decisiones de diseño, ⏳)

| # | Hallazgo | Dónde |
|---|---|---|
| D1 | El estado `"Cancelado"` de reservas no existe en `app.workflow_status`: PostgreSQL lo rechaza. Hay una prueba que lo documenta. | `equipos/service.py` ~497, `equipos/schemas.py:14` |
| D2 | El EXCLUDE de reservas también bloquea `Borrador` y `Ejecutado`, mientras que el código solo considera `Pendiente` y `Aprobado`. Dos borradores superpuestos dan IntegrityError (500). | `02_constraints_triggers.sql:153-159`, `equipos/service.py` ~143 |
| D3 | El despacho compensatorio se inserta con cantidad negativa y viola `CHECK (dispatched_quantity > 0)`. La prueba de M6 espera `-10` y solo pasa en SQLite. | `almacen/service.py` ~936, `schema.sql:390` |
| D4 | `CHECK available_quantity <= initial_quantity` choca con las recepciones sobre un lote existente y con las devoluciones por corrección. | `schema.sql:377`, `inventario/service.py` ~589 |
| D5 | `requests.project_id NOT NULL` obliga a colgar la reposición automática de un proyecto cualquiera, o de uno inventado `GEN-001`, y se le cobra. Contradice RN-02. | `inventario/service.py` ~276-293 |
| D6 | `executed_budget` tiene dos fuentes: M6 y M7 lo incrementan, y M2 lo recalcula y sobreescribe al leer. Varios GET escriben en la base. | `proyectos/service.py` ~164-184, `almacen/service.py` ~447 |
| D7 | No hay tabla de avisos (bandeja interna). `/api/avisos` responde una lista vacía. | `schema.sql` |
| D8 | Falta el trigger `updated_at` en `project_milestones` y `equipment_reservations`. | `02_constraints_triggers.sql` |
| D9 | El correo es único con distinción de mayúsculas en la base: el índice `LOWER(email)` no es `UNIQUE`. | `schema.sql:140` |
| D10 | Los números correlativos salen de `count()`, con riesgo de carrera bajo concurrencia, y los formatos difieren entre código y seed (`DES-0001` frente a `DSP-2026-0001`). | `solicitudes/service.py` ~142, `almacen/service.py` ~48 |
| D11 | El seed promete datos que no trae (lotes por vencer, stock bajo mínimo, historial para el pronóstico). Once tablas quedan vacías y el registro `SYSTEM_INITIALIZATION` no tiene descripción legible. Además, la semilla de `main.py` (solo SQLite) no coincide con `seeders.sql` en ids y ubicaciones. | `database/seeders.sql`, `main.py` |
| D12 | `01_schema.sql` y `03_seed.sql` usan `\i` con rutas relativas a la carpeta desde donde se ejecuta psql. Si se monta `database/` en `docker-entrypoint-initdb.d`, todo corre dos veces. Si no encuentra `btree_gist`, el EXCLUDE se crea en silencio (`EXCEPTION WHEN OTHERS`). | `database/*.sql` |

Cambio de esquema hecho en esta ronda: la columna `users.must_change_password`, que necesita la clave temporal de F1.1. Se agregó en `schema.sql` con un `ALTER TABLE … IF NOT EXISTS` para bases que ya existían.

### 4.1 Matices para validar con el equipo
- **La devolución de una corrección lleva la fecha del día en que se aprueba**, no la del despacho original. Ejemplo: COR-001 corrige un despacho de octubre y su −2,90 cuenta en noviembre. Es la forma de no tocar un período ya cerrado, pero debe quedar acordado.
- **Las reservas no tienen código visible**: se nombran por equipo y fecha. Si el equipo quiere códigos tipo RES-001, hay que agregar una columna correlativa.
- **Los gastos ejecutados cuentan en su fecha de actualización** (`requests.updated_at`), porque no existe un `executed_at`.
- **Quedan módulos con service.py sin usar**: las funciones CRUD viejas de M2, M4, M5 y M8 se pueden limpiar.

### Lógica y coherencia (⏳)

- **M1**
  - `deactivate_or_delete_location` nunca borra, aunque F1.4 lo permite si la ubicación no se usó. La API nueva sí borra.
  - Al desactivar un coordinador no se liberaban sus proyectos. La API nueva sí lo hace (F1.3 y F2.2).
- **M2**
  - Las rutas usan el id UUID; el frontend usa el código.
  - No hay plan de hitos con confirmación, ni gastos, reservas o historial por proyecto, ni exportación a CSV.
- **M4**
  - `next_free_before` y `next_free_after` siempre son `null`.
  - El estado "En uso" nunca se asigna.
  - No existe la cancelación manual.
  - Hay comparaciones de fechas sin zona horaria contra fechas con zona horaria.
- **M5:** la cotización de un gasto nunca se sube. El frontend guarda solo el nombre del archivo y no existe un endpoint de carga.
- **M6**
  - `execute_dispatch` no valida que la solicitud sea de tipo Retiro, que los lotes correspondan a los ítems ni que la cantidad no pase de la aprobada.
  - La recepción deja el Gasto en "Aprobado" mientras M5 lo pasa a "Ejecutado". Son dos flujos que chocan.
- **M7**
  - `check_date_not_in_closed_period` no se usa: el bloqueo por período cerrado solo existe en el despacho.
  - La confirmación devuelve `charges_count=0` y `total_amount=0` fijos.
  - Los proyectos sin coordinador quedan a cargo del aprobador, que no puede confirmarlos.
- **M8:** `func.date(timestamptz)` usa UTC, no `APP_TIMEZONE`.
- **General**
  - Hay código muerto e imports sin uso.
  - Se usa la API de Pydantic v1 (`.from_orm`, `class Config`).
  - En `prompts/PROMPTS.md` no están los prompts de M2, M4, M5 y M8 (RNF-09).
  - El README promete WeasyPrint, statsmodels, pwdlib, Ruff y pruebas de base de datos que no existían. Las de base de datos ya existen.

## 5. Brecha del contrato frontend ↔ backend

**Cerrada.** Los 92 endpoints del frontend existen en el backend con el contrato de los mocks.

| Módulo | Router | Quién lo conectó |
|---|---|---|
| Autenticación, M1, shell (inicio, avisos, contadores, período actual) | `autenticacion/router.py`, `modulos/usuarios/router.py`, `navegacion/router.py` | Piloto |
| M2 Proyectos y Búsqueda | `modulos/proyectos/contrato.py`, `modulos/busqueda/router.py` | Agente A |
| M3 Inventario y M6 Almacén | `modulos/inventario/contrato.py`, `modulos/almacen/contrato.py` (+ `reglas.py`) | Agente B |
| M4 Equipos y M5 Solicitudes, Bandeja y Priorización | `modulos/equipos/contrato.py`, `modulos/solicitudes/contrato.py`, `cotizacion.py` | Agente C |
| M7 Gastos compartidos y M8 Reportes, Dashboard y Auditoría | `modulos/prorrateo/contrato.py`, `modulos/reportes/contrato.py`, `auditoria/contrato.py` | Agente D |

Se retiraron todas las rutas viejas en snake_case. Los `service.py` siguen y los nuevos routers los reutilizan.

Convenciones del contrato:
- Proyectos y solicitudes viajan con su UUID (`id`, `proyectoId`, `solicitudId`) y su código o número visible (`codigo`, `numero`).
- Las reservas no tienen código visible: se nombran por equipo y fecha.

## 6. Decisiones tomadas (9 de noviembre de 2026)

Las tomó el líder del frontend y quedan para validar con el equipo. **Las 8 están implementadas en esta rama**, con su migración idempotente en `database/` (sirve para bases nuevas y para las ya creadas) y sus pruebas contra PostgreSQL en `backend/tests/base_datos/test_decisiones.py` y `backend/tests/almacenamiento/test_almacen.py`.

Resultado tras implementarlas: backend con 86 pruebas en PostgreSQL y 44 en SQLite; frontend con 150 en vitest, más `typecheck`, `lint` y `build` en verde.

Efecto visible: el gasto ejecutado ahora sale de los movimientos reales. Con el seed actual, QUI-024 marca 72,50 (un despacho de 5 × 14,50); antes figuraban 3.200, un número escrito a mano en `seeders.sql`.

| # | Tema | Decisión | Qué cambia |
|---|---|---|---|
| 1 | Reservas canceladas (D1) | Agregar `Cancelado` al enum | `ALTER TYPE app.workflow_status ADD VALUE 'Cancelado'`. Se distingue "lo canceló el mantenimiento" de "lo rechazó el aprobador". |
| 2 | Choque de reservas (D2) | Solo bloquean `Pendiente de Aprobación` y `Aprobado` | Se ajusta el `WHERE` del EXCLUDE en `02_constraints_triggers.sql`; el código de M4 ya usa esos dos estados. |
| 3 | Correcciones de despacho (D3) | Cantidad siempre positiva + sentido + columna calculada con signo | Se agrega `direction` en `dispatches` (`salida` o `devolucion`). `dispatched_quantity` se mantiene con `CHECK > 0`. Se agrega `signed_quantity GENERATED ALWAYS AS (CASE direction WHEN 'devolucion' THEN -dispatched_quantity ELSE dispatched_quantity END) STORED`. Los reportes suman `signed_quantity`. Hay que cambiar M6 (`almacen/service.py`) y su prueba, que hoy espera −10. |
| 4 | A quién se carga una solicitud (D5) | Centro de costo: `proyecto` o `general` | Se agrega `cost_center` en `requests`, con `CHECK ((cost_center = 'proyecto') = (project_id IS NOT NULL))`. La reposición automática va como `general` y se reparte en el cierre (RN-02, M7). Se elimina el proyecto falso `GEN-001` de `inventario/service.py`. |
| 5 | Presupuesto ejecutado (D6) | Fuente única: vista SQL desde los movimientos | La vista `app.v_project_spend` suma despachos (`signed_quantity × costo`), gastos ejecutados y el reparto. M2, M6 y M7 dejan de escribir en `executed_budget` y los GET dejan de hacer commit. Si algún día la consulta pesa, se pasa a una columna mantenida por un trigger de la BD. |
| 6 | Avisos internos (D7) | Tabla `app.notifications` | Guarda destinatario, tipo, título, detalle, enlace, `leido` y fecha. Cada evento inserta su aviso en la misma transacción: decisión de una solicitud o reserva, cancelación por mantenimiento, apertura y cierre de período, y recordatorio de confirmación. |
| 7 | Cotización de gastos (M5) | Supabase Storage | El endpoint de carga es multipart. La BD guarda solo la ruta del archivo y el backend entrega enlaces firmados de corta duración. El formulario de solicitud debe enviar el archivo con `FormData`. |
| 8 | Identificador de proyecto en la API | UUID | Las rutas de M2 se mantienen por `id`. El frontend debe dejar de usar el código en las URLs y los enlaces: rutas `/proyectos/:codigo`, `enlace` de la búsqueda, inicio, bitácora y priorización. Las respuestas deben incluir `id` junto a `codigo`. |

Notas de implementación:
- **Avisos.** `app/avisos/service.py::avisar()` se llama dentro de la transacción del evento. Hoy crean avisos:
  - decidir una solicitud (aprobar, rechazar, ejecutar);
  - decidir una reserva o cancelarla por mantenimiento;
  - revisar una corrección de despacho;
  - abrir un período (aviso a cada coordinador con cargos);
  - generar una reposición automática (aviso a los aprobadores).
- **Cotización.** Router `app/modulos/solicitudes/cotizacion.py`. El almacenamiento está en `app/almacenamiento/service.py`: con `STORAGE_BACKEND=local` usa disco en desarrollo y con `supabase` usa Supabase Storage (bucket privado y clave de servicio solo en el servidor). El backend entrega el PDF él mismo, en vez de redirigir a un enlace firmado: así no depende del CORS de Supabase y conserva el control de permisos. `enlace_firmado()` queda disponible por si se necesita.
- **Frontend.**
  - Rutas `/proyectos/:id`; `proyectoId` en cuerpos y filtros.
  - `api.subir()` para multipart.
  - El formulario de gasto sube el PDF; si la solicitud aún no existe, primero guarda el borrador.
  - `Impacto.proyectos[]` trae `id`, así que "Asignarle otro coordinador" lleva directo al proyecto.

## 7. Cómo se conectó (patrón para M2–M8)

Se usa *contract-first*. El backend es dueño del contrato y tiene una capa de presentación pensada para el frontend (patrón BFF dentro de FastAPI):

- **Especificación:** los handlers MSW (`frontend/src/testing/mocks/handlers/*.ts`), que modelan las pantallas aprobadas.
- **Routers:** cada módulo tiene un router que cumple esa especificación y reutiliza los `service.py` y modelos existentes.
- **Base común** en `backend/app/core/api.py`:
  - `ModeloApi`, que serializa en camelCase.
  - El mapeo de roles.
  - `conflicto()` para los 409 con datos.
  - `ErrorValidacion` y el manejador de 422 en español.
  - La conversión de un id inválido en 404.
- **Tipos:** `npm run api:tipos` (con el backend en :8000) genera `frontend/src/types/api.generated.ts` desde el OpenAPI. `frontend/src/types/contrato.ts` exige que los tipos escritos a mano coincidan con los del backend; si alguien cambia un campo de un lado, `typecheck` falla.
- **Pruebas:** cada router nuevo lleva su `test_contrato.py` contra PostgreSQL.

Orden sugerido: proyectos → inventario → solicitudes y bandeja → equipos y reservas → almacén → gastos compartidos → reportes, búsqueda y dashboard. Al conectar cada módulo se retiran sus rutas viejas en snake_case, como se hizo con `/auth/login`, `/auth/me`, `/users`, `/locations` y `/system-parameters`.

## 8. Cómo reproducir

```bash
# PostgreSQL 17 con el esquema real
docker run -d --name cpq-db -e POSTGRES_DB=control_proyectos -e POSTGRES_USER=cpq -e POSTGRES_PASSWORD=<clave> -p 5432:5432 postgres:17
docker cp database cpq-db:/r/database
docker exec -w /r cpq-db psql -U cpq -d control_proyectos -f database/01_schema.sql
docker exec -w /r cpq-db psql -U cpq -d control_proyectos -f database/03_seed.sql

# Backend
cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m pytest                                    # SQLite (las pg_* se saltan)
TEST_DATABASE_URL=postgresql+psycopg://cpq:<clave>@localhost:5432/cpq_test .venv/Scripts/python -m pytest
DATABASE_URL=postgresql+psycopg://cpq:<clave>@localhost:5432/control_proyectos .venv/Scripts/python -m uvicorn app.main:app --port 8000

# Frontend contra el backend real (sin mocks)
cd frontend && npm run dev          # http://localhost:5173 · usuarios demo: README §13 (contraseña Demo2026*)
npm run api:tipos                   # regenera los tipos cuando cambie el backend
```
