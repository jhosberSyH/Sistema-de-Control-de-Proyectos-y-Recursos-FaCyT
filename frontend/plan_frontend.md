# Plan de desarrollo del frontend

## Contexto

Ya están aprobados el stack (README §6), la estructura de carpetas (README §8) y los 25 mockups de la versión E (`docs/mockups/`). Falta construir el frontend. Por ahora no hay backend, así que la app va a funcionar con datos ficticios (mock). Esos datos no pueden vivir en los componentes ni en las vistas: tienen que estar aparte y poder encenderse o apagarse con una variable de entorno. El día que llegue el backend, se apagan los mocks y la app sigue igual.

**Estado:** plan aprobado el 28/10/2026. El prompt que lo originó es el n.º 7 de [`prompts/PROMPTS.md`](../prompts/PROMPTS.md).

Se construye vista por vista. Después de cada paso se explica cómo probarlo y se espera la validación del equipo antes de seguir. No se hacen commits ni push desde la sesión de desarrollo.

---

## 1. Investigación: cómo manejar datos mock en React + Vite + TanStack Query

### Lo que hacen los proyectos serios

- **bulletproof-react**, la guía de estructura que ya seguimos (README §8), usa **Mock Service Worker (MSW)**:
  - Los mocks viven en `src/testing/mocks/`, con `handlers/` por módulo, `db.ts`, `browser.ts`, `server.ts` y `utils.ts`.
  - Un `enableMocking()` se ejecuta en `main.tsx` antes de pintar la app y solo carga los mocks si `VITE_APP_ENABLE_API_MOCKING=true`.
  - La base en memoria se arma con `@mswjs/data`.
  - Su documentación justifica MSW porque permite construir el frontend "sin esperar al backend ni escribir datos fijos en la app", haciendo llamadas HTTP reales.
- **La documentación oficial de MSW**:
  - Recomienda cargar el worker con un `import()` dinámico, condicionado por el entorno.
  - Pide esperar `worker.start()` antes de pintar la app, porque si no, las primeras peticiones se escapan.
  - Para APIs grandes, sugiere agrupar los handlers por dominio, dejar los "caminos felices" como base y sobrescribir los casos especiales con `use()`.
- **Vite**:
  - Solo expone al navegador las variables que empiezan con `VITE_`.
  - Las reemplaza por su valor al compilar, así que el código que queda detrás de un `if` falso se elimina del build.
  - Todas son cadenas de texto, así que hay que comparar con `=== 'true'`.
  - Los archivos `.env.[modo]` se cargan con `--mode`.
- **MSW 3** (versión actual en npm: 3.0.3, que pide Node ≥ 22.12; tenemos Node 24) incluye un plugin oficial para Vite que sirve el script del worker desde el paquete instalado.
- **Kent C. Dodds** ("Stop mocking fetch") y otros autores recomiendan interceptar a nivel de red en lugar de simular `fetch`, porque la app "no sabe" que hay un mock.
- **La guía de pruebas de TanStack Query** usa `nock` en sus ejemplos y menciona MSW como alternativa. Como MSW sirve tanto en el navegador como en Node, un solo juego de mocks cubre las dos cosas.

### Recomendación: MSW + `@msw/data`, activado con `VITE_ENABLE_API_MOCKING`

**Por qué:**
1. **Ningún componente sabe que existen mocks.**
   - El cliente HTTP llama a `/api/...` igual que lo hará con FastAPI.
   - El Service Worker responde en el navegador. Apagarlo no exige tocar código: las mismas peticiones van a Nginx y al backend.
2. **Se elimina del build de producción.**
   - Con la variable apagada, Vite borra el `import()` dinámico y nada del mock llega al bundle.
3. **Los mismos handlers sirven para Vitest**, con `setupServer` (README §6: pruebas con Vitest).
4. **Los handlers dejan escrito el contrato de la API** (rutas, cuerpos, errores) que después implementará FastAPI.
5. **Es la herramienta con más mantenimiento activo.** Mirage JS lleva unos dos años sin publicar versiones.
6. **Hace lo mismo que nuestra guía de referencia**, bulletproof-react, así que el equipo puede defenderlo (RNF-08).

**Alternativa: una capa de repositorio con dos implementaciones** (patrón *Service Stub* de Fowler)
- Cada módulo expone una interfaz (`proyectosRepo.listar()`, etc.) con dos versiones: `http` y `memoria`. Una fábrica elige cuál usar según `VITE_ENABLE_API_MOCKING`.
- A favor: no depende de un Service Worker y es más fácil de depurar con puntos de interrupción.
- En contra:
  - No ejercita el cliente HTTP real (CSRF, errores 4xx, serialización).
  - Duplica código por módulo.
  - El contrato HTTP no queda escrito en ningún lado.

**Descartadas:**
- **json-server:** es un proceso aparte y genera rutas automáticas que no reflejan las reglas, como el flujo de RN-03.
- **Mirage JS:** parcha `fetch`, no corre en Node y su mantenimiento está detenido.

### Fuentes

- MSW, integración en el navegador: https://mswjs.io/docs/integrations/browser
- MSW, cómo estructurar los handlers: https://mswjs.io/docs/best-practices/structuring-handlers
- MSW, comparación con Mirage, json-server y nock: https://mswjs.io/docs/comparison
- MSW 3.0.0, notas de la versión (plugin de Vite): https://newreleases.io/project/npm/msw/release/3.0.0
- `@msw/data`: https://github.com/mswjs/data
- bulletproof-react, mocks: https://github.com/alan2207/bulletproof-react/tree/master/apps/react-vite/src/testing/mocks
- bulletproof-react, `.env.example`: https://github.com/alan2207/bulletproof-react/blob/master/apps/react-vite/.env.example
- bulletproof-react, pruebas y MSW: https://github.com/alan2207/bulletproof-react/blob/master/docs/testing.md
- Vite, variables y modos: https://vite.dev/guide/env-and-mode
- TanStack Query, guía de pruebas: https://tanstack.com/query/latest/docs/framework/react/guides/testing
- Fowler, Service Stub: https://martinfowler.com/eaaCatalog/serviceStub.html
- Kent C. Dodds, "Stop mocking fetch", citado en: https://dev.to/epilot/testing-react-with-jest-and-openapi-mocks-8gc
- npm-compare, actividad de msw y miragejs: https://npm-compare.com/axios-mock-adapter,faker,json-server,miragejs,msw,nock

---

## 2. Cómo se organizan los mocks

Van en `frontend/src/testing/mocks/`. El README §8 ya asigna a `src/testing/` los datos de prueba.

```
src/testing/mocks/
├── index.ts          enableMocking(): si VITE_ENABLE_API_MOCKING === 'true', import() de browser y db, siembra y worker.start()
├── browser.ts        setupWorker(...handlers)             (navegador)
├── server.ts         setupServer(...handlers)             (Vitest)
├── db.ts             colecciones de @msw/data con esquemas Zod + sembrar() + reiniciar()
├── utils.ts          sesión simulada, exigirRol(), alcance RN-07, demora(), error() con forma FastAPI {detail}
├── datos/            semilla por módulo, coherente con el seed del README §13
│   ├── usuarios.ts   admin@cpq.local, coord.quimica|biologia|fisica@cpq.local, aprobador@cpq.local (Demo2026*)
│   ├── proyectos.ts  QUI-024, BIO-…, FIS-… con los 4 estatus y las 4 prioridades, hitos y cargas
│   ├── inventario.ts insumos de los 3 tipos, lotes (uno vencido, uno próximo a vencer, uno bajo el mínimo)
│   ├── equipos.ts    equipos en los 3 estados, reservas (incluida una que choca), usos
│   ├── solicitudes.ts solicitudes en los 5 estados, una reposición automática, correcciones
│   ├── almacen.ts    despachos de la bitácora (historial de 6 meses o más para el pronóstico)
│   ├── cierre.ts     período de octubre en revisión, cargos, confirmaciones
│   └── auditoria.ts  eventos de ejemplo
└── handlers/         un archivo por módulo, más index.ts que los junta
    ├── autenticacion.ts  usuarios.ts  proyectos.ts  inventario.ts  equipos.ts
    ├── solicitudes.ts    almacen.ts   prorrateo.ts  reportes.ts    auditoria.ts
    └── index.ts
```

**Reglas:**
- **Los estados de los mockups salen de los datos, no de banderas.** Por ejemplo:
  - Error de inicio de sesión: contraseña mal escrita.
  - Choque de reservas: elegir un horario ocupado.
  - Lote vencido: poner una fecha pasada.
  - Código repetido: usar `QUI-024`.
- **Los handlers aplican las reglas que después aplicará el backend**, para que la UI muestre los mismos errores:
  - RN-03 (transiciones válidas; "Rechazado" es final).
  - RN-04 (justificación obligatoria).
  - RN-07 (el Coordinador solo ve sus proyectos).
  - RN-06 (no hay PUT ni DELETE en la bitácora ni en la auditoría).
  - Duplicados, solapes de período y de reserva.
  - Cada mutación agrega un evento a la auditoría simulada.
- **Errores con la forma de FastAPI:** `422 {detail:[{loc, msg}]}` para la validación por campo y `409 {detail}` para los conflictos.
- **Persistencia:** en memoria. Los cambios se mantienen mientras navegas y recargar la página vuelve a la semilla, así cada prueba arranca desde el mismo punto.
- **Demora simulada** de 300 a 600 ms, para que se vean los estados de carga.
- **Sesión simulada:** el handler de `/api/auth/iniciar-sesion` guarda el usuario en la base en memoria y lo copia en `sessionStorage`, para no cerrar la sesión al recargar. `/api/auth/sesion` lo devuelve y `/api/auth/cerrar-sesion` lo borra. El cliente envía `X-CSRF-Token` igual que en producción.

---

## 3. Cómo se activan y desactivan

| Archivo | Contenido | ¿Va a git? |
|---|---|---|
| `frontend/.env.example` | `VITE_ENABLE_API_MOCKING=false`, con un comentario | sí (ya lo permite `.gitignore`) |
| `frontend/.env.mock` | `VITE_ENABLE_API_MOCKING=true` | sí: agrego `!frontend/.env.mock` a `.gitignore`, porque `.env.*` está ignorado |
| `frontend/.env.mock.local` | cambios personales | no |

| Comando | Qué hace |
|---|---|
| `npm run dev:mock` | `vite --mode mock`: mocks encendidos (el que usaremos mientras no haya backend) |
| `npm run dev` | modo `development`, mocks apagados: `/api` va por el proxy de Vite al backend en `:8000` (README §12) |
| `npm run build` | build de producción, sin mocks (se verifica con un `grep` de `msw` en `dist/`) |
| `npm run build:mock` | build de demostración con mocks, opcional, por si hay que mostrar la app sin backend |

`src/vite-env.d.ts` declara `VITE_ENABLE_API_MOCKING` en `ImportMetaEnv`. `main.tsx` queda así:

```ts
enableMocking().then(() => createRoot(root).render(<App />))
```

Con la variable apagada, `enableMocking()` no hace nada. Al conectar el backend real basta con usar `npm run dev` o el build de Docker.

---

## 4. Cómo se conecta la UI con los datos (igual con mock o con backend)

- **`src/lib/api-client.ts`:** envoltorio de `fetch`.
  - Base `/api`, `credentials: 'same-origin'`.
  - Encabezado `X-CSRF-Token` en POST, PUT, PATCH y DELETE.
  - Convierte las respuestas de error en un `ApiError` con `status`, `detail` y los errores por campo.
- **`src/lib/query-client.ts`:** el `QueryClient` de TanStack Query.
- **Cada módulo** (`src/modulos/<módulo>/`) tiene:
  - `api/`: funciones de fetch y hooks `useX` y `useCrearX`, que invalidan las consultas afectadas. Por ejemplo, un despacho invalida el stock y la bitácora (RNF-10).
  - `schemas/`: Zod, usado por React Hook Form y para validar las respuestas.
  - `types/`.
  - `components/`.
- **Los formularios** muestran en su campo los errores 422 que devuelve el servidor (patrón `.campo.error` + `p.msg-error` con `aria-describedby`).
- **Los módulos no se importan entre sí.** Las páginas de `src/app/routes/` los combinan (bulletproof-react).
- **El frontend solo oculta lo que el rol no puede usar.** La autorización real vive en los handlers ahora y en el backend después.

---

## 5. Base técnica y componentes compartidos (antes de las vistas)

### Paso 0. Base técnica

**Proyecto y configuración**
- Vite 8 + React 19 + TypeScript + React Router. Verifico las versiones exactas al instalar.
- Tailwind CSS 4.
- `shadcn init` con `components.json` y el alias `@`.
- TanStack Query, React Hook Form + Zod, Recharts, FullCalendar (núcleo MIT), MSW 3 y `@msw/data`.
- ESLint + Prettier.
- Vitest + Testing Library, con `src/testing/setup.ts` levantando `server.ts`.

**Tokens**
- Paso las variables de `.mk` en `docs/mockups/_fuente/compartido/comun.css` (L69-102) a `src/index.css`:
  - colores claro y oscuro, radios 4/8/10/14, foco, alturas de 44 y 36 px;
  - registradas en `@theme` de Tailwind;
  - las variables de shadcn (`--background`, `--primary`…) apuntan a estos tokens.
- **Tema:** el del sistema por defecto, con `data-theme="light|dark"` en `<html>`, igual que en el mockup. El selector Sistema/Claro/Oscuro guarda la elección en `localStorage`.

**Fuentes, íconos y logos**
- **Fuentes:** IBM Plex Sans (400/500/600/700) y Plex Mono (400/500) en woff2, solo el subconjunto latino, servidas desde el propio sitio con `@fontsource`.
- **Íconos:** porto los 29 SVG de `comun.js` (L4-34) a `src/components/icono.tsx` (sprite + `<Icono nombre="…">`), con el mismo trazo de 1.75. No uso Lucide, para quedar idéntico al mockup.
- **Logos:** copio sin modificar `escudo-uc.jpg`, `facyt-isotipo.png` y `facyt-logo.png` desde `docs/identidad-visual/logos/` a `src/assets/logos/`. El favicon va a `public/`.

**App y proxy**
- `src/app/provider.tsx` (QueryClient, tema, sesión), `src/app/router.tsx` (rutas perezosas) y `src/app/routes/`.
- `vite.config.ts`: alias `@` y proxy de `/api` a `http://localhost:8000` (README §12).

### Paso 1. Componentes compartidos (`src/components/` y `src/components/ui/`)

Cada componente reproduce la clase del mockup indicada. Las referencias son a `docs/mockups/_fuente/compartido/app.css` y `comun.css`.

**Marco de la app** (`components/layout/`)
- **`AppShell`:** rejilla de 92 px + 1fr, enlace "Saltar al contenido" y `main#contenido[tabindex=-1]`.
- **`Riel`:** menú por rol con contadores y `aria-current`, avatar con iniciales y botón de salir. La configuración del menú se toma de `comun-app.js` L5-12.
- **`EncabezadoEditorial`:** escudo sin placa, institución y fecha, con el doble filete primario y acento.
- **`BarraSuperior`:** búsqueda, campana con contador, y hamburguesa y marca en el teléfono.
- **`CajonMovil`:** no está diseñado. Es un `Sheet` de shadcn con los ítems del riel y se usa por debajo de 760 px.
- **`PanelAvisos`:** no está diseñado. Es un `Popover` que lista los avisos con el mismo estilo de `ul.pend`.
- **`SelectorTema`:** no está diseñado. Va en el pie del riel y en el cajón.

**Encabezado de página**
- **`EncabezadoPagina`:** migas en mono mayúscula, h1, subtítulo y acciones (`.cab`).

**Controles** (variantes de shadcn con los estilos del mockup)
- `Boton`: primario, secundario, texto, peligro, chico e ícono.
- `Campo`: etiqueta, ayuda y error con ícono, con `aria-invalid` y `aria-describedby`.
- `Entrada`, `Selector`, `AreaTexto`, `EntradaPrefijo`, `EntradaSufijo` y `Clave` (mostrar u ocultar).
- `OpcionesTarjeta` (`.radios`) y `OpcionGrande` (`.tipo-r`).

**Estado y prioridad**
- `ChipEstado`: ok, warn, err, info y neutro, con un mapa por dominio (proyecto, solicitud, reserva, equipo, inventario, cuenta, cierre y auditoría).
- `ChipPrioridad` y `ChipRol`.

**Contenedores**
- `Aviso`: info, warn, err y ok.
- `Tarjeta` y `Bloque`, con cabecera mono.
- `Kpi`, con las variantes cont, kpi expandible, met, res y cifras.

**Tablas y filtros**
- `TablaDatos`: cabecera mono, columnas numéricas tabulares, `caption`, y en el teléfono pasa a tarjetas usando `data-e`.
- `BarraHerramientas` (`.herr`).
- `Segmentos`: botones de filtro con contador y `aria-pressed`.
- `Paginacion`.

**Navegación interna**
- `Pestanas` (`.pestanas`) y `Pasos` (stepper de la vista 22).

**Diálogos**
- `Dialogo` y `DialogoAlerta`, con el velo y el filete superior de 4 px.

**Datos y progreso**
- `BarraProgreso` y `MiniBarra`.
- `ListaClaveValor` (`dl.kv`), `AntesDespues` (`.comparar`) y `LineaTiempo`.

**Estados de la vista**
- **`EstadoVacio`** (`.vacio`).
- **`Cargando`:** no está diseñado. Esqueletos con el color `surface-2`.
- **`ErrorCarga`:** no está diseñado. Un `Aviso` err con "Reintentar".
- **Páginas 404 y "Sin permiso":** no están diseñadas. Usan el marco de la app, `EstadoVacio` y un enlace a Inicio.

**Gráficos**
- **`GraficoBarras` y `GraficoColumnas`:** Recharts con el aspecto del mockup. Llevan una sola serie en primario, línea de referencia, columna rayada con `<pattern>`, tooltip que se cierra con Escape y botón "Ver como tabla" con `aria-expanded`.

**Utilidades**
- **Formatos (`lib/formato.ts`):** moneda en US$, números con coma decimal (es-VE), fechas en America/Caracas y los textos de fecha del encabezado.
- **Sesión y permisos:** `useSesion`, `RutaProtegida` (por rol) y `usePuede(accion)`.

**El éxito siempre se muestra en línea**, como en los mockups (`.aviso.ok`, tarjetas `.exito`, `.confirmado` y `.hecho`). No uso toasts, porque ningún mockup los tiene.

---

## 6. Orden de construcción, rutas y requisitos de cada vista

Los mockups 01 a 25 están en `docs/mockups/NN-*/index.html`. Los pasos van en el orden del trabajo real: primero el acceso, luego los catálogos que crean los datos base, después la operación diaria, el cierre del período y por último las vistas que agregan datos de las demás (auditoría y dashboard). Las vistas que todavía no existan se muestran como "Vista en construcción".

| Paso | Vista (mockup) | Ruta | Módulo | Rol | Funcionalidades | RF / IA | RN |
|---|---|---|---|---|---|---|---|
| 0–1 | Base, componentes y marco (más cajón, avisos, tema, 404 y sin permiso) | — | `components/`, `app/` | todos | — | RF-01 a RF-10 (menú por rol), RNF-03 | RN-07 |
| 2 | 01 Inicio de sesión | `/iniciar-sesion` | autenticacion | todos | (F1.3: solo cuentas activas) | RF-01 | RN-01 |
| 3 | 02 Inicio por rol | `/inicio` | `app/routes` (combina varios módulos) | los 3 | — | RF-01 a RF-10 | RN-07 |
| 4 | 04 Usuarios | `/usuarios` | usuarios | Adm. | F1.1, F1.2, F1.3 | RF-01 | RN-01, RN-06 |
| 5 | 05 Ubicaciones y parámetros | `/ubicaciones-parametros` | usuarios | Adm. | F1.4, F1.5 | RF-02, RF-03 | — |
| 6 | 06 Proyectos | `/proyectos` | proyectos | Adm. | F2.1, F2.2 (muestra F2.6 y F2.7) | RF-05 a RF-07, RF-11 a RF-16 | RN-07 |
| 7 | 07 Ficha de proyecto | `/proyectos/:id` | proyectos | Adm., Coord. | F2.2 a F2.7 | RF-05, RF-13, RF-15, RF-16 | RN-05, RN-07 |
| 8 | 08 Plan de hitos y avance | `/proyectos/:id/plan` | proyectos | Coord. | F2.4, F2.5 (y F2.6) | RF-05, RF-15 | RN-07 |
| 9 | 09 Inventario, más la entrada de solo consulta del Coord. | `/inventario` | inventario | Aprob., Adm., Coord. | F3.1 a F3.6 | RF-03, RF-17 a RF-19, RF-36, RF-37 | RN-02, RN-03 |
| 10 | 10 Ficha de insumo ("Cambiar stock mínimo" solo para Adm.) | `/inventario/:id` | inventario | Aprob., Adm. | F3.2 a F3.7 | RF-18, RF-19, RF-36, RF-37, IA-01 | RN-03 |
| 11 | 11 Catálogo de equipos | `/equipos` | equipos | Adm. | F4.1, F4.2 | RF-03, RF-21 | — |
| 12 | 12 Reservas, más el calendario de consulta del Aprob. | `/reservas` | equipos | Coord., Aprob. | F4.3, F4.4 | RF-22, RF-29 | RN-03, RN-07 |
| 13 | 13 Uso de equipo | `/reservas/uso` | equipos | Coord. | F4.6, F8.4 | RF-06, RF-21, RF-33 | RN-07 |
| 14 | 14 Mis solicitudes | `/solicitudes` | solicitudes | Coord. | F5.1, F5.2, F5.3 | RF-07, RF-29 | RN-03, RN-07 |
| 15 | 15 Bandeja de aprobación, más "Aprobadas por ejecutar" (F5.5) | `/bandeja` | solicitudes | Aprob. | F3.5, F4.5, F5.4, **F5.5**, F6.6 | RF-08, RF-22, RF-29, RF-35, RF-37, IA-01 | RN-03, RN-06 |
| 16 | 16 Priorización | `/priorizacion` | solicitudes | Aprob. | F5.6, F5.7 | RF-10, RF-28, RF-34 | RN-04, RN-07 |
| 17 | 17 Recepción de lote, más la entrada de Almacén | `/almacen`, `/almacen/recepcion` | almacen | Aprob. | F6.1 (y F3.3) | RF-09, RF-18, RF-20, RF-36 | RN-02 |
| 18 | 18 Despacho | `/almacen/despacho` | almacen | Aprob. | F6.2, F6.3 | RF-09, RF-18, RF-23, RF-29, RF-36 | RN-03, RN-06 |
| 19 | 19 Bitácora y corrección | `/proyectos/bitacora` | almacen | Coord. | F6.3, F6.5 | RF-23, RF-35 | RN-06, RN-07 |
| 20 | 20 Uso de materia prima | `/proyectos/uso-materia-prima` | almacen | Coord. | F6.4 | RF-06 | RN-07 |
| 21 | 21 Revisión de cargos | `/cierre/cargos` | prorrateo | Coord. | F7.1 (y F6.5) | RF-35, RF-38 | RN-07 |
| 22 | 22 Cierre de período | `/gastos-compartidos/cierre` | prorrateo | Aprob. | F7.1, F7.2 | RF-24, RF-38 | — |
| 23 | 23 Reparto de gastos compartidos | `/gastos-compartidos/reparto` | prorrateo | Aprob. | F7.3, F7.4 | RF-25, RF-26, RF-27 | RN-02, RN-05 |
| 24 | 24 Reportes | `/reportes` | reportes | Coord., Aprob., Adm. | F8.2, F8.3, F8.4 | RF-31, RF-32, RF-33 | RN-07 |
| 25 | 25 Auditoría | `/auditoria` | reportes | Adm. | F8.5, F8.6 | RF-04, RF-34 | RN-06 |
| 26 | 03 Dashboard ejecutivo | `/dashboard` | reportes | Adm. | F8.1 (más alertas de F3.4/F3.6 y F2.7) | RF-30 (más RF-16, RF-19, RF-36) | RN-05 |

**Cobertura:**
- Con estas 26 vistas quedan cubiertos todos los RF-01 a RF-38 e IA-01.
- Lo que antes faltaba ahora tiene lugar: F5.5 va en el paso 15; F3.2 se corrige en el paso 10, siguiendo el documento.

**Reportes (RF-31 a RF-33):** los mocks devuelven un PDF y un Excel de muestra, fijos, para probar la descarga. El contenido real lo generará el backend.

**Puntos por confirmar que afectan a la UI.** Se implementan como dice el mockup y quedan marcados en el código con `// SP-xx`:
- SP-06: uso de equipo sin reserva.
- SP-07: si el uso de materia prima descuenta stock.
- SP-08: cerrar el período sin todas las confirmaciones (el mockup lo permite).
- SP-13: reactivar un proyecto suspendido.

### Contrato de la API que fijan los handlers (resumen)

Todo va bajo `/api`, con nombres en español como el backend (`backend/app/modulos/*`).

- **Autenticación:** `auth/iniciar-sesion`, `auth/cerrar-sesion`, `auth/sesion`.
- **Usuarios y catálogos:** `usuarios`, `usuarios/:id/rol`, `usuarios/:id/estado`, `ubicaciones`, `parametros`.
- **Proyectos:** `proyectos`, `proyectos/:id` (`/estatus`, `/coordinador`, `/hitos`, `/avances`, `/gastos`, `/historial`).
- **Inventario:** `insumos`, `insumos/:id` (`/lotes`, `/consumo`, `/pronostico`), `alertas/inventario`.
- **Equipos:** `equipos` (`/:id/mantenimiento`), `reservas`, `usos-equipo`.
- **Solicitudes:** `solicitudes` (`/:id/enviar|aprobar|rechazar|ejecutar`), `bandeja`, `prioridades` (`/proyectos/:id/prioridad`, con justificación).
- **Almacén:** `lotes` (recepción), `despachos`, `bitacora`, `correcciones`, `usos-materia-prima`.
- **Cierre y reparto:** `periodos` (`/:id/confirmaciones`, `/:id/cerrar`, `/:id/prorrateo`, con vista previa y `aplicar`), `cargos`.
- **Reportes y auditoría:** `reportes/:tipo?formato=pdf|xlsx`, `auditoria`, `dashboard`, `inicio`, `avisos`.

Los handlers son la referencia para el backend. Cuando FastAPI publique su OpenAPI, se puede comparar contra ellos.

---

## 7. Validación UX de las cuatro decisiones

Revisé cada decisión contra tres marcos:
- las 10 heurísticas de Nielsen (H1 a H10);
- WCAG 2.2;
- las lecciones L1 a L10 de `docs/investigacion-ux/investigacion_ux.md` (L293-302).

Las cuatro se mantienen. La revisión agregó los ajustes marcados con **→**, que pasan a ser parte del plan.

### 7.1 Piezas sin diseñar, construidas con el mismo lenguaje visual

- **Mismo lenguaje visual.** Cumple H4 (consistencia): el usuario no tiene que aprender un estilo nuevo.
- **Menú del teléfono (cajón).** Cumple H6 (reconocer en lugar de recordar), porque repite exactamente los ítems, etiquetas, íconos y contadores del riel.
  - → Atrapa el foco mientras está abierto y se cierra con Escape. Al cerrarse, el foco vuelve a la hamburguesa (WCAG 2.4.3 y 2.1.2).
  - → La hamburguesa lleva `aria-expanded` y los objetivos táctiles miden 44 px, como en el mockup (WCAG 2.5.8).
- **Panel de avisos.** Cumple H1 (estado visible) y L8 (alertas que llevan al detalle).
  - → Cada aviso es un enlace a su elemento, con la lista ya filtrada.
  - → Los avisos se marcan como leídos al abrirlos.
  - → El contador de la campana se anuncia: `aria-label="3 avisos sin leer"`.
- **Estados de carga.** Cumplen H1.
  - → Los esqueletos tienen la forma de la vista, así el contenido no salta (WCAG 2.2: estabilidad).
  - → No aparecen si la respuesta tarda menos de unos 300 ms, para evitar parpadeos.
  - → Al volver a pedir los datos se mantienen los anteriores en pantalla, sin vaciar la tabla.
  - → La zona que carga lleva `aria-busy`.
- **Errores del servidor.** Cumplen H9 (reconocer, diagnosticar y recuperarse) y L4.
  - → El mensaje dice en lenguaje claro qué pasó y qué hacer, sin códigos HTTP.
  - → Ofrece "Reintentar".
  - → Un error nunca borra lo que el usuario escribió en el formulario (H3, H5).
  - → Un conflicto (409) muestra el registro con el que choca, como ya hacen los mockups 06 y 12.
- **Páginas 404 y "Sin permiso".** Cumplen H3 (salida clara) y H9.
  - → "Sin permiso" dice qué rol puede hacer esa acción y lleva al Inicio del usuario. No muestra un mensaje técnico.
- **Selector de tema.** Cumple H7 (flexibilidad) y RNF-03.
  - → Tres opciones: Sistema, Claro y Oscuro. Se recuerda la elección.
  - → Verifico el contraste en los dos temas: 4.5:1 en texto y 3:1 en bordes y elementos gráficos (WCAG 1.4.3 y 1.4.11).
- **Mensajes de éxito en línea, sin toasts.** Cumple H4 con los mockups.
  - → Los avisos de éxito y de error que aparecen sin cambiar de página llevan `role="status"` o `role="alert"` (WCAG 4.1.3).
- **Entradas de Almacén, de Inventario del coordinador y de Reservas del aprobador.**
  - Almacén. Cumple H6: muestra las tareas del día (despachos por entregar, recepción y despacho) con sus contadores, en el formato de `ul.pend` de la vista 02.
  - Inventario del coordinador.
    - Es de solo consulta y no muestra acciones que el rol no puede usar (H8).
    - Lleva un acceso directo a "Pedir retiro", que abre la vista 14 con el insumo ya cargado (L10, capturar una vez).
  - Reservas del aprobador.
    - Muestra el mismo calendario con todas las reservas (H4).
    - Las pendientes enlazan a la bandeja, donde se aprueban, para que haya una sola forma de decidir (L2).
- **Hueco que salió de la revisión: aviso de sesión por expirar.**
  - El mockup 01 promete un aviso 2 minutos antes del cierre por inactividad.
  - WCAG 2.2.1 (tiempo ajustable) exige avisar y dejar extender la sesión.
  - → Lo agrego al marco en el paso 1: un `DialogoAlerta` con el tiempo que queda y el botón "Seguir trabajando". El borrador del formulario se conserva.

### 7.2 F5.5 como acción dentro de la bandeja

- **Lugar.** Cumple L8 (pendientes por rol) y H6: el Aprobador ya trabaja en la bandeja, así que no tiene que recordar otra pantalla.
- **Separación.** → Va en un segmento propio, "Por ejecutar (n)", separado de "Por decidir", para no mezclar dos tipos de trabajo (H8). El contador del riel suma los dos.
- **Nombres.** Cumple H2 y H4:
  - → El botón se llama "Marcar como ejecutada", porque el chip de estado dice "Ejecutado" y la acción debe nombrar el estado al que lleva.
  - → El campo se llama "Monto real pagado (US$)".
- **Prevención de errores.** Cumple H5 y L2.
  - → El monto es obligatorio y mayor que 0.
  - → Junto al campo se ve el monto estimado. Si la diferencia es grande, aparece un aviso warn, sin bloquear (el mismo patrón de la vista 20).
  - → "Ejecutado" es final (RN-03), así que pide una confirmación con el resumen antes de guardar.
- **Resultado visible.** Cumple H1.
  - → Al terminar muestra el `aviso.ok` y pasa al siguiente pedido, igual que con aprobar y rechazar.

### 7.3 F3.2: el documento gana (solo el Administrador cambia el stock mínimo)

- **Consistencia.** Cumple H4 con la matriz de roles (D3), así el usuario no descubre permisos distintos en cada pantalla.
- **El Aprobador sigue viendo el mínimo.** Cumple H6 y H10: lo necesita para decidir la reposición.
  - → En lugar de un botón desactivado sin explicación, se ve el valor con la nota "Lo define el Administrador del Sistema". Así sabe por qué no puede cambiarlo y a quién pedírselo.
- **Fidelidad.** El cambio respecto al mockup es mínimo: solo desaparece un botón. Para el Administrador, la ficha queda igual al mockup.

### 7.4 Recharts configurado para verse como el mockup

- **Consistencia y diseño.** Cumple H4 con el stack y H8, con una sola serie en el color primario (criterio de la vista 03).
- **Accesibilidad.** Los gráficos en SVG no son accesibles por sí solos.
  - → Se mantiene "Ver como tabla" con `aria-expanded` en cada gráfico (WCAG 1.1.1).
  - → Se deja activa la `accessibilityLayer` de Recharts 3, que viene así por defecto, para recorrer el gráfico con el teclado y ver el tooltip con el foco. El tooltip se cierra con Escape, como en el mockup (WCAG 1.4.13).
- **No depender solo del color** (WCAG 1.4.1):
  - → El mes en curso va rayado y además etiquetado "en curso".
  - → La ejecución mayor que 100 % lleva el ícono de alerta.
  - → La línea de referencia se rotula "100 %".
  - → El pronóstico va rayado y con su intervalo.
- **Movimiento.**
  - → Se desactivan las animaciones (`isAnimationActive={false}`). El mockup no tiene transiciones y así también se respeta `prefers-reduced-motion`.

**Fuentes de esta validación:**
- Nielsen Norman Group, 10 heurísticas: https://www.nngroup.com/articles/ten-usability-heuristics/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Recharts 3.0.0, `accessibilityLayer` activa por defecto: https://newreleases.io/project/npm/recharts/release/3.0.0
- Lecciones L1 a L10: `docs/investigacion-ux/investigacion_ux.md`

---

## 8. Cómo se valida cada paso

Al terminar cada vista te entrego:
1. **Cómo probarla:**
   - `cd frontend && npm run dev:mock`
   - El usuario de prueba con el que entrar.
   - La ruta.
   - Los pasos para recorrer cada estado que muestra el comparador del mockup. Por ejemplo, en Reservas: horario libre, choque y equipo en mantenimiento.
2. **Fidelidad con el mockup:** comparo la vista con `docs/mockups/NN-*/index.html` a 1280 px y a 390 px, en tema claro y oscuro (con Claude in Chrome, si está disponible) y te digo cualquier diferencia que quede.
3. **Pruebas:**
   - `npm run lint`, `npm run typecheck` y `npm run test`, con al menos una prueba de Vitest y Testing Library del flujo principal de la vista sobre los mismos handlers de MSW.
   - En el paso 0, además: `npm run build` y comprobar que `dist/` no contiene `msw`.
4. **Espero tu validación** antes de pasar a la siguiente vista. No hago commits ni push.

## Archivos clave

**Se crean:**
- `frontend/package.json`, `vite.config.ts`, `tsconfig*.json`, `components.json`, `eslint.config.js`, `.prettierrc`, `index.html`.
- `frontend/.env.example` y `frontend/.env.mock`.
- `frontend/src/main.tsx`, `src/index.css` (tokens), `src/vite-env.d.ts`.
- `frontend/src/app/` (provider, router, routes), `src/components/` y `src/components/ui/`, `src/lib/` (api-client, query-client, formato, utils).
- `frontend/src/modulos/*/` y `frontend/src/testing/` (setup y mocks).

**Se modifican:**
- `.gitignore`: se agrega la excepción `!frontend/.env.mock`.
- `prompts/PROMPTS.md`: se registra el prompt 7.

**Referencias que se reutilizan tal cual:**
- `docs/mockups/_fuente/compartido/comun.css` y `app.css`: tokens y estilos.
- `comun.js`: íconos.
- `comun-app.js`: menú por rol.
- `docs/identidad-visual/logos/`: logos.

---

## 9. Bitácora de avance

### Pasos 0, 1 y 2: base, componentes compartidos, marco e inicio de sesión (28/10/2026)

Se entregaron juntos porque el marco de la app solo se puede ver con una sesión abierta.

**Hecho**
- Base técnica:
  - React 19.3, Vite 8.3, React Router 8.5, TanStack Query 5, React Hook Form 7 con Zod 4, Tailwind 4.3, Radix (`radix-ui`), MSW 3.0.3 y `@msw/data` 1.1.
  - Vitest 5, ESLint 10 y Prettier.
  - Fuentes IBM Plex autoalojadas.
  - Logos copiados sin modificar.
- CSS de los mockups:
  - `src/components/estilos/tokens.css`, `comun.css` y `app.css` son copias literales de `docs/mockups/_fuente/compartido`.
  - Tailwind se carga sin su reset, para que la app quede idéntica.
  - La clase `.mk` va en `<body>`, así funcionan igual que en el mockup.
- Componentes compartidos en `src/components/ui`:
  - botón, campo con error y ayuda, contraseña, prefijo US$, chips de estado y prioridad, aviso, tarjeta y bloque;
  - encabezado de página, diálogo y confirmación, tabla y paginación, pestañas, opciones tipo tarjeta, barras de progreso;
  - listas (pendientes, simple, clave-valor, contador) y estados vacío, carga y error.
- Marco (`src/components/layout`):
  - riel por rol con contadores;
  - encabezado editorial con la fecha y el cierre del período;
  - barra con búsqueda y avisos;
  - cajón del teléfono, selector de tema y aviso de sesión por expirar.
- Páginas: inicio de sesión (vista 01), 404, "Sin permiso", error y "Vista en construcción" para las rutas del §6.
- Mocks: autenticación, avisos, contadores del menú y período actual.
- Pruebas: 7 de Vitest sobre los mismos handlers de MSW.

**Decisiones tomadas al construir**
- **TypeScript 6.0.3 y no 7.** typescript-eslint 8 todavía exige `typescript < 6.1`.
- **Plugin de MSW para Vite** en modo `worker-only`, registrado solo cuando la variable está encendida. El build de producción se revisó: no contiene MSW ni datos de prueba.
- **Formato del contrato:** las respuestas de la API usan nombres en camelCase (FastAPI con `alias_generator=to_camel`) y los errores tienen la forma de FastAPI (`{ detail }`).
- **Riel fijo (sticky):** queda fijo al desplazarse. Arriba de la página se ve igual que en el mockup.
- **Nombres de rol:** se usan los nombres oficiales (README §3), sin flexión de género.
- **Patrones propios de una vista:** se construyen con su vista para no inventarlos antes. Son los segmentos con contador (06 y 15, cada uno con su estilo), antes y después, línea de tiempo, pasos, gráficos de Recharts y calendario.
- **Búsqueda global:** el mockup la muestra, pero ningún RF la define. Por ahora lleva a `/buscar`, que figura como "Vista en construcción".

### Ajustes pedidos sobre los pasos 0 a 2 (28/10/2026)

- **Escudo de la UC sin fondo blanco.**
  - Se generó `docs/identidad-visual/logos/uc/escudo-uc-color_980x1287_odontologia_SIN-FONDO.png` a partir del JPEG oficial, con `scripts/quitar_fondo_escudo.py`. El original no se tocó y el derivado quedó registrado en `FUENTES.md`.
  - La app y los mockups ya no ponen el escudo sobre una placa blanca. Se actualizaron `identidad_visual.md` §6, `comun.css`, `comun-app.js`, las vistas 01, 02, 03 y 24, y `construir.py`.
- **Vista "Mi perfil" (`/perfil`).**
  - No tiene mockup; se armó con el mismo lenguaje visual.
  - Muestra la cuenta (solo lectura, porque la administra el Administrador; F1.1 a F1.3), el tema y el cierre de sesión.
  - Se abre desde el avatar, a la derecha de la campana.
- **Riel y cajón del teléfono sin pie.** Se quitaron el avatar, el selector de tema y el botón de salir. Todo eso quedó en Mi perfil.
- **Etiquetas del riel.** Si no caben, se parten en vez de cortarse.
- **Revisión visual.** Desde ahora se hace con la extensión Claude in Chrome. El ancho de teléfono se revisa con Chrome sin interfaz, porque la extensión no puede achicar una ventana maximizada.

### Paso 3: Inicio por rol (vista 02) (28/10/2026)

**Hecho**
- Vista `/inicio` en `src/app/routes/inicio/`, con una variante por rol: coordinador, aprobador y administrador. Se carga bajo demanda.
- Contrato `GET /api/inicio`:
  - Devuelve datos estructurados según el rol; los textos se arman en el frontend.
  - Los tipos están en `src/app/routes/inicio/tipos.ts`.
- `POST /api/periodos/:id/recordatorios`: el botón "Enviar recordatorio" del cierre avisa a los coordinadores que no confirmaron sus cargos.
- Base mock ampliada con proyectos (los del mockup 06), solicitudes, reposiciones, correcciones, reservas, insumos, lotes, confirmaciones del período, parámetros y auditoría.
  - Las fechas de la semilla son relativas a hoy, así los vencimientos y el cierre del mes tienen sentido cualquier día.
  - Las consultas compartidas están en `src/testing/mocks/consultas.ts` y aplican RN-05 y RN-07.
- Los contadores del menú ya no son fijos: se calculan desde la base.
- Formatos nuevos: `hace`, `cuandoCorto`, `diaCorto`, `diaMes` y `saludo`. Las fechas cortas se arman a mano con dos dígitos, porque Chrome escribía "2/11".
- Pruebas: 3 nuevas, una por rol. En total pasan 10.

**Decisiones**
- **Priorización (`/priorizacion`) la abren los tres roles.** F5.6 dice que todos ven el orden y F5.7 que solo el Aprobador lo cambia. El enlace "Ver priorización" del administrador lleva ahí.
- **Las cifras salen de los datos y no del texto del mockup.** Por ejemplo, el presupuesto global ejecutado da 69 % en lugar de 72 %, y "Proyectos por prioridad" incluye BIO-015 (Alta).
- **El texto del rechazo se generalizó:** "Puedes crear una nueva solicitud con lo que faltaba". El del mockup ("…con la cotización adjunta") solo sirve para ese motivo.

### Validación de los pasos 0 a 3 antes del paso 4 (31/10/2026)

**Qué se revisó**
- Automático: TypeScript, ESLint, Prettier, 12 pruebas de Vitest (2 nuevas, del aviso de sesión por expirar con reloj simulado), build de producción sin rastros de MSW ni datos de prueba y build con mocks.
- En Chrome con la extensión, de punta a punta:
  - inicio de sesión (vacío, contraseña mala, cuenta desactivada y los tres roles);
  - inicio de cada rol;
  - panel de avisos (abrir, marcar leído, Escape);
  - "Enviar recordatorio" y su llegada a la coordinadora;
  - Mi perfil, cierre de sesión, "Sin permiso", 404, "Vista en construcción" y "Saltar al contenido".
- Con los mocks apagados (`npm run dev`, sin backend): la app llama a `/api` por el proxy y muestra errores en lenguaje claro sin perder lo escrito.
- Teléfono (390 y 320 px) con Chrome sin interfaz:
  - cajón: foco atrapado, Escape, foco de vuelta y navegación;
  - sin scroll horizontal en ninguna página;
  - comparación con los mockups 01 y 02 en claro y oscuro.

**Corregido**
- **"Saltar al contenido" casi invisible.** Era texto azul sobre azul (1,4:1), porque `.mk a` gana a `.saltar` en `comun.css`. Ahora es blanco sobre primario. El mockup tiene el mismo defecto; en la app se corrige en `extensiones.css`.
- **Logos encimados en la banda del inicio de sesión en el teléfono.** El contenedor de logos se encogía. Se corrigió en la app y en `_fuente/01-inicio-sesion.html`, y se regeneraron los mockups.
- **Foco al cerrar el cajón.** No volvía a la hamburguesa. Si se eligió un destino, queda en el contenido de la página nueva.
- **Foco al enviar el inicio de sesión vacío.** Iba a "Contraseña" en lugar de "Correo", por el orden de registro en React Hook Form.
- **Cierre del período el mismo día.** Se lee "cierra hoy, sábado 31/10" (nuevo formato `elDia`).
- **Avisos guardados como texto.** Ya no dicen "Mañana" ni "hoy", que se vuelven falsos al día siguiente: llevan la fecha. El texto del rechazo coincide con el de Inicio y los códigos (`SOL-118`) no se parten.
- **Panel de avisos en el teléfono.** Ya no toca el borde de la pantalla: queda a 8 px.
- **Servidor caído.** Si no responde, la comprobación de sesión reintenta una sola vez (antes la pantalla quedaba en blanco unos 8 s) y el inicio de sesión lo explica. Se agregó un respaldo de carga para las rutas perezosas (aviso de React Router).
- **Peso de la descarga.**
  - El inicio de sesión y Mi perfil se cargan bajo demanda, y `package.json` declara `sideEffects`. El fragmento principal bajó de 606 kB a 317 kB, y Zod y React Hook Form solo se descargan en el inicio de sesión.
  - El escudo bajó de 545 kB a 47 kB y el isotipo de 51 kB a 15 kB. Son versiones web a 3 veces su tamaño en pantalla, generadas con `scripts/logos_web.py`; los originales de `docs/` no se tocaron.

**Queda anotado para pasos siguientes**
- La nota del inicio de sesión promete que "tu borrador queda guardado" al cerrarse la sesión. Se debe cumplir en el primer formulario largo (paso 4 en adelante).
- "Enviar recordatorio" se puede pulsar varias veces y cada vez crea avisos nuevos. Cuando exista la vista 22 conviene mostrar cuándo se envió el último.

### Paso 4: Usuarios (vista 04) (31/10/2026)

**Hecho**
- Módulo `src/modulos/usuarios/`, con la ruta `/usuarios` (solo para el Administrador), cargado bajo demanda.
- **Lista (F1.1 a F1.3):**
  - Búsqueda por nombre o correo, sin importar tildes ni mayúsculas, que espera a que termines de escribir.
  - Filtros de rol y estado. Los tres viven en la URL, así que se pueden compartir y el botón Atrás los respeta.
  - Paginación de 8 en 8 ("8 de 14 cuentas activas"). Columnas: rol con su punto de color, proyectos activos que coordina, último acceso y estado. En el teléfono, cada fila pasa a tarjeta.
- **"Editar cuenta" funciona como la ficha:**
  - Nombre, correo y rol.
  - Si una coordinadora pasa a otro rol, el aviso del mockup dice qué proyectos vigentes quedan sin coordinador, con "Conservar el rol actual" y "Cambiar rol y guardar".
  - Sección "Acceso a la cuenta", con "Restablecer contraseña" y "Desactivar cuenta".
- **Desactivar (F1.3):**
  - Muestra el impacto antes de confirmar: proyectos, solicitudes en Pendiente de Aprobación, si es la única cuenta activa de Aprobador y que su historial se conserva.
  - El foco empieza en "Conservar la cuenta activa".
  - **Reactivar** está en la fila de la cuenta desactivada.
- **Correo repetido (409):** muestra la cuenta que ya lo usa, con "Ver esa cuenta", que filtra la lista por ese correo.
- **Contraseña:**
  - Al crear una cuenta o restablecer su contraseña, se muestra una temporal una sola vez, con "Copiar". Usa 12 caracteres sin letras ni números confusos.
  - La primera vez que la persona entra con ella, ve "Crea tu contraseña" (`/crear-clave`, con el marco de la vista 01). Mínimo 12 caracteres, sin reglas de composición (NIST SP 800-63B), distinta de la temporal y sin el correo adentro.
  - Hasta que la crea, el servidor solo acepta `POST /auth/cambiar-clave`.
- **Proyectos sin coordinador:** al cambiar el rol o desactivar una cuenta, sus proyectos vigentes quedan sin coordinador y pasan a los pendientes del Inicio del Administrador. También se actualiza el contador de Proyectos del menú.
- **Auditoría:** cada creación, edición, cambio de estado y restablecimiento deja un registro en la auditoría simulada. La contraseña nunca se registra.
- **Contrato de la API:**
  - `GET /usuarios?q&rol&estado&pagina` y `GET /usuarios/:id/impacto`
  - `POST /usuarios`, que devuelve `{ cuenta, claveTemporal }`; un 409 trae `{ detail: { mensaje, cuenta } }`.
  - `PATCH /usuarios/:id`, `PATCH /usuarios/:id/estado` y `POST /usuarios/:id/clave-temporal`
  - `POST /auth/cambiar-clave`, y la sesión trae `debeCambiarClave`.
- Semilla: 15 cuentas (14 activas). Valentina Ruiz (`v.ruiz@cpq.local`) tiene la contraseña temporal sin cambiar.
- Pruebas: 8 nuevas de la vista. En total pasan 20.

**Decisiones**
- **Contraseña temporal con cambio obligatorio** (la eligió el usuario). Ni los requisitos ni el mockup decían cómo recibe alguien su primera contraseña, y el stack no tiene correo.
- **El Administrador no puede cambiarse su rol, desactivarse ni restablecer su contraseña.** Evita quedarse sin acceso; se lo pide a otro administrador. Por eso la semilla trae una segunda cuenta de administrador (Ana Lucía Mora).
- **Orden alfabético** en la lista: el mockup no seguía ningún orden.
- **Nombre completo al hablar de otra persona** ("María Fernanda Ochoa" y no "María"): con nombres de tres palabras no se puede saber cuál es el apellido.
- **Encabezado editorial con el módulo** ("Usuarios, catálogos y parámetros"), igual que `window.APP.ins` en los mockups. Hasta el paso 3 mostraba el título de la página.

**Corregido de paso, para toda la app**
- **Diálogos:**
  - El foco vuelve al control que abrió el diálogo; si ya no existe, va al aviso del resultado.
  - En un formulario, el foco empieza en el primer campo y no en el botón de cerrar.
  - Un error de validación en las opciones tipo tarjeta lleva el foco al grupo.
- **Botones ocupados ("Guardando…"):** usan `aria-disabled`, porque un botón `disabled` perdía el foco y, ante un error del servidor, el foco quedaba en `<body>`.
- **Mocks que se desconectaban:** Chrome detiene el Service Worker de MSW cuando está inactivo y, al reiniciarse, olvida qué pestaña atendía; entonces las peticiones salían al backend (502). Ahora se comprueba al volver a la pestaña y cada 20 s. Si el worker sigue registrado, se reconecta sin perder los datos; si no, se recarga la página.
- **Códigos de proyecto:** ya no se parten en el guion dentro de un texto (clase `.codigo`).
- **Barra de filtros en el teléfono:** la búsqueda ocupa su propia fila.

### Paso 5: Ubicaciones y parámetros (vista 05) (31/10/2026)

**Hecho**
- Ruta `/ubicaciones-parametros` (solo para el Administrador), en el módulo `usuarios`, que cubre usuarios, catálogos y parámetros. Se carga bajo demanda.
- **Ubicaciones (F1.4):**
  - Alta en línea, como en el mockup. Tras agregar una, el foco vuelve a "Nombre" para cargar la siguiente.
  - Tabla con los lotes que guarda cada ubicación y su estado, y un conteo de las activas.
  - No se permiten dos ubicaciones activas con el mismo nombre, sin importar tildes, mayúsculas ni espacios de más. Es el mensaje del mockup, junto al campo.
  - "Editar" abre una ficha (no estaba dibujada; mismo lenguaje que "Editar cuenta") con nombre, descripción y una sección "Uso".
  - Una ubicación que tuvo lotes solo se desactiva: deja de aparecer en la recepción (F6.1) y sus lotes siguen ahí. Una que nunca tuvo lotes también se puede eliminar, como permite F1.4.
  - "Reactivar" está en la fila.
- **Parámetros (F1.5, HU-02):**
  - Anticipación de vencimiento (1 a 365 días) e historial mínimo para el pronóstico (1 a 60 meses).
  - Enteros positivos validados en el navegador y en el servidor.
  - Bajo cada parámetro, su último cambio sale del audit log ("José Rodríguez lo cambió de 45 a 30 el 12/10/2026", o "Valor inicial del sistema").
  - Al guardar se dice qué cambia desde ese momento. Se refrescan las alertas del Inicio y el menú.
- **Contrato de la API:**
  - `GET/POST /ubicaciones`, `PATCH /ubicaciones/:id` y `/estado`, `DELETE /ubicaciones/:id` (409 si tuvo lotes).
  - `GET/PUT /parametros`.
- **Mocks:**
  - Catálogo con las 7 ubicaciones del mockup.
  - Cada lote tiene su ubicación. Se agregaron los lotes que faltaban para que el stock de cada insumo sea la suma de sus lotes, sin cambiar las alertas.
  - El audit log guarda el valor anterior y el nuevo.
- Pruebas: 4 nuevas. En total pasan 24.

**Decisiones**
- **Los números de la columna "Lotes" salen de los datos** (1 a 3 por ubicación), no los del mockup (18, 9, 7…). El orden es alfabético.
- **Estilos con alcance:** los de la vista van dentro de `.vista-ubicaciones` (con `display: contents` para no alterar el espaciado). Diez mockups definen `.dos` con columnas distintas y el CSS de una vista queda cargado al pasar a otra. Las piezas de diálogo quedan fuera de ese alcance, porque se pintan en un portal. Así se hará en las vistas siguientes que repitan nombres de clase.

### Paso 6: Proyectos (vista 06) (31/10/2026)

**Hecho**
- Módulo `src/modulos/proyectos/` y ruta `/proyectos`, cargada bajo demanda.
  - El Administrador ve todos los proyectos.
  - El Coordinador ve "Mis proyectos": solo los suyos (RN-07, aplicado en el servidor), sin "Registrar proyecto", sin "Asignar" y sin la columna de coordinador, que siempre sería él mismo.
- **Lista:**
  - Botones por estatus con su conteo; los conteos respetan la búsqueda, el área y la prioridad.
  - Búsqueda por código, nombre o coordinador; filtros de área y prioridad. Todo vive en la URL.
  - Orden del mockup: por prioridad, dentro de cada una primero En ejecución, luego por código.
  - El código lleva a la ficha (vista 07, paso 7).
  - Un proyecto sin coordinador muestra "Sin coordinador · Asignar" (F2.2).
  - **Avance físico (F2.6):** en Propuesta dice "Plan de hitos confirmado" o "sin confirmar".
  - **Ejecución (F2.7):** pasa de 100 % sin recortarse, con el ícono de alerta y "(pasa del 100 %)" para lector de pantalla.
- **Exportar:** baja la lista con los filtros actuales en CSV (`;` y BOM, para que Excel en español abra bien las tildes).
- **Registrar proyecto (F2.1):**
  - Nace en Propuesta.
  - El código se pasa a mayúsculas, usa el formato `AAA-000` y sugiere el área por su prefijo (QUI → Química). El área tiene que coincidir con el prefijo.
  - El presupuesto se escribe como en Venezuela ("9.500,00", "9500,5") y se formatea al salir del campo (`leerMonto` en `lib/formato`).
  - El coordinador es opcional: lista de coordinadores activos con cuántos proyectos tiene cada uno.
  - Código repetido (409): el error enlaza al proyecto que ya lo tiene, como en el mockup, y el foco va al campo.
  - Si se asigna coordinador, le llega un aviso (F2.2).
- **Contrato de la API:** `GET /proyectos?q&area&prioridad&estatus&pagina` (con `conteos`), `GET /proyectos/exportar`, `GET /proyectos/coordinadores` y `POST /proyectos`.
- Pruebas: 5 de la vista y 3 de formato (`leerMonto`, `elDia`). En total pasan 41.

**Corregido de paso, para toda la app**
- **Rejilla de formularios:** cada campo toma su propio alto. En el mockup 06, el selector "Área" se estiraba hasta 78 px cuando "Código" mostraba su error.
- **Barra de progreso:** `aria-valuemax` sube si el valor pasa de 100, para que `aria-valuenow` no quede fuera de rango. `MiniBarra` muestra el ícono de alerta en ese caso.
- **Búsqueda de la barra superior:** su etiqueta oculta pasa a "Buscar en todo el sistema". Antes había dos campos llamados "Buscar" en la misma página.

### Paso 7: Ficha de proyecto (vista 07) (01/11/2026)

**Hecho**
- Ruta `/proyectos/:id`, cargada bajo demanda.
  - La barra del teléfono y el título de la pestaña muestran el código del proyecto, como el mockup (`useTituloPagina`).
- **Encabezado:** código y área, nombre, estatus, prioridad y "Coordina Daniela Rivas · Registrado el…".
  - Botones del Administrador: Asignar o Cambiar coordinador y Cambiar estatus.
  - Botones del Coordinador: Nueva solicitud y Cargar avance (o "Armar el plan de hitos"). Un proyecto Finalizado no los muestra (HU-04).
- **Métricas:**
  - **Avance físico (F2.6):** se calcula con los hitos (Σ peso × avance / 100). Si el plan no está confirmado dice "No disponible" y cuánto suman los pesos.
  - **Ejecución (F2.7):** desglose en solicitudes de gasto, insumos despachados y parte de los gastos compartidos. Si pasa de 100 % dice cuánto supera el presupuesto.
  - **Próximo hito.**
- **Pestañas:**
  - **Resumen:** hitos y movimientos recientes; "Ver todos" abre la pestaña de gastos.
  - **Gastos y despachos, Reservas e Historial:** cada una pide sus datos solo al abrirse.
- **Cambiar estatus (F2.3):**
  - Solo ofrece los cambios permitidos: Propuesta → En ejecución; En ejecución → Suspendido o Finalizado; Suspendido → En ejecución o Finalizado. Finalizado es el final.
  - De Propuesta a En ejecución exige coordinador y plan confirmado; si falta algo, la opción aparece deshabilitada con el motivo.
  - Muestra el efecto de cada cambio, como el mockup, y un comentario opcional que queda en el historial. La auditoría guarda el estatus anterior y el nuevo.
  - Le llega un aviso al coordinador.
- **Asignar o cambiar coordinador (F2.2):**
  - No estaba dibujado. Ofrece las cuentas activas con rol Coordinador y dice quién deja de verlo; les llega un aviso a los dos.
  - Se abre solo con `?asignar=coordinador` (enlaces de la lista y del inicio).
- **RN-07:** un coordinador que abre un proyecto ajeno ve "Este proyecto no está asignado a ti". Un código inexistente dice que no se encontró.
- **Mocks:**
  - Plan de hitos para cada proyecto, con pesos elegidos para que el avance calculado dé lo de los mockups.
  - Historial de cargas de avance.
  - Cargos por proyecto que suman el gasto ejecutado. QUI-024 tiene el desglose exacto del mockup (3.150 + 1.402 + 260 = 4.812) y 12 cargos por US$ 1.284,50 en el mes de la revisión.
  - El avance ya no se guarda: se calcula (`avanceDe`).
- **Contrato de la API:**
  - `GET /proyectos/:id`, `/gastos`, `/reservas` y `/historial`.
  - `PATCH /proyectos/:id/estatus` y `/coordinador`.
- Pruebas: 7 nuevas. En total pasan 48.

**Decisiones**
- **Suspendido puede volver a En ejecución**, como muestra el mockup, aunque SP-13 está por confirmar con el profesor. Está marcado `// SP-13` en el handler.
- **"Coordina Daniela Rivas"** en lugar de "Coordinadora", sin flexión de género, como el resto de los nombres de rol.

**Corregido de paso, para toda la app**
- **Pestañas:** la línea inferior se dibuja con una sombra interior. El margen de −1 px del mockup desbordaba y Chrome en Windows pintaba una barra de desplazamiento junto a las pestañas.

**Pendiente**
- **Fechas de la semilla:** son relativas a hoy. Desde el 01/11 el período en revisión es noviembre, y los 12 cargos de QUI-024 quedaron en octubre. En el paso 21 (revisión de cargos), los cargos del período se calcularán desde los datos para que todo cuadre cualquier día.

### Paso 8: Plan de hitos y avance (vista 08) (01/11/2026)

**Hecho**
- Ruta `/proyectos/:id/plan`, solo para el coordinador del proyecto (RN-07 en el servidor; el administrador ve "Sin permiso").
- **Armar el plan (F2.4, modo "Plan incompleto"):**
  - Filas con nombre, fecha prevista y peso; agregar y quitar hitos. Al agregar, el foco va al nombre del hito nuevo; al quitar, al botón que queda en su lugar.
  - Suma de pesos en vivo con la barra del mockup: cuánto falta o cuánto sobra para 100 %.
  - "Guardar borrador" guarda aunque no sume 100. "Confirmar plan" solo avanza con 100 %. Si se intenta con 90, dice que faltan 10 % y lleva el foco a los pesos (HU-05).
  - Al confirmar, la vista pasa a la tabla de avance. Si el proyecto está en Propuesta, el administrador recibe un aviso para pasarlo a En ejecución.
- **Cargar avance (F2.5, modo "Cargar avance"):**
  - Tabla de hitos con peso, avance, última carga y "Cargar avance". El próximo hito lleva el botón primario y los completos dicen "Completo".
  - El diálogo valida de 0 a 100 ("Escribiste 120", HU-05), una fecha que no sea futura ni anterior a la última carga, y un comentario opcional.
  - Antes de guardar dice cómo queda el avance físico del proyecto ("pasa de 62 % a 66,5 %"). Si el valor es menor que la última carga, lo advierte sin bloquear.
  - Muestra las cargas anteriores del hito. Cada carga es un registro nuevo y queda en la auditoría.
- **Editar un plan confirmado** (`?modo=editar`, desde "Editar plan" de la ficha o de la tabla):
  - Tiene que seguir sumando 100 y muestra cómo cambia el avance.
  - Los hitos con cargas de avance no se pueden quitar (candado y nota), para no perder su historial.
- **Salir sin guardar:** si hay cambios en el editor, avisa antes de navegar o recargar (`useBlocker` y `beforeunload`).
- **Avance con un decimal:** el avance físico ahora lleva hasta un decimal (66,5 %), y `porcentaje()` une el número y el "%" con un espacio de no separación.
- **Mocks:**
  - QUI-035 (coordinadora Daniela Rivas, Propuesta, plan en borrador con pesos que suman 90), como el mockup 08.
  - Las cargas de QUI-024 traen las fechas y comentarios del mockup.
- **Contrato de la API:**
  - `GET /proyectos/:id/plan` y `PUT /proyectos/:id/hitos` (`{hitos, confirmar}`).
  - `GET` y `POST /proyectos/:id/hitos/:hitoId/avances`.
  - Los 422 de una lista van con la ruta completa (`hitos.2.peso`) y el cliente los muestra en su campo.
- Pruebas: 9 nuevas (6 de la vista y 3 del cálculo). En total pasan 57.

**Decisiones**
- **QUI-035 se agregó a la semilla** para reproducir el mockup 08. La lista del administrador pasa de 11 a 12 proyectos (Propuesta 3). El inicio del coordinador no cambia, porque solo muestra los proyectos en ejecución.
- **Un plan confirmado no vuelve a borrador:** así el avance físico nunca vuelve a "No disponible" por una edición.
- **Un proyecto finalizado** muestra sus hitos sin botones: su avance ya no cambia.
- **La primera carga de QUI-024** quedó después de la confirmación del plan (el mockup 08 la ponía antes que la fecha de confirmación del mockup 07).

**Corregido de paso**
- **`ErrorProyecto`:** el aviso de proyecto ajeno o inexistente ahora lo comparten la ficha y el plan.
- **Pruebas inestables:** con todos los archivos en paralelo, la primera prueba de un archivo a veces pasaba del segundo de espera de `findBy`. Ahora espera hasta 4 s (`configure` en `testing/setup.ts`).

### Paso 9: Inventario (vista 09) (01/11/2026)

**Hecho**
- Ruta `/inventario` para el Aprobador, el Administrador y el Coordinador, con la vista adaptada a cada rol.
- **Tarjetas de alerta (F3.4, F3.6):** insumos bajo el mínimo, lotes próximos a vencer (con los días de anticipación de F1.5) y lotes vencidos.
  - Cuentan todo el inventario. Al pulsar una, la lista se filtra por esa alerta; al pulsarla otra vez, se quita el filtro.
  - Los enlaces del inicio (`?alerta=minimo`, `?alerta=vencimiento`) llegan con el filtro puesto.
- **Tabla:**
  - Insumo y tipo, stock con su mínimo y barra (roja si está bajo), lotes con existencia, próximo vencimiento y estado.
  - El orden es el del mockup: bajo el mínimo, por vencer, vencido y al día.
  - En el próximo vencimiento muestra los días que faltan dentro de la anticipación ("en 9 días", HU-10), o "vencido".
- **Filtros en la URL:** búsqueda por nombre o número de lote (con espera de 300 ms), tipo y ubicación. 20 insumos por página.
- **Exportar:** el catálogo filtrado en CSV.
- **Registrar insumo (Administrador, F3.1 y F3.2):**
  - Nombre, unidad, stock mínimo con su unidad y tipo, con la ayuda del mockup sobre los de uso general.
  - Si el nombre y la unidad ya existen, el error enlaza al insumo existente ("Acetona grado analítico en litros") y el foco vuelve al nombre.
  - Nace con stock cero. Si queda bajo su mínimo, el servidor crea la reposición en Borrador (F3.5) y avisa al aprobador. El mensaje de éxito lo dice, y en un insumo de uso general explica que su costo se reparte al cerrar el período (HU-07).
- **Coordinador (plan §7.1):**
  - Solo consulta: sin tarjetas de alerta ni alta, y el nombre no abre la ficha.
  - Cada fila lleva "Pedir retiro", que abre la vista 14 con el insumo elegido, y arriba hay un "Pedir retiro" general.
- **Mocks:**
  - Catálogo de 24 insumos. Los 9 del mockup 09 tienen sus valores exactos y el stock de cada insumo es la suma de sus lotes (lo comprueba una prueba).
  - Lotes de acetona como la ficha del mockup 10 (L-0402 y L-0417).
  - `revisarReposicion()` en `mocks/reglas.ts` aplica F3.5 y la usarán también el cambio de mínimo, las recepciones y los despachos.
  - REP-012 (metanol) y REP-013 (puntas) quedaron aprobadas, para que todo insumo bajo el mínimo tenga su reposición abierta.
- **Contrato de la API:** `GET /insumos`, `GET /insumos/exportar` y `POST /insumos`. El 409 trae `{mensaje, insumo}`.
- `OpcionesTarjeta` admite un texto de ayuda.
- Pruebas: 6 nuevas (4 de la vista y 2 de la semilla). En total pasan 63.

**Decisiones**
- **Semilla alineada con los mockups 03, 09 y 10,** que coinciden entre sí: 4 insumos bajo el mínimo (acetona, guantes, metanol y puntas), 2 lotes por vencer (medio LB agar y etanol) y 1 vencido (tripsina).
  - La acetona pasa a materia prima, como en el mockup 09.
  - El lote de etanol por vencer es L-0408. El mockup 03 lo llamaba L-0398, pero ese código es de acetona en el mockup 19.
- **Un insumo recién registrado** ya queda bajo su mínimo (stock cero), así que crea su reposición en Borrador, con la misma regla que después de un despacho.
- **El chip de estado** muestra lo más grave de cada insumo: bajo el mínimo, después lote vencido y después lote por vencer.
- **Ubicaciones:** el Depósito de reactivos A ahora guarda 6 lotes. Se actualizó la prueba del paso 5, que esperaba uno.

### Paso 10: Ficha de insumo (vista 10) (01/11/2026)

**Hecho**
- Ruta `/inventario/:id` para el Aprobador y el Administrador. El Coordinador ve "Sin permiso", y un id inexistente dice que no se encontró.
- **Encabezado:** tipo, unidad y ubicaciones de sus lotes, como el subtítulo del mockup.
  - **Aprobador:** "Registrar recepción" (lleva a la vista 17 con el insumo elegido).
  - **Administrador:** "Cambiar stock mínimo" (plan §7.3).
- **Resumen:**
  - **Stock actual (F3.4):** el stock contra el mínimo. El Aprobador ve además "El mínimo lo define el Administrador del Sistema".
  - **Consumo pronosticado (F3.7):** el valor con su intervalo y "Holt-Winters con 7 meses de despachos", o "No disponible: hacen falta 6 meses".
  - **Último movimiento:** el despacho o la recepción más reciente, con lote y código.
- **Reposición automática (F3.5):**
  - **Aprobador:**
    - Corrige la cantidad y ve en vivo cómo queda frente al pronóstico y al mínimo.
    - "Aprobar reposición" pasa la solicitud de Borrador a Pendiente de Aprobación y a Aprobado en un solo paso, y el audit log guarda las dos transiciones (HU-09).
    - "Descartar" pide confirmación, no compra nada y la alerta sigue (HU-09).
  - **Administrador:** la ve sin botones ("La decide el aprobador").
  - **Una reposición ya aprobada** se muestra con quién la aprobó, cuándo y por cuánto, hasta la recepción.
- **Lotes (F3.6):**
  - Los que tienen stock, del que vence antes al que vence después, con ingreso, vencimiento ("en 9 días" o chip "Vencido"), stock, costo unitario y proveedor.
  - Los vencidos aparecen atenuados.
- **Consumo mensual y pronóstico:** `GraficoColumnas`, un componente compartido nuevo (Recharts, plan §7.4).
  - El mes pronosticado va rayado y con su intervalo, y el stock mínimo es una línea punteada con su etiqueta.
  - Sin animaciones, con el tooltip del mockup 03 y con "Ver como tabla" (`aria-expanded`).
  - Sin historial suficiente, muestra el aviso del mockup con los meses que tiene y los que faltan.
- **Cambiar stock mínimo (F3.2):** dice si el stock actual queda bajo el nuevo mínimo. Al guardar, la alerta y la reposición aparecen de inmediato (HU-07).
- **Mocks:**
  - Bitácora de despachos (`db.despachos`, `datos/despachos.ts`) con 7 meses de consumo por insumo. La acetona trae la serie del mockup 10, y puntas, crisoles y pasta térmica solo 3 meses.
  - Los lotes ahora tienen ingreso, costo unitario y proveedor. Las reposiciones guardan la cantidad.
  - `mocks/pronostico.ts` calcula el pronóstico (Holt con tendencia amortiguada e intervalo del 95 %), con pruebas.
- **Contrato de la API:**
  - `GET /insumos/:id` y `PATCH /insumos/:id/minimo`.
  - `POST /solicitudes/:id/aprobar` (`{cantidad}`) y `POST /solicitudes/:id/rechazar`. Por ahora solo para reposiciones; la vista 15 los amplía.
- **Pruebas:** 9 nuevas (6 de la vista, 2 del pronóstico y 1 de la bitácora). En total pasan 72.

**Decisiones**
- **El pronóstico de la acetona da 6,1 L (5,1 a 7,1)** y no 6,2 (4,9 a 7,5) como el mockup: sale del cálculo sobre la serie, no de un número fijo.
- **El método se rotula "Holt-Winters",** como dice el README (statsmodels). Con 7 meses no hay estacionalidad que estimar, así que el mock usa la variante con tendencia de esa misma familia.
- **El mes pronosticado es el mes en curso.** El historial son los meses completos anteriores, así que el mockup se reproduce tal cual: abril a octubre más noviembre.
- **Descartar una reposición la deja en "Rechazado"** (final, RN-03). Se crea otra cuando el stock vuelva a cambiar y siga bajo el mínimo.
- **Recharts solo se descarga en esta vista** (fragmento de unos 110 kB comprimido). El dashboard (paso 26) reusará el mismo componente.

**Corregido de paso**
- **Tiempos de las pruebas:** cada prueba monta la app entera y, con todos los archivos en paralelo, algunas pasaban de los 5 s por defecto. Ahora el límite es de 20 s (`vite.config.ts`).
- **Precarga de la ficha:** su archivo de pruebas precarga la ruta, porque Recharts tarda la primera vez que se transforma.

### Paso 11: Catálogo de equipos (vista 11) (01/11/2026)

**Hecho**
- Ruta `/equipos`, solo para el Administrador.
- **Tabla:**
  - Equipo con su código de activo, ubicación, estado con su chip, próxima reserva y la acción de mantenimiento.
  - En mantenimiento muestra "Desde el…" y "—" en la próxima reserva. Una reserva todavía sin aprobar dice "por aprobar".
- **Filtros en la URL:** búsqueda por nombre o código de activo, estado y ubicación (solo las que tienen equipos).
- **Registrar equipo (F4.1):**
  - Nombre, código de activo y ubicación del catálogo de F1.4. Nace Disponible (HU-12).
  - Si el código ya existe, el error nombra al equipo que lo tiene ("Ese código ya es del espectrofotómetro UV-Vis"), con un enlace que cierra el diálogo y filtra la lista por ese código.
- **Pasar a mantenimiento (F4.2, HU-12):**
  - Antes de confirmar, lista las reservas aprobadas a futuro, con fecha, horario, coordinador y proyecto, y pide el motivo.
  - Al confirmar, el equipo deja de admitir reservas y cada coordinador afectado recibe un aviso con el motivo. Queda en la auditoría.
- **Registrar fin del mantenimiento:** el equipo vuelve a Disponible y queda en la auditoría.
- **Ubicaciones:**
  - El catálogo de F1.4 suma los 5 laboratorios del mockup 11 (decisión del usuario). Al registrar un equipo se ofrecen todas las ubicaciones activas, así que una registrada después en el paso 5 ya se puede usar.
  - Una ubicación con equipos tampoco se elimina, solo se desactiva. El diálogo del paso 5 dice cuántos equipos tiene.
  - Cambiar una ubicación refresca el inventario y los equipos.
- **Mocks:**
  - Colección `equipos` con los 7 del mockup 11.
  - Las reservas guardan `equipoId` (antes, el nombre). Se agregaron las dos reservas aprobadas del difractómetro del mockup 11 y una del horno mufla.
- **Contrato de la API:**
  - `GET` y `POST /equipos`, `GET /equipos/:id/reservas-afectadas`.
  - `POST /equipos/:id/mantenimiento` (`{motivo}`) y `POST /equipos/:id/fin-mantenimiento`.
- **Pruebas:** 6 nuevas. En total pasan 78.

**Decisiones**
- **Laboratorios en el catálogo de ubicaciones** (lo eligió el usuario): F4.1 pide elegir la ubicación de ese catálogo y el mockup 11 ubica los equipos en laboratorios.
  - La lista del paso 5 pasa de 7 a 12 ubicaciones, y los laboratorios también se podrán elegir al recibir lotes.
  - Se actualizaron las pruebas del paso 5 (11 activas).
- **Las reservas afectadas no se cancelan:** siguen aprobadas y sus coordinadores reciben el aviso para reprogramarlas. F4.2 pide listarlas y avisar.
- **"En uso" no se cambia a mano:** el mockup solo trae "Pasar a mantenimiento" y "Registrar fin del mantenimiento". "En uso" lo marcará el registro de uso (paso 13).
- **Próxima reserva del inicio del coordinador:** con las reservas nuevas del difractómetro y del horno, el inicio de Química muestra hasta 4 reservas próximas, en vez de las 2 del mockup 02.

### Paso 12: Reservas de equipos (vista 12) (01/11/2026)

**Hecho**
- Ruta `/reservas` para el Coordinador y el Aprobador. Equipo y semana en la URL; `?reserva=RES-…` (el "Ver en el calendario" del inicio) abre ese equipo y esa semana y resalta la reserva.
- **Calendario semanal del mockup:** de lunes a sábado, de 07:00 a 18:00, con navegación entre semanas.
  - **Coordinador (RN-07):** lo de otros proyectos se ve como "Ocupado"; lo suyo, como "Aprobada" o "Pendiente".
  - **Teléfono:** pasa a agenda por día.
  - **Atajo con el mouse:** un clic en un horario vacío llena el formulario. El formulario es la vía con teclado.
- **Solicitar reserva (F4.3):**
  - Proyecto (los suyos que no están finalizados), fecha y horario. El calendario sigue a la fecha del formulario.
  - **Vista previa (F4.4):**
    - Si el horario está libre, lo dice.
    - Si choca, muestra con qué reserva y los horarios libres más cercanos de ese día. Al elegir uno, conserva la duración pedida.
  - **Al enviar:** el servidor vuelve a validar. Si choca, no guarda nada (HU-13). Si no, la reserva queda pendiente y el aprobador recibe un aviso.
  - **Validaciones:** horario de 07:00 a 18:00, nada de domingos, a futuro y con la hora de fin después del inicio.
- **En mantenimiento:** aviso del mockup con la fecha y el motivo, y "No admite reservas" (F4.4). El servidor también lo impide.
- **Aprobador (plan §7.1):** el mismo calendario (aprobadas y pendientes) y una columna "Pendientes de aprobación" que lleva a la bandeja, donde decide.
- **Horarios:** `src/lib/horarios.ts` (instantes en Caracas, choque entre rangos, horarios libres, semanas), con pruebas. Lo usan la vista y los mocks.
- **Mocks:**
  - La semana del espectrofotómetro del mockup 12 (otros proyectos casi todos los días).
  - Todas las reservas van ancladas a los días de la semana de los mockups, nunca en domingo y siempre a futuro.
- **Contrato de la API:**
  - `GET /reservas?equipo&semana&reserva` y `POST /reservas`.
  - El 409 trae `{mensaje, choque, libres}`.
- **Pruebas:** 10 nuevas (6 de la vista y 4 de horarios). En total pasan 88.

**Decisiones**
- **Las reservas nuevas de la semana del espectrofotómetro están aprobadas,** para no cambiar los "9 decisiones pendientes" del inicio del aprobador (mockup 02). La reserva pendiente de la leyenda se ve al pedir una.
- **El aviso de horario libre dice "te llegará un aviso cuando decida"** en lugar de "te avisaremos en tu bandeja": el coordinador no tiene bandeja, recibe avisos en la campana.
- **Los proyectos en Propuesta o Suspendido pueden reservar;** solo los finalizados no (HU-04).

**Corregido de paso**
- **Reservas de la semana de la semilla:** RES-051 y RES-052 caían en domingo porque se contaban desde hoy. Ahora caen en los días de los mockups (rotavapor el miércoles 04/11, centrífuga el jueves 05/11).

### Paso 13: Uso de equipo (vista 13) (01/11/2026)

**Hecho**
- Ruta `/reservas/uso?equipo=…`, solo para el Coordinador. Sin equipo en la URL, abre el que está usando o el de su próxima reserva, y lo deja fijo en la URL.
- **Registro de uso (F4.6, HU-14):**
  - **En uso por ti:** desde qué hora y para qué proyecto, reloj del tiempo transcurrido (`role="timer"`, avanza cada 30 s), observaciones y "Cerrar registro de uso". Al cerrar, el equipo vuelve a Disponible (salvo que esté en mantenimiento) y el uso pasa al historial.
  - **Disponible:** dice si hay una reserva tuya hoy y propone su proyecto. "Iniciar uso" pasa el equipo a En uso para todos, y el foco va al nuevo estado.
  - **En uso por otra persona, o en mantenimiento:** dice quién lo usa y desde cuándo, o el motivo del mantenimiento, sin botones.
- **Usos de tus proyectos (RN-07):** fecha, proyecto, horas y observaciones, con las horas del mes del último uso ("Octubre: 14,5 h", como el mockup).
- **Accesos:** "Reservar" lleva a la vista 12 con el equipo elegido. "Hoja de vida" (F8.4) lleva a Reportes (vista 24) con el reporte y el equipo ya elegidos.
- **Mocks:**
  - Colección `usos`. El horno mufla y el rotavapor tienen un uso abierto: por eso aparecen En uso en el catálogo (mockup 11).
  - Los 4 usos del mockup 13 de los proyectos de Química y uno de QUI-027, que la coordinadora de Química no ve.
- **Contrato de la API:** `GET /usos?equipo`, `POST /usos` y `POST /usos/:id/cerrar`.
- **Pruebas:** 4 nuevas. En total pasan 92.

**Decisiones**
- **Uso sin reserva (SP-06, por confirmar):** se permite. Si hay una reserva aprobada en ese momento, el uso queda asociado a ella. Está marcado `// SP-06` en el handler.
- **"Hoja de vida" no descarga aquí:** el mockup 24 genera ese mismo reporte, con su rango de fechas y su formato. Una sola forma de generarlo evita duplicar.
- **Selector de equipo en el encabezado:** se agregó junto a "Reservar" y "Hoja de vida", como en la vista 12. El mockup no muestra cómo cambiar de equipo.
- **Solo quien inició el uso puede cerrarlo.**

**Corregido de paso**
- **Reservas (vista 12):** sin equipo en la URL, al pedir una reserva la vista podía saltar a otro equipo (el servidor vuelve a elegir el de la próxima reserva). Ahora el equipo elegido queda fijo en la URL. Lo encontró la prueba de la vista 13, donde pasaba lo mismo al cerrar el uso.

### Paso 14: Mis solicitudes (vista 14) (01/11/2026)

**Hecho**
- Ruta `/solicitudes`, solo para el Coordinador, con las solicitudes de sus proyectos (RN-07). La URL decide la pantalla:
  - la lista;
  - `?nueva=retiro|gasto` (con `&proyecto=`, `&insumo=` o `&desde=` para copiar una rechazada);
  - `?id=` de una solicitud.
- **Lista (mockup 14):**
  - El flujo de RN-03 bajo el título y pestañas por estado con sus conteos.
  - Tabla con solicitud y tipo, proyecto, detalle (con el motivo si fue rechazada), estado y "Actualizada" ("Hoy, 10:42").
  - La acción depende del estado: "Seguir editando" (borrador), "Ver" (detalle de solo lectura), "Ver despacho" (lleva a la bitácora, vista 19) y "Crear una nueva" (rechazada: copia sus datos en un borrador nuevo; RN-03, no vuelve a pendiente).
- **Guardado automático (F5.1, HU-15):**
  - Con el primer cambio se crea el borrador y la URL pasa a `?id=`. Después se guarda a los 700 ms de dejar de escribir.
  - Arriba se ve "Borrador SOL-126 guardado a las 10:58", o "Guardando…", o el error con "Reintentar".
  - "Volver a mis solicitudes" guarda lo último antes de salir. "Descartar borrador" lo borra, con confirmación.
- **Retiro (F5.2):**
  - Proyecto, para qué se usará e insumos con su cantidad. Muestra lo disponible para despachar (sin los lotes vencidos).
  - Pedir de más lleva el chip del mockup ("Pides 4 L y hay 2,5 L") y un aviso que deja enviar igual. Si hay una reposición de ese insumo en curso, el aviso lo dice.
  - Un insumo va en una sola línea. Al agregar un insumo, el foco va al selector nuevo.
- **Gasto (F5.1):**
  - Proyecto, insumo o servicio, cantidad, monto estimado (con formato al salir del campo) y descripción.
  - Cotización opcional (PDF o imagen de hasta 5 MB; el mock guarda el nombre del archivo).
  - Muestra la ejecución presupuestaria del proyecto, que verá el aprobador.
- **Enviar (F5.3):**
  - Si faltan datos, no envía: aviso "Faltan 2 datos para enviar. Los marcamos abajo. Tu borrador sigue guardado.", el error junto a cada campo y el foco en el primero.
  - Si está completo, pide confirmación, pasa a Pendiente de Aprobación, avisa al aprobador y vuelve a la lista con el resultado.
- **Mocks:**
  - Las solicitudes ganan campos estructurados: líneas de insumos y para qué (retiro); insumo o servicio, cantidad, descripción y cotización (gasto); y el despacho que la ejecutó.
  - Se agregaron SOL-125 (el borrador del mockup) y SOL-120 (ejecutada con DES-0318).
  - SOL-117 y SOL-118 pasan a QUI-031, como en el mockup 14.
  - Las de otros coordinadores usan insumos del catálogo.
- **Contrato de la API:**
  - `GET /solicitudes?estado` y `GET /solicitudes/:id`.
  - `POST /solicitudes`, `PATCH /solicitudes/:id` (409 si ya se envió), `POST /solicitudes/:id/enviar` (422 con los faltantes) y `DELETE /solicitudes/:id` (solo borradores).
- **Pruebas:** 6 nuevas. En total pasan 98.

**Decisiones**
- **Descartar borrador:** no está en el mockup, pero sin eso los borradores se acumulan.
- **Detalle de una solicitud enviada:** es un diálogo de solo lectura. El mockup no lo dibuja.
- **Inicio del coordinador:** "Mis solicitudes" del inicio ahora muestra SOL-125 y SOL-120, que el mockup 02 no tenía.

**Corregido de paso**
- **Envío de la solicitud:** al quedar Pendiente, la vista deja de mostrar el formulario antes de que terminen los callbacks de `mutate`. Se usa `mutateAsync`, como en el paso 8.
- **Pruebas que esperan una pausa a propósito** (búsqueda, guardado automático): `findBy` ahora espera hasta 8 s. Con todos los archivos en paralelo, 4 s a veces no alcanzaban. La suite pasó tres veces seguidas.

### Paso 15: Bandeja de aprobación (vista 15) (01/11/2026)

**Hecho**
- Ruta `/bandeja`, solo para el Aprobador. La URL guarda el filtro (`?tipo=solicitud|reserva|correccion|reposicion|ejecutar`) y el pedido abierto (`?pedido=`), así los avisos de la campana y el inicio llevan directo a cada uno (L8).
- **Lista (mockup 15):**
  - Filtros con contador: Todos, Solicitudes, Reservas, Correcciones y Reposiciones.
  - Grupos por prioridad del proyecto (Crítica, Alta, Media, Baja) y al final las reposiciones automáticas; dentro de cada grupo, el más antiguo primero.
  - El detalle queda fijo al costado. En el teléfono, lista y detalle son dos pasos con "Volver a la bandeja".
- **Detalle por tipo:**
  - Gasto (F5.4): datos, cotización y el efecto en el presupuesto (ejecución actual, con la solicitud y lo que queda). Avisa si pasa del 100 %.
  - Retiro (F5.4): insumos, quién retira y el valor estimado (costo del lote que sale primero). Si un insumo no alcanza, lo dice y menciona la reposición en curso.
  - Reserva (F4.5): fecha y estado del equipo. Si choca con otra ya aprobada o el equipo está en mantenimiento, no se puede aprobar.
  - Corrección (F6.6): lo registrado frente a lo pedido, el motivo y lo que pasa al aprobar.
  - Reposición (F3.5): stock, mínimo, consumo previsto de 8 semanas y la cantidad a pedir, editable.
- **Decidir:** aprobar es directo. Rechazar, denegar o descartar pide el motivo en el mismo panel y sin motivo no se puede. Al decidir, aparece "Aprobaste SOL-119. Daniela Rivas recibe el aviso. Sigue SOL-124." y se abre el siguiente.
- **Por ejecutar (F5.5, plan §7.2):** segmento aparte al final de los filtros con los gastos aprobados. "Monto real pagado (US$)" obligatorio, aviso si difiere más de 20 % del estimado y confirmación antes de pasar a Ejecutado. El monto real se carga al proyecto.
- **Efectos en los mocks:**
  - Cada decisión audita la transición y avisa a quien pidió.
  - Corrección aprobada (RN-06): el despacho original no cambia; una línea nueva en la bitácora devuelve la diferencia al lote, el stock sube y un cargo negativo corrige el gasto del proyecto.
  - El contador del menú suma lo por decidir y lo por ejecutar.
- **Contrato de la API:**
  - `GET /bandeja` → `{ pendientes, porEjecutar }`.
  - `POST /solicitudes/:id/aprobar|rechazar` ahora también para gasto y retiro (rechazar exige `motivo`).
  - `POST /reservas/:id/aprobar|rechazar`, `POST /correcciones/:id/aprobar|denegar` (`nota`) y `POST /solicitudes/:id/ejecutar` (`montoReal`).
- **Pruebas:** 6 nuevas. En total pasan 104, tres veces seguidas.

**Decisiones**
- **COR-006 sigue al mockup 15:** se registraron 500 g y se retiraron 50 g (la semilla lo tenía al revés). Se agregó el despacho DES-0312 y el lote L-0425 cuesta US$ 58/kg, para que la corrección descuente US$ 26,10 como en el mockup.
- **Datos que no se cambiaron para seguir el mockup:** la bandeja muestra los pedidos de la semilla (los de los mockups 02 y 10). No se agregaron RES-053, REP-016 ni la versión de SOL-122 del mockup 15.
- **Reservas con `pedidaEl`:** hace falta para ordenar por antigüedad y para "pedida ayer a las 09:10".
- **Gastos por ejecutar de ejemplo:** SOL-113 (FIS-008) y SOL-114 (BIO-011).
- **El aviso de la reposición** no dice que la cantidad venga del pronóstico, porque la semilla la calcula de otra forma. Invita a compararla con el consumo previsto.
- **Avisos al aprobador** (solicitud enviada, reserva pedida, reposición creada) ahora llevan a `/bandeja?pedido=…`.

### Paso 16: Priorización (vista 16) (01/11/2026)

**Hecho**
- Ruta `/priorizacion`. El Aprobador la tiene en el menú; el Administrador llega desde "Ver priorización" del inicio. Todos consultan el orden (F5.6); el Coordinador ve solo sus proyectos (RN-07) y solo el Aprobador cambia la prioridad (F5.7).
- **Lista (mockup 16):**
  - Grupos de Crítica a Baja con su conteo. Cada fila tiene código (enlace a la ficha), nombre, coordinador o "Sin coordinador", último cambio, estatus y "Cambiar prioridad".
  - "Último cambio" sale de la auditoría ("Hoy 08:42, desde Alta"); sin cambios, la fecha de registro ("…, al registrarlo").
  - Filtro de estatus: En ejecución (por defecto) o Todos. Un proyecto finalizado no ofrece el cambio.
- **Diálogo "Cambiar prioridad":**
  - El nivel actual aparece como "(actual)" y no se puede elegir. El botón dice "Cambiar a Alta" según la elección.
  - Sin justificación no se guarda (RN-04), con el error del mockup y el foco en el campo.
  - Antes de guardar dice qué cambia en la bandeja: al subir, a quién pasa delante; al bajar, quiénes le pasan delante.
- **Al guardar:** aviso "Cambiaste QUI-031 de Media a Alta. Daniela Rivas recibe el aviso."; la auditoría guarda el nivel anterior, el nuevo y la justificación; el coordinador recibe un aviso; la bandeja, el inicio y los proyectos se actualizan.
- **Contrato de la API:** `GET /priorizacion?estatus=todos` y `PATCH /proyectos/:id/prioridad` `{ prioridad, justificacion }` (422 sin justificación o con la misma prioridad; 409 si está finalizado).
- **Pruebas:** 4 nuevas. En total pasan 108, tres veces seguidas.

**Decisiones**
- **Historial de prioridad:** el registro de BIO-011 en la auditoría ahora guarda Alta → Crítica, y se agregó el cambio de FIS-008 de Baja a Media (hace 60 días: el "02/09/2026, desde Baja" del mockup).
- **Fechas de registro:** salen de la semilla (hace 180 días), así que no coinciden con las del mockup.
- **Nivel actual deshabilitado** en el diálogo: evita guardar un cambio que no cambia nada.

### Paso 17: Almacén y recepción de lote (vista 17) (01/11/2026)

**Hecho**
- **Entrada `/almacen`** (no estaba dibujada, plan §7.1), solo para el Aprobador:
  - Contadores: despachos por entregar, reposiciones por recibir, lotes próximos a vencer y lotes vencidos (estos dos llevan al inventario filtrado).
  - "Despachos por entregar" (retiros aprobados, con su prioridad) con "Despachar", y "Reposiciones por recibir" (reposiciones aprobadas) con "Registrar recepción".
  - "Últimas recepciones" con lo que queda de cada lote.
- **Recepción `/almacen/recepcion` (mockup 17, F6.1):**
  - Origen: la reposición aprobada asociada (opcional); al elegirla se completan el insumo, la cantidad y la ubicación.
  - Lote: insumo, número de lote del proveedor, cantidad, costo unitario, proveedor, fecha de ingreso (hoy), vencimiento y ubicación (la del último lote del insumo).
  - "Lo que pasa al guardar": stock hoy → después, si la alerta de mínimo se retira o sigue, la reposición que queda asociada y el costo del lote.
  - Un vencimiento pasado muestra el aviso del mockup, marca el campo y bloquea "Registrar lote".
  - Llega con `?solicitud=REP-012` (almacén), `?insumo=` (ficha del insumo; si tiene una reposición aprobada, se asocia sola) o sin nada (inicio).
- **Al guardar:** el lote recibe el siguiente código (L-0432), el stock sube en la misma operación, la reposición pasa a Ejecutado y todo queda en la auditoría. Si el insumo sigue bajo el mínimo y no tiene otra reposición abierta, se crea una (F3.5). El aviso de éxito enlaza a la ficha del insumo y al almacén.
- **Contrato de la API:**
  - `GET /almacen`, `GET /recepciones/opciones` y `POST /lotes`.
  - `POST /lotes` responde 422 por campo (vencimiento pasado o anterior al ingreso, fecha de ingreso futura, insumo que vence sin fecha, reposición de otro insumo) y 409 si el lote del proveedor ya se registró.
- **Pruebas:** 4 nuevas. En total pasan 112, tres veces seguidas.

**Decisiones**
- **"Solicitud de gasto"** lista las reposiciones aprobadas, como el mockup (REP-014). Las solicitudes de gasto aprobadas no tienen un insumo del catálogo y se cierran con "Marcar como ejecutada" en la bandeja (F5.5).
- **REP-014 sigue en Borrador** en la semilla (mockups 02 y 10); por recibir están REP-012 y REP-013.
- **Número de lote del proveedor:** se guarda aparte (`loteProveedor`); el sistema le da su propio código L-xxxx.
- **Cuándo es obligatorio el vencimiento:** si los lotes anteriores del insumo traen fecha.
- **Contadores accesibles:** el componente compartido `Contador` ahora separa el número de la etiqueta para los lectores de pantalla ("2 despachos por entregar").

### Pasos 18 a 22: despacho, bitácora, uso de materia prima, revisión de cargos y cierre (02/11/2026)

Se hicieron en una sola corrida, a pedido. Cada vista se revisó en Chrome con un caso real y en capturas de 1280 px (claro y oscuro) y 390 px.

**Base común (semilla y reglas)**
- **Bitácora:** cada línea guarda quién retiró (un nombre: el personal de laboratorio no tiene cuenta), el aprobador que la registró, la observación y, en un movimiento de corrección, el despacho que corrige.
- **Despachos de QUI-024 del período:** los 11 cargos de despacho de su revisión (mockup 21: 12 cargos por US$ 1.284,50) ahora tienen sus líneas en la bitácora, con las mismas fechas y cantidades. Se renumeraron en orden de fecha (DES-0301 a DES-0318) y sus conceptos usan insumos del catálogo.
- **Hexano:** un segundo lote (L-0430) para que el despacho deje elegir entre dos; el stock pasa a 9,5 L.
- **Corrección aprobada (F6.6):** ya no se registra con el código COR-xxx. Es un movimiento DES nuevo enlazado al original, con su cargo.
- **Período en revisión:** la revisión de un mes se hace al terminar. Los primeros 10 días del mes, el período en revisión es el mes pasado; después, el mes en curso. Los tres anteriores están cerrados y repartidos. Así, hoy se revisa octubre, con sus datos, como en los mockups 21 y 22.
- **Confirmaciones:** guardan quién y cuándo confirmó. Los cargos y el monto salen siempre de la tabla de cargos (pendiente anotado en el paso 14).
- **Fecha pasada en encabezado e inicio:** si el período ya terminó, el encabezado dice "El cierre de octubre está en revisión" y el inicio del coordinador dice "en cuanto confirmen todos", en lugar de una fecha que ya pasó.
- **Período cerrado (F7.2):** no admite despachos, gastos ejecutados ni correcciones (pedirlas o aprobarlas) con fecha en su rango.

**Paso 18: Despacho (`/almacen/despacho`, mockup 18; F6.2, F6.3)**
- Por cada insumo, los lotes con stock: el sugerido es el que vence primero (o el que ingresó primero, si no vence) entre los que alcanzan. Los vencidos se ven, bloqueados; un lote que no alcanza también se bloquea. Si ningún lote alcanza, avisa y no deja confirmar.
- "Quién retira" con la lista de nombres que ya retiraron para el proyecto, y una observación opcional. El texto de confirmación resume qué sale de cada lote.
- Al confirmar, en una operación: líneas en la bitácora, stock de lote e insumo, cargo al proyecto, retiro en Ejecutado, auditoría, aviso al coordinador y revisión de la reposición automática. La tarjeta de éxito del mockup lleva a la bitácora y al siguiente despacho.
- Sin `?solicitud=`, abre el retiro aprobado más antiguo y fija la URL.

**Paso 19: Bitácora (`/proyectos/bitacora`, mockup 19; F6.3, F6.5)**
- El Coordinador ve sus proyectos (RN-07) y pide correcciones; el Aprobador la consulta completa (se habilitó para "Ver en la bitácora" del despacho).
- Filtros: proyecto, desde y hasta (por defecto, del inicio del período en revisión a hoy) e insumo. `?despacho=` resalta el despacho y lo deja a la vista.
- Los movimientos de corrección van sombreados, con "Corrige a DES-xxxx, aprobada por …"; el original dice "Corregido por …". Una corrección pendiente se ve como chip.
- "Pedir corrección": la cantidad o el proyecto (a otro proyecto propio), con el motivo obligatorio y el aviso del movimiento que se registraría. Queda pendiente en la bandeja (COR-007…) y avisa a los aprobadores.

**Paso 20: Uso de materia prima (`/proyectos/uso-materia-prima`, mockup 20; F6.4)**
- Proyecto, insumo (solo la materia prima despachada al proyecto), cantidad, fecha y observaciones.
- Balance: despachado, usado y lo que queda (o la diferencia), con la barra del mockup y la lista de usos. Cuenta el mes de la fecha y, si el período en revisión empezó antes, desde su inicio ("desde el 01/10").
- Si el uso supera lo despachado, avisa y deja guardar ("Guardar con la diferencia"), con un enlace para crear una solicitud de retiro.
- SP-07: el registro no descuenta stock (ya bajó con el despacho).
- La ficha del proyecto del coordinador gana dos enlaces de texto, "Bitácora" y "Registrar uso", que no estaban en el mockup 07.

**Paso 21: Revisión de cargos (`/cierre/cargos`, mockup 21; F7.1)**
- Selector de proyectos con su estado (por confirmar, corrección pendiente, confirmado con fecha), número de cargos y monto.
- Tabla de gastos y despachos del período (los gastos compartidos no entran), con el total. "Pedir corrección" en los despachos lleva a la bitácora y abre el diálogo si el despacho tiene una sola línea.
- "Confirmar los 12 cargos de QUI-024" deja la tarjeta de confirmado del mockup. Con una corrección pendiente no se confirma: avisa y bloquea el botón.

**Paso 22: Cierre de período (`/gastos-compartidos/cierre`, mockup 22; F7.1, F7.2)**
- Pasos 1 a 4 según el estado. Con la revisión abierta: el tablero (quién confirmó y cuándo, corrección pendiente, sin coordinador), el avance, el recordatorio a los coordinadores y "Cerrar octubre de 2026" con confirmación.
- SP-08: se puede cerrar sin todas las confirmaciones; la auditoría guarda cuáles faltaban.
- Sin revisión abierta: el formulario para abrir la siguiente (tipo y fechas sugeridas). Si el rango se cruza con otro período, muestra el aviso del mockup y no envía nada. Al abrir, crea las confirmaciones de los proyectos en ejecución y avisa a cada coordinador. Un período cerrado sin repartir lleva al reparto (paso 23).

**Contrato de la API**
- `GET /despachos/nuevo?solicitud`, `POST /despachos`.
- `GET /bitacora`, `POST /correcciones`.
- `GET` y `POST /usos-materia`.
- `GET /cierre/cargos`, `POST /cierre/confirmaciones`.
- `GET /cierre`, `POST /periodos` (409 con el período que se cruza), `POST /periodos/:id/cerrar`.

**Pruebas:** 9 nuevas (despacho, lote vencido, bitácora y corrección, movimiento enlazado, uso de materia prima, revisión y confirmación, corrección pendiente, tablero y cierre, cruce y apertura). En total pasan 121, tres veces seguidas.

**Corregido de paso**
- **Prueba del inventario:** con toda la suite en paralelo, su primera prueba pasó una vez del tiempo límite. Precarga la vista, como la ficha del insumo.
- **Despacho en el teléfono:** los nombres largos de ubicación aplastaban el código del lote. La ubicación va en su propia línea.

**Decisiones**
- **Columnas de lotes:** más anchas que en el mockup en escritorio, porque los nombres de ubicación del catálogo son largos.
- **"Asignar coordinador" en el tablero:** el Aprobador no puede asignarlo, así que la fila dice que lo asigna el Administrador.
- **"Pedir corrección" en la revisión de cargos:** solo en despachos. F6.5 corrige despachos; los gastos no tienen corrección.

### Pasos 23 a 26: reparto, reportes, auditoría y dashboard (02/11/2026)

Se hicieron en una sola corrida, a pedido. Cada vista se comparó con su mockup en capturas de 1280 px (claro y oscuro) y 390 px, sin scroll horizontal. La extensión de Chrome no llegó al servidor local en esta sesión, así que la revisión visual se hizo con Chrome sin interfaz (Playwright), como en los pasos anteriores.

**Base común (semilla y reglas)**
- **Gastos compartidos del período (SP-09):** son el costo de los lotes de consumibles de uso general **recibidos** en el rango (cantidad recibida × costo unitario). Los lotes guardan ahora la cantidad recibida (`recibido`), también al registrar una recepción. Cuatro lotes del mes en revisión (guantes, papel absorbente, alcohol isopropílico y jabón) suman US$ 1.000,00, como el mockup 23.
- **Cargos de la semilla:** los proyectos genéricos reparten sus compras y despachos en los últimos cuatro meses (antes caían casi todos en el mes en curso), y sus gastos compartidos, en los tres períodos ya repartidos. Así el gráfico de gasto por mes del dashboard tiene forma real. QUI-024 no cambia (12 cargos por US$ 1.284,50 en la revisión; 4.812 en total).
- **Repartos aplicados:** colección nueva con el criterio, el total y la parte de cada proyecto; la semilla trae los tres períodos repartidos. El resumen del reparto (F8.3) sale de aquí.
- **Auditoría:** el inicio y el cierre de sesión quedan registrados (acción `sesion`, entidad `sesion:<id>`). La semilla suma dos meses de historial (inicios de sesión de cada día hábil y el registro de cada despacho), hasta hace tres días. La actividad reciente del inicio no muestra las sesiones.

**Paso 23: Reparto de gastos compartidos (`/gastos-compartidos/reparto`, mockup 23; F7.3, F7.4)**
- El período cerrado sin repartir, con las tres cifras del mockup (gastos compartidos, consumo de los activos y proyectos activos) y los suspendidos que no participan (RN-05).
- Los dos criterios lado a lado; el consumo es lo despachado al proyecto en el período. Los montos se redondean al centavo hacia abajo y el residuo va al proyecto de código menor, con la nota del mockup.
- "Aplicar reparto…" en un solo paso: un cargo "compartido" por proyecto (entra al gasto ejecutado), el período pasa a repartido, se avisa a cada coordinador y queda en la auditoría. La tarjeta "Aplicado" descarga el resumen en PDF.
- Sin período por repartir: estado vacío con el último reparto, su PDF y el camino al cierre. Si nadie consumió, solo se puede repartir en partes iguales.

**Paso 24: Reportes (`/reportes`, mockup 24; F8.2 a F8.4)**
- Tres reportes: análisis de gastos (gastos, despachos y compartidos por proyecto), resumen del reparto (período repartido, criterio, consumo, porcentaje y monto) y hoja de vida de un equipo (usos, horas y reservas por proyecto, más el historial).
- Alcance por rol a la vista (RN-07): el Coordinador solo elige y ve sus proyectos; la hoja de vida le cuenta solo sus usos y reservas.
- La vista previa es la primera página real del PDF, con los filtros elegidos. Sin datos, avisa (con la fecha de registro del proyecto, si el rango es anterior) y desactiva las descargas: no se genera un archivo vacío.
- Los mocks arman un PDF de texto y un Excel (.xlsx) de verdad con los datos de la consulta (`testing/mocks/archivos.ts`); el formato final lo hará el backend.
- La entrada "Hoja de vida" del uso de equipo (vista 13) llega con el reporte y el equipo ya elegidos.

**Paso 25: Auditoría (`/auditoria`, mockup 25; F8.5, F8.6)**
- Lo más reciente primero, 10 por página, con el total. "Filtrar" abre usuario, acción, objeto (con espera al escribir) y fecha; el conteo dice qué se filtró.
- Cada fila se elige con clic o teclado; el detalle muestra fecha con segundos, usuario y rol, IP, el objeto (enlazado si el Administrador lo puede abrir), antes y después, justificación y detalle. Solo lectura (RN-06).
- La fila elegida se marca con `aria-current` (el mockup usa `aria-selected`, que en una tabla solo vale dentro de un grid).
- La paginación compartida se compacta con muchas páginas: primera, última y vecinas de la actual, con "…".

**Paso 26: Dashboard ejecutivo (`/dashboard`, mockup 03; F8.1)**
- Cuatro indicadores al día; cada uno abre el detalle que lo forma (proyectos, insumos bajo el mínimo con su reposición, lotes por vencer y vencidos).
- Ejecución presupuestaria con las barras del mockup (escala 0 a 120 %, línea del 100 %, tooltip que se cierra con Escape, ícono de alerta sobre el 100 %); gasto por mes con `GraficoColumnas`, que ahora raya el mes en curso y pone el valor en miles. Cada gráfico tiene "Ver como tabla".
- Filtros: período (los últimos cinco meses, el mes pasado o el último trimestre completo: cambia el gráfico de gasto por mes) y prioridad (cambia todo lo de proyectos).

**Contrato de la API**
- `GET /reparto`, `POST /periodos/:id/reparto`.
- `GET /reportes/opciones`, `GET /reportes/vista-previa`, `GET /reportes/:tipo?formato=pdf|xlsx` (409 si no hay datos).
- `GET /auditoria`.
- `GET /dashboard`.

**Pruebas:** 10 nuevas (reparto y su estado vacío; tres reportes y el aviso sin datos; auditoría con detalle, filtros y paginación; dashboard con detalle, tabla y prioridad). En total pasan 131. El build de producción no incluye MSW.

**Decisiones**
- **Cifras del mockup 23:** el consumo por proyecto sale de los despachos de la semilla, así que no son las del mockup (allí QUI-024 consumió US$ 172,60, que choca con sus US$ 644,50 de despachos del mockup 21). El total repartido sí es US$ 1.000,00.
- **Barras de ejecución:** se hicieron con HTML y CSS como el mockup, no con Recharts; el gráfico de gasto por mes sí usa Recharts.
- **Mes en curso en el dashboard:** a principios de mes casi no tiene gasto; se muestra igual, rayado, porque es el dato real.


### Correcciones de la revisión de vistas (02/11/2026)

Se aplicaron los 27 hallazgos de `revision/revision_vistas.md` (menos el REV-013, que sigue como decisión). Detalle por ID en el informe, sección «Correcciones aplicadas».

- **Alta:** REV-001 (la actividad reciente se ordena a mano), REV-002 (`EnvTabla`: la tabla que se desplaza pasa a ser una región con foco y nombre solo cuando desborda), REV-003 (lotes del despacho sin `<li>` dentro del `radiogroup`), REV-004 (búsqueda real: `GET /api/buscar?q=`, `/buscar`, con el alcance de cada rol).
- **Media:** REV-005 a REV-011 (avisos con el mes y el horario reales, saludo sin fecha vencida, reflujo a 320 px, cotización descargable con `GET /api/solicitudes/:id/cotizacion`, movimientos de la ficha con avances y gastos compartidos, reservas rechazadas con motivo, «Reintentar» en el despacho).
- **Baja:** REV-012 a REV-027, salvo el REV-013.
- **Mocks:** las reservas y los equipos «de hoy» cuentan todo el día; antes dependían de la hora a la que se corrían las pruebas.

**Contrato nuevo:** `GET /buscar`, `GET /solicitudes/:id/cotizacion`; `GET /reservas` trae `rechazadas` (coordinador); `GET /reportes/opciones` marca `repartido` en cada período; `GET /navegacion/contadores` trae `bandejaPorEjecutar`; la respuesta de `POST /despachos` trae `coordinador` y `aprobadaEl`.

**Pruebas:** 15 nuevas o ampliadas. En total pasan 146. Lint, tipos y Prettier sin fallos; el build no incluye MSW. Con los guiones de `revision/scripts/`: axe sin hallazgos en las vistas con REV-002 y REV-003, 25 de 25 vistas con «Reintentar», guardas conformes, los 5 flujos completos y sin desborde a 320 px.

### Decisiones y detalles menores tras la revisión (03/11/2026)

- **Decisiones del equipo** (requisitos v0.1.3): el lote vencido se ve bloqueado (HU-19 criterio 2 y F6.2); SP-06 (uso de equipo sin reserva), SP-07 (el uso de materia prima no descuenta stock) y SP-08 (el cierre no se bloquea) quedan resueltos. SP-09, SP-10 y SP-13 siguen por confirmar con el profesor: `docs/requisitos/hoja_preguntas_profesor.md` trae cada pregunta con la propuesta del equipo (lotes recibidos; 320, 390, 768 y 1280 px; reactivar suspendidos).
- **REV-015:** el inicio del Aprobador reserva la última fila de la bandeja para la primera reposición automática y enlaza a «Ver los N pedidos».
- **Esqueleto del inicio del Administrador:** era un falso positivo del guion (la página de llegada ya estaba en caché). Con carga real muestra el esqueleto.
- **Tableta (768 px):** 40 vistas sin scroll horizontal. Se corrigió que los textos ocultos de una tabla ancha ensancharan la página (`.tabla-env` con `position: relative`) y, a menos de 960 px, el dashboard y las reservas pasan a una columna y la bandeja angosta su lista.
- **Revisión con la extensión de Chrome:** no conectó (el token de Claude Code es de otra cuenta de claude.ai); se hizo con Chrome y Playwright.

**Pruebas según el día (03/11/2026).** La semilla es relativa a hoy y algunas pruebas dependían del día o de la hora. Se corrigió lo que fallaba el mismo día en que se corrían y se agregó `VITE_FECHA_PRUEBA` (por ejemplo `VITE_FECHA_PRUEBA=2026-11-07T10:00:00-04:00 npm run test`), que finge la fecha de toda la suite (`src/testing/fecha-prueba.ts`). Cambios: los despachos de QUI-024 se anclan al fin del mes en revisión (`delPeriodo`), las reservas próximas parten del primer día hábil después de hoy y la semana de reservas de otros proyectos se corre entera cuando hace falta. La lista de movimientos de la ficha ya no pierde un avance cuando falta solo un gasto compartido. Con las 147 pruebas pasan los días 1 a 10 de un mes (cuando el período en revisión es el mes pasado) y el 1 de diciembre; **a mitad de mes todavía fallan algunas** (el período en revisión pasa a ser el mes en curso y hay fechas fijas en las pruebas de auditoría, uso de materia prima e inicio). Está pendiente hacerlas independientes del día.

**Decisiones SP-09, SP-10 y SP-13 (03/11/2026).** Las tomó el equipo: SP-09 los lotes recibidos; SP-10 anchos de 320, 390, 768 y 1280 px y local con Docker Compose y despliegue verificado en la nube con Railway y Supabase; SP-13 se permite reactivar un proyecto suspendido. Requisitos v0.1.4. No cambia el comportamiento de la app. Solo queda por confirmar con el profesor SP-03 (parámetros generales). Se eliminó la hoja de preguntas para el profesor. El entorno local es Docker Compose (sección 10 del README) y el despliegue se verifica en la nube (sección 15), así que el README no cambia.
