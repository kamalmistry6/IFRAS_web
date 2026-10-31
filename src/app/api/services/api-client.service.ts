import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ListQuery } from '../models';

export interface ApiRequestOptions {
  /** Per-request switches, see core/interceptors/http-context.tokens.ts. */
  context?: HttpContext;
}

/** True for URLs that belong to our API (used by the interceptors). */
export function isApiUrl(url: string): boolean {
  return url.startsWith(environment.apiBaseUrl);
}

/**
 * The one place that talks HTTP to the backend. Data services (StudentsService,
 * SessionsService ...) call this instead of HttpClient, so the base URL, query
 * building and options are handled once.
 *
 *   this.api.get<Page<Student>>('/students/', { search: 'rahul', page: 2 })
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  constructor(private http: HttpClient) {}

  get<T>(path: string, query?: ListQuery, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.get<T>(this.url(path), {
      params: this.toParams(query),
      context: options.context,
    });
  }

  /** A file the server generates (an Excel template, a report), as a Blob. */
  getBlob(path: string, query?: ListQuery, options: ApiRequestOptions = {}): Observable<Blob> {
    return this.http.get(this.url(path), {
      params: this.toParams(query),
      responseType: 'blob',
      context: options.context,
    });
  }

  post<T>(path: string, body: unknown = {}, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.post<T>(this.url(path), body, { context: options.context });
  }

  put<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.put<T>(this.url(path), body, { context: options.context });
  }

  patch<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.patch<T>(this.url(path), body, { context: options.context });
  }

  delete<T = void>(path: string, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.delete<T>(this.url(path), { context: options.context });
  }

  /** '/students/' -> 'http://127.0.0.1:8000/api/v1/students/' */
  url(path: string): string {
    return `${environment.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  /** Leaves out null, undefined and empty values, so filters can be passed as they are. */
  private toParams(query?: ListQuery): HttpParams {
    let params = new HttpParams();

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === null || value === undefined || value === '') continue;
      params = params.set(key, String(value));
    }

    return params;
  }
}
