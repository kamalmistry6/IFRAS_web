import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Route,
  Router,
  RouterStateSnapshot,
  UrlSegment,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { AppPermission, UserType } from '../enums';
import { AuthService } from '../services';
import { AuthorizeRule, isAuthorized } from '../utils/authorization';
import { AuthGuard, AuthMatchGuard } from './auth.guard';
import { HomeRedirectGuard, NoAuthGuard } from './no-auth.guard';

/** A stand-in for AuthService whose user type each test sets. */
const auth = {
  userType: null as UserType | null,
  get isAuthenticated(): boolean {
    return this.userType !== null;
  },
  isAuthorizedNow(rule: AuthorizeRule = {}): boolean {
    return isAuthorized(this.userType, rule);
  },
};

describe('route guards', () => {
  let router: Router;

  beforeEach(() => {
    auth.userType = null;
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    router = TestBed.inject(Router);
  });

  /** The address a guard redirects to, or `true` when it lets the user through. */
  const outcome = (result: unknown): string | true => {
    if (result === true) return true;
    return router.serializeUrl(result as UrlTree);
  };

  const run = <T>(guard: (...args: never[]) => T, ...args: unknown[]): T =>
    TestBed.runInInjectionContext(() => (guard as (...a: unknown[]) => T)(...args));

  const route = (data: object = {}) => ({ data }) as unknown as ActivatedRouteSnapshot;
  const state = (url: string) => ({ url }) as RouterStateSnapshot;

  describe('AuthGuard', () => {
    it('sends a signed-out visitor to the login page and remembers where they wanted to go', () => {
      expect(outcome(run(AuthGuard, route(), state('/teacher/today')))).toBe(
        '/login?returnUrl=%2Fteacher%2Ftoday',
      );
    });

    it('lets a signed-in user through when the route asks for nothing special', () => {
      auth.userType = UserType.STUDENT;

      expect(outcome(run(AuthGuard, route(), state('/x')))).toBe(true);
    });

    it('lets in a user type the route allows', () => {
      auth.userType = UserType.TEACHER;

      expect(outcome(run(AuthGuard, route({ roles: [UserType.TEACHER] }), state('/x')))).toBe(true);
    });

    it('shows the forbidden page to a signed-in user of the wrong type', () => {
      auth.userType = UserType.STUDENT;

      expect(outcome(run(AuthGuard, route({ roles: [UserType.TEACHER] }), state('/x')))).toBe(
        '/forbidden',
      );
    });

    it('checks the permission the route asks for', () => {
      const data = { permissions: [AppPermission.STUDENTS_MANAGE] };

      auth.userType = UserType.ADMIN;
      expect(outcome(run(AuthGuard, route(data), state('/x')))).toBe(true);

      auth.userType = UserType.TEACHER;
      expect(outcome(run(AuthGuard, route(data), state('/x')))).toBe('/forbidden');
    });
  });

  describe('AuthMatchGuard (lazy areas)', () => {
    const teacherArea = { data: { roles: [UserType.TEACHER] } } as unknown as Route;
    const segments = [new UrlSegment('teacher', {}), new UrlSegment('today', {})];

    it('sends a signed-out visitor to login, remembering the address', () => {
      expect(outcome(run(AuthMatchGuard, teacherArea, segments))).toBe(
        '/login?returnUrl=%2Fteacher%2Ftoday',
      );
    });

    it('lets the right user type download the area', () => {
      auth.userType = UserType.TEACHER;

      expect(outcome(run(AuthMatchGuard, teacherArea, segments))).toBe(true);
    });

    it("refuses the wrong user type, so the area's code is never loaded", () => {
      auth.userType = UserType.ADMIN;

      expect(outcome(run(AuthMatchGuard, teacherArea, segments))).toBe('/forbidden');
    });

    it('accepts either administrator type for the admin area', () => {
      const adminArea = {
        data: { roles: [UserType.ADMIN, UserType.SUPER_ADMIN] },
      } as unknown as Route;

      auth.userType = UserType.SUPER_ADMIN;
      expect(outcome(run(AuthMatchGuard, adminArea, segments))).toBe(true);

      auth.userType = UserType.ADMIN;
      expect(outcome(run(AuthMatchGuard, adminArea, segments))).toBe(true);
    });
  });

  describe('NoAuthGuard (the login page)', () => {
    it('lets a signed-out visitor see the login page', () => {
      expect(outcome(run(NoAuthGuard))).toBe(true);
    });

    it.each([
      [UserType.TEACHER, '/teacher/today'],
      [UserType.ADMIN, '/admin/dashboard'],
      [UserType.SUPER_ADMIN, '/admin/dashboard'],
      [UserType.STUDENT, '/student/attendance'],
    ])('sends a signed-in %s to %s', (userType, home) => {
      auth.userType = userType;

      expect(outcome(run(NoAuthGuard))).toBe(home);
    });
  });

  describe('HomeRedirectGuard (the "/" address)', () => {
    it('sends a signed-out visitor to the login page', () => {
      expect(outcome(run(HomeRedirectGuard))).toBe('/login');
    });

    it.each([
      [UserType.TEACHER, '/teacher/today'],
      [UserType.ADMIN, '/admin/dashboard'],
      [UserType.SUPER_ADMIN, '/admin/dashboard'],
      [UserType.STUDENT, '/student/attendance'],
    ])('sends a signed-in %s to their own home, %s', (userType, home) => {
      auth.userType = userType;

      expect(outcome(run(HomeRedirectGuard))).toBe(home);
    });
  });
});
