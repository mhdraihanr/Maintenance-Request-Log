import assert from "node:assert/strict";
import { Hono } from "hono";
import { makeAuthRoutes } from "../../src/routes/auth.routes";
import { errorHandler } from "../../src/middleware/errorHandler";
import {
  LOGIN_MAX_FAILURES,
  resetLoginLimiter,
} from "../../src/middleware/rateLimit";
import { invalidCredentials } from "../../src/utils/errors";

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

const BUD = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "bud",
  name: "Budi Santoso",
  role: "operator" as const,
};

type LoginCall = { username: string; password: string };

function buildApp(opts: { failAll?: boolean } = {}) {
  resetLoginLimiter();

  const loginCalls: LoginCall[] = [];

  const app = new Hono();
  app.onError(errorHandler());
  app.route(
    "/api/auth",
    makeAuthRoutes({
      service: {
        login: async (username, password) => {
          loginCalls.push({ username, password });
          if (opts.failAll) throw invalidCredentials();
          return { user: BUD, token: "TOKEN-BUD" };
        },
        profile: async () => BUD,
      },
    }),
  );

  return { app, loginCalls };
}

const json = (body: unknown, ip?: string): RequestInit => ({
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(ip ? { "x-forwarded-for": ip } : {}),
  },
  body: JSON.stringify(body),
});

const readError = async (res: Response) =>
  (await res.json()) as {
    error: { code: string; fields?: Record<string, string> };
  };

const failLogin = (app: Hono, ip = "203.0.113.1") =>
  app.request(
    "/api/auth/login",
    json({ username: "tidak-ada", password: "salah-sekali" }, ip),
  );

async function main() {
  await check("login body kosong → 400 VALIDATION_ERROR + fields", async () => {
    const { app } = buildApp();
    const res = await app.request("/api/auth/login", json({}));

    assert.equal(res.status, 400);
    const body = await readError(res);
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.ok(body.error.fields, "fields wajib ada");
  });

  await check("login field asing → 400 dan nama field terbaca", async () => {
    const { app } = buildApp();
    const res = await app.request(
      "/api/auth/login",
      json({ username: "bud", password: "operator123", role: "admin" }),
    );

    assert.equal(res.status, 400);
    const body = await readError(res);
    assert.ok(body.error.fields && "role" in body.error.fields);
  });

  await check("login sukses → 200 data user + Set-Cookie auth", async () => {
    const { app } = buildApp();
    const res = await app.request(
      "/api/auth/login",
      json({ username: "bud", password: "operator123" }),
    );

    assert.equal(res.status, 200);

    const body = (await res.json()) as { data: Record<string, unknown> };
    assert.equal(body.data.username, "bud");
    assert.equal("password_hash" in body.data, false);

    const cookie = res.headers.get("set-cookie") ?? "";
    assert.match(cookie, /^auth=TOKEN-BUD/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Path=\//);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Max-Age=28800/);
  });

  await check("login sukses TIDAK mengirim Secure di development", async () => {
    const { app } = buildApp();
    const res = await app.request(
      "/api/auth/login",
      json({ username: "bud", password: "operator123" }),
    );

    const cookie = res.headers.get("set-cookie") ?? "";
    assert.equal(
      /Secure/i.test(cookie),
      false,
      "Secure hanya untuk produksi; kalau selalu on, curl di localhost gagal",
    );
  });

  await check("login meneruskan username hasil trim ke service", async () => {
    const { app, loginCalls } = buildApp();
    await app.request(
      "/api/auth/login",
      json({ username: "  bud  ", password: "operator123" }),
    );

    assert.deepEqual(loginCalls[0], {
      username: "bud",
      password: "operator123",
    });
  });

  await check("logout tanpa cookie → 401 UNAUTHENTICATED", async () => {
    const { app } = buildApp();
    const res = await app.request("/api/auth/logout", { method: "POST" });

    assert.equal(res.status, 401);
    const body = await readError(res);
    assert.equal(body.error.code, "UNAUTHENTICATED");
  });

  await check("me tanpa cookie → 401 UNAUTHENTICATED", async () => {
    const { app } = buildApp();
    const res = await app.request("/api/auth/me");

    assert.equal(res.status, 401);
    const body = await readError(res);
    assert.equal(body.error.code, "UNAUTHENTICATED");
  });

  await check("me cookie palsu → 401, bukan 500", async () => {
    const { app } = buildApp();
    const res = await app.request("/api/auth/me", {
      headers: { cookie: "auth=token.palsu.sekali" },
    });

    assert.equal(res.status, 401);
    const body = await readError(res);
    assert.equal(body.error.code, "UNAUTHENTICATED");
  });

  await check(`kegagalan ke-${LOGIN_MAX_FAILURES} masih 401`, async () => {
    const { app } = buildApp({ failAll: true });
    const ip = "198.51.100.8";

    let last = 0;
    for (let i = 1; i <= LOGIN_MAX_FAILURES; i++) {
      last = (await failLogin(app, ip)).status;
    }

    assert.equal(last, 401, `harus 401, dapat ${last}`);
  });

  await check(
    `kegagalan ke-${LOGIN_MAX_FAILURES + 1} → 429 RATE_LIMITED`,
    async () => {
      const { app } = buildApp({ failAll: true });

      let last = 0;
      for (let i = 1; i <= LOGIN_MAX_FAILURES + 1; i++) {
        last = (await failLogin(app)).status;
      }

      assert.equal(last, 429, `harus 429, dapat ${last}`);
    },
  );

  await check("429 punya code RATE_LIMITED", async () => {
    const { app } = buildApp({ failAll: true });

    for (let i = 0; i <= LOGIN_MAX_FAILURES; i++) {
      await failLogin(app);
    }

    const body = await readError(await failLogin(app));
    assert.equal(body.error.code, "RATE_LIMITED");
  });

  await check(
    "rate limit diperiksa SEBELUM validasi (body kosong pun 429)",
    async () => {
      const { app } = buildApp({ failAll: true });
      const ip = "198.51.100.7";

      for (let i = 0; i <= LOGIN_MAX_FAILURES; i++) {
        await failLogin(app, ip);
      }

      const res = await app.request("/api/auth/login", json({}, ip));
      assert.equal(
        res.status,
        429,
        "IP yang sudah diblokir harus ditolak sebelum body diproses",
      );
    },
  );

  await check("limit dihitung per-IP, bukan global", async () => {
    const { app } = buildApp({ failAll: true });

    for (let i = 0; i <= LOGIN_MAX_FAILURES; i++) {
      await failLogin(app, "10.0.0.1");
    }

    const blocked = await failLogin(app, "10.0.0.1");
    assert.equal(blocked.status, 429, "IP yang gagal harus diblokir");

    const other = await failLogin(app, "10.0.0.2");
    assert.equal(other.status, 401, "IP lain tidak boleh ikut diblokir");
  });

  console.log(`\n${passed} lulus, ${failed} gagal`);
  if (failed > 0) process.exit(1);
}

void main();
