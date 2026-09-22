import assert from "node:assert/strict";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { makeAuth } from "../../src/middleware/auth";
import type { AuthUser } from "../../src/middleware/auth";
import { errorHandler } from "../../src/middleware/errorHandler";
import { requireRole } from "../../src/middleware/requireRole";
import { makeUserRoutes } from "../../src/routes/user.routes";
import type { UserRouteDeps } from "../../src/routes/user.routes";
import { signToken } from "../../src/utils/jwt";

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  OK  ${name}`);
  } catch (err) {
    failed += 1;
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  FAIL ${name}\n       ${message}`);
  }
}

const ADMIN_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const OP_ID = "cccccccc-3333-4333-8333-cccccccccccc";

const ADMIN: AuthUser = {
  id: ADMIN_ID,
  username: "andi",
  name: "Andi",
  role: "admin",
  isActive: true,
};

const OPERATOR: AuthUser = {
  id: OP_ID,
  username: "bud",
  name: "Budi",
  role: "operator",
  isActive: true,
};

const SUPERVISOR: AuthUser = {
  id: "dddddddd-4444-4444-8444-dddddddddddd",
  username: "siti",
  name: "Siti",
  role: "supervisor",
  isActive: true,
};

const USER = {
  id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
  username: "siti",
  name: "Siti",
  role: "supervisor",
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date("2026-09-20T00:00:00Z"),
};

const cookieFor = (user: AuthUser) =>
  `auth=${signToken({ sub: user.id, role: user.role })}`;

// Sesi palsu: mengembalikan user sesuai cookie yang dikirim.
const makeFakeAuth = (user: AuthUser): MiddlewareHandler =>
  makeAuth({
    query: (async () => ({
      rows: [
        {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          is_active: true,
        },
      ],
    })) as never,
  });

type PartialDeps = {
  service?: Partial<UserRouteDeps["service"]>;
  actor?: AuthUser;
};

const buildApp = (deps: PartialDeps) => {
  const app = new Hono();
  app.onError(errorHandler());

  const full: UserRouteDeps = {
    auth: () => makeFakeAuth(deps.actor ?? ADMIN),
    guard: () => requireRole("admin"),
    service: {
      list: async () => ({
        items: [USER],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
      create: async () => USER,
      getById: async () => USER,
      update: async () => USER,
      deactivate: async () => undefined,
      ...deps.service,
    } as UserRouteDeps["service"],
  };

  app.route("/api/users", makeUserRoutes(full));
  return app;
};

console.log("\nautentikasi dan otorisasi");

await check("tanpa cookie -> 401 UNAUTHENTICATED", async () => {
  const res = await buildApp({}).request("/api/users");
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "UNAUTHENTICATED");
});

await check("operator GET /api/users -> 403 FORBIDDEN", async () => {
  const res = await buildApp({ actor: OPERATOR }).request("/api/users", {
    headers: { cookie: cookieFor(OPERATOR) },
  });
  assert.equal(res.status, 403);
});

await check("operator POST /api/users -> 403", async () => {
  const res = await buildApp({ actor: OPERATOR }).request("/api/users", {
    method: "POST",
    headers: {
      cookie: cookieFor(OPERATOR),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: "x",
      name: "X",
      password: "rahasia123",
      role: "operator",
    }),
  });
  assert.equal(res.status, 403);
});

await check("operator DELETE /api/users/:id -> 403", async () => {
  const res = await buildApp({ actor: OPERATOR }).request(
    `/api/users/${USER.id}`,
    { method: "DELETE", headers: { cookie: cookieFor(OPERATOR) } },
  );
  assert.equal(res.status, 403);
});

await check("supervisor GET /api/users -> 403", async () => {
  const res = await buildApp({ actor: SUPERVISOR }).request("/api/users", {
    headers: { cookie: cookieFor(SUPERVISOR) },
  });
  assert.equal(res.status, 403);
});

console.log("\nGET /api/users");

await check("admin list -> 200 dengan meta", async () => {
  const res = await buildApp({}).request("/api/users", {
    headers: { cookie: cookieFor(ADMIN) },
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    data: unknown[];
    meta: { total: number };
  };
  assert.equal(body.data.length, 1);
  assert.equal(body.meta.total, 1);
});

await check("query is_active=abc -> 400, bukan 500", async () => {
  const res = await buildApp({}).request("/api/users?is_active=abc", {
    headers: { cookie: cookieFor(ADMIN) },
  });
  assert.equal(res.status, 400);
});

console.log("\nPOST /api/users");

await check("admin create -> 201 dan tanpa password", async () => {
  const res = await buildApp({}).request("/api/users", {
    method: "POST",
    headers: { cookie: cookieFor(ADMIN), "content-type": "application/json" },
    body: JSON.stringify({
      username: "dika",
      name: "Dika",
      password: "rahasia123",
      role: "operator",
    }),
  });

  assert.equal(res.status, 201);
  const body = (await res.json()) as { data: Record<string, unknown> };
  assert.ok(!("passwordHash" in body.data));
  assert.ok(!("password_hash" in body.data));
});

await check("create username tidak sah -> 400", async () => {
  const res = await buildApp({}).request("/api/users", {
    method: "POST",
    headers: { cookie: cookieFor(ADMIN), "content-type": "application/json" },
    body: JSON.stringify({
      username: "AB",
      name: "Ab",
      password: "rahasia123",
      role: "operator",
    }),
  });
  assert.equal(res.status, 400);
});

await check("create field asing -> 400", async () => {
  const res = await buildApp({}).request("/api/users", {
    method: "POST",
    headers: { cookie: cookieFor(ADMIN), "content-type": "application/json" },
    body: JSON.stringify({
      username: "dika",
      name: "Dika",
      password: "rahasia123",
      role: "operator",
      is_active: false,
    }),
  });
  assert.equal(res.status, 400);
});

await check("body rusak -> 400, bukan 500", async () => {
  const res = await buildApp({}).request("/api/users", {
    method: "POST",
    headers: { cookie: cookieFor(ADMIN), "content-type": "application/json" },
    body: "{rusak",
  });
  assert.equal(res.status, 400);
});

await check("service melempar 409 -> response 409 USERNAME_TAKEN", async () => {
  const app = buildApp({
    service: {
      create: (async () => {
        const { conflict } = await import("../../src/utils/errors");
        throw conflict("USERNAME_TAKEN", "Username sudah dipakai");
      }) as never,
    },
  });

  const res = await app.request("/api/users", {
    method: "POST",
    headers: { cookie: cookieFor(ADMIN), "content-type": "application/json" },
    body: JSON.stringify({
      username: "bud",
      name: "Bud",
      password: "rahasia123",
      role: "operator",
    }),
  });

  assert.equal(res.status, 409);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "USERNAME_TAKEN");
});

console.log("\nPATCH /api/users/:id");

await check("admin patch nama -> 200", async () => {
  const res = await buildApp({}).request(`/api/users/${USER.id}`, {
    method: "PATCH",
    headers: { cookie: cookieFor(ADMIN), "content-type": "application/json" },
    body: JSON.stringify({ name: "Siti Baru" }),
  });
  assert.equal(res.status, 200);
});

await check("patch body kosong -> 400", async () => {
  const res = await buildApp({}).request(`/api/users/${USER.id}`, {
    method: "PATCH",
    headers: { cookie: cookieFor(ADMIN), "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
});

await check("service melempar 400 -> response 400", async () => {
  const app = buildApp({
    service: {
      update: (async () => {
        const { badRequest } = await import("../../src/utils/errors");
        throw badRequest("Tidak bisa menonaktifkan akun sendiri");
      }) as never,
    },
  });

  const res = await app.request(`/api/users/${ADMIN_ID}`, {
    method: "PATCH",
    headers: { cookie: cookieFor(ADMIN), "content-type": "application/json" },
    body: JSON.stringify({ is_active: false }),
  });
  assert.equal(res.status, 400);
});

await check("patch id bukan UUID -> 400", async () => {
  const res = await buildApp({}).request("/api/users/bukan-uuid", {
    method: "PATCH",
    headers: { cookie: cookieFor(ADMIN), "content-type": "application/json" },
    body: JSON.stringify({ name: "X" }),
  });
  assert.equal(res.status, 400);
});

await check("patch is_active bukan boolean -> 400", async () => {
  const res = await buildApp({}).request(`/api/users/${USER.id}`, {
    method: "PATCH",
    headers: { cookie: cookieFor(ADMIN), "content-type": "application/json" },
    body: JSON.stringify({ is_active: "false" }),
  });
  assert.equal(res.status, 400);
});

console.log("\nDELETE /api/users/:id");

await check("admin delete -> 204 tanpa body", async () => {
  const res = await buildApp({}).request(`/api/users/${USER.id}`, {
    method: "DELETE",
    headers: { cookie: cookieFor(ADMIN) },
  });

  assert.equal(res.status, 204);
  assert.equal(await res.text(), "");
});

await check("service melempar 404 -> response 404", async () => {
  const app = buildApp({
    service: {
      deactivate: (async () => {
        const { notFound } = await import("../../src/utils/errors");
        throw notFound("User tidak ditemukan");
      }) as never,
    },
  });

  const res = await app.request(`/api/users/${USER.id}`, {
    method: "DELETE",
    headers: { cookie: cookieFor(ADMIN) },
  });
  assert.equal(res.status, 404);
});

console.log("\nGET /api/users/:id");

await check("admin detail -> 200", async () => {
  const res = await buildApp({}).request(`/api/users/${USER.id}`, {
    headers: { cookie: cookieFor(ADMIN) },
  });
  assert.equal(res.status, 200);
});

await check("detail id bukan UUID -> 400", async () => {
  const res = await buildApp({}).request("/api/users/bukan-uuid", {
    headers: { cookie: cookieFor(ADMIN) },
  });
  assert.equal(res.status, 400);
});

console.log(`\n${passed} lulus, ${failed} gagal`);

if (failed > 0) {
  process.exitCode = 1;
}
