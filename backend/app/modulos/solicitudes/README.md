## Limitaciones conocidas del Módulo 5 (Solicitudes y Priorización)

### F5.1 — Uso de `decision_reason` para la descripción

El modelo `Request` no incluye un campo `description`. Para cumplir con F5.1
sin modificar el modelo, la descripción libre que escribe el coordinador se
almacena en `decision_reason` con la etiqueta `[DESCRIPCION]`. El campo se
reutiliza como un mini-historial de texto con secciones etiquetadas:

- `[DESCRIPCION]` — descripción original del coordinador.
- `[APROBACION]` — nota opcional del aprobador al aprobar.
- `[RECHAZO]` — motivo obligatorio del rechazo.
- `[EJECUCION]` — monto real registrado al ejecutar.

La descripción nunca se pierde. El frontend puede mostrarla en un campo separado
parseando la línea `[DESCRIPCION]`. Esto difiere del Módulo 3 (reposición
automática), donde `decision_reason` se sobrescribe porque la descripción la
genera el sistema y no hay riesgo de perder texto del usuario.

### F5.1 — Servicios

En esta versión los ítems de una solicitud deben existir en el catálogo
unificado de insumos (`Item`). No se permite registrar solicitudes de
"servicios" que no estén en el catálogo. Para solicitar un servicio, primero se
debe crear un insumo que lo represente.

### F5.5 — Retiros no se ejecutan en M5

Las solicitudes de Retiro pasan a `Ejecutado` cuando el Módulo 6 confirma el
despacho. El endpoint `POST /solicitudes/{id}/ejecutar` rechaza Retiros con
`409`.

### F5.6 / F5.7 — Prefijo `/priorizacion`

Las operaciones de priorización viven bajo `/priorizacion/proyectos` para no
colisionar con las rutas `/proyectos` y `/proyectos/{id}` del Módulo 2.