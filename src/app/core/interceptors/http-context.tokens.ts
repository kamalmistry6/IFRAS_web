import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Per-request switches, set through HttpContext. Example:
 *
 *   this.api.get('/students/', {}, { context: quiet() })
 *
 * They replace octanet's custom headers: a context never travels to the server.
 */

/** Do not show an error toast: the caller shows the error itself (e.g. inside a form). */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/** Do not move the global progress bar (e.g. for a background refresh). */
export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);

/** Do not attach the access token or try to refresh it (login and refresh calls). */
export const PUBLIC_REQUEST = new HttpContextToken<boolean>(() => false);

/** Shortcut: the caller handles errors itself, so no toast. */
export function quiet(): HttpContext {
  return new HttpContext().set(SKIP_ERROR_TOAST, true);
}

/** Shortcut: a public call (no token). */
export function publicRequest(): HttpContext {
  return new HttpContext().set(PUBLIC_REQUEST, true).set(SKIP_ERROR_TOAST, true);
}
