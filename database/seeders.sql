-- ============================================================================
-- Sistema de Control de Proyectos y Recursos FaCyT
-- Seeders for All 8 Modules
-- Target: PostgreSQL 17 (Schema: app)
-- Realistic data for Physics, Chemistry, and Biology laboratories
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Users (Passwords: Demo2026*) - 1 per each of the 3 roles + realistic team
-- ----------------------------------------------------------------------------
INSERT INTO app.users (id, full_name, email, password_hash, role, is_active)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'José Rodríguez', 'admin@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$sGb3wqbRh+uOZlKvSTIXug$4zIre8QE0BwDfe+0RgTDGNfPgJXkuDybcAyahG2XdXw', 'Administrador del Sistema', true),
    ('a0000000-0000-0000-0000-000000000002', 'Carmen Pérez', 'aprobador@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$sGb3wqbRh+uOZlKvSTIXug$4zIre8QE0BwDfe+0RgTDGNfPgJXkuDybcAyahG2XdXw', 'Aprobador / Gestor de Inventario', true),
    ('a0000000-0000-0000-0000-000000000003', 'Daniela Rivas', 'coord.quimica@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$sGb3wqbRh+uOZlKvSTIXug$4zIre8QE0BwDfe+0RgTDGNfPgJXkuDybcAyahG2XdXw', 'Coordinador de Proyecto', true),
    ('a0000000-0000-0000-0000-000000000004', 'María Fernanda Ochoa', 'coord.biologia@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$sGb3wqbRh+uOZlKvSTIXug$4zIre8QE0BwDfe+0RgTDGNfPgJXkuDybcAyahG2XdXw', 'Coordinador de Proyecto', true),
    ('a0000000-0000-0000-0000-000000000005', 'Andrés Salazar', 'coord.fisica@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$sGb3wqbRh+uOZlKvSTIXug$4zIre8QE0BwDfe+0RgTDGNfPgJXkuDybcAyahG2XdXw', 'Coordinador de Proyecto', true)
ON CONFLICT (email) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Storage Locations (F1.4)
-- ----------------------------------------------------------------------------
INSERT INTO app.locations (id, name, description, is_active)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Depósito de reactivos A', 'Planta baja, ala de Química', true),
    ('c0000000-0000-0000-0000-000000000002', 'Cuarto frío de Biología', 'Refrigeración controlada entre 2 y 8 °C', true),
    ('c0000000-0000-0000-0000-000000000003', 'Almacén de consumibles generales', 'Planta baja, junto a recepción', true),
    ('c0000000-0000-0000-0000-000000000004', 'Gabinete de solventes inflamables', 'Pasillo de Química, gabinete certificado NFPA', true)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. System Parameters (F1.5)
-- ----------------------------------------------------------------------------
INSERT INTO app.system_parameters (id, parameter_key, parameter_value, label, description, unit, updated_by_user_id)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'batch_expiration_alert_days', 30, 'Anticipación de la alerta de vencimiento', 'Un lote aparece como "Próximo a vencer" cuando le quedan estos días o menos.', 'días', 'a0000000-0000-0000-0000-000000000001'),
    ('d0000000-0000-0000-0000-000000000002', 'min_dispatch_history_months', 3, 'Historial mínimo para mostrar el pronóstico', 'Con menos meses de despachos, la ficha del insumo indica "Sin historial suficiente para pronosticar".', 'meses', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (parameter_key) DO UPDATE
SET parameter_value = EXCLUDED.parameter_value,
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    unit = EXCLUDED.unit;

-- ----------------------------------------------------------------------------
-- 4. Projects (M2: Realistic Chemistry, Biology & Physics projects)
-- ----------------------------------------------------------------------------
-- Solo QUI-024 tiene su plan de hitos confirmado (pesos 30 + 40 + 30 = 100): su avance físico es
-- 30 × 100 % + 40 × 37,5 % = 45 %. Los otros dos todavía no cargan el plan: avance "No disponible".
INSERT INTO app.projects (id, code, title, area, operational_status, priority_level, assigned_budget, physical_progress_pct, plan_confirmed, coordinator_id)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'QUI-024', 'Síntesis de nanopartículas para catálisis heterogénea', 'Química', 'En ejecución', 'Alta', 8500.00, 45.00, true, 'a0000000-0000-0000-0000-000000000003'),
    ('b0000000-0000-0000-0000-000000000002', 'BIO-011', 'Bioensayos microbiológicos en aguas residuales industriales', 'Biología', 'En ejecución', 'Crítica', 12000.00, 0.00, false, 'a0000000-0000-0000-0000-000000000004'),
    ('b0000000-0000-0000-0000-000000000003', 'FIS-008', 'Caracterización óptica de películas delgadas semiconductoras', 'Física', 'En ejecución', 'Media', 6200.00, 0.00, false, 'a0000000-0000-0000-0000-000000000005')
ON CONFLICT (code) DO NOTHING;

-- Project Milestones (M2)
INSERT INTO app.project_milestones (id, project_id, name, description, weight, current_progress_pct, target_date, position)
VALUES
    ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Fase 1: Preparación de precursores químicos', 'Purificación de sales y solventes de grado analítico', 30.00, 100.00, CURRENT_DATE - INTERVAL '15 days', 1),
    ('b1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Fase 2: Síntesis hidrotérmica y calcinación', 'Operación controlada en reactor y mufla', 40.00, 37.50, CURRENT_DATE + INTERVAL '45 days', 2),
    ('b1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Fase 3: Pruebas catalíticas y reporte final', 'Cálculo de rendimiento y selectividad', 30.00, 0.00, CURRENT_DATE + INTERVAL '90 days', 3)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. Unified Items Catalog (M3: Raw material, Project consumable, General overhead)
-- ----------------------------------------------------------------------------
INSERT INTO app.items (id, name, unit_of_measure, item_type, current_stock, min_stock, forecasted_consumption, is_active)
VALUES
    ('e0000000-0000-0000-0000-000000000001', 'Nitrato de Plata Reactivo (AgNO3)', 'g', 'Materia prima', 500.000, 100.000, 150.000, true),
    ('e0000000-0000-0000-0000-000000000002', 'Agar Nutritivo Bacteriológico', 'g', 'Materia prima', 1200.000, 300.000, 400.000, true),
    ('e0000000-0000-0000-0000-000000000003', 'Sustratos de Cuarzo 25x25mm', 'unidad', 'Consumible de proyecto', 80.000, 20.000, 30.000, true),
    ('e0000000-0000-0000-0000-000000000004', 'Guantes de Nitrilo Talla M (Caja x100)', 'caja', 'Consumible de uso general', 25.000, 5.000, 10.000, true),
    ('e0000000-0000-0000-0000-000000000005', 'Etanol Absoluto 99.8%', 'L', 'Consumible de uso general', 40.000, 10.000, 15.000, true),
    ('e0000000-0000-0000-0000-000000000006', 'Papel Absoluto de Laboratorio', 'rollo', 'Consumible de uso general', 50.000, 12.000, 20.000, true)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. Equipments (M4: 3 Laboratory Assets)
-- ----------------------------------------------------------------------------
INSERT INTO app.equipments (id, asset_code, name, location_id, operational_status, description)
VALUES
    ('f0000000-0000-0000-0000-000000000001', 'EQ-FACYT-001', 'Espectrofotómetro UV-Vis Shimadzu', 'c0000000-0000-0000-0000-000000000001', 'Disponible', 'Rango espectral 190-1100 nm, con celdas de cuarzo'),
    ('f0000000-0000-0000-0000-000000000002', 'EQ-FACYT-002', 'Autoclave Vertical Digital 75L', 'c0000000-0000-0000-0000-000000000002', 'Disponible', 'Esterilización por vapor a 121 °C / 134 °C'),
    ('f0000000-0000-0000-0000-000000000003', 'EQ-FACYT-003', 'Evaporadora Térmica para Películas Delgadas', 'c0000000-0000-0000-0000-000000000001', 'En uso', 'Cámara de alto vacío con fuente resistiva para metales')
ON CONFLICT (asset_code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. Batches (M6: Initial stock lots)
-- ----------------------------------------------------------------------------
INSERT INTO app.batches (id, item_id, location_id, batch_number, initial_quantity, available_quantity, unit_cost, supplier, received_date, expiration_date, expiration_status)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'LOT-AG-2026-01', 500.000, 500.000, 2.85, 'Merck Químicos C.A.', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '365 days', 'Vigente'),
    ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'LOT-AGAR-2026-A', 1200.000, 1200.000, 0.45, 'Bioquim de Venezuela', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '180 days', 'Vigente'),
    ('10000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 'LOT-GLV-2026-X', 30.000, 25.000, 14.50, 'Suministros Médicos del Centro', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '720 days', 'Vigente'),
    ('10000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000004', 'LOT-ETOH-2026-02', 50.000, 40.000, 6.20, 'Distribuidora Química Carabobo', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '500 days', 'Vigente')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8. Dispatches (M6: Sample dispatch in immutable outbounds)
-- ----------------------------------------------------------------------------
INSERT INTO app.dispatches (id, dispatch_number, batch_id, project_id, dispatched_quantity, unit_cost_snapshot, dispatched_by, received_by_name, is_compensatory, original_dispatch_id)
VALUES
    ('20000000-0000-0000-0000-000000000001', 'DSP-2026-0001', '10000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 5.000, 14.50, 'a0000000-0000-0000-0000-000000000002', 'Dr. Carlos Mendoza', false, NULL)
ON CONFLICT (dispatch_number) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 9. Initial Audit Log Entry (F8.5)
-- ----------------------------------------------------------------------------
INSERT INTO app.audit_logs (timestamp, user_id, ip_address, action_type, target_object, target_table, target_id, old_value, new_value, justification)
VALUES
    (clock_timestamp(), 'a0000000-0000-0000-0000-000000000001', '127.0.0.1', 'SYSTEM_INITIALIZATION', 'SYSTEM:SEED', 'system', 'root', NULL, jsonb_build_object('status', 'Initialized relational database schema and seeders for Modules 1-8'), 'Data seeding execution');


-- ----------------------------------------------------------------------------
-- 10. Gastos compartidos (M7): el mes de hace dos meses, revisado, cerrado y a la espera del reparto.
--     Los gastos compartidos son los lotes de consumibles de uso general recibidos en su rango (SP-09).
--     Sin repartir a propósito: un reparto cambiaría el gasto ejecutado de los proyectos de la semilla.
-- ----------------------------------------------------------------------------
INSERT INTO app.accounting_periods (id, period_name, period_type, start_date, end_date, status, total_overhead_cost,
                                    opened_by_user_id, closed_by_user_id, closed_at, created_at, updated_at)
SELECT '70000000-0000-0000-0000-000000000001',
       (ARRAY['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
              'noviembre', 'diciembre'])[EXTRACT(MONTH FROM m.inicio)::int] || ' de ' || EXTRACT(YEAR FROM m.inicio)::int,
       'Mensual', m.inicio, m.fin, 'Cerrado',
       COALESCE((SELECT SUM(b.initial_quantity * b.unit_cost)
                 FROM app.batches b JOIN app.items i ON i.id = b.item_id
                 WHERE i.item_type = 'Consumible de uso general' AND b.received_date BETWEEN m.inicio AND m.fin), 0),
       'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002',
       (m.fin + TIME '17:00') AT TIME ZONE 'America/Caracas',
       (m.fin - 8 + TIME '09:00') AT TIME ZONE 'America/Caracas',
       (m.fin + TIME '17:00') AT TIME ZONE 'America/Caracas'
FROM (SELECT date_trunc('month', CURRENT_DATE - INTERVAL '2 months')::date AS inicio,
             (date_trunc('month', CURRENT_DATE - INTERVAL '1 month') - INTERVAL '1 day')::date AS fin) m
ON CONFLICT (id) DO NOTHING;

INSERT INTO app.period_project_confirmations (id, period_id, project_id, coordinator_user_id, confirmed, confirmed_at)
SELECT c.id::uuid, '70000000-0000-0000-0000-000000000001', c.proyecto::uuid, c.coordinador::uuid, true,
       p.closed_at - c.antes
FROM (VALUES
    ('70000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', INTERVAL '3 days'),
    ('70000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', INTERVAL '2 days'),
    ('70000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005', INTERVAL '1 day')
) AS c(id, proyecto, coordinador, antes)
JOIN app.accounting_periods p ON p.id = '70000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 11. Inventario y almacén (M3, M6) con datos para las alertas, la bitácora y el pronóstico (D11).
--     Ids 3x...: insumos 30…, lotes 31…, despachos 32…, usos de materia prima 33….
--     - Acetona: bajo su mínimo (alerta y reposición al primer movimiento).
--     - Tripsina: su único lote vence en 12 días ("Próximo a vencer").
--     - Peptona: un lote vencido con existencia (no se despacha) y otro vigente.
--     - Medio LB agar: despachos mensuales a BIO-011 (seis meses, sin el mes cerrado de M7) para el
--       pronóstico, y un uso de materia prima registrado este mes. El stock de cada insumo es la suma
--       de sus lotes y cada lote descuenta lo despachado.
--     No toca QUI-024: su gasto ejecutado sigue en 72,50 (pruebas de base_datos).
-- ----------------------------------------------------------------------------
INSERT INTO app.items (id, name, unit_of_measure, item_type, current_stock, min_stock, is_active)
VALUES
    ('30000000-0000-0000-0000-000000000001', 'Acetona grado analítico', 'L', 'Materia prima', 2.500, 5.000, true),
    ('30000000-0000-0000-0000-000000000002', 'Tripsina 0,25 %', 'L', 'Materia prima', 0.400, 0.200, true),
    ('30000000-0000-0000-0000-000000000003', 'Medio LB agar', 'kg', 'Materia prima', 2.300, 0.500, true),
    ('30000000-0000-0000-0000-000000000004', 'Peptona de caseína', 'kg', 'Materia prima', 1.500, 0.500, true)
ON CONFLICT DO NOTHING;

INSERT INTO app.batches (id, item_id, location_id, batch_number, supplier_lot_code, initial_quantity, available_quantity,
                         unit_cost, supplier, received_date, expiration_date, expiration_status)
VALUES
    ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004',
     'L-0101', 'MK-AC-2291', 2.500, 2.500, 18.40, 'Merck Químicos C.A.', CURRENT_DATE - 40, CURRENT_DATE + 400, 'Vigente'),
    ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002',
     'L-0102', 'TRP-0925', 0.400, 0.400, 95.00, 'Bioquim de Venezuela', CURRENT_DATE - 60, CURRENT_DATE + 12, 'Próximo a vencer'),
    ('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002',
     'L-0103', 'LB-44817', 5.000, 2.300, 58.00, 'Bioquim de Venezuela', (date_trunc('month', CURRENT_DATE) - INTERVAL '7 months')::date,
     CURRENT_DATE + 200, 'Vigente'),
    ('31000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002',
     'L-0104', 'PEP-1187', 0.500, 0.500, 42.00, 'Bioquim de Venezuela', CURRENT_DATE - 300, CURRENT_DATE - 6, 'Vencido'),
    ('31000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002',
     'L-0105', 'PEP-1342', 1.000, 1.000, 42.00, 'Bioquim de Venezuela', CURRENT_DATE - 20, CURRENT_DATE + 300, 'Vigente')
ON CONFLICT DO NOTHING;

-- Un despacho por mes (día 10, 10:00 en Caracas); el mes de hace dos meses está cerrado en M7 y queda sin despachos
INSERT INTO app.dispatches (id, dispatch_number, movement_code, batch_id, project_id, dispatched_quantity, direction,
                            unit_cost_snapshot, dispatched_by, received_by_name, is_compensatory, dispatched_at)
SELECT d.id::uuid, d.codigo, d.codigo, '31000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002',
       d.cantidad, 'salida', 58.00, 'a0000000-0000-0000-0000-000000000002', 'Lic. Pedro Gómez', false,
       ((date_trunc('month', CURRENT_DATE)::date - d.meses * INTERVAL '1 month')::date + d.dia + TIME '10:00')
           AT TIME ZONE 'America/Caracas'
FROM (VALUES
    ('32000000-0000-0000-0000-000000000001', 'DES-0101', 6, 9, 0.400),
    ('32000000-0000-0000-0000-000000000002', 'DES-0102', 5, 9, 0.500),
    ('32000000-0000-0000-0000-000000000003', 'DES-0103', 4, 9, 0.450),
    ('32000000-0000-0000-0000-000000000004', 'DES-0104', 3, 9, 0.600),
    ('32000000-0000-0000-0000-000000000005', 'DES-0105', 1, 9, 0.550),
    ('32000000-0000-0000-0000-000000000006', 'DES-0106', 0, 0, 0.200)
) AS d(id, codigo, meses, dia, cantidad)
ON CONFLICT (dispatch_number) DO NOTHING;

INSERT INTO app.raw_material_usages (id, project_id, item_id, reported_by_user_id, quantity_used, usage_date, notes)
VALUES
    ('33000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003',
     'a0000000-0000-0000-0000-000000000004', 0.150, date_trunc('month', CURRENT_DATE)::date, 'Preparación de placas para el bioensayo')
ON CONFLICT DO NOTHING;
