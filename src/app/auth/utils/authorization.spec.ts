import { AppPermission, UserType } from '../enums';
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
