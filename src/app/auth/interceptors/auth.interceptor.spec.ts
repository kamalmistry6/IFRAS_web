import {
  HTTP_INTERCEPTORS,
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { publicRequest } from 'src/app/core/interceptors/http-context.tokens';
import { TokenStorageService } from '../services';
import { AuthInterceptor } from './auth.interceptor';

const base = environment.apiBaseUrl;
const refreshUrl = `${base}/auth/refresh/`;
const unauthorized = { status: 401, statusText: 'Unauthorized' };

describe('AuthInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let tokens: TokenStorageService;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    router = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: Router, useValue: router },
      ],
    });

    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStorageService);
  });

  afterEach(() => http.verify());

  const signedIn = () => tokens.setTokens({ access: 'old', refresh: 'refresh-1' }, false);

  describe('adding the token', () => {
    it('sends the access token with every API call', () => {
      signedIn();
      client.get(`${base}/students/`).subscribe();

      const request = http.expectOne(`${base}/students/`);
      expect(request.request.headers.get('Authorization')).toBe('Bearer old');
      request.flush({});
    });

    it('sends nothing when nobody is signed in', () => {
      client.get(`${base}/students/`).subscribe();

      const request = http.expectOne(`${base}/students/`);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    });

    it('never sends the token to another website', () => {
      signedIn();
      client.get('https://other.example/data').subscribe();

      const request = http.expectOne('https://other.example/data');
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    });

    it('leaves login and refresh calls alone', () => {
      signedIn();
      client
        .post(`${base}/auth/login/`, {}, { context: publicRequest() })
        .subscribe({ error: () => undefined });

      const request = http.expectOne(`${base}/auth/login/`);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({ detail: 'wrong' }, unauthorized);

      // A 401 here means "wrong password", not "token expired": no refresh.
      http.expectNone(refreshUrl);
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('an expired token (401)', () => {
    it('refreshes the token and repeats the call', () => {
      signedIn();
      let result: unknown;
      client.get(`${base}/students/`).subscribe((value) => (result = value));

      http.expectOne(`${base}/students/`).flush({ code: 'token_not_valid' }, unauthorized);
      http.expectOne(refreshUrl).flush({ access: 'new' });

      const retry = http.expectOne(`${base}/students/`);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
      retry.flush({ count: 0 });

      expect(result).toEqual({ count: 0 });
      expect(tokens.getAccessToken()).toBe('new');
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('sends ONE refresh when several calls fail together, then repeats them all', () => {
      signedIn();
      const results: unknown[] = [];
      client.get(`${base}/a/`).subscribe((value) => results.push(value));
      client.get(`${base}/b/`).subscribe((value) => results.push(value));
      client.get(`${base}/c/`).subscribe((value) => results.push(value));

      for (const path of ['a', 'b', 'c']) {
        http.expectOne(`${base}/${path}/`).flush({}, unauthorized);
      }

      // Exactly one refresh for the three calls.
      http.expectOne(refreshUrl).flush({ access: 'new' });

      for (const path of ['a', 'b', 'c']) {
        const retry = http.expectOne(`${base}/${path}/`);
        expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
        retry.flush(path);
      }

      expect(results).toEqual(['a', 'b', 'c']);
    });

    it('signs the user out when the refresh itself fails', () => {
      signedIn();
      let failure: { status: number } | undefined;
      client.get(`${base}/students/`).subscribe({ error: (e) => (failure = e) });

      http.expectOne(`${base}/students/`).flush({}, unauthorized);
      http.expectOne(refreshUrl).flush({ detail: 'expired' }, unauthorized);

      expect(router.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { reason: 'expired' },
      });
      expect(failure?.status).toBe(401);
      expect(tokens.getRefreshToken()).toBeNull();
    });

    it('signs the user out, without trying a refresh, when there is no refresh token', () => {
      tokens.setAccessToken('only-access');
      client.get(`${base}/students/`).subscribe({ error: () => undefined });

      http.expectOne(`${base}/students/`).flush({}, unauthorized);

      http.expectNone(refreshUrl);
      expect(router.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { reason: 'expired' },
      });
    });

    it('does NOT sign the user out when only the repeated call fails (e.g. a 404)', () => {
      signedIn();
      let failure: { status: number } | undefined;
      client.get(`${base}/students/9/`).subscribe({ error: (e) => (failure = e) });

      http.expectOne(`${base}/students/9/`).flush({}, unauthorized);
      http.expectOne(refreshUrl).flush({ access: 'new' });
      http
        .expectOne(`${base}/students/9/`)
        .flush({ detail: 'Not found.' }, { status: 404, statusText: 'Not Found' });

      expect(failure?.status).toBe(404);
      expect(router.navigate).not.toHaveBeenCalled();
      expect(tokens.getRefreshToken()).toBe('refresh-1');
    });
  });

  describe('accounts that can no longer sign in', () => {
    it('signs out at once when the account was deleted', () => {
      signedIn();
      let failure: { status: number } | undefined;
      client.get(`${base}/students/`).subscribe({ error: (e) => (failure = e) });

      http
        .expectOne(`${base}/students/`)
        .flush({ detail: 'User account has been deleted', code: 'user_deleted' }, unauthorized);

      http.expectNone(refreshUrl);
      expect(router.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { reason: 'deleted' },
      });
      expect(failure?.status).toBe(401);
    });

    it('signs out at once when the password was changed elsewhere', () => {
      signedIn();
      client.get(`${base}/students/`).subscribe({ error: () => undefined });

      http
        .expectOne(`${base}/students/`)
        .flush(
          { detail: "The user's password has been changed.", code: 'password_changed' },
          unauthorized,
        );

      http.expectNone(refreshUrl);
      expect(router.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { reason: 'password_changed' },
      });
    });
  });

  it('passes other errors through untouched', () => {
    signedIn();
    let failure: { status: number } | undefined;
    client.get(`${base}/students/`).subscribe({ error: (e) => (failure = e) });

    http.expectOne(`${base}/students/`).flush({}, { status: 500, statusText: 'Server Error' });

    expect(failure?.status).toBe(500);
    http.expectNone(refreshUrl);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
