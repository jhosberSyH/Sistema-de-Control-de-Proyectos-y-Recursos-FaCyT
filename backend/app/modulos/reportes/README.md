## Módulo 8 (Reportes y Auditoría)

### Dependencias nuevas
Se agregaron `reportlab>=4.2.0` (PDF) y `openpyxl>=3.1.0` (Excel) al requirements.txt.

### F8.5 — Registro automático
El registro de auditoría ya estaba implementado desde el Módulo 1. El Módulo 8
no expone un endpoint para "crear" logs; solo consulta y exporta. Cada mutación de
M1 a M7 sigue llamando a `record_audit_log` antes del commit.

### F8.4 — Cambios de estado del equipo
Los cambios de estado operacional se reconstruyen consultando `audit_logs`
(`target_table='equipments'`, `action_type='EQUIPMENT_STATUS_CHANGE'`,
`target_id=<id>`). No hay tabla específica para eso.

### F8.2 — Alcance del coordinador
El coordinador solo puede exportar gastos de sus proyectos (RN-07). Si envía
`proyecto_ids` con proyectos ajenos, el servidor los ignora.

### F8.3 — Coordinador
El coordinador solo ve sus filas en el resumen de prorrateo, pero el costo total
del overhead del período sigue siendo el global (es el dato de contexto del
período).

### F8.2 / F8.3 / F8.4 — Rangos de fecha
Si se envía `periodo_id`, se usa el rango del `AccountingPeriod`. Si no, se
exigen `fecha_inicio` y `fecha_fin` en formato `YYYY-MM-DD`. Las comparaciones
de fecha se hacen con `func.date(...)` sobre los timestamps con timezone.

### F8.1 — Cálculo de `executed_budget`
El dashboard recalcula el `executed_budget` de cada proyecto activo con
`recalculate_project_metrics` del Módulo 2, por consistencia con D10. Esto
puede diferir ligeramente de un valor persistido si otros módulos no lo
recalcularon, pero el dashboard siempre muestra el valor correcto.