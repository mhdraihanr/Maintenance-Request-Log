export type ErrorFields = Record<string, string>;

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: ErrorFields;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: ErrorFields,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const badRequest = (message: string, fields?: ErrorFields): AppError =>
  new AppError(400, "VALIDATION_ERROR", message, fields);

export const unauthorized = (message = "Anda belum masuk"): AppError =>
  new AppError(401, "UNAUTHENTICATED", message);

export const accountInactive = (): AppError =>
  new AppError(401, "ACCOUNT_INACTIVE", "Akun Anda dinonaktifkan");

export const invalidCredentials = (): AppError =>
  new AppError(401, "INVALID_CREDENTIALS", "Username atau password salah");

export const forbidden = (message = "Anda tidak punya akses"): AppError =>
  new AppError(403, "FORBIDDEN", message);

export const notFound = (message = "Data tidak ditemukan"): AppError =>
  new AppError(404, "NOT_FOUND", message);

export const conflict = (code: string, message: string): AppError =>
  new AppError(409, code, message);
