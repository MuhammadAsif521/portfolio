export interface ApiFieldError {
  field?: string;
  message?: string;
}

/**
 * Extracts a human-readable message from an HttpErrorResponse (or a raw API
 * error body). Field-level `errors[].message` (e.g. request validation
 * failures) takes priority over the generic top-level `message`, since it
 * points at what actually needs fixing.
 */
export function getError(err: any, fallback = 'Something went wrong'): string {
  const body = err?.error ?? err;
  const errors: ApiFieldError[] | undefined = body?.errors;

  if (Array.isArray(errors) && errors.length) {
    const messages = errors.map((e) => e?.message).filter((m): m is string => !!m);
    if (messages.length) return messages.join(', ');
  }

  return body?.message || fallback;
}
