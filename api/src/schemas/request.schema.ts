import { z } from "zod";
import { paginationFields } from "./common.schema";

export const prioritySchema = z.enum(["low", "medium", "high"]);
export const statusSchema = z.enum(["submitted", "approved", "rejected"]);

const machineIdField = z
  .string("Machine ID wajib diisi")
  .trim()
  .min(1, "Machine ID wajib diisi")
  .max(64, "Machine ID maksimal 64 karakter");

const descriptionField = z
  .string("Deskripsi wajib diisi")
  .trim()
  .min(5, "Deskripsi minimal 5 karakter")
  .max(2000, "Deskripsi maksimal 2000 karakter");

export const createRequestSchema = z.strictObject({
  machine_id: machineIdField,
  description: descriptionField,
  priority: prioritySchema,
});

export const updateRequestSchema = z
  .strictObject({
    machine_id: machineIdField.optional(),
    description: descriptionField.optional(),
    priority: prioritySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: "Tidak ada field yang diubah",
  });

export const reviewSchema = z.strictObject({
  note: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional(),
});

export const listQuerySchema = z.object({
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),

  sort: z.enum(["created_at", "priority", "status"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),

  search: z.string().trim().max(200).optional(),

  ...paginationFields,
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
