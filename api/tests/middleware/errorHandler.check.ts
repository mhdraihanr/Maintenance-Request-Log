import { errorHandler } from "../../src/middleware/errorHandler";
import { badRequest, notFound, forbidden } from "../../src/utils/errors";

type Captured = {
  body: unknown;
  status: number;
};

const call = async (err: unknown, path = "/api/test"): Promise<Captured> => {
  let captured: Captured = { body: null, status: 0 };

  const c = {
    get: (k: string) => (k === "requestId" ? "req-123" : undefined),
    req: { method: "GET", path },
    json: (body: unknown, status: number) => {
      captured = { body, status };
      return { body, status };
    },
  };

  const res = errorHandler()(err as never, c as never);
  await Promise.resolve(res);
  return captured;
};

const show = (label: string, r: Captured) => {
  console.log(label.padEnd(22), r.status, JSON.stringify(r.body));
};

show(
  "VALIDATION_ERROR",
  await call(badRequest("Input tidak valid", { a: "b" })),
);
show("FORBIDDEN", await call(forbidden(), "/api/requests/1"));
show("NOT_FOUND", await call(notFound()));

const plain = await call(
  new Error("connection string: postgres://mrl:devpassword@db"),
);
const plainBody = JSON.stringify(plain.body);
console.log();
console.log("--- cabang 500 (Error biasa) ---");
console.log(plain.status, plainBody);
console.log(
  "bocorkan pesan asli :",
  plainBody.includes("devpassword") ? "❌ BOCOR" : "✅ TIDAK",
);
console.log(
  "pakai pesan generik :",
  plainBody.includes("Terjadi kesalahan") ? "✅" : "❌",
);
console.log(
  "sertakan requestId  :",
  plainBody.includes("req-123") ? "✅" : "❌",
);
console.log(
  "code INTERNAL_ERROR :",
  plainBody.includes("INTERNAL_ERROR") ? "✅" : "❌",
);

const noFields = await call(notFound());
const nfBody = JSON.stringify(noFields.body);
console.log();
console.log(
  "NOT_FOUND tanpa fields:",
  nfBody.includes("fields") ? "❌ ada fields" : "✅ tidak ada",
);
