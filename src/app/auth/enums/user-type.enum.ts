/**
 * Who is using the app. The backend sends a role name (and a flag for Django
 * superusers); resolveUserType() turns that into one of these.
 */
export enum UserType {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  /**
   * The head of a department: a teacher the server names as head of a department. Not a role of its
   * own on the server (the role stays TEACHER); the app treats the person as a teacher who also
   * manages their department like an administrator.
   */
  HOD = 'HOD',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}

/** Where each user type lands after signing in. */
export const HOME_ROUTE: Record<UserType, string> = {
  [UserType.SUPER_ADMIN]: '/admin/dashboard',
  [UserType.ADMIN]: '/admin/dashboard',
  [UserType.HOD]: '/admin/dashboard',
  [UserType.TEACHER]: '/teacher/today',
  [UserType.STUDENT]: '/student/attendance',
};

/** Readable names for menus and badges. */
export const USER_TYPE_LABEL: Record<UserType, string> = {
  [UserType.SUPER_ADMIN]: 'Platform administrator',
  [UserType.ADMIN]: 'College administrator',
  [UserType.HOD]: 'Head of department',
  [UserType.TEACHER]: 'Teacher',
  [UserType.STUDENT]: 'Student',
};
