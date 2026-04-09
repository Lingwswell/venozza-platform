export type ApiSuccess<T> = {
  ok: true;
  data: T;
  message?: string;
};

export type ApiError = {
  ok: false;
  error: string;
  details?: unknown;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function apiSuccess<T>(data: T, message?: string): ApiSuccess<T> {
  return { ok: true, data, message };
}

export function apiError(error: string, details?: unknown): ApiError {
  return { ok: false, error, details };
}
