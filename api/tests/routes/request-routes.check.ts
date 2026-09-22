import assert from "node:assert/strict";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { makeAuth } from "../../src/middleware/auth";
import type { AuthUser } from "../../src/middleware/auth";
import { errorHandler } from "../../src/middleware/errorHandler";
import { makeRequestRoutes } from "../../src/routes/request.routes";
import type { RequestRouteDeps } from "../../src/routes/request.routes";
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

const OP = "11111111-1111-4111-8111-111111111111";
const SUP = "22222222-2222-4222-8222-222222222222";

const OP_USER: AuthUser = {
  id: OP,
  username: "bud",
  name: "Budi",
  role: "operator",
  isActive: true,
};

const REQUEST = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  code: "MR-001",
  machineId: "Machine A-12",
  description: "Overheating issue",
  priority: "high",
  status: "submitted",
  createdBy: { id: OP, name: "Budi" },
  createdAt: new Date("2026-09-22T00:00:00Z"),
  reviewedBy: null,
  reviewedAt: null,
};

const cookieFor = (user: AuthUser) =>
  `auth=${signToken({ sub: user.id, role: user.role })}`;

// Sesi palsu: selalu mengembalikan operator aktif, tanpa menyentuh Postgres.
const fakeAuth = (): MiddlewareHandler =>
  makeAuth({
    query: (async () => ({
      rows: [
        {
          id: OP_USER.id,
          username: OP_USER.username,
          name: OP_USER.name,
          role: OP_USER.role,
          is_active: true,
        },
      ],
    })) as never,
  });

// Partial bersarang: tes cukup mengisi satu method dan sisanya dipakai apa adanya.
type PartialDeps = {
  service?: Partial<RequestRouteDeps["service"]>;
};

const buildApp = (deps: PartialDeps) => {
  const app = new Hono();
  app.onError(errorHandler());

  const full: RequestRouteDeps = {
    auth: fakeAuth,
    service: {
      list: async () => ({
        items: [REQUEST],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
      create: async () => REQUEST,
      getById: async () => REQUEST,
      update: async () => REQUEST,
      review: async () => ({
        ...REQUEST,
        status: "approved",
        reviewedBy: OP,
        reviewedAt: new Date(),
      }),
      remove: async () => undefined,
      ...deps.service,
    } as RequestRouteDeps["service"],
  };

  app.route("/api/requests", makeRequestRoutes(full));
  return app;
};

console.log("\nautentikasi");

await check("tanpa cookie → 401 UNAUTHENTICATED", async () => {
  const app = buildApp({});
  const res = await app.request("/api/requests");
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "UNAUTHENTICATED");
});

console.log("\nGET /api/requests");

await check("200 dengan data + meta", async () => {
  const app = buildApp({});
  const res = await app.request("/api/requests", {
    headers: { cookie: cookieFor(OP_USER) },
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    data: unknown[];
    meta: { total: number };
  };
  assert.equal(body.data.length, 1);
  assert.equal(body.meta.total, 1);
});

await check("scope=all DITERIMA tanpa error dan diabaikan", async () => {
  const app = buildApp({});
  const res = await app.request("/api/requests?scope=all", {
    headers: { cookie: cookieFor(OP_USER) },
  });

  // Bukan 403: skema query tidak mengenal `scope`, jadi ia diabaikan.
  assert.equal(res.status, 200);
});

await check("scope=all TIDAK sampai ke service", async () => {
  let received: Record<string, unknown> | undefined;
  const app = buildApp({
    service: {
      list: (async (_user: AuthUser, query: Record<string, unknown>) => {
        received = query;
        return {
          items: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        };
      }) as never,
    },
  });

  await app.request("/api/requests?scope=all", {
    headers: { cookie: cookieFor(OP_USER) },
  });

  assert.ok(received);
  assert.equal("scope" in received, false);
});

await check("status tidak valid → 400 VALIDATION_ERROR + fields", async () => {
  const app = buildApp({});
  const res = await app.request("/api/requests?status=ngawur", {
    headers: { cookie: cookieFor(OP_USER) },
  });

  assert.equal(res.status, 400);
  const body = (await res.json()) as {
    error: { code: string; fields: Record<string, string> };
  };
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.ok(body.error.fields.status);
});

await check("page & limit datang sebagai string dan dikonversi", async () => {
  let received: { page?: number; limit?: number } = {};
  const app = buildApp({
    service: {
      list: (async (
        _user: AuthUser,
        query: { page?: number; limit?: number },
      ) => {
        received = query;
        return {
          items: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        };
      }) as never,
    },
  });

  await app.request("/api/requests?page=2&limit=5", {
    headers: { cookie: cookieFor(OP_USER) },
  });

  assert.equal(received.page, 2);
  assert.equal(received.limit, 5);
});

console.log("\nPOST /api/requests");

await check("body valid → 201", async () => {
  const app = buildApp({});
  const res = await app.request("/api/requests", {
    method: "POST",
    headers: { cookie: cookieFor(OP_USER), "content-type": "application/json" },
    body: JSON.stringify({
      machine_id: "Machine A-12",
      description: "Overheating issue",
      priority: "high",
    }),
  });

  assert.equal(res.status, 201);
  const body = (await res.json()) as { data: { code: string } };
  assert.equal(body.data.code, "MR-001");
});

await check("field asing (status) → 400, bukan diabaikan", async () => {
  const app = buildApp({});
  const res = await app.request("/api/requests", {
    method: "POST",
    headers: { cookie: cookieFor(OP_USER), "content-type": "application/json" },
    body: JSON.stringify({
      machine_id: "Machine A-12",
      description: "Overheating issue",
      priority: "high",
      status: "approved",
    }),
  });

  assert.equal(res.status, 400);
  const body = (await res.json()) as {
    error: { fields: Record<string, string> };
  };
  assert.ok(
    body.error.fields.status ?? body.error.fields[""],
    JSON.stringify(body.error.fields),
  );
});

await check("body bukan JSON → 400, bukan 500", async () => {
  const app = buildApp({});
  const res = await app.request("/api/requests", {
    method: "POST",
    headers: { cookie: cookieFor(OP_USER), "content-type": "application/json" },
    body: "{rusak",
  });

  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "VALIDATION_ERROR");
});

await check("priority tidak valid → 400", async () => {
  const app = buildApp({});
  const res = await app.request("/api/requests", {
    method: "POST",
    headers: { cookie: cookieFor(OP_USER), "content-type": "application/json" },
    body: JSON.stringify({
      machine_id: "M",
      description: "deskripsi cukup",
      priority: "urgent",
    }),
  });

  assert.equal(res.status, 400);
});

await check("description terlalu pendek → 400", async () => {
  const app = buildApp({});
  const res = await app.request("/api/requests", {
    method: "POST",
    headers: { cookie: cookieFor(OP_USER), "content-type": "application/json" },
    body: JSON.stringify({
      machine_id: "M",
      description: "abc",
      priority: "low",
    }),
  });

  assert.equal(res.status, 400);
});

console.log("\nGET /api/requests/:id");

await check("id bukan UUID → 400", async () => {
  const app = buildApp({});
  const res = await app.request("/api/requests/bukan-uuid", {
    headers: { cookie: cookieFor(OP_USER) },
  });

  assert.equal(res.status, 400);
});

await check("200 untuk request yang boleh dilihat", async () => {
  const app = buildApp({});
  const res = await app.request(`/api/requests/${REQUEST.id}`, {
    headers: { cookie: cookieFor(OP_USER) },
  });

  assert.equal(res.status, 200);
});

console.log("\nPATCH /api/requests/:id");

await check("body valid → 200", async () => {
  const app = buildApp({});
  const res = await app.request(`/api/requests/${REQUEST.id}`, {
    method: "PATCH",
    headers: { cookie: cookieFor(OP_USER), "content-type": "application/json" },
    body: JSON.stringify({ priority: "medium" }),
  });

  assert.equal(res.status, 200);
});

await check("mengirim status ke PATCH → 400 (FR-02.9)", async () => {
  const app = buildApp({});
  const res = await app.request(`/api/requests/${REQUEST.id}`, {
    method: "PATCH",
    headers: { cookie: cookieFor(OP_USER), "content-type": "application/json" },
    body: JSON.stringify({ status: "approved" }),
  });

  assert.equal(res.status, 400);
});

await check("mengirim created_by ke PATCH → 400", async () => {
  const app = buildApp({});
  const res = await app.request(`/api/requests/${REQUEST.id}`, {
    method: "PATCH",
    headers: { cookie: cookieFor(OP_USER), "content-type": "application/json" },
    body: JSON.stringify({ created_by: SUP }),
  });

  assert.equal(res.status, 400);
});

await check("body kosong → 400", async () => {
  const app = buildApp({});
  const res = await app.request(`/api/requests/${REQUEST.id}`, {
    method: "PATCH",
    headers: { cookie: cookieFor(OP_USER), "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  assert.equal(res.status, 400);
});

await check("service melempar 403 → response 403 FORBIDDEN", async () => {
  const app = buildApp({
    service: {
      update: (async () => {
        const { forbidden } = await import("../../src/utils/errors");
        throw forbidden();
      }) as never,
    },
  });

  const res = await app.request(`/api/requests/${REQUEST.id}`, {
    method: "PATCH",
    headers: { cookie: cookieFor(OP_USER), "content-type": "application/json" },
    body: JSON.stringify({ priority: "low" }),
  });

  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "FORBIDDEN");
});

await check("service melempar 404 → response 404 NOT_FOUND", async () => {
  const app = buildApp({
    service: {
      getById: (async () => {
        const { notFound } = await import("../../src/utils/errors");
        throw notFound();
      }) as never,
    },
  });

  const res = await app.request(`/api/requests/${REQUEST.id}`, {
    headers: { cookie: cookieFor(OP_USER) },
  });

  assert.equal(res.status, 404);
});

console.log("\nPOST /api/requests/:id/approve dan /reject");

await check("approve tanpa body → 200", async () => {
  const app = buildApp({});
  const res = await app.request(`/api/requests/${REQUEST.id}/approve`, {
    method: "POST",
    headers: { cookie: cookieFor(OP_USER) },
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { status: string } };
  assert.equal(body.data.status, "approved");
});

await check("approve dengan note valid → 200", async () => {
  const app = buildApp({});
  const res = await app.request(`/api/requests/${REQUEST.id}/approve`, {
    method: "POST",
    headers: { cookie: cookieFor(OP_USER), "content-type": "application/json" },
    body: JSON.stringify({ note: "Sudah diverifikasi di lapangan" }),
  });

  assert.equal(res.status, 200);
});

await check("approve dengan note kepanjangan → 400", async () => {
  const app = buildApp({});
  const res = await app.request(`/api/requests/${REQUEST.id}/approve`, {
    method: "POST",
    headers: { cookie: cookieFor(OP_USER), "content-type": "application/json" },
    body: JSON.stringify({ note: "x".repeat(501) }),
  });

  assert.equal(res.status, 400);
});

await check("approve dengan field asing → 400", async () => {
  const app = buildApp({});
  const res = await app.request(`/api/requests/${REQUEST.id}/approve`, {
    method: "POST",
    headers: { cookie: cookieFor(OP_USER), "content-type": "application/json" },
    body: JSON.stringify({ status: "approved" }),
  });

  assert.equal(res.status, 400);
});

await check("approve body rusak → 400, bukan 500", async () => {
  const app = buildApp({});
  const res = await app.request(`/api/requests/${REQUEST.id}/approve`, {
    method: "POST",
    headers: { cookie: cookieFor(OP_USER), "content-type": "application/json" },
    body: "{rusak",
  });

  assert.equal(res.status, 400);
});

await check("reject → 200 dengan status rejected", async () => {
  const app = buildApp({
    service: {
      review: (async (_u: AuthUser, _id: string, next: string) => ({
        ...REQUEST,
        status: next,
      })) as never,
    },
  });

  const res = await app.request(`/api/requests/${REQUEST.id}/reject`, {
    method: "POST",
    headers: { cookie: cookieFor(OP_USER) },
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { status: string } };
  assert.equal(body.data.status, "rejected");
});

await check("service melempar 403 → response 403", async () => {
  const app = buildApp({
    service: {
      review: (async () => {
        const { forbidden } = await import("../../src/utils/errors");
        throw forbidden();
      }) as never,
    },
  });

  const res = await app.request(`/api/requests/${REQUEST.id}/approve`, {
    method: "POST",
    headers: { cookie: cookieFor(OP_USER) },
  });

  assert.equal(res.status, 403);
});

await check(
  "service melempar 409 ALREADY_REVIEWED → response 409",
  async () => {
    const app = buildApp({
      service: {
        review: (async () => {
          const { conflict } = await import("../../src/utils/errors");
          throw conflict("ALREADY_REVIEWED", "Request ini sudah ditinjau");
        }) as never,
      },
    });

    const res = await app.request(`/api/requests/${REQUEST.id}/approve`, {
      method: "POST",
      headers: { cookie: cookieFor(OP_USER) },
    });

    assert.equal(res.status, 409);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "ALREADY_REVIEWED");
  },
);

await check("approve id bukan UUID → 400", async () => {
  const app = buildApp({});
  const res = await app.request("/api/requests/bukan-uuid/approve", {
    method: "POST",
    headers: { cookie: cookieFor(OP_USER) },
  });

  assert.equal(res.status, 400);
});

await check("approve tanpa cookie → 401", async () => {
  const app = buildApp({});
  const res = await app.request(`/api/requests/${REQUEST.id}/approve`, {
    method: "POST",
  });

  assert.equal(res.status, 401);
});

console.log("\nDELETE /api/requests/:id");

await check("admin hapus → 204 tanpa body", async () => {
  const app = buildApp({});
  const res = await app.request(`/api/requests/${REQUEST.id}`, {
    method: "DELETE",
    headers: { cookie: cookieFor(OP_USER) },
  });

  assert.equal(res.status, 204);
  assert.equal(await res.text(), "");
});

await check("service melempar 403 → response 403", async () => {
  const app = buildApp({
    service: {
      remove: (async () => {
        const { forbidden } = await import("../../src/utils/errors");
        throw forbidden();
      }) as never,
    },
  });

  const res = await app.request(`/api/requests/${REQUEST.id}`, {
    method: "DELETE",
    headers: { cookie: cookieFor(OP_USER) },
  });

  assert.equal(res.status, 403);
});

await check("service melempar 404 → response 404", async () => {
  const app = buildApp({
    service: {
      remove: (async () => {
        const { notFound } = await import("../../src/utils/errors");
        throw notFound();
      }) as never,
    },
  });

  const res = await app.request(`/api/requests/${REQUEST.id}`, {
    method: "DELETE",
    headers: { cookie: cookieFor(OP_USER) },
  });

  assert.equal(res.status, 404);
});

console.log(`\n${passed} lulus, ${failed} gagal`);

if (failed > 0) {
  process.exitCode = 1;
}
