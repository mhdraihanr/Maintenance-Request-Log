import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";
import { unauthorized } from "./errors";

export type JwtPayload = {
  sub: string;
  role: "operator" | "supervisor" | "admin";
  iat: number;
  exp: number;
};

const encode = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const decode = <T>(value: string): T =>
  JSON.parse(Buffer.from(value, "base64url").toString()) as T;

const signatureOf = (data: string): string =>
  createHmac("sha256", env.JWT_SECRET).update(data).digest("base64url");

export function signToken(input: {
  sub: string;
  role: JwtPayload["role"];
}): string {
  const now = Math.floor(Date.now() / 1000);

  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: input.sub,
    role: input.role,
    iat: now,
    exp: now + env.JWT_TTL_HOURS * 3600,
  });

  const data = `${header}.${payload}`;
  return `${data}.${signatureOf(data)}`;
}

export function verifyToken(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw unauthorized("Token tidak valid");
  }

  const [header, payload, signature] = parts as [string, string, string];
  const expected = signatureOf(`${header}.${payload}`);

  const given = Buffer.from(signature);
  const want = Buffer.from(expected);

  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    throw unauthorized("Token tidak valid");
  }

  let decoded: JwtPayload;
  try {
    decoded = decode<JwtPayload>(payload);
  } catch {
    throw unauthorized("Token tidak valid");
  }

  if (
    typeof decoded.sub !== "string" ||
    typeof decoded.exp !== "number" ||
    typeof decoded.role !== "string"
  ) {
    throw unauthorized("Token tidak valid");
  }

  if (decoded.exp < Math.floor(Date.now() / 1000)) {
    throw unauthorized("Sesi Anda berakhir, silakan masuk lagi");
  }

  return decoded;
}
