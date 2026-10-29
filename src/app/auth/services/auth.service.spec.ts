import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { UserType } from '../enums';
import { CurrentUser } from '../models';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

const base = environment.apiBaseUrl;
const KEY = 'fra.refresh';

const teacher: CurrentUser = {
  public_id: 'u-1',
  username: 'teacher_001',
  first_name: 'Amit',
  last_name: 'Patil',
  email: '',
  role: 'TEACHER',
  is_super_admin: false,
  college: { id: 1, public_id: 'c-1', name: 'SDSM College', code: '225' },
  student_profile_public_id: null,
  teacher_profile_public_id: 't-1',
};

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let tokens: TokenStorageService;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    router = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });

    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStorageService);
  });

  afterEach(() => http.verify());

  describe('login', () => {
    it('stores the tokens, loads the user and works out the user type', () => {
      let signedIn: CurrentUser | undefined;
      auth
        .login({ username: 'teacher_001', password: 'secret' })
        .subscribe((user) => (signedIn = user));

      const login = http.expectOne(`${base}/auth/login/`);
      expect(login.request.body).toEqual({ username: 'teacher_001', password: 'secret' });
      login.flush({ access: 'access-1', refresh: 'refresh-1' });
      http.expectOne(`${base}/auth/me/`).flush(teacher);

      expect(signedIn).toEqual(teacher);
      expect(auth.isAuthenticated).toBe(true);
      expect(auth.userType).toBe(UserType.TEACHER);
      expect(auth.fullName).toBe('Amit Patil');
      expect(tokens.getAccessToken()).toBe('access-1');
      expect(sessionStorage.getItem(KEY)).toBe('refresh-1');
    });

    it('keeps the refresh token across browser restarts when asked to', () => {
      auth.login({ username: 'a', password: 'b' }, true).subscribe();
      http.expectOne(`${base}/auth/login/`).flush({ access: 'a', refresh: 'r' });
      http.expectOne(`${base}/auth/me/`).flush(teacher);

      expect(localStorage.getItem(KEY)).toBe('r');
    });

    it('reports a wrong password without leaving tokens or a user behind', () => {
      let failure: unknown;
      auth.login({ username: 'a', password: 'wrong' }).subscribe({ error: (e) => (failure = e) });

      http
        .expectOne(`${base}/auth/login/`)
        .flush({ detail: 'No active account found' }, { status: 401, statusText: 'Unauthorized' });

      expect(failure).toBeDefined();
      expect(auth.isAuthenticated).toBe(false);
      expect(tokens.getAccessToken()).toBeNull();
    });

    it('clears the tokens when the user cannot be loaded after a good login', () => {
      auth.login({ username: 'a', password: 'b' }).subscribe({ error: () => undefined });

      http.expectOne(`${base}/auth/login/`).flush({ access: 'a', refresh: 'r' });
      http.expectOne(`${base}/auth/me/`).flush({}, { status: 500, statusText: 'Server Error' });

      expect(tokens.getAccessToken()).toBeNull();
      expect(tokens.getRefreshToken()).toBeNull();
    });
  });

  describe('restoreSession (page reload)', () => {
    it('does nothing when no refresh token is stored', async () => {
      const result = await firstValueFrom(auth.restoreSession());

      expect(result).toBeNull();
      http.expectNone(`${base}/auth/refresh/`);
    });

    it('signs the user back in from a stored refresh token', async () => {
      sessionStorage.setItem(KEY, 'stored-refresh');

      const restored = firstValueFrom(auth.restoreSession());

      const refresh = http.expectOne(`${base}/auth/refresh/`);
      expect(refresh.request.body).toEqual({ refresh: 'stored-refresh' });
      refresh.flush({ access: 'fresh' });
      http.expectOne(`${base}/auth/me/`).flush(teacher);

      expect(await restored).toEqual(teacher);
      expect(auth.userType).toBe(UserType.TEACHER);
      expect(tokens.getAccessToken()).toBe('fresh');
    });

    it('starts the app signed out when the stored token is no longer valid', async () => {
      sessionStorage.setItem(KEY, 'expired-refresh');

      const restored = firstValueFrom(auth.restoreSession());
      http
        .expectOne(`${base}/auth/refresh/`)
        .flush({ detail: 'expired' }, { status: 401, statusText: 'Unauthorized' });

      expect(await restored).toBeNull();
      expect(auth.isAuthenticated).toBe(false);
      expect(sessionStorage.getItem(KEY)).toBeNull();
      // Starting up must not bounce the user to the login page by itself.
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    beforeEach(() => tokens.setTokens({ access: 'old', refresh: 'r' }, false));

    it('shares ONE request between callers that ask at the same time', () => {
      const results: string[] = [];
      auth.refreshAccessToken().subscribe((token) => results.push(token));
      auth.refreshAccessToken().subscribe((token) => results.push(token));
      auth.refreshAccessToken().subscribe((token) => results.push(token));

      http.expectOne(`${base}/auth/refresh/`).flush({ access: 'new' });

      expect(results).toEqual(['new', 'new', 'new']);
      expect(tokens.getAccessToken()).toBe('new');
    });

    it('can refresh again later (the shared request is not kept)', () => {
      auth.refreshAccessToken().subscribe();
      http.expectOne(`${base}/auth/refresh/`).flush({ access: 'one' });

      auth.refreshAccessToken().subscribe();
      http.expectOne(`${base}/auth/refresh/`).flush({ access: 'two' });

      expect(tokens.getAccessToken()).toBe('two');
    });

    it('fails, without a request, when there is no refresh token', () => {
      tokens.clear();
      let failure: unknown;

      auth.refreshAccessToken().subscribe({ error: (e) => (failure = e) });

      expect(failure).toBeInstanceOf(Error);
      http.expectNone(`${base}/auth/refresh/`);
    });
  });

  describe('logout', () => {
    it('clears everything and goes to the login page with the reason', () => {
      tokens.setTokens({ access: 'a', refresh: 'r' }, true);
      auth.loadCurrentUser().subscribe();
      http.expectOne(`${base}/auth/me/`).flush(teacher);

      auth.logout('expired');

      expect(auth.isAuthenticated).toBe(false);
      expect(tokens.getAccessToken()).toBeNull();
      expect(localStorage.getItem(KEY)).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { reason: 'expired' },
      });
    });

    it('says "signed_out" by default', () => {
      auth.logout();

      expect(router.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { reason: 'signed_out' },
      });
    });
  });

  describe('changePassword', () => {
    it('replaces the stored tokens and keeps the "stay signed in" choice', () => {
      tokens.setTokens({ access: 'a', refresh: 'r' }, true);

      auth.changePassword({ old_password: 'old', new_password: 'new' }).subscribe();
      http.expectOne(`${base}/auth/change-password/`).flush({ access: 'a2', refresh: 'r2' });

      expect(tokens.getAccessToken()).toBe('a2');
      expect(localStorage.getItem(KEY)).toBe('r2');
    });
  });

  describe('authorization', () => {
    it('answers for the signed-in user and reacts to sign-out', async () => {
      auth.loadCurrentUser().subscribe();
      http.expectOne(`${base}/auth/me/`).flush(teacher);

      expect(auth.isAuthorizedNow({ roles: [UserType.TEACHER] })).toBe(true);
      expect(auth.isAuthorizedNow({ roles: [UserType.ADMIN] })).toBe(false);
      expect(await firstValueFrom(auth.isAuthorize({ roles: [UserType.TEACHER] }))).toBe(true);

      auth.logout();

      expect(auth.isAuthorizedNow()).toBe(false);
    });

    it('updates what the header shows after a profile change', () => {
      auth.loadCurrentUser().subscribe();
      http.expectOne(`${base}/auth/me/`).flush(teacher);

      auth.updateCurrentUser({ first_name: 'Amitabh' });

      expect(auth.fullName).toBe('Amitabh Patil');
    });
  });
});
