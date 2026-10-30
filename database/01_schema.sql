-- ============================================================================
-- Sistema de Control de Proyectos y Recursos FaCyT
-- Script 01: Schema Definition
-- Schema: app
-- Target: PostgreSQL 17
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS app;

-- ----------------------------------------------------------------------------
-- 1. Allowed roles enum / domain
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.user_role AS ENUM (
            'Administrador del Sistema',
            'Coordinador de Proyecto',
            'Aprobador / Gestor de Inventario'
        );
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Users table (F1.1, F1.2, F1.3)
-- Strict logical deletion: is_active flag. No physical deletion in production.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role app.user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON app.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON app.users (role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON app.users (is_active);

-- ----------------------------------------------------------------------------
-- 3. Sessions table (RFC 10017 - Backend for Frontend session management)
-- Stores SHA-256 hash of token, never plain token.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    csrf_token VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON app.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON app.sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON app.sessions (expires_at);

-- ----------------------------------------------------------------------------
-- 4. Projects table stub (Needed for coordinator assignment & impact check in F1.2 & F1.3)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.project_status AS ENUM (
            'Propuesta',
            'En ejecución',
            'Suspendido',
            'Finalizado'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_priority' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.project_priority AS ENUM (
            'Crítica',
            'Alta',
            'Media',
            'Baja'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS app.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    status app.project_status NOT NULL DEFAULT 'Propuesta',
    priority app.project_priority NOT NULL DEFAULT 'Media',
    assigned_budget NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (assigned_budget >= 0),
    executed_budget NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (executed_budget >= 0),
    coordinator_id UUID REFERENCES app.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_projects_coordinator_id ON app.projects (coordinator_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON app.projects (status);

-- ----------------------------------------------------------------------------
-- 5. Storage locations catalog (F1.4)
-- Unique active name rule: unique index on LOWER(name) where is_active = true
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Index for unique active locations (RN: uniqueness among active locations)
CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_active_name 
    ON app.locations (LOWER(TRIM(name))) 
    WHERE is_active = true;

-- ----------------------------------------------------------------------------
-- 6. Batches table stub (Referential integrity: F1.4 locations cannot be deleted if batches exist)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES app.locations(id) ON DELETE RESTRICT,
    batch_number VARCHAR(60) NOT NULL,
    initial_quantity NUMERIC(12, 3) NOT NULL CHECK (initial_quantity >= 0),
    current_quantity NUMERIC(12, 3) NOT NULL CHECK (current_quantity >= 0),
    unit_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
    expiration_date DATE,
    received_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_batches_location_id ON app.batches (location_id);

-- ----------------------------------------------------------------------------
-- 7. System parameters table (F1.5)
-- Key-value configurations (strictly positive integers > 0)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.system_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parameter_key VARCHAR(80) NOT NULL UNIQUE,
    parameter_value INTEGER NOT NULL CHECK (parameter_value > 0),
    label VARCHAR(150) NOT NULL,
    description TEXT,
    unit VARCHAR(30) NOT NULL,
    updated_by_user_id UUID REFERENCES app.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_system_parameters_key ON app.system_parameters (parameter_key);

-- ----------------------------------------------------------------------------
-- 8. Transactional Audit Log (F8.5, RN-06, RNF-12)
-- Strictly append-only, immutable audit trail.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    user_id UUID REFERENCES app.users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45) NOT NULL,
    target_object VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON app.audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON app.audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target_object ON app.audit_log (target_object);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON app.audit_log (action_type);

