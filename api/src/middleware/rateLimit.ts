import type { Context, MiddlewareHandler } from "hono";
import { AppError } from "../utils/errors";

export const LOGIN_MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const clientKey = (c: Context): string => {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();

  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp.trim();

  return "local";
};

export function resetLoginLimiter(): void {
  buckets.clear();
}

export const loginRateLimit = (): MiddlewareHandler => {
  return async (c, next) => {
    const key = clientKey(c);
    const now = Date.now();
    const existing = buckets.get(key);

    if (existing && existing.resetAt > now) {
      if (existing.count >= LOGIN_MAX_FAILURES) {
        throw new AppError(
          429,
          "RATE_LIMITED",
          "Terlalu banyak percobaan masuk, coba lagi nanti",
        );
      }
    } else if (existing) {
      buckets.delete(key);
    }

    await next();

    // Hono mengubah error handler jadi response SEBELUM middleware ini lanjut,
    // jadi kegagalan login tidak terlihat di catch — tapi di c.res.status.
    if (c.res.status === 401) {
      const current = buckets.get(key);

      if (current && current.resetAt > now) {
        current.count += 1;
      } else {
        buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
      }
    }
  };
};
