import { z } from "zod";
import { AppError, badRequest } from "./errors";

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};

  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) {
        out[key] ??= "Field tidak dikenal";
      }
      continue;
    }

    const field = issue.path.join(".") || "_";
    out[field] ??= issue.message;
  }

  return out;
}

export function parseOrThrow<T extends z.ZodType>(
  schema: T,
  input: unknown,
  message = "Input tidak valid",
): z.infer<T> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw badRequest(message, fieldErrors(result.error));
  }

  return result.data;
}

export function readJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest("Body harus berupa JSON yang valid");
  }
}

export { AppError };
