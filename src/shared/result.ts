export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string; fingerprint?: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail(message: string, code?: string, fingerprint?: string): Result<never> {
  return { ok: false, message, code, fingerprint };
}
