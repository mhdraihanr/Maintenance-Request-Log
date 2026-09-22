import "hono";
import type { AuthUser } from "./middleware/auth";

declare module "hono" {
  interface ContextVariableMap {
    userId: string | null;
    user: AuthUser;
  }
}
