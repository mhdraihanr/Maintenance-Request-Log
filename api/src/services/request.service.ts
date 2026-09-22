import { query as defaultQuery } from "../db/pool";
import type { AuthUser } from "../middleware/auth";
import {
  canEdit,
  canView,
  type RequestForPolicy,
} from "../policies/permissions";
import { badRequest, forbidden, notFound } from "../utils/errors";

type RequestRow = {
  id: string;
  code: string;
  machine_id: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "submitted" | "approved" | "rejected";
  created_by: string;
  created_at: Date;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_by_name: string;
};

type ListFilter = {
  status?: "submitted" | "approved" | "rejected";
  priority?: "low" | "medium" | "high";
  search?: string;
  page: number;
  limit: number;
  sort: "created_at" | "priority" | "status";
  order: "asc" | "desc";
};

type RequestQuery = (
  text: string,
  params?: unknown[],
) => Promise<{ rows: unknown[]; rowCount: number | null }>;

export type RequestDeps = {
  query: RequestQuery;
};

const COLUMNS = `r.id, r.code, r.machine_id, r.description, r.priority, r.status,
       r.created_by, r.created_at, r.reviewed_by, r.reviewed_at,
       u.name AS created_by_name`;

const toPublicRequest = (row: RequestRow) => ({
  id: row.id,
  code: row.code,
  machineId: row.machine_id,
  description: row.description,
  priority: row.priority,
  status: row.status,
  createdBy: { id: row.created_by, name: row.created_by_name },
  createdAt: row.created_at,
  reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at,
});

const toPolicyShape = (row: RequestRow): RequestForPolicy => ({
  createdBy: row.created_by,
  status: row.status,
});

const SORTABLE = {
  created_at: "r.created_at",
  priority: "r.priority",
  status: "r.status",
} as const;

export const makeRequestService = (deps: RequestDeps) => ({
  async list(user: AuthUser, filter: ListFilter) {
    const where: string[] = [];
    const params: unknown[] = [];

    // Cakupan dari peran, bukan dari klien: operator selalu terkunci ke miliknya.
    if (user.role === "operator") {
      params.push(user.id);
      where.push(`r.created_by = $${params.length}`);
    }

    if (filter.status) {
      params.push(filter.status);
      where.push(`r.status = $${params.length}`);
    }

    if (filter.priority) {
      params.push(filter.priority);
      where.push(`r.priority = $${params.length}`);
    }

    if (filter.search) {
      params.push(`%${filter.search}%`);
      where.push(
        `(r.machine_id ILIKE $${params.length} OR r.description ILIKE $${params.length})`,
      );
    }

    const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const direction = filter.order === "asc" ? "ASC" : "DESC";
    const sortColumn = SORTABLE[filter.sort];

    const counted = await deps.query(
      `SELECT count(*)::int AS total FROM requests r ${clause}`,
      params,
    );
    const total = (counted.rows[0] as { total: number }).total;

    const offset = (filter.page - 1) * filter.limit;
    const rows = await deps.query(
      `SELECT ${COLUMNS}
         FROM requests r
         JOIN users u ON u.id = r.created_by
         ${clause}
        ORDER BY ${sortColumn} ${direction}, r.id ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.limit, offset],
    );

    return {
      items: (rows.rows as RequestRow[]).map(toPublicRequest),
      meta: {
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: Math.ceil(total / filter.limit),
      },
    };
  },

  async create(
    user: AuthUser,
    input: { machine_id: string; description: string; priority: string },
  ) {
    const result = await deps.query(
      `INSERT INTO requests (code, machine_id, description, priority, created_by)
       VALUES ('MR-' || lpad(nextval('request_code_seq')::text, 3, '0'), $1, $2, $3, $4)
       RETURNING id`,
      [input.machine_id, input.description, input.priority, user.id],
    );

    const id = (result.rows[0] as { id: string }).id;
    return this.getById(user, id);
  },

  async getById(user: AuthUser, id: string) {
    const result = await deps.query(
      `SELECT ${COLUMNS}
         FROM requests r
         JOIN users u ON u.id = r.created_by
        WHERE r.id = $1`,
      [id],
    );

    const row = result.rows[0] as RequestRow | undefined;

    // Tidak ada → 404. Ada tapi bukan haknya → 403. Dua kasus ini sengaja dibedakan.
    if (!row) throw notFound("Request tidak ditemukan");
    if (!canView(user, toPolicyShape(row))) throw forbidden();

    return toPublicRequest(row);
  },

  async update(
    user: AuthUser,
    id: string,
    input: { machine_id?: string; description?: string; priority?: string },
  ) {
    const result = await deps.query(
      `SELECT ${COLUMNS}
         FROM requests r
         JOIN users u ON u.id = r.created_by
        WHERE r.id = $1`,
      [id],
    );

    const row = result.rows[0] as RequestRow | undefined;

    if (!row) throw notFound("Request tidak ditemukan");
    if (!canEdit(user, toPolicyShape(row))) throw forbidden();

    const fields: string[] = [];
    const params: unknown[] = [];

    if (input.machine_id !== undefined) {
      params.push(input.machine_id);
      fields.push(`machine_id = $${params.length}`);
    }

    if (input.description !== undefined) {
      params.push(input.description);
      fields.push(`description = $${params.length}`);
    }

    if (input.priority !== undefined) {
      params.push(input.priority);
      fields.push(`priority = $${params.length}`);
    }

    // Tanpa guard ini, UPDATE tanpa SET akan jadi SQL tidak valid.
    if (fields.length === 0) throw badRequest("Tidak ada field yang diubah");

    params.push(id);
    await deps.query(
      `UPDATE requests SET ${fields.join(", ")} WHERE id = $${params.length}`,
      params,
    );

    return this.getById(user, id);
  },
});

export const requestService = makeRequestService({ query: defaultQuery });
