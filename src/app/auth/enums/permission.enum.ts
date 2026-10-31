import { UserType } from './user-type.enum';

/**
 * What a user may do. Routes, menus and buttons ask for a permission, never
 * for a role name, so a rule changes in one place (ROLE_PERMISSIONS below).
 *
 * This is only for showing and hiding things. The backend enforces every
 * rule itself (see FRONTEND_GUIDE.md in the IFRAS_api repository (docs/), section 4).
 */
export enum AppPermission {
  // Academic structure
  ACADEMICS_VIEW = 'academics.view',
  /** Departments, programs, semesters, subjects and subject offerings. */
  ACADEMICS_MANAGE = 'academics.manage',
  /** Colleges and academic years: shared by every college. */
  ACADEMICS_PLATFORM_MANAGE = 'academics.platform.manage',

  // People
  STUDENTS_MANAGE = 'students.manage',
  /** Enrollments are managed together with students. */
  ENROLLMENTS_MANAGE = 'enrollments.manage',
  TEACHERS_MANAGE = 'teachers.manage',
  ASSIGNMENTS_MANAGE = 'assignments.manage',
  STUDENT_PROFILE_VIEW = 'student.profile.view',
  TEACHER_PROFILE_EDIT = 'teacher.profile.edit',

  // Timetable and lectures
  TIMETABLE_VIEW = 'timetable.view',
  TIMETABLE_MANAGE = 'timetable.manage',
  LECTURES_TODAY = 'lectures.today',
  MY_ASSIGNMENTS_VIEW = 'my.assignments.view',

  // Attendance
  ATTENDANCE_TAKE = 'attendance.take',
  ATTENDANCE_SESSIONS_VIEW = 'attendance.sessions.view',
  ATTENDANCE_CORRECT = 'attendance.correct',
  /** Administrators have no time limit on corrections; teachers have 7 days. */
  ATTENDANCE_CORRECT_ANY_TIME = 'attendance.correct.any.time',
  MY_ATTENDANCE_VIEW = 'my.attendance.view',

  // Reports
  REPORTS_VIEW = 'reports.view',
  /** The list of students under a percentage: administrators only. */
  REPORTS_DEFAULTERS = 'reports.defaulters',

  // Account
  PASSWORD_CHANGE = 'account.password.change',
}

const P = AppPermission;

/** The permissions of each user type. Mirrors FRONTEND_GUIDE.md in the IFRAS_api repository (docs/), section 4. */
export const ROLE_PERMISSIONS: Record<UserType, readonly AppPermission[]> = {
  [UserType.SUPER_ADMIN]: [
    P.ACADEMICS_VIEW,
    P.ACADEMICS_MANAGE,
    P.ACADEMICS_PLATFORM_MANAGE,
    P.STUDENTS_MANAGE,
    P.ENROLLMENTS_MANAGE,
    P.TEACHERS_MANAGE,
    P.ASSIGNMENTS_MANAGE,
    P.TIMETABLE_VIEW,
    P.TIMETABLE_MANAGE,
    P.LECTURES_TODAY,
    P.ATTENDANCE_TAKE,
    P.ATTENDANCE_SESSIONS_VIEW,
    P.ATTENDANCE_CORRECT,
    P.ATTENDANCE_CORRECT_ANY_TIME,
    P.REPORTS_VIEW,
    P.REPORTS_DEFAULTERS,
    P.PASSWORD_CHANGE,
  ],
  [UserType.ADMIN]: [
    P.ACADEMICS_VIEW,
    P.ACADEMICS_MANAGE,
    P.STUDENTS_MANAGE,
    P.ENROLLMENTS_MANAGE,
    P.TEACHERS_MANAGE,
    P.ASSIGNMENTS_MANAGE,
    P.TIMETABLE_VIEW,
    P.TIMETABLE_MANAGE,
    P.LECTURES_TODAY,
    P.ATTENDANCE_TAKE,
    P.ATTENDANCE_SESSIONS_VIEW,
    P.ATTENDANCE_CORRECT,
    P.ATTENDANCE_CORRECT_ANY_TIME,
    P.REPORTS_VIEW,
    P.REPORTS_DEFAULTERS,
    P.PASSWORD_CHANGE,
  ],
  [UserType.TEACHER]: [
    P.ACADEMICS_VIEW,
    P.TIMETABLE_VIEW,
    P.LECTURES_TODAY,
    P.MY_ASSIGNMENTS_VIEW,
    P.ATTENDANCE_TAKE,
    P.ATTENDANCE_SESSIONS_VIEW,
    P.ATTENDANCE_CORRECT,
    P.REPORTS_VIEW,
    P.TEACHER_PROFILE_EDIT,
    P.PASSWORD_CHANGE,
  ],
  [UserType.STUDENT]: [
    P.ACADEMICS_VIEW,
    P.STUDENT_PROFILE_VIEW,
    P.MY_ATTENDANCE_VIEW,
    P.PASSWORD_CHANGE,
  ],
};
