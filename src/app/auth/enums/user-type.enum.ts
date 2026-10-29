/**
 * Who is using the app. The backend sends a role name (and a flag for Django
 * superusers); resolveUserType() turns that into one of these.
 */
export enum UserType {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}

/** Where each user type lands after signing in. */
export const HOME_ROUTE: Record<UserType, string> = {
  [UserType.SUPER_ADMIN]: '/admin/dashboard',
  [UserType.ADMIN]: '/admin/dashboard',
  [UserType.TEACHER]: '/teacher/today',
  [UserType.STUDENT]: '/student/attendance',
};

/** Readable names for menus and badges. */
export const USER_TYPE_LABEL: Record<UserType, string> = {
  [UserType.SUPER_ADMIN]: 'Platform administrator',
  [UserType.ADMIN]: 'College administrator',
  [UserType.TEACHER]: 'Teacher',
  [UserType.STUDENT]: 'Student',
};
