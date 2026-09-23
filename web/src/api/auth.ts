import { apiRequest } from "./client";
import type { AuthUser } from "./types";

export function login(username: string, password: string): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/login", {
    method: "POST",
    body: { username, password },
  });
}

export function logout(): Promise<void> {
  return apiRequest<void>("/auth/logout", { method: "POST" });
}

export function me(): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/me");
}
