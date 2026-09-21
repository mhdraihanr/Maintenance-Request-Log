import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  JWT_SECRET: z
    .string()
    .min(
      32,
      "JWT_SECRET minimal 32 karakter — hasilkan dengan: openssl rand -hex 32",
    ),
  JWT_TTL_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .default(8),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  console.error(`Konfigurasi environment tidak valid:\n${details}\n`);
  console.error("Periksa file .env Anda (bandingkan dengan .env.example).");
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
