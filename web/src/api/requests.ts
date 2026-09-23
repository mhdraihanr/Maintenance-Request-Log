import { apiList, apiRequest } from "./client";
import type {
  MaintenanceRequest,
  Page,
  Priority,
  RequestStatus,
} from "./types";

export interface ListRequestsQuery {
  status?: RequestStatus;
  priority?: Priority;
  search?: string;
  sort?: "created_at" | "priority" | "status";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface CreateRequestPayload {
  machine_id: string;
  description: string;
  priority: Priority;
}

export interface UpdateRequestPayload {
  machine_id?: string;
  description?: string;
  priority?: Priority;
}

/**
 * Query kosong tidak dikirim sama sekali.
 * API memakai `.default()` di Zod, jadi mengirim `status=` (string kosong) akan
 * ditolak sebagai nilai enum tidak valid, bukan dianggap "tanpa filter".
 */
function toSearchParams(query: ListRequestsQuery): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function listRequests(
  query: ListRequestsQuery = {},
  signal?: AbortSignal,
): Promise<Page<MaintenanceRequest>> {
  return apiList<MaintenanceRequest>(`/requests${toSearchParams(query)}`, {
    signal,
  });
}

export function getRequest(
  id: string,
  signal?: AbortSignal,
): Promise<MaintenanceRequest> {
  return apiRequest<MaintenanceRequest>(`/requests/${id}`, { signal });
}

export function createRequest(
  payload: CreateRequestPayload,
): Promise<MaintenanceRequest> {
  return apiRequest<MaintenanceRequest>("/requests", {
    method: "POST",
    body: payload,
  });
}

export function updateRequest(
  id: string,
  payload: UpdateRequestPayload,
): Promise<MaintenanceRequest> {
  return apiRequest<MaintenanceRequest>(`/requests/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export function reviewRequest(
  id: string,
  decision: "approve" | "reject",
  note?: string,
): Promise<MaintenanceRequest> {
  return apiRequest<MaintenanceRequest>(`/requests/${id}/${decision}`, {
    method: "POST",
    body: note ? { note } : {},
  });
}

export function deleteRequest(id: string): Promise<void> {
  return apiRequest<void>(`/requests/${id}`, { method: "DELETE" });
}
