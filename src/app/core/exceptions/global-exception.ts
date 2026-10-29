import { HttpErrorResponse } from '@angular/common/http';

/** Field name -> messages, exactly as the API reports validation problems. */
export type FieldErrors = Record<string, string[]>;

/** Keys of an error body that are not field errors. */
const NON_FIELD_KEYS = new Set(['non_field_errors']);
const IGNORED_KEYS = new Set(['detail', 'code', 'messages']);

/**
 * Every failed API call reaches the components as one of these, whatever the
 * cause (no connection, 400 with field errors, 403, 500 ...). The error
 * interceptor builds it from the HttpErrorResponse, so components never parse
 * raw error bodies.
 *
 * The backend reports problems in these shapes (see FRONTEND_GUIDE.md in the IFRAS_api repository (docs/) 3.2):
 *   {"roll_number": ["..."]}              a field error        -> fieldErrors
 *   {"non_field_errors": ["..."]}         a rule across fields -> generalErrors
 *   {"detail": "...", "code": "..."}      401 / 403 / 404 / 409 -> detail, code
 */
export class GlobalException extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly detail: string | null;
  readonly fieldErrors: FieldErrors;
  readonly generalErrors: string[];
  readonly time: string = new Date().toISOString();

  constructor(init: {
    status: number;
    message: string;
    code?: string | null;
    detail?: string | null;
    fieldErrors?: FieldErrors;
    generalErrors?: string[];
  }) {
    super(init.message);
    this.name = 'GlobalException';
    this.status = init.status;
    this.code = init.code ?? null;
    this.detail = init.detail ?? null;
    this.fieldErrors = init.fieldErrors ?? {};
    this.generalErrors = init.generalErrors ?? [];
  }

  /** Builds the exception from a failed HTTP call. */
  static fromHttp(error: HttpErrorResponse): GlobalException {
    const parsed = parseBody(error.error);
    const status = error.status;

    const message =
      parsed.detail ??
      parsed.generalErrors[0] ??
      firstFieldMessage(parsed.fieldErrors) ??
      defaultMessage(status);

    return new GlobalException({ status, message, ...parsed });
  }

  /** The call never reached the server (offline, server down, CORS). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isValidation(): boolean {
    return this.status === 400;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  /** A short heading for a toast or an error panel. */
  get title(): string {
    if (this.isNetworkError) return 'Connection problem';
    if (this.isValidation) return 'Please check the form';
    if (this.isUnauthorized) return 'Session expired';
    if (this.isForbidden) return 'Not allowed';
    if (this.isNotFound) return 'Not found';
    if (this.isConflict) return 'Conflict';
    if (this.isServerError) return 'Server error';
    return 'Something went wrong';
  }

  /** Every message in one list: general errors first, then each field's. */
  get allMessages(): string[] {
    const fieldMessages = Object.values(this.fieldErrors).flat();
    const general = this.detail ? [this.detail, ...this.generalErrors] : this.generalErrors;
    return [...general, ...fieldMessages];
  }
}

interface ParsedBody {
  detail: string | null;
  code: string | null;
  fieldErrors: FieldErrors;
  generalErrors: string[];
}

function parseBody(body: unknown): ParsedBody {
  const parsed: ParsedBody = { detail: null, code: null, fieldErrors: {}, generalErrors: [] };

  if (typeof body === 'string') {
    // An HTML error page from a proxy is not a message for the user.
    if (body.trim() && !body.trimStart().startsWith('<')) parsed.generalErrors.push(body.trim());
    return parsed;
  }

  if (Array.isArray(body)) {
    parsed.generalErrors.push(...flatten(body));
    return parsed;
  }

  if (body === null || typeof body !== 'object') return parsed;

  const record = body as Record<string, unknown>;
  if (typeof record['detail'] === 'string') parsed.detail = record['detail'];
  if (typeof record['code'] === 'string') parsed.code = record['code'];

  for (const [key, value] of Object.entries(record)) {
    if (IGNORED_KEYS.has(key)) continue;

    const messages = flatten(value);
    if (messages.length === 0) continue;

    if (NON_FIELD_KEYS.has(key)) parsed.generalErrors.push(...messages);
    else parsed.fieldErrors[key] = messages;
  }

  return parsed;
}

/** Turns a string, a list, or a nested object of messages into a flat list. */
function flatten(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(flatten);

  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, inner]) =>
      flatten(inner).map((message) => `${key}: ${message}`),
    );
  }

  return [];
}

function firstFieldMessage(fieldErrors: FieldErrors): string | null {
  const first = Object.values(fieldErrors)[0];
  return first?.[0] ?? null;
}

function defaultMessage(status: number): string {
  if (status === 0) return 'Cannot reach the server. Check your connection and try again.';
  if (status === 401) return 'Your session has ended. Please sign in again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'We could not find what you asked for.';
  if (status >= 500) return 'Something went wrong on our side. Please try again in a moment.';
  return 'The request could not be completed.';
}
