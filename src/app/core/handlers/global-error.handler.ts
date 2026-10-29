import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { environment } from 'src/environments/environment';
import { GlobalException } from '../exceptions';
import { ToastService } from '../services';

/** At most one "unexpected error" toast per this many milliseconds. */
const TOAST_INTERVAL = 3000;

/**
 * Catches errors that nobody handled: a bug in a component, a failed promise,
 * or a failed HTTP call whose subscriber had no `error` callback.
 *
 *  - GlobalException (an API failure): already shown by the interceptor or the
 *    form, so it is only logged during development.
 *  - Anything else: logged, and the user gets one calm message.
 *
 * ToastService is fetched lazily (Injector) so this handler can be created
 * very early without pulling services in.
 */
@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private lastToast = 0;

  constructor(private injector: Injector) {}

  handleError(error: unknown): void {
    if (error instanceof GlobalException) {
      if (!environment.production) console.warn('[API error not handled by the caller]', error);
      return;
    }

    console.error(error);

    const now = Date.now();
    if (now - this.lastToast < TOAST_INTERVAL) return;
    this.lastToast = now;

    this.injector
      .get(ToastService)
      .error(
        'Something went wrong',
        'An unexpected error occurred. If it keeps happening, reload the page.',
      );
  }
}
