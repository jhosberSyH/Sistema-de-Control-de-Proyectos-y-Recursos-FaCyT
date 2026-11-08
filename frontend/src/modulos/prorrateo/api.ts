/**
 * Module 7: Accounting Period Closing & Overhead Proration API Client
 * (F7.1 to F7.4 | HU-22, HU-23)
 */

export interface AccountingPeriodCreatePayload {
  period_name: string;
  period_type: 'Mensual' | 'Trimestral';
  start_date: string;
  end_date: string;
  total_overhead_cost?: number | null;
}

export interface AccountingPeriodResponse {
  id: string;
  period_name: string;
  period_type: 'Mensual' | 'Trimestral';
  start_date: string;
  end_date: string;
  status: 'Abierto' | 'En revisión' | 'Cerrado' | 'Prorrateado';
  proration_criterion?: 'Proporcional' | 'Equitativo' | null;
  total_overhead_cost: number;
  closed_by_user_id?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectChargeDetail {
  id: string;
  charge_date: string;
  concept: string;
  origin_type: 'Despacho' | 'Gasto';
  reference_code: string;
  amount: number;
  is_correction: boolean;
  can_request_correction: boolean;
}

export interface ProjectChargesReviewResponse {
  project_id: string;
  project_code: string;
  project_title: string;
  coordinator_name: string;
  is_confirmed: boolean;
  confirmed_at?: string | null;
  comments?: string | null;
  total_charges_count: number;
  total_amount: number;
  charges: ProjectChargeDetail[];
}

export interface PeriodConfirmationSummaryItem {
  project_id: string;
  project_code: string;
  project_title: string;
  coordinator_id: string;
  coordinator_name: string;
  charges_count: number;
  total_amount: number;
  is_confirmed: boolean;
  confirmed_at?: string | null;
}

export interface PeriodConfirmationDashboardResponse {
  period_id: string;
  period_name: string;
  period_type: string;
  start_date: string;
  end_date: string;
  status: string;
  total_active_projects: number;
  confirmed_projects_count: number;
  confirmation_percentage: number;
  confirmations: PeriodConfirmationSummaryItem[];
}

export interface ProjectChargesConfirmPayload {
  comments?: string;
}

export interface AccountingPeriodClosePayload {
  force_close_missing_confirmations?: boolean;
}

export interface ProrationProjectItem {
  project_id: string;
  project_code: string;
  project_title: string;
  operational_status: string;
  is_active_for_proration: boolean;
  direct_consumption: number;
  consumption_percentage: number;
  allocated_overhead: number;
  has_rounding_residual: boolean;
  residual_cents: number;
}

export interface ProrationPreviewResponse {
  period_id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  proration_criterion: 'Proporcional' | 'Equitativo';
  total_overhead_cost: number;
  total_active_projects_consumption: number;
  active_projects_count: number;
  excluded_projects_count: number;
  rounding_residual: number;
  residual_assigned_to_project_code?: string | null;
  allocations: ProrationProjectItem[];
}

export interface ProrationExecutePayload {
  proration_criterion: 'Proporcional' | 'Equitativo';
}

export interface OverheadAllocationResponse {
  id: string;
  period_id: string;
  project_id: string;
  registered_consumption: number;
  consumption_pct: number;
  allocated_amount: number;
  applied_at: string;
}

const API_BASE = '/api/prorrateo';

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.detail || `Error del servidor (${res.status})`;
    throw new Error(message);
  }

  return res.json();
}

export const prorationApi = {
  // F7.1: Period Review Opening
  async openPeriodReview(payload: AccountingPeriodCreatePayload): Promise<AccountingPeriodResponse> {
    return fetchJson<AccountingPeriodResponse>(`${API_BASE}/periodos`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listPeriods(status?: string): Promise<AccountingPeriodResponse[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return fetchJson<AccountingPeriodResponse[]>(`${API_BASE}/periodos${qs}`);
  },

  async getPeriodDetail(periodId: string): Promise<AccountingPeriodResponse> {
    return fetchJson<AccountingPeriodResponse>(`${API_BASE}/periodos/${periodId}`);
  },

  async getPeriodConfirmationDashboard(periodId: string): Promise<PeriodConfirmationDashboardResponse> {
    return fetchJson<PeriodConfirmationDashboardResponse>(`${API_BASE}/periodos/${periodId}/tablero`);
  },

  // F7.1: Coordinator Charges Review & Confirmation
  async getProjectCharges(periodId: string, projectId: string): Promise<ProjectChargesReviewResponse> {
    return fetchJson<ProjectChargesReviewResponse>(`${API_BASE}/periodos/${periodId}/proyectos/${projectId}/cargos`);
  },

  async confirmProjectCharges(
    periodId: string,
    projectId: string,
    payload: ProjectChargesConfirmPayload
  ): Promise<PeriodConfirmationSummaryItem> {
    return fetchJson<PeriodConfirmationSummaryItem>(
      `${API_BASE}/periodos/${periodId}/proyectos/${projectId}/confirmar`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  // F7.2: Period Closing
  async closePeriod(
    periodId: string,
    payload: AccountingPeriodClosePayload = {}
  ): Promise<AccountingPeriodResponse> {
    return fetchJson<AccountingPeriodResponse>(`${API_BASE}/periodos/${periodId}/cerrar`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // F7.3 & F7.4: Overhead Proration
  async getProrationPreview(
    periodId: string,
    criterion: 'Proporcional' | 'Equitativo' = 'Proporcional'
  ): Promise<ProrationPreviewResponse> {
    return fetchJson<ProrationPreviewResponse>(
      `${API_BASE}/periodos/${periodId}/prorrateo/vista-previa?criterio=${encodeURIComponent(criterion)}`
    );
  },

  async executeProration(
    periodId: string,
    payload: ProrationExecutePayload
  ): Promise<OverheadAllocationResponse[]> {
    return fetchJson<OverheadAllocationResponse[]>(`${API_BASE}/periodos/${periodId}/prorrateo/ejecutar`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
