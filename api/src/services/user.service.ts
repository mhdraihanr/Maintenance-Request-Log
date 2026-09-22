import { query as defaultQuery } from "../db/pool";
import type { AuthUser } from "../middleware/auth";
import type { Role } from "../types";
import { badRequest, conflict, notFound } from "../utils/errors";
import { hashPassword } from "../utils/password";

type UserRow = {
  id: string;
  username: string;
  name: string;
  role: Role;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
};

type ListFilter = {
  search?: string;
  role?: Role;
  is_active?: boolean;
  page: number;
  limit: number;
};

type CreateInput = {
  username: string;
  name: string;
  password: string;
  role: Role;
};

type UpdateInput = {
  name?: string;
  role?: Role;
  password?: string;
  is_active?: boolean;
};

type Query = (
  text: string,
  params?: unknown[],
) => Promise<{ rows: unknown[]; rowCount: number | null }>;

export type UserDeps = {
  query: Query;
  hash: typeof hashPassword;
};

const COLUMNS = `id, username, name, role, is_active, last_login_at, created_at`;

// password_hash TIDAK pernah keluar dari fungsi ini.
const toPublicUser = (row: UserRow) => ({
  id: row.id,
  username: row.username,
  name: row.name,
  role: row.role,
  isActive: row.is_active,
  lastLoginAt: row.last_login_at,
  createdAt: row.created_at,
});

export const makeUserService = (deps: UserDeps) => ({
  async list(filter: ListFilter) {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filter.search) {
      params.push(`%${filter.search}%`);
      where.push(
        `(username ILIKE $${params.length} OR name ILIKE $${params.length})`,
      );
    }

    if (filter.role) {
      params.push(filter.role);
      where.push(`role = $${params.length}`);
    }

    if (filter.is_active !== undefined) {
      params.push(filter.is_active);
      where.push(`is_active = $${params.length}`);
    }

    const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const counted = await deps.query(
      `SELECT count(*)::int AS total FROM users ${clause}`,
      params,
    );
    const total = (counted.rows[0] as { total: number }).total;

    const offset = (filter.page - 1) * filter.limit;
    const rows = await deps.query(
      `SELECT ${COLUMNS}
         FROM users
         ${clause}
        ORDER BY created_at DESC, id ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.limit, offset],
    );

    return {
      items: (rows.rows as UserRow[]).map(toPublicUser),
      meta: {
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: Math.ceil(total / filter.limit),
      },
    };
  },

  async create(input: CreateInput) {
    const hash = await deps.hash(input.password);

    let result;
    try {
      result = await deps.query(
        `INSERT INTO users (username, name, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING ${COLUMNS}`,
        [input.username, input.name, hash, input.role],
      );
    } catch (err) {
      // Username UNIQUE: 409, bukan 500. Kode 23505 = unique_violation.
      if (isUniqueViolation(err)) {
        throw conflict("USERNAME_TAKEN", "Username sudah dipakai");
      }
      throw err;
    }

    return toPublicUser(result.rows[0] as UserRow);
  },

  async getById(id: string) {
    const row = await findRow(deps, id);
    return toPublicUser(row);
  },

  async update(actor: AuthUser, id: string, input: UpdateInput) {
    const row = await findRow(deps, id);

    // Menonaktifkan diri sendiri akan mengunci admin keluar dari panel.
    if (input.is_active === false && id === actor.id) {
      throw badRequest("Tidak bisa menonaktifkan akun sendiri");
    }

    // Cek ini hanya perlu kalau baris target memang admin aktif.
    if (input.is_active === false || input.role !== undefined) {
      await guardLastAdmin(deps, row, input);
    }

    const fields: string[] = [];
    const params: unknown[] = [];

    if (input.name !== undefined) {
      params.push(input.name);
      fields.push(`name = $${params.length}`);
    }

    if (input.role !== undefined) {
      params.push(input.role);
      fields.push(`role = $${params.length}`);
    }

    if (input.is_active !== undefined) {
      params.push(input.is_active);
      fields.push(`is_active = $${params.length}`);
    }

    if (input.password !== undefined) {
      params.push(await deps.hash(input.password));
      fields.push(`password_hash = $${params.length}`);
    }

    params.push(id);
    const result = await deps.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING ${COLUMNS}`,
      params,
    );

    return toPublicUser(result.rows[0] as UserRow);
  },

  async deactivate(actor: AuthUser, id: string) {
    const row = await findRow(deps, id);

    if (id === actor.id) {
      throw badRequest("Tidak bisa menonaktifkan akun sendiri");
    }

    await guardLastAdmin(deps, row, { is_active: false });

    await deps.query(`UPDATE users SET is_active = false WHERE id = $1`, [id]);
  },
});

const findRow = async (deps: UserDeps, id: string): Promise<UserRow> => {
  const result = await deps.query(
    `SELECT ${COLUMNS} FROM users WHERE id = $1`,
    [id],
  );

  const row = result.rows[0] as UserRow | undefined;
  if (!row) throw notFound("User tidak ditemukan");

  return row;
};

const guardLastAdmin = async (
  deps: UserDeps,
  row: UserRow,
  input: UpdateInput,
): Promise<void> => {
  const losingAdmin =
    row.role === "admin" &&
    row.is_active &&
    (input.is_active === false ||
      (input.role !== undefined && input.role !== "admin"));

  if (!losingAdmin) return;

  const counted = await deps.query(
    `SELECT count(*)::int AS total FROM users WHERE role = 'admin' AND is_active = true`,
  );
  const activeAdmins = (counted.rows[0] as { total: number }).total;

  if (activeAdmins <= 1) {
    throw badRequest("Harus ada minimal satu admin aktif");
  }
};

// pg melempar error dengan properti `code`; 23505 = unique_violation.
const isUniqueViolation = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  (err as { code: string }).code === "23505";

export const userService = makeUserService({
  query: defaultQuery,
  hash: hashPassword,
});
