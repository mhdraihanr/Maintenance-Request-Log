import assert from "node:assert/strict";
import { loginSchema } from "../../src/schemas/auth.schema";
import {
  createUserSchema,
  updateUserSchema,
  userListQuerySchema,
} from "../../src/schemas/user.schema";
import {
  createRequestSchema,
  updateRequestSchema,
  listQuerySchema,
} from "../../src/schemas/request.schema";
import { idParamSchema } from "../../src/schemas/params.schema";
import { fieldErrors, parseOrThrow } from "../../src/utils/validation";
import { AppError } from "../../src/utils/errors";

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  OK  ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(`      ${(err as Error).message}`);
    failed++;
  }
}

// 1 — field asing ditolak, dan namanya tetap terbaca
check("createRequest menolak field asing & melaporkan namanya", () => {
  const r = createRequestSchema.safeParse({
    machine_id: "Machine A-12",
    description: "Bearing aus",
    priority: "high",
    created_by: "11111111-1111-4111-8111-111111111111",
  });

  assert.equal(r.success, false);
  const fields = fieldErrors(r.error!);
  assert.ok(
    "created_by" in fields,
    "created_by harus muncul sebagai field bermasalah",
  );
});

// 2 — status tidak bisa diselundupkan lewat PATCH
check("updateRequest menolak penyelundupan status", () => {
  const r = updateRequestSchema.safeParse({ status: "approved" });

  assert.equal(r.success, false);
  assert.ok("status" in fieldErrors(r.error!));
});

// 3 — PATCH kosong ditolak
check("updateRequest menolak body kosong", () => {
  assert.equal(updateRequestSchema.safeParse({}).success, false);
});

// 4 — normalisasi username
check("createUser men-lowercase & trim username", () => {
  const r = createUserSchema.safeParse({
    username: "  Budi.Besar ",
    name: "Budi",
    password: "rahasia123",
    role: "operator",
  });

  assert.equal(r.success, true);
  assert.equal(r.data!.username, "budi.besar");
});

// 5 — username tidak bisa diubah lewat PATCH
check("updateUser menolak perubahan username", () => {
  const r = updateUserSchema.safeParse({ username: "baru" });
  assert.equal(r.success, false);
});

// 6 — password pendek ditolak
check("createUser menolak password < 8 karakter", () => {
  const r = createUserSchema.safeParse({
    username: "budi",
    name: "Budi",
    password: "pendek",
    role: "operator",
  });

  assert.equal(r.success, false);
});

// 7 — pagination default
check("listQuery memberi default page/limit/sort/order", () => {
  const r = listQuerySchema.safeParse({});
  assert.equal(r.success, true);
  assert.equal(r.data!.page, 1);
  assert.equal(r.data!.limit, 20);
  assert.equal(r.data!.sort, "created_at");
  assert.equal(r.data!.order, "desc");
});

// 8 — sorted/order tidak bisa diisi sembarang nilai (masuk ke SQL)
check("listQuery menolak sort/order tidak dikenal", () => {
  assert.equal(
    listQuerySchema.safeParse({ sort: "DROP TABLE" }).success,
    false,
  );
  assert.equal(listQuerySchema.safeParse({ order: "sideways" }).success, false);
});

// 9 — pagination dipaksa angka
check("listQuery mengubah page/limit string jadi angka", () => {
  const r = listQuerySchema.safeParse({ page: "3", limit: "50" });
  assert.equal(r.success, true);
  assert.equal(r.data!.page, 3);
  assert.equal(r.data!.limit, 50);
});

// 10 — limit di luar batas ditolak
check("listQuery menolak limit > 100", () => {
  assert.equal(listQuerySchema.safeParse({ limit: "500" }).success, false);
});

// 11 — UUID divalidasi
check("idParam menolak id bukan UUID", () => {
  assert.equal(idParamSchema.safeParse({ id: "abc" }).success, false);
  assert.equal(
    idParamSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111" })
      .success,
    true,
  );
});

// 12 — parseOrThrow melempar AppError 400 dengan kontrak yang benar
check("parseOrThrow melempar AppError 400 VALIDATION_ERROR + fields", () => {
  let thrown: unknown;
  try {
    parseOrThrow(loginSchema, { username: "ab", password: "" });
  } catch (err) {
    thrown = err;
  }

  assert.ok(thrown instanceof AppError, "harus AppError");
  assert.equal(thrown.status, 400);
  assert.equal(thrown.code, "VALIDATION_ERROR");
  assert.ok(thrown.fields, "fields wajib ada");
  assert.ok("username" in thrown.fields!);
  assert.ok("password" in thrown.fields!);
});

// 13 — login menerima format username apa pun yang panjangnya 3-32 (tanpa regex)
check("login tidak menerapkan regex format username", () => {
  const r = loginSchema.safeParse({
    username: "Budi_Besar!",
    password: "operator123",
  });
  assert.equal(r.success, true);
});

// 14 — login menolak username terlalu pendek (dok 04 baris 61: 3-32 char)
check("login menolak username < 3 karakter", () => {
  assert.equal(
    loginSchema.safeParse({ username: "ab", password: "x" }).success,
    false,
  );
});

// 15 — login men-trim spasi di username
check("login men-trim spasi di username", () => {
  const r = loginSchema.safeParse({
    username: "  bud  ",
    password: "operator123",
  });
  assert.equal(r.success, true);
  assert.equal(r.data!.username, "bud");
});

// 16 — zod tidak lagi punya .errors (regresi Zod 3)
check("ZodError memakai .issues, bukan .errors", () => {
  const r = createRequestSchema.safeParse({});
  assert.equal(r.success, false);
  assert.ok(Array.isArray(r.error!.issues));
  assert.equal((r.error as unknown as { errors?: unknown }).errors, undefined);
});

// 17 — query param boolean jangan pakai coerce (coerce("false") === true)
check("userListQuery: is_active=false → false (bukan true)", () => {
  const r = userListQuerySchema.safeParse({ is_active: "false" });
  assert.equal(r.success, true);
  assert.equal(r.data!.is_active, false);
});

// 18 — nilai boolean ngawur ditolak, bukan diam-diam jadi true
check("userListQuery menolak is_active yang bukan true/false", () => {
  assert.equal(
    userListQuerySchema.safeParse({ is_active: "mungkin" }).success,
    false,
  );
});

console.log(`\n${passed} lulus, ${failed} gagal`);
if (failed > 0) process.exit(1);
