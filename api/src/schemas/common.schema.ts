import { z } from "zod";

export const boolQuery = z
  .enum(["true", "false"])
  .transform((v) => v === "true");

export const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
