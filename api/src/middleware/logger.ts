import type { MiddlewareHandler } from "hono";
import type { RequestIdVariables } from "./requestId";

export const logger =
  (): MiddlewareHandler<{
    Variables: RequestIdVariables;
  }> =>
  async (c, next) => {
    const started = performance.now();

    await next();

    const elapsedMs = Math.round((performance.now() - started) * 10) / 10;
    const status = c.res.status;

    const entry = {
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
      status,
      elapsedMs,
      userId: c.get("userId") ?? null,
    };

    console.log(JSON.stringify(entry));
  };
