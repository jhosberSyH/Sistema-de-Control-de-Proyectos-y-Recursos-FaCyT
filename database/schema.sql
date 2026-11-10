-- ============================================================================
-- Sistema de Control de Proyectos y Recursos FaCyT
-- Relational Database Schema (Modules 1 to 8)
-- Target: PostgreSQL 17 (Schema: app)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS app;

-- ----------------------------------------------------------------------------
-- ENUMS AND DOMAINS
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- M1: User Roles (RN-01)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.user_role AS ENUM (
            'Administrador del Sistema',
            'Coordinador de Proyecto',
            'Aprobador / Gestor de Inventario'
        );
    END IF;

    -- M2: Project Statuses & Priorities (RF-13, RF-14)
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

    -- M3: Item Types (RN-02)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_type' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.item_type AS ENUM (
            'Materia prima',
            'Consumible de proyecto',
            'Consumible de uso general'
        );
    END IF;

    -- M4: Equipment Operational Status
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_status' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.equipment_status AS ENUM (
            'Disponible',
            'En uso',
            'En mantenimiento'
        );
    END IF;

    -- M4 & M5: Workflow Request Status (RN-03)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_status' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.workflow_status AS ENUM (
            'Borrador',
            'Pendiente de Aprobación',
            'Aprobado',
            'Rechazado',
            'Ejecutado',
            'Cancelado'
        );
    END IF;

    -- M6: Sentido de una línea de despacho (decisión 3: cantidad siempre positiva + sentido)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_direction' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.dispatch_direction AS ENUM (
            'salida',
            'devolucion'
        );
    END IF;

    -- M5: A quién se carga una solicitud (decisión 4: centro de costo)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cost_center' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.cost_center AS ENUM (
            'proyecto',
            'general'
        );
    END IF;

    -- M5: Request Type
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_type' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.request_type AS ENUM (
            'Gasto',
            'Retiro',
            'Reposición automática'
        );
    END IF;

    -- M6: Batch Expiration Status
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_expiration_status' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.batch_expiration_status AS ENUM (
            'Vigente',
            'Próximo a vencer',
            'Vencido'
        );
    END IF;

    -- M6: Dispatch Correction Status
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'correction_status' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.correction_status AS ENUM (
            'Pendiente',
            'Aprobado',
            'Denegado'
        );
    END IF;

    -- M7: Accounting Period Type & Status
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'period_type' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.period_type AS ENUM (
            'Mensual',
            'Trimestral'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'period_status' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.period_status AS ENUM (
            'Abierto',
            'En revisión',
            'Cerrado',
            'Prorrateado'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'proration_criterion' AND typnamespace = 'app'::regnamespace) THEN
        CREATE TYPE app.proration_criterion AS ENUM (
            'Proporcional',
            'Equitativo'
        );
    END IF;
END $$;

-- Bases creadas antes de la decisión 1: la reserva cancelada por mantenimiento tiene estado propio
ALTER TYPE app.workflow_status ADD VALUE IF NOT EXISTS 'Cancelado';

-- ----------------------------------------------------------------------------
-- MODULE 1: USERS, LOCATIONS, PARAMETERS, SESSIONS
-- ----------------------------------------------------------------------------

-- Table 1: users (F1.1, F1.2, F1.3)
CREATE TABLE IF NOT EXISTS app.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role app.user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    must_change_password BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Bases ya creadas antes de que existiera la columna (clave temporal, F1.1)
ALTER TABLE app.users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_email ON app.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON app.users (role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON app.users (is_active);

-- Server-side sessions (RFC 10017)
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

-- Table 2: locations (F1.4)
CREATE TABLE IF NOT EXISTS app.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_active_name 
    ON app.locations (LOWER(TRIM(name))) 
    WHERE is_active = true;

-- Table 3: system_parameters (F1.5)
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
-- MODULE 2: PROJECTS AND ADVANCEMENT
-- ----------------------------------------------------------------------------

-- Table 4: projects (F2.1 - F2.7)
CREATE TABLE IF NOT EXISTS app.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    operational_status app.project_status NOT NULL DEFAULT 'Propuesta',
    priority_level app.project_priority NOT NULL DEFAULT 'Media',
    assigned_budget NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (assigned_budget >= 0),
    allocated_budget NUMERIC(15, 2) GENERATED ALWAYS AS (assigned_budget) STORED,
    -- Sin executed_budget: el gasto ejecutado se calcula desde los movimientos (vista app.v_project_spend, decisión 5)
    physical_progress_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (physical_progress_pct BETWEEN 0 AND 100),
    coordinator_id UUID REFERENCES app.users(id) ON DELETE SET NULL,
    -- Área del laboratorio (F2.1): la dicen las tres letras del código institucional (QUI-024 → Química)
    area VARCHAR(20) NOT NULL CHECK (area IN ('Física', 'Química', 'Biología')),
    -- F2.4: el plan de hitos queda confirmado cuando su coordinador lo cierra con pesos que suman 100.
    -- Mientras no lo esté, el avance físico es "No disponible" y el proyecto no pasa a En ejecución.
    plan_confirmed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Bases anteriores a la decisión 5: el dato derivado deja de guardarse (fuente única: los movimientos)
ALTER TABLE app.projects DROP COLUMN IF EXISTS executed_budget;

-- Bases anteriores al contrato de M2: área y plan confirmado
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'app' AND table_name = 'projects' AND column_name = 'area'
    ) THEN
        ALTER TABLE app.projects ADD COLUMN area VARCHAR(20);
        UPDATE app.projects SET area = CASE LEFT(code, 3)
            WHEN 'FIS' THEN 'Física' WHEN 'QUI' THEN 'Química' ELSE 'Biología' END;
        ALTER TABLE app.projects ALTER COLUMN area SET NOT NULL;
        ALTER TABLE app.projects ADD CONSTRAINT projects_area_check
            CHECK (area IN ('Física', 'Química', 'Biología'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'app' AND table_name = 'projects' AND column_name = 'plan_confirmed'
    ) THEN
        ALTER TABLE app.projects ADD COLUMN plan_confirmed BOOLEAN NOT NULL DEFAULT false;
        -- Un plan cuyos pesos ya suman 100 se da por confirmado
        UPDATE app.projects p SET plan_confirmed = true
        WHERE (SELECT COALESCE(SUM(m.weight), 0) FROM app.project_milestones m WHERE m.project_id = p.id) = 100;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_coordinator_id ON app.projects (coordinator_id);
CREATE INDEX IF NOT EXISTS idx_projects_operational_status ON app.projects (operational_status);
CREATE INDEX IF NOT EXISTS idx_projects_priority_level ON app.projects (priority_level);

-- Table 5: project_milestones (F2.4, F2.5)
CREATE TABLE IF NOT EXISTS app.project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    weight NUMERIC(5, 2) NOT NULL CHECK (weight > 0 AND weight <= 100),
    current_progress_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (current_progress_pct BETWEEN 0 AND 100),
    target_date DATE,
    completed_at TIMESTAMPTZ,
    -- Número del hito dentro del plan (1, 2, 3…), en el orden en que lo guardó el coordinador
    position INTEGER NOT NULL DEFAULT 1 CHECK (position >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Bases anteriores al contrato de M2: número del hito, por fecha prevista y fecha de registro
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'app' AND table_name = 'project_milestones' AND column_name = 'position'
    ) THEN
        ALTER TABLE app.project_milestones ADD COLUMN position INTEGER NOT NULL DEFAULT 1 CHECK (position >= 1);
        UPDATE app.project_milestones m SET position = o.n
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY target_date NULLS LAST, created_at) AS n
            FROM app.project_milestones
        ) o
        WHERE o.id = m.id;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON app.project_milestones (project_id);

-- Table 6: milestone_progress_logs (F2.5)
CREATE TABLE IF NOT EXISTS app.milestone_progress_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID NOT NULL REFERENCES app.project_milestones(id) ON DELETE CASCADE,
    reported_by_user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
    previous_progress_pct NUMERIC(5, 2) NOT NULL,
    new_progress_pct NUMERIC(5, 2) NOT NULL,
    notes TEXT,
    -- Día al que corresponde la carga (lo elige el coordinador; no puede ser futuro). reported_at es
    -- cuándo se registró en el sistema.
    progress_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Bases anteriores al contrato de M2: las cargas viejas quedan con el día en que se registraron
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'app' AND table_name = 'milestone_progress_logs' AND column_name = 'progress_date'
    ) THEN
        ALTER TABLE app.milestone_progress_logs ADD COLUMN progress_date DATE NOT NULL DEFAULT CURRENT_DATE;
        UPDATE app.milestone_progress_logs SET progress_date = reported_at::date;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_milestone_logs_milestone_id ON app.milestone_progress_logs (milestone_id);

-- ----------------------------------------------------------------------------
-- MODULE 3: INVENTORY (ITEMS)
-- ----------------------------------------------------------------------------

-- Table 7: items (F3.1 - F3.7)
CREATE TABLE IF NOT EXISTS app.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    unit_of_measure VARCHAR(30) NOT NULL,
    item_type app.item_type NOT NULL,
    current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (current_stock >= 0),
    min_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (min_stock >= 0),
    forecasted_consumption NUMERIC(12, 3),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_items_name_unit UNIQUE (name, unit_of_measure)
);

CREATE INDEX IF NOT EXISTS idx_items_item_type ON app.items (item_type);
CREATE INDEX IF NOT EXISTS idx_items_current_stock ON app.items (current_stock);

-- ----------------------------------------------------------------------------
-- MODULE 4: EQUIPMENTS, RESERVATIONS, USAGES
-- ----------------------------------------------------------------------------

-- Table 8: equipments (F4.1 - F4.6)
CREATE TABLE IF NOT EXISTS app.equipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    location_id UUID REFERENCES app.locations(id) ON DELETE RESTRICT,
    operational_status app.equipment_status NOT NULL DEFAULT 'Disponible',
    description TEXT,
    -- Mientras está En mantenimiento: por qué y desde cuándo (F4.2)
    maintenance_reason TEXT,
    maintenance_since DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- M4 con el contrato del frontend: bases creadas antes
ALTER TABLE app.equipments ADD COLUMN IF NOT EXISTS maintenance_reason TEXT;
ALTER TABLE app.equipments ADD COLUMN IF NOT EXISTS maintenance_since DATE;

CREATE INDEX IF NOT EXISTS idx_equipments_location_id ON app.equipments (location_id);
CREATE INDEX IF NOT EXISTS idx_equipments_status ON app.equipments (operational_status);

-- Table 9: equipment_reservations (F4.3, F4.4, RF-22)
CREATE TABLE IF NOT EXISTS app.equipment_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES app.equipments(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
    reserved_by_user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
    approved_by_user_id UUID REFERENCES app.users(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status app.workflow_status NOT NULL DEFAULT 'Borrador',
    notes TEXT,
    -- Decisión del aprobador (F4.5) o cancelación por mantenimiento (F4.2): cuándo y por qué
    decided_at TIMESTAMPTZ,
    decision_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_reservation_time_range CHECK (end_time > start_time)
);

ALTER TABLE app.equipment_reservations ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE app.equipment_reservations ADD COLUMN IF NOT EXISTS decision_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_reservations_equipment ON app.equipment_reservations (equipment_id);
CREATE INDEX IF NOT EXISTS idx_reservations_project ON app.equipment_reservations (project_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON app.equipment_reservations (status);

-- Table 10: equipment_usages (F4.6)
CREATE TABLE IF NOT EXISTS app.equipment_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES app.equipments(id) ON DELETE RESTRICT,
    project_id UUID NOT NULL REFERENCES app.projects(id) ON DELETE RESTRICT,
    reservation_id UUID REFERENCES app.equipment_reservations(id) ON DELETE SET NULL,
    registered_by_user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    -- F4.6: el uso se abre al empezar (sin fin ni horas) y se cierra al terminar
    end_time TIMESTAMPTZ,
    used_hours NUMERIC(6, 2) CHECK (used_hours >= 0),
    observations TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_usage_time_range CHECK (end_time > start_time),
    CONSTRAINT chk_usage_closed_with_hours CHECK ((end_time IS NULL) = (used_hours IS NULL))
);

-- Bases creadas antes del uso abierto (F4.6)
ALTER TABLE app.equipment_usages ALTER COLUMN end_time DROP NOT NULL;
ALTER TABLE app.equipment_usages ALTER COLUMN used_hours DROP NOT NULL;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_usage_closed_with_hours') THEN
        ALTER TABLE app.equipment_usages ADD CONSTRAINT chk_usage_closed_with_hours
            CHECK ((end_time IS NULL) = (used_hours IS NULL));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_usages_equipment ON app.equipment_usages (equipment_id);
CREATE INDEX IF NOT EXISTS idx_usages_project ON app.equipment_usages (project_id);
-- Un equipo tiene a lo sumo un uso abierto a la vez
CREATE UNIQUE INDEX IF NOT EXISTS uq_usages_one_open_per_equipment ON app.equipment_usages (equipment_id) WHERE end_time IS NULL;

-- ----------------------------------------------------------------------------
-- MODULE 5: REQUESTS AND WORKFLOW
-- ----------------------------------------------------------------------------

-- Table 11: requests (F5.1 - F5.7, RN-03)
CREATE TABLE IF NOT EXISTS app.requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(40) NOT NULL UNIQUE,
    request_type app.request_type NOT NULL,
    -- Centro de costo (decisión 4): 'proyecto' lleva proyecto; 'general' se reparte en el cierre (RN-02, M7)
    cost_center app.cost_center NOT NULL DEFAULT 'proyecto',
    project_id UUID REFERENCES app.projects(id) ON DELETE RESTRICT,
    requester_user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
    status app.workflow_status NOT NULL DEFAULT 'Borrador',
    estimated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (estimated_amount >= 0),
    actual_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (actual_amount >= 0),
    decided_by_user_id UUID REFERENCES app.users(id) ON DELETE SET NULL,
    decision_reason TEXT,
    decided_at TIMESTAMPTZ,
    -- Cotización del gasto (decisión 7): el archivo vive en Supabase Storage; aquí solo su ruta
    quote_path VARCHAR(500),
    quote_filename VARCHAR(255),
    quote_size_bytes INTEGER CHECK (quote_size_bytes IS NULL OR quote_size_bytes > 0),
    quote_uploaded_at TIMESTAMPTZ,
    -- Contenido del formulario (F5.1, F5.2): resumen para las listas, propósito del retiro y,
    -- en un gasto, el insumo o servicio, su cantidad en texto ("1 frasco") y la justificación
    description TEXT,
    purpose VARCHAR(200),
    item_or_service VARCHAR(160),
    expense_quantity VARCHAR(60),
    justification TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_requests_cost_center_project CHECK ((cost_center = 'proyecto') = (project_id IS NOT NULL))
);

-- M5 con el contrato del frontend: bases creadas antes
ALTER TABLE app.requests ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE app.requests ADD COLUMN IF NOT EXISTS purpose VARCHAR(200);
ALTER TABLE app.requests ADD COLUMN IF NOT EXISTS item_or_service VARCHAR(160);
ALTER TABLE app.requests ADD COLUMN IF NOT EXISTS expense_quantity VARCHAR(60);
ALTER TABLE app.requests ADD COLUMN IF NOT EXISTS justification TEXT;

-- Bases anteriores a las decisiones 4 y 7
ALTER TABLE app.requests ADD COLUMN IF NOT EXISTS cost_center app.cost_center NOT NULL DEFAULT 'proyecto';
ALTER TABLE app.requests ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE app.requests ADD COLUMN IF NOT EXISTS quote_path VARCHAR(500);
ALTER TABLE app.requests ADD COLUMN IF NOT EXISTS quote_filename VARCHAR(255);
ALTER TABLE app.requests ADD COLUMN IF NOT EXISTS quote_size_bytes INTEGER CHECK (quote_size_bytes IS NULL OR quote_size_bytes > 0);
ALTER TABLE app.requests ADD COLUMN IF NOT EXISTS quote_uploaded_at TIMESTAMPTZ;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_requests_cost_center_project') THEN
        ALTER TABLE app.requests ADD CONSTRAINT chk_requests_cost_center_project
            CHECK ((cost_center = 'proyecto') = (project_id IS NOT NULL));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_requests_project_id ON app.requests (project_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON app.requests (status);
CREATE INDEX IF NOT EXISTS idx_requests_type ON app.requests (request_type);

-- Table 12: request_items (F5.1, F5.2)
CREATE TABLE IF NOT EXISTS app.request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES app.requests(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES app.items(id) ON DELETE RESTRICT,
    -- Un borrador puede tener una línea sin cantidad todavía (F5.1); enviarlo exige > 0 (F5.3)
    requested_quantity NUMERIC(12, 3) NOT NULL CONSTRAINT chk_request_items_requested_quantity CHECK (requested_quantity >= 0),
    approved_quantity NUMERIC(12, 3) CHECK (approved_quantity >= 0),
    unit_cost_estimate NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost_estimate >= 0)
);

-- Bases anteriores: el CHECK (> 0) original impedía guardar el borrador a medio escribir
ALTER TABLE app.request_items DROP CONSTRAINT IF EXISTS request_items_requested_quantity_check;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_request_items_requested_quantity') THEN
        ALTER TABLE app.request_items ADD CONSTRAINT chk_request_items_requested_quantity
            CHECK (requested_quantity >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_request_items_request_id ON app.request_items (request_id);

-- ----------------------------------------------------------------------------
-- MODULE 6: WAREHOUSE, BATCHES, INMUTABLE DISPATCHES
-- ----------------------------------------------------------------------------

-- Table 13: batches (F6.1, RF-20, RF-36)
CREATE TABLE IF NOT EXISTS app.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES app.items(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES app.locations(id) ON DELETE RESTRICT,
    batch_number VARCHAR(60) NOT NULL,
    initial_quantity NUMERIC(12, 3) NOT NULL CHECK (initial_quantity >= 0),
    available_quantity NUMERIC(12, 3) NOT NULL CHECK (available_quantity >= 0),
    unit_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
    supplier VARCHAR(150),
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE,
    expiration_status app.batch_expiration_status NOT NULL DEFAULT 'Vigente',
    -- Contrato del frontend (F6.1): número de lote que trae el proveedor y la reposición que se recibe
    supplier_lot_code VARCHAR(40),
    request_id UUID REFERENCES app.requests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_batch_quantities CHECK (available_quantity <= initial_quantity)
);

-- M3/M6 con el contrato del frontend: bases creadas antes
ALTER TABLE app.batches ADD COLUMN IF NOT EXISTS supplier_lot_code VARCHAR(40);
ALTER TABLE app.batches ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES app.requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_batches_item_id ON app.batches (item_id);
CREATE INDEX IF NOT EXISTS idx_batches_location_id ON app.batches (location_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiration_date ON app.batches (expiration_date);

-- Table 14: dispatches (RF-23, RNF-11 - Strictly Immutable Outbound Log)
CREATE TABLE IF NOT EXISTS app.dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_number VARCHAR(40) NOT NULL UNIQUE,
    batch_id UUID NOT NULL REFERENCES app.batches(id) ON DELETE RESTRICT,
    project_id UUID NOT NULL REFERENCES app.projects(id) ON DELETE RESTRICT,
    dispatched_quantity NUMERIC(12, 3) NOT NULL CHECK (dispatched_quantity > 0),
    -- Decisión 3: la devolución de una corrección a la baja es una línea positiva con sentido 'devolucion'
    direction app.dispatch_direction NOT NULL DEFAULT 'salida',
    -- Lo que suman los reportes: negativo solo en las devoluciones
    signed_quantity NUMERIC(12, 3) GENERATED ALWAYS AS (
        CASE WHEN direction = 'devolucion' THEN -dispatched_quantity ELSE dispatched_quantity END
    ) STORED,
    unit_cost_snapshot NUMERIC(15, 2) NOT NULL CHECK (unit_cost_snapshot >= 0),
    dispatched_by UUID NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
    received_by_name VARCHAR(150) NOT NULL,
    request_id UUID REFERENCES app.requests(id) ON DELETE SET NULL,
    is_compensatory BOOLEAN NOT NULL DEFAULT false,
    original_dispatch_id UUID REFERENCES app.dispatches(id) ON DELETE RESTRICT,
    -- Código del despacho que ven las personas (DES-0320): lo comparten las líneas de un mismo despacho
    -- (una por insumo y lote); dispatch_number sigue siendo único por línea
    movement_code VARCHAR(40),
    -- Observación del despacho (F6.3) o "Corrección COR-006" en un movimiento de corrección
    notes TEXT,
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- M6 con el contrato del frontend (agregar columnas no dispara el trigger de inalterabilidad)
ALTER TABLE app.dispatches ADD COLUMN IF NOT EXISTS movement_code VARCHAR(40);
ALTER TABLE app.dispatches ADD COLUMN IF NOT EXISTS notes TEXT;

-- Bases anteriores a la decisión 3 (agregar columnas no dispara el trigger de inalterabilidad)
ALTER TABLE app.dispatches ADD COLUMN IF NOT EXISTS direction app.dispatch_direction NOT NULL DEFAULT 'salida';
ALTER TABLE app.dispatches ADD COLUMN IF NOT EXISTS signed_quantity NUMERIC(12, 3) GENERATED ALWAYS AS (
    CASE WHEN direction = 'devolucion' THEN -dispatched_quantity ELSE dispatched_quantity END
) STORED;

CREATE INDEX IF NOT EXISTS idx_dispatches_batch_id ON app.dispatches (batch_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_project_id ON app.dispatches (project_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_dispatched_at ON app.dispatches (dispatched_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatches_movement_code ON app.dispatches (movement_code);
CREATE INDEX IF NOT EXISTS idx_dispatches_original ON app.dispatches (original_dispatch_id);

-- Table 15: raw_material_usages (F6.4)
CREATE TABLE IF NOT EXISTS app.raw_material_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- F6.4: el uso se registra por proyecto e insumo (el despacho es opcional, de registros anteriores)
    dispatch_id UUID REFERENCES app.dispatches(id) ON DELETE RESTRICT,
    item_id UUID REFERENCES app.items(id) ON DELETE RESTRICT,
    project_id UUID NOT NULL REFERENCES app.projects(id) ON DELETE RESTRICT,
    reported_by_user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
    quantity_used NUMERIC(12, 3) NOT NULL CHECK (quantity_used >= 0),
    waste_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (waste_quantity >= 0),
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_raw_usages_dispatch_id ON app.raw_material_usages (dispatch_id);
CREATE INDEX IF NOT EXISTS idx_raw_usages_project_id ON app.raw_material_usages (project_id);

-- M6 con el contrato del frontend: bases creadas antes
ALTER TABLE app.raw_material_usages ALTER COLUMN dispatch_id DROP NOT NULL;
ALTER TABLE app.raw_material_usages ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES app.items(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_raw_usages_project_item ON app.raw_material_usages (project_id, item_id);

-- Table 16: dispatch_corrections (RF-35, F6.5)
CREATE TABLE IF NOT EXISTS app.dispatch_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_dispatch_id UUID NOT NULL REFERENCES app.dispatches(id) ON DELETE RESTRICT,
    requested_by_user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
    reviewed_by_user_id UUID REFERENCES app.users(id) ON DELETE SET NULL,
    status app.correction_status NOT NULL DEFAULT 'Pendiente',
    justification TEXT NOT NULL,
    correct_quantity NUMERIC(12, 3) NOT NULL CHECK (correct_quantity >= 0),
    -- F6.5: qué está mal (la cantidad o el proyecto), el código que se muestra (COR-006) y la nota del aprobador
    correction_number VARCHAR(20) UNIQUE,
    corrected_field VARCHAR(10) NOT NULL DEFAULT 'cantidad' CHECK (corrected_field IN ('cantidad', 'proyecto')),
    new_project_id UUID REFERENCES app.projects(id) ON DELETE RESTRICT,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_correction_new_project CHECK ((corrected_field = 'proyecto') = (new_project_id IS NOT NULL))
);

-- M6 con el contrato del frontend: bases creadas antes
ALTER TABLE app.dispatch_corrections ADD COLUMN IF NOT EXISTS correction_number VARCHAR(20) UNIQUE;
ALTER TABLE app.dispatch_corrections ADD COLUMN IF NOT EXISTS corrected_field VARCHAR(10) NOT NULL DEFAULT 'cantidad'
    CHECK (corrected_field IN ('cantidad', 'proyecto'));
ALTER TABLE app.dispatch_corrections ADD COLUMN IF NOT EXISTS new_project_id UUID REFERENCES app.projects(id) ON DELETE RESTRICT;
ALTER TABLE app.dispatch_corrections ADD COLUMN IF NOT EXISTS review_notes TEXT;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_correction_new_project') THEN
        ALTER TABLE app.dispatch_corrections ADD CONSTRAINT chk_correction_new_project
            CHECK ((corrected_field = 'proyecto') = (new_project_id IS NOT NULL));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_corrections_dispatch_id ON app.dispatch_corrections (original_dispatch_id);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON app.dispatch_corrections (status);

-- ----------------------------------------------------------------------------
-- MODULE 7: ACCOUNTING PERIODS AND OVERHEAD PRORATION
-- ----------------------------------------------------------------------------

-- Table 17: accounting_periods (F7.1, F7.2, RF-24)
CREATE TABLE IF NOT EXISTS app.accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_name VARCHAR(100) NOT NULL,
    period_type app.period_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status app.period_status NOT NULL DEFAULT 'Abierto',
    proration_criterion app.proration_criterion,
    total_overhead_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_overhead_cost >= 0),
    closed_by_user_id UUID REFERENCES app.users(id) ON DELETE SET NULL,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_period_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_periods_dates ON app.accounting_periods (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_periods_status ON app.accounting_periods (status);

-- Table 18: period_project_confirmations (F7.1, RF-38)
CREATE TABLE IF NOT EXISTS app.period_project_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES app.accounting_periods(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
    coordinator_user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
    confirmed BOOLEAN NOT NULL DEFAULT false,
    confirmed_at TIMESTAMPTZ,
    comments TEXT,
    CONSTRAINT uq_period_project_confirmation UNIQUE (period_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_confirmations_period_id ON app.period_project_confirmations (period_id);

-- Table 19: overhead_allocations (F7.3, F7.4, RF-25, RF-26, RF-27)
CREATE TABLE IF NOT EXISTS app.overhead_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES app.accounting_periods(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES app.projects(id) ON DELETE RESTRICT,
    registered_consumption NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (registered_consumption >= 0),
    consumption_pct NUMERIC(6, 4) NOT NULL DEFAULT 0.0000 CHECK (consumption_pct BETWEEN 0 AND 1),
    allocated_amount NUMERIC(15, 2) NOT NULL CHECK (allocated_amount >= 0),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_period_project_allocation UNIQUE (period_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_allocations_period_id ON app.overhead_allocations (period_id);
CREATE INDEX IF NOT EXISTS idx_allocations_project_id ON app.overhead_allocations (project_id);

-- Contrato de M7 (vistas 21 a 23), idempotente para bases ya creadas:
-- quién abrió la revisión (created_at dice cuándo) y quién aplicó el reparto y cuándo.
ALTER TABLE app.accounting_periods ADD COLUMN IF NOT EXISTS opened_by_user_id UUID REFERENCES app.users(id) ON DELETE SET NULL;
ALTER TABLE app.accounting_periods ADD COLUMN IF NOT EXISTS prorated_by_user_id UUID REFERENCES app.users(id) ON DELETE SET NULL;
ALTER TABLE app.accounting_periods ADD COLUMN IF NOT EXISTS prorated_at TIMESTAMPTZ;
-- Un proyecto activo sin coordinador también entra en la revisión ("sin coordinador"): nadie lo confirma.
-- Al confirmar, coordinator_user_id guarda quién confirmó.
ALTER TABLE app.period_project_confirmations ALTER COLUMN coordinator_user_id DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- MODULE 8: IMMUTABLE AUDIT LOG
-- ----------------------------------------------------------------------------

-- Table 20: audit_logs (RF-34, RNF-12, F8.5)
-- Maintains full backward compatibility with target_object and adds target_table, target_id, justification
CREATE TABLE IF NOT EXISTS app.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    user_id UUID REFERENCES app.users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_object VARCHAR(100),
    target_table VARCHAR(60),
    target_id VARCHAR(64),
    old_value JSONB,
    new_value JSONB,
    justification TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON app.audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON app.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON app.audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_table ON app.audit_logs (target_table);

-- Compatibility view so any legacy queries pointing to audit_log work transparently
CREATE OR REPLACE VIEW app.audit_log AS SELECT * FROM app.audit_logs;


-- ----------------------------------------------------------------------------
-- AVISOS INTERNOS (decisión 6): la campana del encabezado
-- ----------------------------------------------------------------------------

-- Table 22: notifications
CREATE TABLE IF NOT EXISTS app.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('ok', 'warn', 'err', 'info')),
    title VARCHAR(200) NOT NULL,
    detail TEXT,
    link VARCHAR(300) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON app.notifications (user_id, is_read, created_at DESC);


-- ----------------------------------------------------------------------------
-- GASTO EJECUTADO POR PROYECTO (decisión 5): fuente única, calculada desde los movimientos
-- La misma fórmula vive en el ORM (Project.executed_budget); una prueba exige que coincidan.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW app.v_project_spend AS
SELECT
    p.id AS project_id,
    p.code,
    COALESCE(d.dispatch_cost, 0)::NUMERIC(15, 2) AS dispatch_cost,
    COALESCE(r.expense_cost, 0)::NUMERIC(15, 2) AS expense_cost,
    COALESCE(o.shared_cost, 0)::NUMERIC(15, 2) AS shared_cost,
    (COALESCE(d.dispatch_cost, 0) + COALESCE(r.expense_cost, 0) + COALESCE(o.shared_cost, 0))::NUMERIC(15, 2) AS executed_budget
FROM app.projects p
LEFT JOIN (
    SELECT project_id, SUM(signed_quantity * unit_cost_snapshot) AS dispatch_cost
    FROM app.dispatches GROUP BY project_id
) d ON d.project_id = p.id
LEFT JOIN (
    SELECT project_id, SUM(actual_amount) AS expense_cost
    FROM app.requests
    -- Solo gastos: un Retiro ejecutado ya está contado en sus despachos
    WHERE request_type = 'Gasto' AND status = 'Ejecutado' AND cost_center = 'proyecto'
    GROUP BY project_id
) r ON r.project_id = p.id
LEFT JOIN (
    SELECT project_id, SUM(allocated_amount) AS shared_cost
    FROM app.overhead_allocations GROUP BY project_id
) o ON o.project_id = p.id;
