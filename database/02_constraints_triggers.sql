-- ============================================================================
-- Sistema de Control de Proyectos y Recursos FaCyT
-- Constraints, Triggers and Immutability (Modules 1 to 8)
-- Target: PostgreSQL 17
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Immutability Trigger for audit_logs (RNF-12, RN-06)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.fn_prevent_audit_logs_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operación no permitida: El registro de auditoría (audit_logs) es estrictamente inmutable y no puede modificarse ni eliminarse (RNF-12).'
        USING ERRCODE = 'integrity_constraint_violation';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_logs_prevent_mutation') THEN
        CREATE TRIGGER trg_audit_logs_prevent_mutation
            BEFORE UPDATE OR DELETE ON app.audit_logs
            FOR EACH ROW
            EXECUTE FUNCTION app.fn_prevent_audit_logs_mutation();
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Immutability Trigger for dispatches (RNF-11, RF-23)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.fn_prevent_dispatches_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operación no permitida: La bitácora de despachos (dispatches) es estrictamente inmutable y no puede modificarse ni eliminarse (RNF-11). Use una solicitud de corrección (RF-35).'
        USING ERRCODE = 'integrity_constraint_violation';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_dispatches_prevent_mutation') THEN
        CREATE TRIGGER trg_dispatches_prevent_mutation
            BEFORE UPDATE OR DELETE ON app.dispatches
            FOR EACH ROW
            EXECUTE FUNCTION app.fn_prevent_dispatches_mutation();
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Strict Logical Deletion Trigger for users (F1.3)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.fn_prevent_user_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operación no permitida: Las cuentas de usuario no pueden eliminarse físicamente para conservar la trazabilidad histórica. Utilice la desactivación lógica (F1.3).'
        USING ERRCODE = 'integrity_constraint_violation';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_prevent_hard_delete') THEN
        CREATE TRIGGER trg_users_prevent_hard_delete
            BEFORE DELETE ON app.users
            FOR EACH ROW
            EXECUTE FUNCTION app.fn_prevent_user_hard_delete();
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Automatic updated_at timestamp maintenance
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
        CREATE TRIGGER trg_users_updated_at
            BEFORE UPDATE ON app.users
            FOR EACH ROW
            EXECUTE FUNCTION app.fn_update_timestamp();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_locations_updated_at') THEN
        CREATE TRIGGER trg_locations_updated_at
            BEFORE UPDATE ON app.locations
            FOR EACH ROW
            EXECUTE FUNCTION app.fn_update_timestamp();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_system_parameters_updated_at') THEN
        CREATE TRIGGER trg_system_parameters_updated_at
            BEFORE UPDATE ON app.system_parameters
            FOR EACH ROW
            EXECUTE FUNCTION app.fn_update_timestamp();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_projects_updated_at') THEN
        CREATE TRIGGER trg_projects_updated_at
            BEFORE UPDATE ON app.projects
            FOR EACH ROW
            EXECUTE FUNCTION app.fn_update_timestamp();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_items_updated_at') THEN
        CREATE TRIGGER trg_items_updated_at
            BEFORE UPDATE ON app.items
            FOR EACH ROW
            EXECUTE FUNCTION app.fn_update_timestamp();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_equipments_updated_at') THEN
        CREATE TRIGGER trg_equipments_updated_at
            BEFORE UPDATE ON app.equipments
            FOR EACH ROW
            EXECUTE FUNCTION app.fn_update_timestamp();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_requests_updated_at') THEN
        CREATE TRIGGER trg_requests_updated_at
            BEFORE UPDATE ON app.requests
            FOR EACH ROW
            EXECUTE FUNCTION app.fn_update_timestamp();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_accounting_periods_updated_at') THEN
        CREATE TRIGGER trg_accounting_periods_updated_at
            BEFORE UPDATE ON app.accounting_periods
            FOR EACH ROW
            EXECUTE FUNCTION app.fn_update_timestamp();
    END IF;

    -- D8: estas dos tablas también tienen updated_at y no tenían trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_project_milestones_updated_at') THEN
        CREATE TRIGGER trg_project_milestones_updated_at
            BEFORE UPDATE ON app.project_milestones
            FOR EACH ROW
            EXECUTE FUNCTION app.fn_update_timestamp();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_equipment_reservations_updated_at') THEN
        CREATE TRIGGER trg_equipment_reservations_updated_at
            BEFORE UPDATE ON app.equipment_reservations
            FOR EACH ROW
            EXECUTE FUNCTION app.fn_update_timestamp();
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Extension btree_gist and Conflict Prevention for Equipment Reservations (RF-22)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Decisión 2: solo ocupan la agenda las reservas Pendiente de Aprobación y Aprobado (un borrador no
-- aparta el equipo y lo ejecutado ya pasó). Se recrea siempre para que las bases existentes tomen la regla.
-- Sin EXCEPTION WHEN OTHERS: si falta btree_gist, el script debe fallar en vez de seguir sin la regla.
ALTER TABLE app.equipment_reservations DROP CONSTRAINT IF EXISTS uq_no_overlapping_equipment_reservations;
ALTER TABLE app.equipment_reservations
    ADD CONSTRAINT uq_no_overlapping_equipment_reservations
    EXCLUDE USING GIST (
        equipment_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    )
    WHERE (status IN ('Pendiente de Aprobación', 'Aprobado'));
