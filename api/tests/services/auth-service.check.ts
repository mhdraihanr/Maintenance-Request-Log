import assert from "node:assert/strict";
import { makeAuthService } from "../../src/services/auth.service";
import { AppError } from "../../src/utils/errors";

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  OK  ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(`      ${(err as Error).message}`);
    failed++;
  }
}

const USERS: Record<string, Record<string, unknown>> = {
  bud: {
    id: "11111111-1111-4111-8111-111111111111",
    username: "bud",
    name: "Budi Santoso",
    role: "operator",
    password_hash: "$argon2id$HASH_BUD",
    is_active: true,
  },
  mati: {
    id: "22222222-2222-4222-8222-222222222222",
    username: "mati",
    name: "Akun Nonaktif",
    role: "operator",
    password_hash: "$argon2id$HASH_MATI",
    is_active: false,
  },
};

type Call = { text: string; params?: unknown[] };

function buildService(opts: { correctPassword?: string } = {}) {
  const calls: Call[] = [];
  const correct = opts.correctPassword ?? "operator123";

  const service = makeAuthService({
    query: async (text, params) => {
      calls.push({ text, params });

      if (text.includes("WHERE username")) {
        const username = params?.[0] as string;
        const row = USERS[username];
        return { rows: row ? [row] : [] };
      }

      if (text.includes("WHERE id")) {
        const id = params?.[0] as string;
        const row = Object.values(USERS).find((u) => u.id === id);
        return { rows: row ? [row] : [] };
      }

      return { rows: [] };
    },
    verify: async (_hash, plain) => plain === correct,
    sign: ({ sub }) => `TOKEN_FOR_${sub}`,
  });

  return { service, calls };
}

async function expectAppError(
  fn: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    assert.ok(err instanceof AppError, `harus AppError, dapat ${typeof err}`);
    assert.equal(err.code, code);
    return;
  }

  assert.fail(`tidak melempar apa pun, harusnya ${code}`);
}

async function main() {
  await check(
    "login benar mengembalikan user tanpa password_hash",
    async () => {
      const { service } = buildService();
      const { user } = await service.login("bud", "operator123");

      assert.deepEqual(Object.keys(user).sort(), [
        "id",
        "name",
        "role",
        "username",
      ]);
      assert.equal(user.username, "bud");
      assert.equal(user.role, "operator");
    },
  );

  await check("login benar menerbitkan token", async () => {
    const { service } = buildService();
    const { token } = await service.login("bud", "operator123");
    assert.equal(token, "TOKEN_FOR_11111111-1111-4111-8111-111111111111");
  });

  await check("login benar mencatat last_login_at", async () => {
    const { service, calls } = buildService();
    await service.login("bud", "operator123");

    const update = calls.find((c) => c.text.includes("last_login_at"));
    assert.ok(update, "harus ada UPDATE last_login_at");
    assert.deepEqual(update.params, ["11111111-1111-4111-8111-111111111111"]);
  });

  await check("password salah → INVALID_CREDENTIALS", async () => {
    const { service } = buildService();
    await expectAppError(
      () => service.login("bud", "salah"),
      "INVALID_CREDENTIALS",
    );
  });

  await check(
    "username tidak ada → INVALID_CREDENTIALS (bukan NOT_FOUND)",
    async () => {
      const { service } = buildService();
      await expectAppError(
        () => service.login("tidak-ada", "apa-saja"),
        "INVALID_CREDENTIALS",
      );
    },
  );

  await check("password salah tidak menyentuh last_login_at", async () => {
    const { service, calls } = buildService();
    await service.login("bud", "salah").catch(() => {});

    const update = calls.find((c) => c.text.includes("last_login_at"));
    assert.equal(update, undefined, "tidak boleh UPDATE kalau gagal");
  });

  await check("akun nonaktif + password benar → ACCOUNT_INACTIVE", async () => {
    const { service } = buildService({ correctPassword: "apa-saja" });
    await expectAppError(
      () => service.login("mati", "apa-saja"),
      "ACCOUNT_INACTIVE",
    );
  });

  await check(
    "akun nonaktif + password salah → INVALID_CREDENTIALS (status tidak bocor)",
    async () => {
      const { service } = buildService();
      await expectAppError(
        () => service.login("mati", "salah"),
        "INVALID_CREDENTIALS",
      );
    },
  );

  await check("profile mengembalikan user tanpa password_hash", async () => {
    const { service } = buildService();
    const profile = await service.profile(
      "11111111-1111-4111-8111-111111111111",
    );

    assert.equal(profile.username, "bud");
    assert.equal("password_hash" in profile, false);
  });

  await check("profile akun nonaktif → ACCOUNT_INACTIVE", async () => {
    const { service } = buildService();
    await expectAppError(
      () => service.profile("22222222-2222-4222-8222-222222222222"),
      "ACCOUNT_INACTIVE",
    );
  });

  await check("profile user tidak ada → UNAUTHENTICATED", async () => {
    const { service } = buildService();
    await expectAppError(
      () => service.profile("99999999-9999-4999-8999-999999999999"),
      "UNAUTHENTICATED",
    );
  });

  console.log(`\n${passed} lulus, ${failed} gagal`);
  if (failed > 0) process.exit(1);
}

void main();
