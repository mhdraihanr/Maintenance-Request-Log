import { z } from "zod";

export const idParamSchema = z.object({
  id: z.uuid("ID tidak valid"),
});

export type IdParam = z.infer<typeof idParamSchema>;
