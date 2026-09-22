import { z } from "zod";

export const loginSchema = z.strictObject({
  username: z
    .string("Username wajib diisi")
    .trim()
    .min(3, "Username minimal 3 karakter")
    .max(32, "Username maksimal 32 karakter"),

  password: z
    .string("Password wajib diisi")
    .min(1, "Password wajib diisi")
    .max(128, "Password maksimal 128 karakter"),
});

export type LoginInput = z.infer<typeof loginSchema>;
