/**
 * Sistema de Control de Proyectos y Recursos FaCyT
 * TypeScript Type Definitions (Modules 1 to 8)
 * Corresponding to Relational Database Schema (app.*)
 */

// ============================================================================
// MODULE 1: AUTHENTICATION, USERS, LOCATIONS, PARAMETERS
// ============================================================================

export type UserRole =
  | 'Administrador del Sistema'
  | 'Coordinador de Proyecto'
  | 'Aprobador / Gestor de Inventario';

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  csrf_token: string;
  ip_address: string;
  user_agent?: string | null;
  expires_at: string;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface SystemParameter {
  id: string;
  key: string;
  numeric_value: number;
  description: string;
  updated_at: string;
}

// ============================================================================
// MODULE 2: PROJECTS AND ADVANCEMENT
// ============================================================================

export type ProjectStatus =
  | 'Propuesta'
  | 'En ejecución'
  | 'Suspendido'
  | 'Finalizado';

export type ProjectPriority =
  | 'Crítica'
  | 'Alta'
  | 'Media'
  | 'Baja';

export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  operational_status: ProjectStatus;
  status?: ProjectStatus; // Backward-compatible alias
  priority_level: ProjectPriority;
  priority?: ProjectPriority; // Backward-compatible alias
  allocated_budget: number;
  assigned_budget?: number; // Backward-compatible alias
  executed_budget: number;
  physical_progress_pct: number;
  progress_pct?: number; // Backward-compatible alias
  coordinator_id?: string | null;
  coordinator_user_id?: string | null; // Backward-compatible alias
  coordinator?: User | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  weight: number; // Percentage 0 - 100
  current_progress_pct: number; // 0 - 100
  target_date?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MilestoneProgressLog {
  id: string;
  milestone_id: string;
  previous_progress_pct: number;
  new_progress_pct: number;
  logged_by_user_id: string;
  notes?: string | null;
  logged_at: string;
}

// ============================================================================
// MODULE 3: RAW MATERIALS AND CONSUMABLES INVENTORY
// ============================================================================

export type ItemType =
  | 'Materia prima'
  | 'Consumible de proyecto'
  | 'Consumible de uso general';

export interface Item {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  unit_of_measure: string;
  item_type: ItemType;
  current_stock: number;
  min_stock: number;
  forecasted_consumption: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// MODULE 4: EQUIPMENT AND RESERVATIONS
// ============================================================================

export type EquipmentStatus =
  | 'Disponible'
  | 'En uso'
  | 'En mantenimiento';

export interface Equipment {
  id: string;
  asset_code: string;
  name: string;
  description?: string | null;
  location_id: string;
  location?: Location | null;
  operational_status: EquipmentStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ReservationStatus =
  | 'Borrador'
  | 'Pendiente de Aprobación'
  | 'Aprobado'
  | 'Rechazado'
  | 'Ejecutado';

export interface EquipmentReservation {
  id: string;
  equipment_id: string;
  equipment?: Equipment | null;
  project_id: string;
  project?: Project | null;
  requested_by_user_id: string;
  requested_by?: User | null;
  start_time: string;
  end_time: string;
  status: ReservationStatus;
  approval_notes?: string | null;
  approved_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentUsage {
  id: string;
  equipment_id: string;
  reservation_id?: string | null;
  project_id: string;
  logged_by_user_id: string;
  actual_start_time: string;
  actual_end_time: string;
  operating_hours: number;
  notes?: string | null;
  created_at: string;
}

// ============================================================================
// MODULE 5: PURCHASE & WITHDRAWAL REQUESTS
// ============================================================================

export type RequestType =
  | 'Gasto'
  | 'Retiro'
  | 'Reposición automática';

export type RequestStatus =
  | 'Borrador'
  | 'Pendiente de Aprobación'
  | 'Aprobado'
  | 'Rechazado'
  | 'Ejecutado';

export interface Request {
  id: string;
  code: string;
  request_type: RequestType;
  project_id?: string | null;
  project?: Project | null;
  requested_by_user_id: string;
  requested_by?: User | null;
  status: RequestStatus;
  priority_score: number;
  estimated_amount: number;
  actual_amount: number;
  justification?: string | null;
  approval_notes?: string | null;
  approved_by_user_id?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  items?: RequestItem[];
}

export interface RequestItem {
  id: string;
  request_id: string;
  item_id: string;
  item?: Item | null;
  requested_quantity: number;
  approved_quantity: number;
  estimated_unit_cost: number;
}

// ============================================================================
// MODULE 6: WAREHOUSE, BATCHES & DISPATCHES (IMMUTABLE LOG)
// ============================================================================

export type BatchExpirationStatus =
  | 'Vigente'
  | 'Próximo a vencer'
  | 'Vencido';

export interface Batch {
  id: string;
  batch_number: string;
  item_id: string;
  item?: Item | null;
  location_id: string;
  location?: Location | null;
  initial_quantity: number;
  available_quantity: number;
  current_quantity?: number; // Backward-compatible alias
  unit_cost: number;
  supplier: string;
  received_date: string;
  expiration_date?: string | null;
  expiration_status: BatchExpirationStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Dispatch {
  id: string;
  dispatch_number: string;
  batch_id: string;
  batch?: Batch | null;
  project_id: string;
  project?: Project | null;
  dispatched_quantity: number;
  unit_cost_snapshot: number;
  dispatched_by: string; // user_id
  received_by_name: string;
  is_compensatory: boolean;
  original_dispatch_id?: string | null;
  dispatched_at: string;
}

export interface RawMaterialUsage {
  id: string;
  dispatch_id: string;
  dispatch?: Dispatch | null;
  reported_by_user_id: string;
  reported_quantity: number;
  deviation_percentage: number;
  notes?: string | null;
  reported_at: string;
}

export type CorrectionStatus =
  | 'Pendiente'
  | 'Aprobado'
  | 'Denegado';

export interface DispatchCorrection {
  id: string;
  dispatch_id: string;
  dispatch?: Dispatch | null;
  requested_by_user_id: string;
  correction_type: string;
  quantity_adjustment: number;
  reason: string;
  status: CorrectionStatus;
  reviewed_by_user_id?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

// ============================================================================
// MODULE 7: PERIOD CLOSING & OVERHEAD PRORATION
// ============================================================================

export type PeriodType =
  | 'Mensual'
  | 'Trimestral';

export type PeriodStatus =
  | 'Abierto'
  | 'En revisión'
  | 'Cerrado'
  | 'Prorrateado';

export type ProrationCriterion =
  | 'Proporcional'
  | 'Equitativo';

export interface AccountingPeriod {
  id: string;
  period_name: string;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  proration_criterion?: ProrationCriterion | null;
  total_overhead_cost: number;
  closed_by_user_id?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PeriodProjectConfirmation {
  id: string;
  period_id: string;
  project_id: string;
  coordinator_user_id: string;
  confirmed: boolean;
  confirmed_at?: string | null;
  comments?: string | null;
}

export interface OverheadAllocation {
  id: string;
  period_id: string;
  project_id: string;
  registered_consumption: number;
  consumption_pct: number;
  allocated_amount: number;
  applied_at: string;
}

// ============================================================================
// MODULE 8: IMMUTABLE AUDIT LOG
// ============================================================================

export interface AuditLog {
  id: string;
  timestamp: string;
  user_id?: string | null;
  ip_address: string;
  action_type: string;
  target_object?: string | null; // Backward-compatible
  target_table?: string | null;
  target_id?: string | null;
  old_value?: Record<string, any> | null;
  new_value?: Record<string, any> | null;
  justification?: string | null;
}

