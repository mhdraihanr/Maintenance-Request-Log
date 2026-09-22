import assert from "node:assert/strict";
import { Hono } from "hono";
import { AppError } from "../../src/utils/errors";
import type { Role, AuthUser } from "../../src/middleware/auth"; // ← Role dari auth.ts!
import { requireRole } from "../../src/middleware/requireRole";

// Aplikasi Hono NYATA dengan user yang DI-SET LANGSUNG ke context.
// requireRole tidak butuh DB, jadi tidak perlu factory: cukup c.set("user", ...).
function buildApp(user: AuthUser | null, ...allowed: Role[]) {
  const app = new Hono<{ Variables: { user: AuthUser; userId: string } }>();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        { error: { code: err.code, message: err.message } },
        err.status as 400 | 401 | 403 | 404 | 409 | 429 | 500,
      );
    }
    throw err;
  });

  // Meniru langkah auth(): memakai middleware lain untuk mengisi context.
  // null = meniru "lupa memasang auth()".
  app.use("*", async (c, next) => {
    if (user) {
      c.set("user", user);
      c.set("userId", user.id);
    }
    await next();
  });

  app.get("/protect", requireRole(...allowed), (c) =>
    c.json({ ok: true, role: c.get("user").role }),
  );

  return app;
}

const operator: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "bud",
  name: "Budi Uji",
  role: "operator",
  isActive: true,
};

const admin: AuthUser = { ...operator, role: "admin" };

async function readError(res: Response) {
  return (await res.json()) as { error: { code: string; message: string } };
}

// 1. user belum di-set (lupa pasang auth()) -> 401
{
  const res = await buildApp(null, "admin").request("/protect");
  assert.equal(res.status, 401);
  const body = await readError(res);
  assert.equal(body.error.code, "UNAUTHENTICATED");
  console.log("✓ requireRole tanpa user -> 401");
}

// 2. role cocok -> 200
{
  const res = await buildApp(admin, "admin").request("/protect");
  assert.equal(res.status, 200);
  console.log("✓ requireRole role cocok -> 200");
}

// 3. role tidak cocok -> 403 FORBIDDEN
{
  const res = await buildApp(operator, "admin").request("/protect");
  assert.equal(res.status, 403);
  const body = await readError(res);
  assert.equal(body.error.code, "FORBIDDEN");
  console.log("✓ requireRole role tidak cocok -> 403 FORBIDDEN");
}

// 4. multi-role: operator cocok karena "supervisor" ada di daftar
{
  const res = await buildApp(operator, "supervisor", "operator").request(
    "/protect",
  );
  assert.equal(res.status, 200);
  console.log("✓ requireRole multi-role bekerja");
}

// 5. role di context berubah (demote) -> langsung 403
{
  const demoted: AuthUser = { ...admin, role: "operator" };
  const res = await buildApp(demoted, "admin").request("/protect");
  assert.equal(res.status, 403);
  console.log(
    "✓ requireRole memakai role dari context (demote langsung berlaku)",
  );
}

console.log("\nSemua 5 pemeriksaan requireRole lulus.");
