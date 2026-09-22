import assert from "node:assert/strict";
import { makeUserService } from "../../src/services/user.service";
import type { UserDeps } from "../../src/services/user.service";
import type { AuthUser } from "../../src/middleware/auth";

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

const ADMIN: AuthUser = {
  id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  username: "andi",
  name: "Andi",
  role: "admin",
  isActive: true,
};

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
  username: "siti",
  name: "Siti",
  role: "supervisor",
  is_active: true,
  last_login_at: null,
  created_at: new Date("2026-09-20T00:00:00Z"),
  ...over,
});

type Call = { text: string; params: unknown[] };

// Antrean baris: tiap panggilan query mengambil satu grup hasil dari `queue`.
const recorder = (queue: unknown[][]) => {
  const calls: Call[] = [];
  let i = 0;

  const query = (async (text: string, params: unknown[] = []) => {
    calls.push({ text, params });
    const rows = queue[i] ?? [];
    i += 1;
    return { rows, rowCount: rows.length };
  }) as UserDeps["query"];

  return { query, calls };
};

const hash = (async (plain: string) => `HASHED:${plain}`) as UserDeps["hash"];

const svc = (queue: unknown[][]) => {
  const { query, calls } = recorder(queue);
  return { service: makeUserService({ query, hash }), calls };
};

console.log("\nlist");

await check("list mengembalikan meta dan menyembunyikan password", async () => {
  const { service } = svc([[{ total: 1 }], [row()]]);
  const result = await service.list({ page: 1, limit: 20 });

  assert.deepEqual(Object.keys(result.items[0]!), [
    "id",
    "username",
    "name",
    "role",
    "isActive",
    "lastLoginAt",
    "createdAt",
  ]);
  assert.equal(result.meta.total, 1);
});

await check("list filter is_active=false ikut ke WHERE", async () => {
  const { service, calls } = svc([[{ total: 0 }], []]);
  await service.list({ is_active: false, page: 1, limit: 20 });

  assert.ok(calls[1]!.text.includes("is_active = $1"));
  assert.deepEqual(calls[1]!.params.slice(0, 1), [false]);
});

await check("list search memakai ILIKE pada username dan name", async () => {
  const { service, calls } = svc([[{ total: 0 }], []]);
  await service.list({ search: "bud", page: 1, limit: 20 });

  assert.ok(calls[1]!.text.includes("username ILIKE $1 OR name ILIKE $1"));
  assert.deepEqual(calls[1]!.params.slice(0, 1), ["%bud%"]);
});

await check("list menghitung totalPages dari limit", async () => {
  const { service } = svc([[{ total: 41 }], []]);
  const result = await service.list({ page: 1, limit: 20 });

  assert.equal(result.meta.totalPages, 3);
});

console.log("\ncreate");

await check("create mem-hash password sebelum INSERT", async () => {
  const { service, calls } = svc([
    [row({ username: "dika", role: "operator" })],
  ]);

  const created = await service.create({
    username: "dika",
    name: "Dika",
    password: "rahasia123",
    role: "operator",
  });

  const insert = calls.find((c) => c.text.startsWith("INSERT"))!;
  assert.equal(insert.params[2], "HASHED:rahasia123");
  assert.equal(created.username, "dika");
  assert.ok(!("passwordHash" in created));
});

await check("create username duplikat -> CONFLICT 409, bukan 500", async () => {
  const err = Object.assign(new Error("duplicate"), { code: "23505" });
  const failing = (async () => {
    throw err;
  }) as UserDeps["query"];

  const service = makeUserService({ query: failing, hash });

  await assert.rejects(
    () =>
      service.create({
        username: "bud",
        name: "Bud",
        password: "rahasia123",
        role: "operator",
      }),
    (e: { status: number; code: string }) =>
      e.status === 409 && e.code === "USERNAME_TAKEN",
  );
});

console.log("\nupdate");

await check("update nama saja -> password_hash tidak tersentuh", async () => {
  const { service, calls } = svc([[row()], [row({ name: "Siti Baru" })]]);

  const updated = await service.update(ADMIN, row().id, { name: "Siti Baru" });

  const sql = calls[1]!.text;
  assert.ok(sql.includes("name = $1"));
  assert.ok(!sql.includes("password_hash"));
  assert.equal(updated.name, "Siti Baru");
});

await check("update password -> di-hash, bukan plaintext", async () => {
  const { service, calls } = svc([[row()], [row()]]);

  await service.update(ADMIN, row().id, { password: "baru12345" });

  const sql = calls[1]!.text;
  assert.ok(sql.includes("password_hash = $1"));
  assert.deepEqual(calls[1]!.params[0], "HASHED:baru12345");
});

await check("update user tidak ada -> NOT_FOUND 404", async () => {
  const { service } = svc([[]]);

  await assert.rejects(
    () => service.update(ADMIN, row().id, { name: "X" }),
    (e: { status: number }) => e.status === 404,
  );
});

await check("nonaktifkan diri sendiri -> BAD_REQUEST 400", async () => {
  const { service } = svc([[row({ id: ADMIN.id, role: "admin" })]]);

  await assert.rejects(
    () => service.update(ADMIN, ADMIN.id, { is_active: false }),
    (e: { status: number }) => e.status === 400,
  );
});

await check("nonaktifkan admin aktif terakhir -> 400", async () => {
  const target = row({ role: "admin", is_active: true });
  const { service } = svc([[target], [{ total: 1 }]]);

  await assert.rejects(
    () => service.update(ADMIN, target.id, { is_active: false }),
    (e: { status: number }) => e.status === 400,
  );
});

await check(
  "nonaktifkan admin saat masih ada 2 admin -> diizinkan",
  async () => {
    const target = row({ role: "admin", is_active: true });
    const { service } = svc([
      [target],
      [{ total: 2 }],
      [row({ is_active: false })],
    ]);

    const updated = await service.update(ADMIN, target.id, {
      is_active: false,
    });

    assert.equal(updated.isActive, false);
  },
);

await check("nonaktifkan operator -> tidak perlu hitung admin", async () => {
  const target = row({ role: "operator" });
  const { service, calls } = svc([[target], [row({ is_active: false })]]);

  await service.update(ADMIN, target.id, { is_active: false });

  assert.ok(
    !calls.some((c) =>
      c.text.includes("count(*)::int AS total FROM users WHERE role"),
    ),
  );
});

await check("ubah peran admin aktif terakhir -> 400", async () => {
  const target = row({ role: "admin", is_active: true });
  const { service } = svc([[target], [{ total: 1 }]]);

  await assert.rejects(
    () => service.update(ADMIN, target.id, { role: "operator" }),
    (e: { status: number }) => e.status === 400,
  );
});

await check("ubah peran admin nonaktif -> tidak dihitung, aman", async () => {
  const target = row({ role: "admin", is_active: false });
  const { service, calls } = svc([
    [target],
    [row({ role: "operator", is_active: false })],
  ]);

  const updated = await service.update(ADMIN, target.id, { role: "operator" });

  assert.equal(updated.role, "operator");
  assert.ok(
    !calls.some((c) =>
      c.text.includes("count(*)::int AS total FROM users WHERE role"),
    ),
  );
});

console.log("\ndeactivate (DELETE)");

await check(
  "deactivate mengeset is_active = false, bukan DELETE baris",
  async () => {
    const { service, calls } = svc([[row()], []]);

    await service.deactivate(ADMIN, row().id);

    const sql = calls[1]!.text;
    assert.ok(sql.includes("SET is_active = false"));
    assert.ok(!sql.includes("DELETE FROM"));
  },
);

await check("deactivate diri sendiri -> 400", async () => {
  const { service } = svc([[row({ id: ADMIN.id, role: "admin" })]]);

  await assert.rejects(
    () => service.deactivate(ADMIN, ADMIN.id),
    (e: { status: number }) => e.status === 400,
  );
});

await check("deactivate user tidak ada -> 404", async () => {
  const { service } = svc([[]]);

  await assert.rejects(
    () => service.deactivate(ADMIN, row().id),
    (e: { status: number }) => e.status === 404,
  );
});

await check("deactivate admin aktif terakhir -> 400", async () => {
  const target = row({ role: "admin", is_active: true });
  const { service, calls } = svc([[target], [{ total: 1 }]]);

  await assert.rejects(
    () => service.deactivate(ADMIN, target.id),
    (e: { status: number }) => e.status === 400,
  );
  assert.ok(!calls.some((c) => c.text.includes("SET is_active = false")));
});

console.log(`\n${passed} lulus, ${failed} gagal`);

if (failed > 0) {
  process.exitCode = 1;
}
