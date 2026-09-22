import { z } from "zod";
import { boolQuery, paginationFields } from "./common.schema";

export const roleSchema = z.enum(["operator", "supervisor", "admin"]);

const usernameField = z
  .string("Username wajib diisi")
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9._-]{3,32}$/,
    "Username hanya boleh huruf kecil, angka, titik, garis bawah, atau strip (3–32 karakter)",
  );

const nameField = z
  .string("Nama wajib diisi")
  .trim()
  .min(1, "Nama wajib diisi")
  .max(64, "Nama maksimal 64 karakter");

export const createUserSchema = z.strictObject({
  username: usernameField,
  name: nameField,
  password: z
    .string("Password wajib diisi")
    .min(8, "Password minimal 8 karakter")
    .max(128, "Password maksimal 128 karakter"),
  role: roleSchema,
});

export const updateUserSchema = z
  .strictObject({
    name: nameField.optional(),
    role: roleSchema.optional(),
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .max(128, "Password maksimal 128 karakter")
      .optional(),
    is_active: z.boolean("is_active harus boolean").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: "Tidak ada field yang diubah",
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  role: roleSchema.optional(),

  is_active: boolQuery.optional(),

  ...paginationFields,
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;
