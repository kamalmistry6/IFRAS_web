import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { GlobalException } from '../exceptions';
import { ToastService } from '../services';
import { SKIP_ERROR_TOAST } from './http-context.tokens';

/**
 * Turns every failed HTTP call into a GlobalException, so components receive
 * one friendly object instead of a raw HttpErrorResponse:
 *
 *   this.students.create(body).subscribe({
 *     error: (error: GlobalException) => this.errors = error.fieldErrors,
 *   });
 *
 * It also shows a toast for the failures a form cannot show itself:
 * no connection, 403, 409 and server errors. Not for:
 *   400  the form shows field errors next to the fields
 *   401  AuthInterceptor handles it (refresh, or back to the login page)
 *   404  the page decides (usually a "not found" state)
 * A request can opt out with SKIP_ERROR_TOAST (see quiet()).
 */
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private toast: ToastService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: unknown) => {
        if (!(error instanceof HttpErrorResponse)) return throwError(() => error);

        const exception = GlobalException.fromHttp(error);

        if (this.shouldToast(request, exception)) {
          this.toast.error(exception.title, exception.message);
        }

        return throwError(() => exception);
      }),
    );
  }

  private shouldToast(request: HttpRequest<unknown>, exception: GlobalException): boolean {
    if (request.context.get(SKIP_ERROR_TOAST)) return false;

    return (
      exception.isNetworkError ||
      exception.isForbidden ||
      exception.isConflict ||
      exception.isServerError
    );
  }
}
