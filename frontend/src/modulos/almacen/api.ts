/**
 * Module 6: Warehouse and Immutable Outbound Log API Client
 * (F6.1 to F6.6 | HU-18 to HU-21)
 */

export interface BatchCreatePayload {
  item_id: string;
  location_id: string;
  batch_number: string;
  quantity: number;
  unit_cost: number;
  supplier?: string;
  received_date?: string;
  expiration_date?: string | null;
  expense_request_id?: string | null;
  force_expired_acceptance?: boolean;
}

export interface BatchResponse {
  id: string;
  item_id?: string | null;
  item_name?: string | null;
  item_unit?: string | null;
  location_id: string;
  location_name?: string | null;
  batch_number: string;
  initial_quantity: number;
  available_quantity: number;
  unit_cost: number;
  supplier?: string | null;
  received_date: string;
  expiration_date?: string | null;
  expiration_status: 'Vigente' | 'Próximo a vencer' | 'Vencido';
  days_until_expiration?: number | null;
  is_blocked_for_dispatch: boolean;
  created_at: string;
}

export interface SuggestedBatchForDispatch {
  batch_id: string;
  batch_number: string;
  location_name: string;
  available_quantity: number;
  unit_cost: number;
  expiration_date?: string | null;
  expiration_status: string;
  days_until_expiration?: number | null;
  is_suggested: boolean;
  is_blocked: boolean;
}

export interface WithdrawalItemDispatchSuggestion {
  item_id: string;
  item_name: string;
  unit_of_measure: string;
  requested_quantity: number;
  approved_quantity: number;
  available_batches: SuggestedBatchForDispatch[];
}

export interface WithdrawalRequestDispatchPreparation {
  request_id: string;
  request_number: string;
  project_id: string;
  project_code: string;
  project_title: string;
  requester_name: string;
  status: string;
  items: WithdrawalItemDispatchSuggestion[];
}

export interface DispatchAllocationItem {
  batch_id: string;
  quantity: number;
}

export interface DispatchCreatePayload {
  request_id: string;
  received_by_name: string;
  allocations: DispatchAllocationItem[];
  notes?: string;
}

export interface DispatchResponse {
  id: string;
  dispatch_number: string;
  batch_id: string;
  batch_number?: string | null;
  item_id?: string | null;
  item_name?: string | null;
  item_unit?: string | null;
  project_id: string;
  project_code?: string | null;
  project_title?: string | null;
  dispatched_quantity: number;
  unit_cost_snapshot: number;
  total_cost: number;
  dispatched_by: string;
  dispatched_by_name?: string | null;
  received_by_name: string;
  request_id?: string | null;
  is_compensatory: boolean;
  original_dispatch_id?: string | null;
  dispatched_at: string;
}

export interface RawMaterialUsagePayload {
  project_id: string;
  dispatch_id: string;
  quantity_used: number;
  waste_quantity?: number;
  usage_date?: string;
  notes?: string;
}

export interface RawMaterialUsageResponse {
  id: string;
  dispatch_id: string;
  dispatch_number?: string | null;
  project_id: string;
  project_code?: string | null;
  reported_by_user_id: string;
  reported_by_name?: string | null;
  item_name?: string | null;
  unit_of_measure?: string | null;
  dispatched_quantity: number;
  quantity_used: number;
  waste_quantity: number;
  usage_date: string;
  notes?: string | null;
  is_excess_over_dispatched: boolean;
  excess_quantity: number;
  created_at: string;
}

export interface ProjectMaterialBalanceSummary {
  project_id: string;
  project_code: string;
  item_id: string;
  item_name: string;
  unit_of_measure: string;
  total_dispatched: number;
  total_used: number;
  total_waste: number;
  remaining_unreported: number;
  is_usage_exceeded: boolean;
  excess_quantity: number;
}

export interface DispatchCorrectionCreatePayload {
  original_dispatch_id: string;
  correct_quantity: number;
  justification: string;
}

export interface DispatchCorrectionReviewPayload {
  approved: boolean;
  review_notes?: string;
}

export interface DispatchCorrectionResponse {
  id: string;
  original_dispatch_id: string;
  original_dispatch_number?: string | null;
  project_id?: string | null;
  project_code?: string | null;
  item_name?: string | null;
  unit_of_measure?: string | null;
  original_quantity: number;
  correct_quantity: number;
  quantity_difference: number;
  requested_by_user_id: string;
  requested_by_name?: string | null;
  reviewed_by_user_id?: string | null;
  reviewed_by_name?: string | null;
  status: 'Pendiente' | 'Aprobado' | 'Denegado';
  justification: string;
  compensatory_dispatch_id?: string | null;
  compensatory_dispatch_number?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

const API_BASE = '/api/almacen';

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

export const warehouseApi = {
  // F6.1: Batch Reception
  async receiveBatch(payload: BatchCreatePayload): Promise<BatchResponse> {
    return fetchJson<BatchResponse>(`${API_BASE}/lotes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // F6.2: Dispatch Preparation
  async getWithdrawalDispatchPreparation(requestId: string): Promise<WithdrawalRequestDispatchPreparation> {
    return fetchJson<WithdrawalRequestDispatchPreparation>(`${API_BASE}/solicitudes-retiro/${requestId}/preparar`);
  },

  // F6.2 & F6.3: Dispatch Execution
  async executeDispatch(payload: DispatchCreatePayload): Promise<DispatchResponse[]> {
    return fetchJson<DispatchResponse[]>(`${API_BASE}/despachos`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // F6.3: Immutable Outbound Log Query
  async listDispatches(params?: {
    projectId?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
  }): Promise<DispatchResponse[]> {
    const query = new URLSearchParams();
    if (params?.projectId) query.append('project_id', params.projectId);
    if (params?.fromDate) query.append('from_date', params.fromDate);
    if (params?.toDate) query.append('to_date', params.toDate);
    if (params?.search) query.append('search', params.search);

    const qs = query.toString();
    return fetchJson<DispatchResponse[]>(`${API_BASE}/despachos${qs ? `?${qs}` : ''}`);
  },

  // F6.4: Raw Material Usage Reporting
  async reportRawMaterialUsage(payload: RawMaterialUsagePayload): Promise<RawMaterialUsageResponse> {
    return fetchJson<RawMaterialUsageResponse>(`${API_BASE}/uso-materia-prima`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getProjectMaterialBalance(projectId: string): Promise<ProjectMaterialBalanceSummary[]> {
    return fetchJson<ProjectMaterialBalanceSummary[]>(`${API_BASE}/proyectos/${projectId}/balance-materia-prima`);
  },

  // F6.5 & F6.6: Compensatory Dispatch Corrections
  async requestDispatchCorrection(payload: DispatchCorrectionCreatePayload): Promise<DispatchCorrectionResponse> {
    return fetchJson<DispatchCorrectionResponse>(`${API_BASE}/correcciones`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listDispatchCorrections(status?: string): Promise<DispatchCorrectionResponse[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return fetchJson<DispatchCorrectionResponse[]>(`${API_BASE}/correcciones${qs}`);
  },

  async reviewDispatchCorrection(
    correctionId: string,
    payload: DispatchCorrectionReviewPayload
  ): Promise<DispatchCorrectionResponse> {
    return fetchJson<DispatchCorrectionResponse>(`${API_BASE}/correcciones/${correctionId}/revisar`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
