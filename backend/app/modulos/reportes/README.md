## Módulo 8 (Reportes, dashboard y auditoría)

Contrato del frontend (`frontend/src/testing/mocks/handlers/{reportes,dashboard,auditoria}.ts`):

| Ruta | Quién | Archivo |
|---|---|---|
| `GET /api/reportes/opciones` | todos (el Coordinador, solo sus proyectos) | `contrato.py` |
| `GET /api/reportes/vista-previa?tipo&desde&hasta&proyectoIds&periodo&equipo` | todos | `contrato.py` |
| `GET /api/reportes/{gastos\|reparto\|hoja-de-vida}?formato=pdf\|xlsx&...` | todos | `contrato.py` |
| `GET /api/dashboard?periodo&prioridad` | Administrador | `contrato.py` |
| `GET /api/auditoria?usuario&accion&objeto&desde&pagina` | Administrador | `app/auditoria/contrato.py` |

- **Archivos.** PDF con reportlab (encabezado institucional y "Página i de n") y Excel con openpyxl (los
  montos van como número). Sin datos no se genera el archivo: 409 con el motivo, igual que la vista previa
  devuelve `vacio`.
- **Gasto ejecutado.** Sale de los movimientos (vista `app.v_project_spend`, decisión 5): despachos
  valorizados con signo, gastos ejecutados y la parte de los gastos compartidos. El análisis de gastos y el
  gráfico del dashboard usan las mismas tres fuentes por fecha (un gasto cuenta el día en que se ejecutó; el
  reparto, el día en que se aplicó).
- **Fechas.** Días en `APP_TIMEZONE` (`formato.py`), no en UTC.
- **RN-07.** El Coordinador solo incluye sus proyectos; pedir uno ajeno responde 404.
- **Hoja de vida (F8.4).** Los cambios de estado del equipo salen de `audit_logs` (no hay tabla propia).
- **Auditoría (F8.5, F8.6).** Solo lectura. Cada módulo registra con `record_audit_log` y, para que se lea
  bien, guarda `new_value.descripcion` y `new_value.detalle`; las filas sin descripción se describen en
  español a partir de `action_type` y del objeto.

`service.py` y `schemas.py` son la versión anterior (snake_case); ya no están montados en la app.
