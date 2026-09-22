import type { MiddlewareHandler } from "hono";
import type { Role } from "../types";
import { forbidden, unauthorized } from "../utils/errors";

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
