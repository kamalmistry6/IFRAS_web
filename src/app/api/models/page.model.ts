/** Every list endpoint returns this shape (20 items per page by default). */
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Query parameters for a list call. Empty values are left out of the URL. */
export type ListQuery = Record<string, string | number | boolean | null | undefined>;

/** Date as sent by the API: YYYY-MM-DD. Treat it as text, never as a JS Date. */
export type ApiDate = string;

/** Time of day as sent by the API: HH:MM:SS. */
export type ApiTime = string;

/** ISO timestamp with offset, e.g. 2026-10-28T21:37:01+05:30. */
export type ApiDateTime = string;
