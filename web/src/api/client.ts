import type { ApiErrorBody, Page, PageMeta } from "./types";

/** Error dari API, membawa code + pesan + field errors agar form bisa inline. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.fields = body.fields;
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Satu jalur untuk semua panggilan API.
 * `credentials: "include"` wajib — token ada di httpOnly cookie, bukan header.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, signal } = options;

  const init: RequestInit = {
    method,
    credentials: "include",
    headers: { Accept: "application/json" },
  };

  if (body !== undefined) {
    init.headers = { ...init.headers, "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  if (signal) {
    init.signal = signal;
  }

  const response = await fetch(`/api${path}`, init);

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ApiError(response.status, {
        code: "INVALID_RESPONSE",
        message: "Respons server tidak dapat dibaca",
      });
    }
  }

  if (!response.ok) {
    const errorBody = (parsed as { error?: ApiErrorBody } | null)?.error;
    throw new ApiError(
      response.status,
      errorBody ?? { code: "UNKNOWN", message: "Terjadi kesalahan" },
    );
  }

  return (parsed as { data: T }).data;
}

/**
 * Panggilan API yang mengembalikan daftar berhalaman.
 *
 * API membalas `{ data: [...], meta: {...} }` — pagination berada di level atas,
 * bukan di dalam `data`. `apiRequest` hanya mengambil field `data` dan membuang
 * `meta`, jadi daftar berhalaman punya jalur sendiri di sini.
 */
export async function apiList<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Page<T>> {
  const envelope = await apiEnvelope<{ data: T[]; meta: PageMeta }>(
    path,
    options,
  );

  return {
    items: envelope.data,
    meta: envelope.meta,
  };
}

/**
 * Sama seperti `apiRequest`, tapi mengembalikan seluruh envelope alih-alih
 * hanya field `data`. Dipakai oleh `apiList` untuk mengambil `meta`.
 */
async function apiEnvelope<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, signal } = options;

  const init: RequestInit = {
    method,
    credentials: "include",
    headers: { Accept: "application/json" },
  };

  if (body !== undefined) {
    init.headers = { ...init.headers, "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  if (signal) {
    init.signal = signal;
  }

  const response = await fetch(`/api${path}`, init);

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ApiError(response.status, {
        code: "INVALID_RESPONSE",
        message: "Respons server tidak dapat dibaca",
      });
    }
  }

  if (!response.ok) {
    const errorBody = (parsed as { error?: ApiErrorBody } | null)?.error;
    throw new ApiError(
      response.status,
      errorBody ?? { code: "UNKNOWN", message: "Terjadi kesalahan" },
    );
  }

  return parsed as T;
}
