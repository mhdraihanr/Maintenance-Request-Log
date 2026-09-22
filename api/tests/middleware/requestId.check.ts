import { requestId } from "../../src/middleware/requestId";

type Ctx = {
  req: { header: (name: string) => string | undefined };
  values: Record<string, unknown>;
  headers: Record<string, string>;
  set: (key: string, value: unknown) => void;
  get: (key: string) => unknown;
  header: (key: string, value: string) => void;
};

const run = async (incoming?: string) => {
  const values: Record<string, unknown> = {};
  const headers: Record<string, string> = {};

  const c: Ctx = {
    req: { header: () => incoming },
    values,
    headers,
    set: (k, v) => {
      values[k] = v;
    },
    get: (k) => values[k],
    header: (k, v) => {
      headers[k] = v;
    },
  };

  await requestId()(c as never, (async () => {}) as never);
  return { id: values.requestId as string, echo: headers["X-Request-Id"] };
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const noHeader = await run();
console.log(
  "tanpa header     :",
  noHeader.id,
  "| UUID?",
  UUID_RE.test(noHeader.id) ? "✅" : "❌",
);
console.log("di-echo ke respons:", noHeader.echo === noHeader.id ? "✅" : "❌");

const a = await run();
const b = await run();
console.log("dua request unik :", a.id !== b.id ? "✅" : "❌");

const forwarded = await run("proxy-abc-123");
console.log(
  "header diteruskan:",
  forwarded.id === "proxy-abc-123" ? "✅" : "❌",
);

const tooLong = "x".repeat(129);
const replaced = await run(tooLong);
console.log(
  "header >128 ganti:",
  replaced.id !== tooLong && UUID_RE.test(replaced.id) ? "✅" : "❌",
);

const atLimit = "y".repeat(128);
const kept = await run(atLimit);
console.log("header =128 dipakai:", kept.id === atLimit ? "✅" : "❌");
