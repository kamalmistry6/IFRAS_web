import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ApiClient } from 'src/app/api/services';
import { publicRequest } from 'src/app/core/interceptors/http-context.tokens';
import { UserType } from '../enums';
import {
  AccessToken,
  ChangePasswordRequest,
  CurrentUser,
  LoginRequest,
  LogoutReason,
  TokenPair,
} from '../models';
import { AuthorizeRule, isAuthorized, resolveUserType } from '../utils/authorization';
import { TokenStorageService } from './token-storage.service';

/**
 * Who is signed in, and how they got there.
 *
 *  login()            username + password  ->  tokens  ->  /auth/me/  ->  user
 *  restoreSession()   runs once at start-up: a stored refresh token signs the
 *                     user back in after a page reload
 *  refreshAccessToken() gets a new 5-minute token. Several calls that fail at
 *                     the same moment share ONE refresh request.
 *  logout()           clears everything and goes to /login
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSubject = new BehaviorSubject<CurrentUser | null>(null);
  private refreshing$: Observable<string> | null = null;

  readonly user$ = this.userSubject.asObservable();
  readonly userType$ = this.user$.pipe(map((user) => resolveUserType(user)));

  constructor(
    private api: ApiClient,
    private tokens: TokenStorageService,
    private router: Router,
  ) {}

  get user(): CurrentUser | null {
    return this.userSubject.value;
  }

  get userType(): UserType | null {
    return resolveUserType(this.user);
  }

  get isAuthenticated(): boolean {
    return this.user !== null;
  }

  get fullName(): string {
    const user = this.user;
    if (!user) return '';
    return `${user.first_name} ${user.last_name}`.trim() || user.username;
  }

  // ---- Signing in and out ---------------------------------------------------

  login(request: LoginRequest, remember = false): Observable<CurrentUser> {
    return this.api.post<TokenPair>('/auth/login/', request, { context: publicRequest() }).pipe(
      tap((tokens) => this.tokens.setTokens(tokens, remember)),
      switchMap(() => this.loadCurrentUser()),
      catchError((error) => {
        // A half-finished login must not leave tokens behind.
        this.tokens.clear();
        return throwError(() => error);
      }),
    );
  }

  loadCurrentUser(): Observable<CurrentUser> {
    return this.api.get<CurrentUser>('/auth/me/').pipe(tap((user) => this.userSubject.next(user)));
  }

  /**
   * Called once when the app starts. Resolves to the user, or to null when
   * there is nothing to restore. It never fails: the app must always start.
   */
  restoreSession(): Observable<CurrentUser | null> {
    if (!this.tokens.getRefreshToken()) return of(null);

    const hasAccess = this.tokens.getAccessToken() !== null;
    const accessReady$: Observable<unknown> = hasAccess ? of(null) : this.refreshAccessToken();

    return accessReady$.pipe(
      switchMap(() => this.loadCurrentUser()),
      catchError(() => {
        this.tokens.clear();
        this.userSubject.next(null);
        return of(null);
      }),
    );
  }

  /** Clears the session and shows the login page, with a reason if there is one. */
  logout(reason: LogoutReason = 'signed_out'): void {
    this.tokens.clear();
    this.refreshing$ = null;
    this.userSubject.next(null);
    void this.router.navigate(['/login'], { queryParams: { reason } });
  }

  // ---- Tokens ---------------------------------------------------------------

  /** One refresh at a time: every caller that asks while it runs gets the same result. */
  refreshAccessToken(): Observable<string> {
    if (this.refreshing$) return this.refreshing$;

    const refresh = this.tokens.getRefreshToken();
    if (!refresh) return throwError(() => new Error('There is no refresh token.'));

    this.refreshing$ = this.api
      .post<AccessToken>('/auth/refresh/', { refresh }, { context: publicRequest() })
      .pipe(
        map((response) => response.access),
        tap((access) => this.tokens.setAccessToken(access)),
        finalize(() => (this.refreshing$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.refreshing$;
  }

  // ---- Account --------------------------------------------------------------

  /**
   * Changing the password invalidates every older token on every device, so
   * the response carries a fresh pair; it replaces the stored one and keeps
   * this device signed in.
   */
  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.api.post<TokenPair>('/auth/change-password/', request).pipe(
      tap((tokens) => this.tokens.setTokens(tokens, this.tokens.isRemembered())),
      map(() => undefined),
    );
  }

  /** Updates what the header shows after a profile change (e.g. a new name). */
  updateCurrentUser(changes: Partial<CurrentUser>): void {
    const user = this.user;
    if (user) this.userSubject.next({ ...user, ...changes });
  }

  // ---- Authorization --------------------------------------------------------

  isAuthorizedNow(rule: AuthorizeRule = {}): boolean {
    return isAuthorized(this.userType, rule);
  }

  /** Same check as a stream, for templates and directives that must react to sign-in and sign-out. */
  isAuthorize(rule: AuthorizeRule = {}): Observable<boolean> {
    return this.userType$.pipe(map((userType) => isAuthorized(userType, rule)));
  }
}
