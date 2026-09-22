import { query as defaultQuery } from "../db/pool";
import type { Role } from "../types";
import {
  accountInactive,
  invalidCredentials,
  unauthorized,
} from "../utils/errors";
import { signToken } from "../utils/jwt";
import { verifyPassword } from "../utils/password";

export type PublicUser = {
  id: string;
  username: string;
  name: string;
  role: Role;
};

type UserRow = {
  id: string;
  username: string;
  name: string;
  role: Role;
  password_hash: string;
  is_active: boolean;
};

export type AuthDeps = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  verify: typeof verifyPassword;
  sign: typeof signToken;
};

export const makeAuthService = (deps: AuthDeps) => ({
  async login(
    username: string,
    password: string,
  ): Promise<{ user: PublicUser; token: string }> {
    const result = await deps.query(
      `SELECT id, username, name, role, password_hash, is_active
         FROM users
        WHERE username = $1`,
      [username],
    );

    const row = result.rows[0] as UserRow | undefined;

    // Urutan argumen: hash dulu, plaintext kedua. Dibalik = 500 untuk semua password.
    if (!row || !(await deps.verify(row.password_hash, password))) {
      throw invalidCredentials();
    }

    if (!row.is_active) {
      throw accountInactive();
    }

    await deps.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [
      row.id,
    ]);

    return {
      user: toPublicUser(row),
      token: deps.sign({ sub: row.id, role: row.role }),
    };
  },

  async profile(userId: string): Promise<PublicUser> {
    const result = await deps.query(
      `SELECT id, username, name, role, password_hash, is_active
         FROM users
        WHERE id = $1`,
      [userId],
    );

    const row = result.rows[0] as UserRow | undefined;

    if (!row) {
      throw unauthorized();
    }

    if (!row.is_active) {
      throw accountInactive();
    }

    return toPublicUser(row);
  },
});

const toPublicUser = (row: UserRow): PublicUser => ({
  id: row.id,
  username: row.username,
  name: row.name,
  role: row.role,
});

export const authService = makeAuthService({
  query: defaultQuery,
  verify: verifyPassword,
  sign: signToken,
});
