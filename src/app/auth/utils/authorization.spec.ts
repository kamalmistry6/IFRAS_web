import { AppPermission, ROLE_PERMISSIONS, UserType } from '../enums';
import { CurrentUser } from '../models';
import { hasPermission, isAuthorized, resolveUserType } from './authorization';

function user(overrides: Partial<CurrentUser>): CurrentUser {
  return {
    public_id: 'u1',
    username: 'someone',
    first_name: '',
    last_name: '',
    email: '',
    role: null,
    is_super_admin: false,
    college: null,
    must_change_password: false,
    hod_department: null,
    student_profile_public_id: null,
    teacher_profile_public_id: null,
    ...overrides,
  };
}

describe('resolveUserType', () => {
  it('maps each backend role to a user type', () => {
    expect(resolveUserType(user({ role: 'ADMIN' }))).toBe(UserType.ADMIN);
    expect(resolveUserType(user({ role: 'TEACHER' }))).toBe(UserType.TEACHER);
    expect(resolveUserType(user({ role: 'STUDENT' }))).toBe(UserType.STUDENT);
    expect(resolveUserType(user({ role: 'SUPER_ADMIN', is_super_admin: true }))).toBe(
      UserType.SUPER_ADMIN,
    );
  });

  it('makes a teacher who heads a department a head of department', () => {
    const head = user({
      role: 'TEACHER',
      hod_department: { id: 3, name: 'Information Technology' },
    });

    expect(resolveUserType(head)).toBe(UserType.HOD);
    expect(resolveUserType(user({ role: 'TEACHER', hod_department: null }))).toBe(UserType.TEACHER);
  });

  it('only a teacher can be a head of department', () => {
    const department = { id: 3, name: 'IT' };

    expect(resolveUserType(user({ role: 'ADMIN', hod_department: department }))).toBe(
      UserType.ADMIN,
    );
    expect(resolveUserType(user({ role: 'STUDENT', hod_department: department }))).toBe(
      UserType.STUDENT,
    );
  });

  it('treats a Django superuser without a role as a platform administrator', () => {
    expect(resolveUserType(user({ role: null, is_super_admin: true }))).toBe(UserType.SUPER_ADMIN);
  });

  it('gives nobody a type when there is no user or no active role', () => {
    expect(resolveUserType(null)).toBeNull();
    expect(resolveUserType(user({ role: null }))).toBeNull();
  });
});

describe('hasPermission', () => {
  it('follows the role table', () => {
    expect(hasPermission(UserType.ADMIN, AppPermission.STUDENTS_MANAGE)).toBe(true);
    expect(hasPermission(UserType.TEACHER, AppPermission.STUDENTS_MANAGE)).toBe(false);
    expect(hasPermission(UserType.STUDENT, AppPermission.MY_ATTENDANCE_VIEW)).toBe(true);
  });

  it('keeps platform-wide data for the platform administrator only', () => {
    expect(hasPermission(UserType.SUPER_ADMIN, AppPermission.ACADEMICS_PLATFORM_MANAGE)).toBe(true);
    expect(hasPermission(UserType.ADMIN, AppPermission.ACADEMICS_PLATFORM_MANAGE)).toBe(false);
  });

  it('lets only administrators correct attendance at any time', () => {
    expect(hasPermission(UserType.ADMIN, AppPermission.ATTENDANCE_CORRECT_ANY_TIME)).toBe(true);
    expect(hasPermission(UserType.TEACHER, AppPermission.ATTENDANCE_CORRECT_ANY_TIME)).toBe(false);
    expect(hasPermission(UserType.TEACHER, AppPermission.ATTENDANCE_CORRECT)).toBe(true);
  });

  it('gives a signed-out visitor nothing', () => {
    expect(hasPermission(null, AppPermission.PASSWORD_CHANGE)).toBe(false);
  });
});

describe('a head of department', () => {
  const can = (permission: AppPermission) => hasPermission(UserType.HOD, permission);

  it('manages the department like an administrator', () => {
    for (const permission of [
      AppPermission.DASHBOARD_VIEW,
      AppPermission.ACADEMICS_MANAGE,
      AppPermission.TEACHERS_MANAGE,
      AppPermission.ASSIGNMENTS_MANAGE,
      AppPermission.TIMETABLE_MANAGE,
      AppPermission.ATTENDANCE_CORRECT_ANY_TIME,
      AppPermission.REPORTS_VIEW,
      AppPermission.REPORTS_DEFAULTERS,
    ]) {
      expect(can(permission)).toBe(true);
    }
  });

  it('only looks at students and enrollments', () => {
    expect(can(AppPermission.STUDENTS_VIEW)).toBe(true);
    expect(can(AppPermission.ENROLLMENTS_VIEW)).toBe(true);
    expect(can(AppPermission.STUDENTS_MANAGE)).toBe(false);
    expect(can(AppPermission.ENROLLMENTS_MANAGE)).toBe(false);
  });

  it('cannot change the departments, who heads them, or what is shared by colleges', () => {
    expect(can(AppPermission.ACADEMICS_DEPARTMENTS_MANAGE)).toBe(false);
    expect(can(AppPermission.TEACHERS_DEPARTMENT_MANAGE)).toBe(false);
    expect(can(AppPermission.ACADEMICS_PLATFORM_MANAGE)).toBe(false);
  });

  it('is still a teacher: own lectures, own profile and password', () => {
    for (const permission of [
      AppPermission.LECTURES_TODAY,
      AppPermission.MY_ASSIGNMENTS_VIEW,
      AppPermission.ATTENDANCE_TAKE,
      AppPermission.TEACHER_PROFILE_EDIT,
      AppPermission.PASSWORD_CHANGE,
    ]) {
      expect(can(permission)).toBe(true);
    }
    expect(can(AppPermission.MY_ATTENDANCE_VIEW)).toBe(false);
  });

  it('holds every permission a plain teacher holds', () => {
    for (const permission of ROLE_PERMISSIONS[UserType.TEACHER]) {
      expect(can(permission)).toBe(true);
    }
  });

  it('administrators alone put teachers in departments and name the head', () => {
    for (const type of [UserType.ADMIN, UserType.SUPER_ADMIN]) {
      expect(hasPermission(type, AppPermission.TEACHERS_DEPARTMENT_MANAGE)).toBe(true);
      expect(hasPermission(type, AppPermission.ACADEMICS_DEPARTMENTS_MANAGE)).toBe(true);
    }
    expect(hasPermission(UserType.TEACHER, AppPermission.TEACHERS_DEPARTMENT_MANAGE)).toBe(false);
    expect(hasPermission(UserType.STUDENT, AppPermission.DASHBOARD_VIEW)).toBe(false);
    expect(hasPermission(UserType.TEACHER, AppPermission.DASHBOARD_VIEW)).toBe(false);
  });

  it('sees the admin screens through the rule of their user type', () => {
    expect(isAuthorized(UserType.HOD, { roles: [UserType.ADMIN, UserType.HOD] })).toBe(true);
    expect(isAuthorized(UserType.HOD, { roles: [UserType.ADMIN, UserType.SUPER_ADMIN] })).toBe(
      false,
    );
  });
});

describe('isAuthorized', () => {
  it('rejects a signed-out visitor whatever the rule', () => {
    expect(isAuthorized(null)).toBe(false);
    expect(isAuthorized(null, { roles: [UserType.TEACHER] })).toBe(false);
  });

  it('allows every signed-in user when the rule is empty', () => {
    expect(isAuthorized(UserType.STUDENT)).toBe(true);
    expect(isAuthorized(UserType.STUDENT, {})).toBe(true);
  });

  it('needs ANY listed permission by default', () => {
    const rule = { permissions: [AppPermission.STUDENTS_MANAGE, AppPermission.MY_ATTENDANCE_VIEW] };

    expect(isAuthorized(UserType.STUDENT, rule)).toBe(true);
    expect(isAuthorized(UserType.TEACHER, rule)).toBe(false);
  });

  it('needs ALL listed permissions with isAll', () => {
    const rule = {
      permissions: [AppPermission.STUDENTS_MANAGE, AppPermission.TEACHERS_MANAGE],
      isAll: true,
    };

    expect(isAuthorized(UserType.ADMIN, rule)).toBe(true);
    expect(isAuthorized(UserType.TEACHER, rule)).toBe(false);
  });

  it('checks the user type', () => {
    const rule = { roles: [UserType.ADMIN, UserType.SUPER_ADMIN] };

    expect(isAuthorized(UserType.ADMIN, rule)).toBe(true);
    expect(isAuthorized(UserType.TEACHER, rule)).toBe(false);
  });

  it('inverts the user type check with exceptRole', () => {
    const rule = { roles: [UserType.STUDENT], exceptRole: true };

    expect(isAuthorized(UserType.TEACHER, rule)).toBe(true);
    expect(isAuthorized(UserType.STUDENT, rule)).toBe(false);
  });

  it('needs both the user type and the permission when both are given', () => {
    const rule = { roles: [UserType.TEACHER], permissions: [AppPermission.LECTURES_TODAY] };

    expect(isAuthorized(UserType.TEACHER, rule)).toBe(true);
    // An admin holds the permission too, but is not a teacher.
    expect(isAuthorized(UserType.ADMIN, rule)).toBe(false);
  });
});
