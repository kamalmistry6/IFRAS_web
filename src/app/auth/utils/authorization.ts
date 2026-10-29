import { AppPermission, ROLE_PERMISSIONS, UserType } from '../enums';
import { CurrentUser } from '../models';

/** The rule a route, a menu item or a button asks for. All parts are optional. */
export interface AuthorizeRule {
  /** The user must hold ANY of these (or ALL when `isAll` is true). */
  permissions?: readonly AppPermission[];
  /** The user type must be one of these (or NOT one of these when `exceptRole` is true). */
  roles?: readonly UserType[];
  isAll?: boolean;
  exceptRole?: boolean;
}

/** Turns the backend's role and superuser flag into one user type. */
export function resolveUserType(user: CurrentUser | null): UserType | null {
  if (!user) return null;
  if (user.is_super_admin) return UserType.SUPER_ADMIN;

  switch (user.role) {
    case 'ADMIN':
      return UserType.ADMIN;
    case 'TEACHER':
      return UserType.TEACHER;
    case 'STUDENT':
      return UserType.STUDENT;
    default:
      return null;
  }
}

/** Does this user type hold this permission? */
export function hasPermission(userType: UserType | null, permission: AppPermission): boolean {
  return userType !== null && ROLE_PERMISSIONS[userType].includes(permission);
}

/**
 * The one authorization check used by guards, the directive and the menu.
 * A rule with no roles and no permissions allows every signed-in user.
 */
export function isAuthorized(userType: UserType | null, rule: AuthorizeRule = {}): boolean {
  if (userType === null) return false;

  const { permissions = [], roles = [], isAll = false, exceptRole = false } = rule;

  if (roles.length > 0) {
    const inRoles = roles.includes(userType);
    if (exceptRole ? inRoles : !inRoles) return false;
  }

  if (permissions.length > 0) {
    const test = (permission: AppPermission) => hasPermission(userType, permission);
    return isAll ? permissions.every(test) : permissions.some(test);
  }

  return true;
}
