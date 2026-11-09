## Limitaciones conocidas del Módulo 4 (Equipos y Reservas)

### F4.6 — Registro de uso de equipos sin estado “En uso” automático

El modelo de datos actual define `EquipmentUsage.end_time` y `EquipmentUsage.used_hours`
como columnas obligatorias (`nullable=False`). Por esa razón, en esta versión el
coordinador registra un uso **ya finalizado** (hora de inicio y hora de fin en la
misma operación). El sistema calcula automáticamente `used_hours` a partir del rango.

Consecuencias:

- El estado operacional **“En uso”** no se activa automáticamente al registrar un uso.
  El equipo permanece en “Disponible” o “En mantenimiento” según corresponda.
- No existe un endpoint de “cerrar uso” porque no hay usos abiertos.
- El Administrador solo puede alternar manualmente entre **“Disponible”** y
  **“En mantenimiento”**. El estado “En uso” queda reservado para una versión futura
  en la que el modelo permita usos abiertos.

Esta limitación se documenta explícitamente porque el enunciado (F4.6) describe un
flujo de uso abierto. Se resolvió así por restricciones del modelo entregado por el
equipo; modificarlo requeriría migraciones que no forman parte de esta entrega.

### F4.2 — Cancelación automática de reservas al pasar a mantenimiento

Cuando un equipo pasa a **“En mantenimiento”**, el sistema cancela automáticamente
todas las reservas en estado **“Pendiente de Aprobación”** o **“Aprobado”** cuya
`start_time` sea futura. Cada reserva cancelada:

- pasa al estado **“Cancelado”** (estado final, extensión de RN-03 para reservas),
- registra una entrada de auditoría con `action_type = "RESERVATION_CANCELLED_MAINTENANCE"`,
- se devuelve en la respuesta del endpoint `PATCH /equipos/{id}/status` junto con un
  mensaje de advertencia.

No existe endpoint manual de cancelación de reservas en esta versión.