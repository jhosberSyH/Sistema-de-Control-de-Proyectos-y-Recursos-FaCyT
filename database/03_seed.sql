-- ============================================================================
-- Sistema de Control de Proyectos y Recursos FaCyT
-- Script 03: Seed Data (Demo Evaluation Environment)
-- Target: PostgreSQL 17
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Initial Users (Passwords default to Demo2026*)
-- ----------------------------------------------------------------------------
INSERT INTO app.users (id, full_name, email, password_hash, role, is_active)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'José Rodríguez', 'admin@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$j29f8f4h28gh48f2h48f$sC0+Nq0t9O4/Fm7eZ4pX1aQ7wK4uI6rE3tY8uI2oP5a', 'Administrador del Sistema', true),
    ('a0000000-0000-0000-0000-000000000002', 'Carmen Pérez', 'aprobador@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$j29f8f4h28gh48f2h48f$sC0+Nq0t9O4/Fm7eZ4pX1aQ7wK4uI6rE3tY8uI2oP5a', 'Aprobador / Gestor de Inventario', true),
    ('a0000000-0000-0000-0000-000000000003', 'Daniela Rivas', 'coord.quimica@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$j29f8f4h28gh48f2h48f$sC0+Nq0t9O4/Fm7eZ4pX1aQ7wK4uI6rE3tY8uI2oP5a', 'Coordinador de Proyecto', true),
    ('a0000000-0000-0000-0000-000000000004', 'María Fernanda Ochoa', 'coord.biologia@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$j29f8f4h28gh48f2h48f$sC0+Nq0t9O4/Fm7eZ4pX1aQ7wK4uI6rE3tY8uI2oP5a', 'Coordinador de Proyecto', true),
    ('a0000000-0000-0000-0000-000000000005', 'Andrés Salazar', 'coord.fisica@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$j29f8f4h28gh48f2h48f$sC0+Nq0t9O4/Fm7eZ4pX1aQ7wK4uI6rE3tY8uI2oP5a', 'Coordinador de Proyecto', true),
    ('a0000000-0000-0000-0000-000000000006', 'Rosa Linares', 'r.linares@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$j29f8f4h28gh48f2h48f$sC0+Nq0t9O4/Fm7eZ4pX1aQ7wK4uI6rE3tY8uI2oP5a', 'Coordinador de Proyecto', true),
    ('a0000000-0000-0000-0000-000000000007', 'Luis Mendoza', 'l.mendoza@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$j29f8f4h28gh48f2h48f$sC0+Nq0t9O4/Fm7eZ4pX1aQ7wK4uI6rE3tY8uI2oP5a', 'Aprobador / Gestor de Inventario', true),
    ('a0000000-0000-0000-0000-000000000008', 'Pedro Gil', 'p.gil@cpq.local', '$argon2id$v=19$m=65536,t=3,p=4$j29f8f4h28gh48f2h48f$sC0+Nq0t9O4/Fm7eZ4pX1aQ7wK4uI6rE3tY8uI2oP5a', 'Coordinador de Proyecto', false)
ON CONFLICT (email) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Initial Projects (for coordinator impact checks)
-- ----------------------------------------------------------------------------
INSERT INTO app.projects (id, code, title, status, priority, assigned_budget, executed_budget, coordinator_id)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'QUI-024', 'Síntesis de nanopartículas para catálisis heterogénea', 'En ejecución', 'Alta', 8500.00, 3200.00, 'a0000000-0000-0000-0000-000000000003'),
    ('b0000000-0000-0000-0000-000000000002', 'QUI-031', 'Extracción de alcaloides de flora autóctona', 'En ejecución', 'Media', 4500.00, 1100.00, 'a0000000-0000-0000-0000-000000000003'),
    ('b0000000-0000-0000-0000-000000000003', 'BIO-011', 'Bioensayos microbiológicos en aguas residuales', 'En ejecución', 'Crítica', 12000.00, 6800.00, 'a0000000-0000-0000-0000-000000000004'),
    ('b0000000-0000-0000-0000-000000000004', 'FIS-008', 'Caracterización óptica de películas delgadas', 'En ejecución', 'Media', 6200.00, 2900.00, 'a0000000-0000-0000-0000-000000000005'),
    ('b0000000-0000-0000-0000-000000000005', 'FIS-010', 'Modelado numérico de cavidades resonantes', 'En ejecución', 'Baja', 3100.00, 450.00, 'a0000000-0000-0000-0000-000000000005'),
    ('b0000000-0000-0000-0000-000000000006', 'QUI-027', 'Purificación de reactivos cromatográficos', 'Propuesta', 'Baja', 2000.00, 0.00, 'a0000000-0000-0000-0000-000000000006')
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Storage Locations (F1.4)
-- ----------------------------------------------------------------------------
INSERT INTO app.locations (id, name, description, is_active)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Depósito de reactivos A', 'Planta baja, ala de Química', true),
    ('c0000000-0000-0000-0000-000000000002', 'Depósito de reactivos B', 'Sótano, cuarto ventilado', true),
    ('c0000000-0000-0000-0000-000000000003', 'Cuarto frío de Biología', 'Refrigeración controlada entre 2 y 8 °C', true),
    ('c0000000-0000-0000-0000-000000000004', 'Congelador −20 °C', 'Laboratorio de Microbiología', true),
    ('c0000000-0000-0000-0000-000000000005', 'Gabinete de solventes inflamables', 'Pasillo de Química, gabinete certificado NFPA', true),
    ('c0000000-0000-0000-0000-000000000006', 'Almacén de consumibles generales', 'Planta baja, junto a recepción', true),
    ('c0000000-0000-0000-0000-000000000007', 'Estante temporal 3', 'Ubicación histórica usada durante la mudanza de 2025', false)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Initial Batches (Attached to locations to test F1.4 delete prevention)
-- ----------------------------------------------------------------------------
INSERT INTO app.batches (location_id, batch_number, initial_quantity, current_quantity, unit_cost, expiration_date)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'LOTE-REACT-2026-A1', 50.000, 32.500, 45.00, CURRENT_DATE + INTERVAL '120 days'),
    ('c0000000-0000-0000-0000-000000000003', 'LOTE-BIO-2026-C3', 20.000, 18.000, 120.00, CURRENT_DATE + INTERVAL '15 days')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. System Parameters (F1.5)
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
-- 6. Initial Audit Log entry (Seed initialization trace)
-- ----------------------------------------------------------------------------
INSERT INTO app.audit_log (timestamp, user_id, ip_address, target_object, action_type, old_value, new_value)
VALUES
    (clock_timestamp(), 'a0000000-0000-0000-0000-000000000001', '127.0.0.1', 'SYSTEM_INITIALIZATION', 'SEED', NULL, jsonb_build_object('status', 'Initialized database structure and seed data for Module 1'));

