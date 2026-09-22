import { hashPassword, verifyPassword } from "../../src/utils/password";

const plain = "operator123";
const started = performance.now();
const stored = await hashPassword(plain);
const elapsed = Math.round(performance.now() - started);

console.log("hash        :", stored);
console.log("panjang     :", stored.length);
console.log("durasi hash :", `${elapsed} ms`);
console.log(
  "diawali     :",
  stored.startsWith("$argon2id$") ? "$argon2id$ ✅" : "BUKAN argon2id ❌",
);
console.log();
console.log("password benar :", await verifyPassword(stored, plain));
console.log("password salah :", await verifyPassword(stored, "salah-sekali"));
console.log(
  "hash lain lagi :",
  (await hashPassword(plain)) === stored
    ? "SAMA (BURUK)"
    : "BERBEDA ✅ (ada salt acak)",
);
