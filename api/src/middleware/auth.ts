import type { MiddlewareHandler } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { query as defaultQuery } from "../db/pool";
import type { Role } from "../types";
import { accountInactive, unauthorized } from "../utils/errors";
import { verifyToken } from "../utils/jwt";

const COOKIE_NAME = "auth";

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  role: Role;
  isActive: boolean;
};

type UserRow = {
  id: string;
  username: string;
  name: string;
  role: Role;
  is_active: boolean;
};

export type AuthDeps = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: UserRow[] }>;
};

export const makeAuth =
  (deps: AuthDeps): MiddlewareHandler =>
  async (c, next) => {
    const token = getCookie(c, COOKIE_NAME);

    if (!token) {
      throw unauthorized();
    }

    const payload = verifyToken(token);

    const result = await deps.query(
      `SELECT id, username, name, role, is_active
       FROM users
      WHERE id = $1`,
      [payload.sub],
    );

    const row = result.rows[0];

    if (!row) {
      deleteCookie(c, COOKIE_NAME, { path: "/" });
      throw unauthorized("Sesi tidak dikenal, silakan masuk lagi");
    }

    if (!row.is_active) {
      deleteCookie(c, COOKIE_NAME, { path: "/" });
      throw accountInactive();
    }

    const user: AuthUser = {
      id: row.id,
      username: row.username,
      name: row.name,
      role: row.role,
      isActive: row.is_active,
    };

    c.set("user", user);
    c.set("userId", user.id);

    await next();
  };

export const auth = (): MiddlewareHandler => makeAuth({ query: defaultQuery });
