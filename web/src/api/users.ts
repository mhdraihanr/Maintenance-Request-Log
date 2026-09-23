import { apiList, apiRequest } from "./client";
import type { Page, PublicUser, Role } from "./types";

export interface ListUsersQuery {
  search?: string;
  role?: Role;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateUserPayload {
  username: string;
  name: string;
  password: string;
  role: Role;
}

export interface UpdateUserPayload {
  name?: string;
  role?: Role;
  password?: string;
  is_active?: boolean;
}

function toSearchParams(query: ListUsersQuery): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function listUsers(
  query: ListUsersQuery = {},
  signal?: AbortSignal,
): Promise<Page<PublicUser>> {
  return apiList<PublicUser>(`/users${toSearchParams(query)}`, { signal });
}

export function getUser(id: string, signal?: AbortSignal): Promise<PublicUser> {
  return apiRequest<PublicUser>(`/users/${id}`, { signal });
}

export function createUser(payload: CreateUserPayload): Promise<PublicUser> {
  return apiRequest<PublicUser>("/users", { method: "POST", body: payload });
}

export function updateUser(
  id: string,
  payload: UpdateUserPayload,
): Promise<PublicUser> {
  return apiRequest<PublicUser>(`/users/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

/** Soft delete: user tetap ada di daftar, statusnya berubah jadi Inactive. */
export function deactivateUser(id: string): Promise<void> {
  return apiRequest<void>(`/users/${id}`, { method: "DELETE" });
}
