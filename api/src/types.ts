import "hono";
import type { AuthUser } from "./middleware/auth";

export type Role = "operator" | "supervisor" | "admin";

declare module "hono" {
  interface ContextVariableMap {
    userId: string | null;
    user: AuthUser;
  }
}
