-- ============================================================================
-- Sistema de Control de Proyectos y Recursos FaCyT
-- Script 02: Constraints, Triggers and Immutability
-- Target: PostgreSQL 17
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Immutability Trigger for audit_log (RNF-12, RN-06)
-- Nobody, not even the Administrator, can UPDATE or DELETE audit_log records.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.fn_prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operación no permitida: El registro de auditoría (audit_log) es estrictamente inmutable y no puede modificarse ni eliminarse (RNF-12).'
        USING ERRCODE = 'integrity_constraint_violation';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_prevent_mutation ON app.audit_log;
CREATE TRIGGER trg_audit_log_prevent_mutation
    BEFORE UPDATE OR DELETE ON app.audit_log
    FOR EACH ROW
    EXECUTE FUNCTION app.fn_prevent_audit_log_mutation();

-- ----------------------------------------------------------------------------
-- 2. Strict Logical Deletion Trigger for users (F1.3)
-- Prevents hard DELETE operations on user accounts to preserve audit trails.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.fn_prevent_user_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operación no permitida: Las cuentas de usuario no pueden eliminarse físicamente para conservar la trazabilidad histórica. Utilice la desactivación lógica (F1.3).'
        USING ERRCODE = 'integrity_constraint_violation';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_prevent_hard_delete ON app.users;
CREATE TRIGGER trg_users_prevent_hard_delete
    BEFORE DELETE ON app.users
    FOR EACH ROW
    EXECUTE FUNCTION app.fn_prevent_user_hard_delete();

-- ----------------------------------------------------------------------------
-- 3. Automatic updated_at timestamp maintenance
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON app.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON app.users
    FOR EACH ROW
    EXECUTE FUNCTION app.fn_update_timestamp();

DROP TRIGGER IF EXISTS trg_locations_updated_at ON app.locations;
CREATE TRIGGER trg_locations_updated_at
    BEFORE UPDATE ON app.locations
    FOR EACH ROW
    EXECUTE FUNCTION app.fn_update_timestamp();

DROP TRIGGER IF EXISTS trg_system_parameters_updated_at ON app.system_parameters;
CREATE TRIGGER trg_system_parameters_updated_at
    BEFORE UPDATE ON app.system_parameters
    FOR EACH ROW
    EXECUTE FUNCTION app.fn_update_timestamp();

DROP TRIGGER IF EXISTS trg_projects_updated_at ON app.projects;
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON app.projects
    FOR EACH ROW
    EXECUTE FUNCTION app.fn_update_timestamp();

