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
    ('a0000000-0000-0000-0000-000000000001', 'José Rodríguez', 'admin@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$j29f8f4h28gh48f2h48f$sC0+Nq0t9O4/Fm7eZ4pX1aQ7wK4uI6rE3tY8uI2oP5a', 'Administrador del Sistema', true),
    ('a0000000-0000-0000-0000-000000000002', 'Carmen Pérez', 'aprobador@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$j29f8f4h28gh48f2h48f$sC0+Nq0t9O4/Fm7eZ4pX1aQ7wK4uI6rE3tY8uI2oP5a', 'Aprobador / Gestor de Inventario', true),
    ('a0000000-0000-0000-0000-000000000003', 'Daniela Rivas', 'coord.quimica@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$j29f8f4h28gh48f2h48f$sC0+Nq0t9O4/Fm7eZ4pX1aQ7wK4uI6rE3tY8uI2oP5a', 'Coordinador de Proyecto', true),
    ('a0000000-0000-0000-0000-000000000004', 'María Fernanda Ochoa', 'coord.biologia@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$j29f8f4h28gh48f2h48f$sC0+Nq0t9O4/Fm7eZ4pX1aQ7wK4uI6rE3tY8uI2oP5a', 'Coordinador de Proyecto', true),
    ('a0000000-0000-0000-0000-000000000005', 'Andrés Salazar', 'coord.fisica@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$j29f8f4h28gh48f2h48f$sC0+Nq0t9O4/Fm7eZ4pX1aQ7wK4uI6rE3tY8uI2oP5a', 'Coordinador de Proyecto', true)
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
INSERT INTO app.projects (id, code, title, operational_status, priority_level, assigned_budget, executed_budget, physical_progress_pct, coordinator_id)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'QUI-024', 'Síntesis de nanopartículas para catálisis heterogénea', 'En ejecución', 'Alta', 8500.00, 3200.00, 45.00, 'a0000000-0000-0000-0000-000000000003'),
    ('b0000000-0000-0000-0000-000000000002', 'BIO-011', 'Bioensayos microbiológicos en aguas residuales industriales', 'En ejecución', 'Crítica', 12000.00, 6800.00, 60.00, 'a0000000-0000-0000-0000-000000000004'),
    ('b0000000-0000-0000-0000-000000000003', 'FIS-008', 'Caracterización óptica de películas delgadas semiconductoras', 'En ejecución', 'Media', 6200.00, 2900.00, 30.00, 'a0000000-0000-0000-0000-000000000005')
ON CONFLICT (code) DO NOTHING;

-- Project Milestones (M2)
INSERT INTO app.project_milestones (id, project_id, name, description, weight, current_progress_pct, target_date)
VALUES
    ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Fase 1: Preparación de precursores químicos', 'Purificación de sales y solventes de grado analítico', 30.00, 100.00, CURRENT_DATE - INTERVAL '15 days'),
    ('b1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Fase 2: Síntesis hidrotérmica y calcinación', 'Operación controlada en reactor y mufla', 40.00, 37.50, CURRENT_DATE + INTERVAL '45 days'),
    ('b1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Fase 3: Pruebas catalíticas y reporte final', 'Cálculo de rendimiento y selectividad', 30.00, 0.00, CURRENT_DATE + INTERVAL '90 days')
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

