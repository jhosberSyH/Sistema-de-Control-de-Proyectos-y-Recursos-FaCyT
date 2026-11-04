/**
 * Module 3: Inventory API Client
 * (F3.1 to F3.7 | HU-07 to HU-11)
 */

import { Item, ItemType, Batch } from '../../types';

export interface ItemResponse extends Item {
  is_low_stock: boolean;
  batches_count: number;
  next_expiration_date?: string | null;
}

export interface BatchSummary {
  id: string;
  batch_number: string;
  location_id: string;
  location_name: string;
  initial_quantity: number;
  available_quantity: number;
  unit_cost: number;
  supplier?: string | null;
  received_date: string;
  expiration_date?: string | null;
  expiration_status: 'Vigente' | 'Próximo a vencer' | 'Vencido';
  days_until_expiration?: number | null;
  is_blocked: boolean;
}

export interface AutomaticReplenishmentSummary {
  request_id: string;
  request_number: string;
  status: string;
  suggested_quantity: number;
  created_at: string;
  can_submit: boolean;
  can_discard: boolean;
}

export interface ItemDetailResponse extends ItemResponse {
  batches: BatchSummary[];
  active_replenishment?: AutomaticReplenishmentSummary | null;
  forecast_message?: string | null;
}

export interface InventoryAlertCounters {
  low_stock_count: number;
  near_expiry_count: number;
  expired_count: number;
}

export interface ItemCreatePayload {
  name: string;
  unit_of_measure: string;
  item_type: ItemType;
  min_stock?: number | null;
}

export interface ItemUpdatePayload {
  name?: string;
  unit_of_measure?: string;
  item_type?: ItemType;
  is_active?: boolean;
}

const API_BASE = '/api/inventario';

export const inventoryApi = {
  /** List inventory items with optional search and filters (F3.1, F3.4) */
  async listItems(params?: {
    search?: string;
    tipo?: string;
    ubicacion?: string;
    bajo_minimo?: boolean;
  }): Promise<ItemResponse[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.tipo && params.tipo !== 'Todos') query.append('tipo', params.tipo);
    if (params?.ubicacion && params.ubicacion !== 'Todas') query.append('ubicacion', params.ubicacion);
    if (params?.bajo_minimo) query.append('bajo_minimo', 'true');

    const res = await fetch(`${API_BASE}/items?${query.toString()}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al obtener el listado de insumos.');
    }
    return res.json();
  },

  /** Get item detail sheet with lot breakdown and forecast (F3.3 to F3.7) */
  async getItemDetail(itemId: string): Promise<ItemDetailResponse> {
    const res = await fetch(`${API_BASE}/items/${itemId}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al obtener el detalle del insumo.');
    }
    return res.json();
  },

  /** Register new item in unified catalog (F3.1 | HU-07) */
  async createItem(payload: ItemCreatePayload): Promise<ItemResponse> {
    const res = await fetch(`${API_BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al registrar el insumo.');
    }
    return res.json();
  },

  /** Update general item metadata (F3.1) */
  async updateItem(itemId: string, payload: ItemUpdatePayload): Promise<ItemResponse> {
    const res = await fetch(`${API_BASE}/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al actualizar el insumo.');
    }
    return res.json();
  },

  /** Configure minimum stock threshold (F3.2 | HU-07) */
  async updateMinStock(itemId: string, minStock: number | null): Promise<ItemResponse> {
    const res = await fetch(`${API_BASE}/items/${itemId}/min-stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ min_stock: minStock }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al actualizar el stock mínimo.');
    }
    return res.json();
  },

  /** Get top alert badges counters (F3.4, F3.6) */
  async getAlertCounters(): Promise<InventoryAlertCounters> {
    const res = await fetch(`${API_BASE}/alertas`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al obtener los contadores de alerta.');
    }
    return res.json();
  },

  /** Approve or discard draft automatic replenishment request (F3.5 | HU-09) */
  async decideReplenishment(
    requestId: string,
    action: 'submit' | 'discard',
    adjustedQuantity?: number
  ): Promise<{ status: string; new_status: string; decision_reason: string }> {
    const res = await fetch(`${API_BASE}/reposiciones/${requestId}/decidir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, adjusted_quantity: adjustedQuantity }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al procesar la decisión de reposición.');
    }
    return res.json();
  },

  /** Recalculate forecast on demand (F3.7 | HU-11) */
  async recalculateForecast(itemId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/items/${itemId}/recalcular-pronostico`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Error al recalcular el pronóstico.');
    }
    return res.json();
  },
};

