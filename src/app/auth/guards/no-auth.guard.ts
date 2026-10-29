import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HOME_ROUTE } from '../enums';
import { AuthService } from '../services';

/** For pages meant for signed-out users (the login page): a signed-in user is sent home. */
export const NoAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const userType = auth.userType;

  return userType ? router.createUrlTree([HOME_ROUTE[userType]]) : true;
};

/**
 * For the empty path "/": signed-in users go to their own home page, everyone
 * else to the login page.
 */
export const HomeRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const userType = auth.userType;

  return router.createUrlTree([userType ? HOME_ROUTE[userType] : '/login']);
};
