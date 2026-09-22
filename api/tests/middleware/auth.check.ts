import assert from "node:assert/strict";
import { Hono } from "hono";
import { AppError } from "../../src/utils/errors";
import type { AuthUser } from "../../src/middleware/auth";
import { makeAuth } from "../../src/middleware/auth";
import { signToken } from "../../src/utils/jwt";

const COOKIE_NAME = "auth";

// Baris DB tiruan. auth.check.ts TIDAK menyentuh Postgres sama sekali.
type Row = {
  id: string;
  username: string;
  name: string;
  role: "operator" | "supervisor" | "admin";
  is_active: boolean;
};

const row: Row = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "bud",
  name: "Budi Uji",
  role: "operator",
  is_active: true,
};

// Meniru `query` milik pg: menerima (text, params) dan mengembalikan { rows }.
// Parameternya DIABAIKAN — uji mengontrol hasilnya langsung.
const fakeQuery =
  (rows: Row[]) =>
  async (_text: string, _params?: unknown[]): Promise<{ rows: Row[] }> => ({
    rows,
  });

// Aplikasi Hono NYATA. Ini wajib: getCookie membaca c.req.raw.headers,
// yang tidak bisa ditiru oleh objek Context palsu.
function buildApp(rows: Row[]) {
  const app = new Hono<{ Variables: { user: AuthUser; userId: string } }>();

  // onError minimal, sama seperti index.ts memasang errorHandler().
  // Tanpa ini, Hono mengubah SEMUA error jadi 500 dan uji jadi tidak informatif.
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        { error: { code: err.code, message: err.message } },
        err.status as 400 | 401 | 403 | 404 | 409 | 429 | 500,
      );
    }
    throw err;
  });

  app.use("*", makeAuth({ query: fakeQuery(rows) }));
  app.get("/me", (c) =>
    c.json({ user: c.get("user"), userId: c.get("userId") }),
  );

  return app;
}

function tokenFor(
  userId: string,
  role: "operator" | "supervisor" | "admin" = "operator",
) {
  return signToken({ sub: userId, role });
}

async function readError(res: Response) {
  return (await res.json()) as { error: { code: string; message: string } };
}

// 1. tanpa cookie -> 401
{
  const res = await buildApp([row]).request("/me");
  assert.equal(res.status, 401);
  const body = await readError(res);
  assert.equal(body.error.code, "UNAUTHENTICATED");
  console.log("✓ tanpa cookie -> 401 UNAUTHENTICATED");
}

// 2. cookie valid -> 200, user terisi dari DB
{
  const res = await buildApp([row]).request("/me", {
    headers: { Cookie: `${COOKIE_NAME}=${tokenFor(row.id)}` },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { user: AuthUser; userId: string };
  assert.equal(body.user.id, row.id);
  assert.equal(body.user.username, "bud");
  assert.equal(body.user.name, "Budi Uji");
  assert.equal(body.user.role, "operator");
  assert.equal(body.user.isActive, true);
  assert.equal(body.userId, row.id);
  console.log("✓ cookie valid -> 200, user terisi dari DB");
}

// 3. token valid tapi user tidak ada di DB -> 401 + cookie dihapus
{
  const res = await buildApp([]).request("/me", {
    headers: { Cookie: `${COOKIE_NAME}=${tokenFor(row.id)}` },
  });
  assert.equal(res.status, 401);
  const body = await readError(res);
  assert.equal(body.error.code, "UNAUTHENTICATED");
  const setCookie = res.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /Max-Age=0/, "cookie harus dihapus (Max-Age=0)");
  console.log("✓ user tidak dikenal -> 401 + cookie dihapus");
}

// 4. is_active=false -> 401 ACCOUNT_INACTIVE
{
  const inactive: Row = { ...row, is_active: false };
  const res = await buildApp([inactive]).request("/me", {
    headers: { Cookie: `${COOKIE_NAME}=${tokenFor(row.id)}` },
  });
  assert.equal(res.status, 401);
  const body = await readError(res);
  assert.equal(body.error.code, "ACCOUNT_INACTIVE");
  console.log(
    "✓ is_active=false di DB -> 401 ACCOUNT_INACTIVE (role/status dari DB)",
  );
}

// 5. KASUS TERPENTING: token bilang operator, DB bilang admin -> admin
{
  const adminRow: Row = { ...row, role: "admin" };
  const res = await buildApp([adminRow]).request("/me", {
    // token SENGAJA dibuat dengan role "operator"
    headers: { Cookie: `${COOKIE_NAME}=${tokenFor(row.id, "operator")}` },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { user: AuthUser };
  assert.equal(
    body.user.role,
    "admin",
    "role HARUS dari DB, bukan payload.role",
  );
  console.log(
    "✓ role diambil dari DB (token bilang operator, DB bilang admin -> admin)",
  );
}

// 6. cookie rusak -> 401
{
  const res = await buildApp([row]).request("/me", {
    headers: { Cookie: `${COOKIE_NAME}=token.yang.tidak.valid` },
  });
  assert.equal(res.status, 401);
  const body = await readError(res);
  assert.equal(body.error.code, "UNAUTHENTICATED");
  console.log("✓ cookie rusak -> 401 UNAUTHENTICATED");
}

// 7. Context PALSU tidak cukup: getCookie butuh c.req.raw.headers yang lengkap.
// Jadi uji ini memakai Hono asli, dan memeriksa error yang SAMPAI ke onError.
{
  const seen: unknown[] = [];
  const app = new Hono<{ Variables: { user: AuthUser; userId: string } }>();

  app.use("*", makeAuth({ query: async () => ({ rows: [row] }) }));
  app.onError((err, c) => {
    seen.push(err);
    return c.json({ caught: err instanceof AppError }, 500);
  });
  app.get("/x", (c) => c.json({ ok: true }));

  const res = await app.request("/x"); // tanpa cookie

  assert.equal(seen.length, 1, "harus ada tepat satu error sampai ke onError");
  const err = seen[0];
  assert.ok(err instanceof AppError, "error harus AppError, bukan TypeError");
  assert.equal((err as AppError).status, 401);
  assert.equal((err as AppError).code, "UNAUTHENTICATED");
  assert.equal(
    res.status,
    500,
    "onError di app ini memang mengubahnya jadi 500",
  );
  console.log("✓ middleware melempar AppError(401), tidak menulis response");
}

console.log("\nSemua 7 pemeriksaan auth lulus.");
