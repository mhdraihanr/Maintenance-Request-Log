import type { MiddlewareHandler } from "hono";
import { forbidden, unauthorized } from "../utils/errors";
import type { Role } from "./auth";

export const requireRole =
  (...allowed: Role[]): MiddlewareHandler =>
  async (c, next) => {
    const user = c.get("user");

    if (!user) {
      throw unauthorized();
    }

    if (!allowed.includes(user.role)) {
      throw forbidden();
    }

    await next();
  };
