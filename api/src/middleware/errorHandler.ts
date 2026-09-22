import type { ErrorHandler } from "hono";
import { AppError } from "../utils/errors";
import { env } from "../env";

export const errorHandler = (): ErrorHandler => (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.fields ? { fields: err.fields } : {}),
        },
      },
      err.status as 400,
    );
  }

  const requestId = c.get("requestId") ?? null;

  console.error(
    JSON.stringify({
      level: "error",
      requestId,
      method: c.req.method,
      path: c.req.path,
      message: err instanceof Error ? err.message : String(err),
      stack: env.NODE_ENV === "production" ? undefined : err.stack,
    }),
  );

  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan pada server",
        requestId,
      },
    },
    500,
  );
};
