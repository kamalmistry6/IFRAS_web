import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { isApiUrl } from 'src/app/api/services';
import { PUBLIC_REQUEST } from 'src/app/core/interceptors/http-context.tokens';
import { AuthService, TokenStorageService } from '../services';

/**
 * Adds the access token to every API call and keeps the user signed in.
 *
 *   401 + code "user_deleted"      -> sign out ("account no longer active")
 *   401 + code "password_changed"  -> sign out (an older token cannot be refreshed back to life)
 *   any other 401                  -> refresh the token ONCE, repeat the call
 *                                     refresh fails -> sign out ("session expired")
 *
 * Login and refresh calls are marked PUBLIC_REQUEST and are left alone.
 * AuthService is fetched lazily (Injector) so this class and the HttpClient
 * that AuthService uses do not depend on each other at start-up.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private injector: Injector,
    private tokens: TokenStorageService,
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!isApiUrl(request.url) || request.context.get(PUBLIC_REQUEST)) {
      return next.handle(request);
    }

    return next.handle(this.withToken(request, this.tokens.getAccessToken())).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return this.handleUnauthorized(request, next, error);
        }
        return throwError(() => error);
      }),
    );
  }

  private handleUnauthorized(
    request: HttpRequest<unknown>,
    next: HttpHandler,
    error: HttpErrorResponse,
  ): Observable<HttpEvent<unknown>> {
    const auth = this.injector.get(AuthService);
    const code = (error.error as { code?: string } | null)?.code;

    if (code === 'user_deleted') {
      auth.logout('deleted');
      return throwError(() => error);
    }

    if (code === 'password_changed') {
      auth.logout('password_changed');
      return throwError(() => error);
    }

    if (!this.tokens.getRefreshToken()) {
      auth.logout('expired');
      return throwError(() => error);
    }

    return auth.refreshAccessToken().pipe(
      // Only a failed REFRESH signs the user out. A failure of the repeated
      // call below is an ordinary error for the caller (a 404, a 400 ...).
      catchError(() => {
        auth.logout('expired');
        return throwError(() => error);
      }),
      switchMap((token) => next.handle(this.withToken(request, token))),
    );
  }

  private withToken(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
    return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
  }
}
