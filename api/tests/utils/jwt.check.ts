import { signToken, verifyToken } from "../../src/utils/jwt";

const token = signToken({
  sub: "11111111-2222-3333-4444-555555555555",
  role: "operator",
});

console.log("token   :", token);
console.log("payload :", JSON.stringify(verifyToken(token)));

const mustFail = (label: string, fn: () => unknown) => {
  try {
    fn();
    console.log(`❌ ${label} — LOLOS, seharusnya gagal!`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`✅ ${label} — ditolak (${message})`);
  }
};

const [header, payload, signature] = token.split(".") as [
  string,
  string,
  string,
];
const last = signature.slice(-1);
const tampered = `${header}.${payload}.${signature.slice(0, -1)}${last === "X" ? "Y" : "X"}`;

mustFail("signature diubah", () => verifyToken(tampered));

const forgedPayload = Buffer.from(
  JSON.stringify({ sub: "attacker", role: "admin", iat: 1, exp: 9999999999 }),
).toString("base64url");
mustFail("payload diubah jadi admin", () =>
  verifyToken(`${header}.${forgedPayload}.${signature}`),
);

const noneHeader = Buffer.from(
  JSON.stringify({ alg: "none", typ: "JWT" }),
).toString("base64url");
mustFail("header alg:none", () => verifyToken(`${noneHeader}.${payload}.`));

mustFail("format rusak (1 bagian)", () => verifyToken("abc"));
mustFail("format rusak (4 bagian)", () => verifyToken("a.b.c.d"));
mustFail("string kosong", () => verifyToken(""));
