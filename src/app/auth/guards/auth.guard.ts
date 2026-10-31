import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Data, Router, UrlSegment } from '@angular/router';
import { AuthService } from '../services';
import { AuthorizeRule } from '../utils/authorization';

/** Where a user who must choose a new password is sent, and the only page open to them. */
export const PASSWORD_ROUTE = '/account/password';

/** Reads the rule from a route's `data`. See the examples on AuthGuard. */
export function ruleFromRouteData(data: Data | undefined): AuthorizeRule {
  return {
    permissions: data?.['permissions'],
    roles: data?.['roles'],
    isAll: data?.['isAll'],
    exceptRole: data?.['exceptRole'],
  };
}

/**
 * AuthGuard: the route needs a signed-in user, and optionally a permission or user type.
 *
 * ROUTE DATA KEYS (all optional)
 *   permissions  AppPermission[]  the user must hold ANY of these (ALL if isAll is true)
 *   roles        UserType[]       the user type must be one of these (NOT one of them if exceptRole is true)
 *   isAll        boolean          require every listed permission
 *   exceptRole   boolean          invert the roles check
 *
 * EXAMPLES
 *   Signed-in users only:
 *     { path: 'account', canActivate: [AuthGuard] }
 *   One permission:
 *     { path: 'students', canActivate: [AuthGuard],
 *       data: { permissions: [AppPermission.STUDENTS_MANAGE] } }
 *   A user type:
 *     { path: 'teacher', canActivate: [AuthGuard], data: { roles: [UserType.TEACHER] } }
 *
 * Not signed in            -> /login?returnUrl=...
 * Signed in but not allowed -> /forbidden
 * Must choose a new password -> /account/password, and nothing else, until they have
 */
export const AuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  if (auth.user?.must_change_password && !state.url.split('?')[0].startsWith(PASSWORD_ROUTE)) {
    return router.createUrlTree([PASSWORD_ROUTE]);
  }

  return auth.isAuthorizedNow(ruleFromRouteData(route.data))
    ? true
    : router.createUrlTree(['/forbidden']);
};

/**
 * The same rule for lazy-loaded modules, used as `canMatch`. A user who is not
 * allowed never downloads the module's code at all:
 *   { path: 'teacher', canMatch: [AuthMatchGuard], data: { roles: [UserType.TEACHER] },
 *     loadChildren: () => import('./main/teacher/teacher.module').then(m => m.TeacherModule) }
 */
export const AuthMatchGuard: CanMatchFn = (route, segments: UrlSegment[]) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated) {
    const returnUrl = '/' + segments.map((segment) => segment.path).join('/');
    return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
  }

  // Every area is closed until the password has been changed (the account area is not one of them).
  if (auth.user?.must_change_password) return router.createUrlTree([PASSWORD_ROUTE]);

  return auth.isAuthorizedNow(ruleFromRouteData(route.data))
    ? true
    : router.createUrlTree(['/forbidden']);
};
