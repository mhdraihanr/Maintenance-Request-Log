export type Role = "operator" | "supervisor" | "admin";

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
