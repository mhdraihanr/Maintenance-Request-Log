export type Role = "operator" | "supervisor" | "admin";

export type Priority = "low" | "medium" | "high";

export type RequestStatus = "submitted" | "approved" | "rejected";

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: Role;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

/** Bentuk request yang dikembalikan API (camelCase, sudah dipetakan di service). */
export interface MaintenanceRequest {
  id: string;
  code: string;
  machineId: string;
  description: string;
  priority: Priority;
  status: RequestStatus;
  createdBy: { id: string; name: string };
  createdAt: string;
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
}

/** User publik. Tidak pernah memuat password_hash. */
export interface PublicUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Envelope daftar dari API adalah `{ data: [...], meta: {...} }` — pagination
 * ada di level atas, bukan di dalam `data`. Tipe ini adalah bentuk yang sudah
 * digabung kembali oleh helper `apiList` di client.ts.
 */
export interface Page<T> {
  items: T[];
  meta: PageMeta;
}
