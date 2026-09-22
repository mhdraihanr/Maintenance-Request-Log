import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";

export type RequestIdVariables = {
  requestId: string;
};

const HEADER = "X-Request-Id";

export const requestId =
  (): MiddlewareHandler<{
    Variables: RequestIdVariables;
  }> =>
  async (c, next) => {
    const incoming = c.req.header(HEADER);
    const id = incoming && incoming.length <= 128 ? incoming : randomUUID();

    c.set("requestId", id);
    c.header(HEADER, id);

    await next();
  };
