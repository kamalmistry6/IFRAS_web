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
  /** Programs, semesters, subjects and subject offerings (a head of department: of their department). */
  ACADEMICS_MANAGE = 'academics.manage',
  /** The departments themselves: administrators only. */
  ACADEMICS_DEPARTMENTS_MANAGE = 'academics.departments.manage',
  /** Colleges and academic years: shared by every college. */
  ACADEMICS_PLATFORM_MANAGE = 'academics.platform.manage',

  // People
  /** See the students and their enrollments (a head of department: of their department). */
  STUDENTS_VIEW = 'students.view',
  ENROLLMENTS_VIEW = 'enrollments.view',
  /** Add, edit and import students: administrators only. */
  STUDENTS_MANAGE = 'students.manage',
  /** Enrol students and edit enrollments: administrators only. */
  ENROLLMENTS_MANAGE = 'enrollments.manage',
  TEACHERS_MANAGE = 'teachers.manage',
  /** Which department a teacher is in, and who heads it: administrators only. */
  TEACHERS_DEPARTMENT_MANAGE = 'teachers.department.manage',
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

  // Dashboard and reports
  DASHBOARD_VIEW = 'dashboard.view',
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
    P.DASHBOARD_VIEW,
    P.ACADEMICS_VIEW,
    P.ACADEMICS_MANAGE,
    P.ACADEMICS_DEPARTMENTS_MANAGE,
    P.ACADEMICS_PLATFORM_MANAGE,
    P.STUDENTS_VIEW,
    P.ENROLLMENTS_VIEW,
    P.STUDENTS_MANAGE,
    P.ENROLLMENTS_MANAGE,
    P.TEACHERS_MANAGE,
    P.TEACHERS_DEPARTMENT_MANAGE,
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
    P.DASHBOARD_VIEW,
    P.ACADEMICS_VIEW,
    P.ACADEMICS_MANAGE,
    P.ACADEMICS_DEPARTMENTS_MANAGE,
    P.STUDENTS_VIEW,
    P.ENROLLMENTS_VIEW,
    P.STUDENTS_MANAGE,
    P.ENROLLMENTS_MANAGE,
    P.TEACHERS_MANAGE,
    P.TEACHERS_DEPARTMENT_MANAGE,
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
  // A head of department: a teacher (own lectures, own profile) who manages their department like
  // an administrator: its teachers, assignments, timetable, structure, sessions and reports. Students
  // and enrollments are view only (the college administrator adds and enrols them), and the
  // department itself and who heads it are for administrators.
  [UserType.HOD]: [
    P.DASHBOARD_VIEW,
    P.ACADEMICS_VIEW,
    P.ACADEMICS_MANAGE,
    P.STUDENTS_VIEW,
    P.ENROLLMENTS_VIEW,
    P.TEACHERS_MANAGE,
    P.ASSIGNMENTS_MANAGE,
    P.TIMETABLE_VIEW,
    P.TIMETABLE_MANAGE,
    P.LECTURES_TODAY,
    P.MY_ASSIGNMENTS_VIEW,
    P.ATTENDANCE_TAKE,
    P.ATTENDANCE_SESSIONS_VIEW,
    P.ATTENDANCE_CORRECT,
    P.ATTENDANCE_CORRECT_ANY_TIME,
    P.REPORTS_VIEW,
    P.REPORTS_DEFAULTERS,
    P.TEACHER_PROFILE_EDIT,
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
