import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, finalize } from 'rxjs';
import { isApiUrl } from 'src/app/api/services';
import { LoadingService } from '../services';
import { SKIP_LOADING } from './http-context.tokens';

/** Moves the global progress bar while API calls are running. */
@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  constructor(private loading: LoadingService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!isApiUrl(request.url) || request.context.get(SKIP_LOADING)) {
      return next.handle(request);
    }

    this.loading.start();
    return next.handle(request).pipe(finalize(() => this.loading.stop()));
  }
}
