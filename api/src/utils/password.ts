import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  algorithm: 2, // Argon2id
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  return verify(storedHash, plain, ARGON2_OPTIONS);
}
