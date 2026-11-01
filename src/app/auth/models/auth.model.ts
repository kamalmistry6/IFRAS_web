/** Role names exactly as the backend sends them. */
export type RoleName = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface CollegeSummary {
  id: number;
  public_id: string;
  name: string;
  code: string;
}

/** The logged-in user: GET /auth/me/. */
export interface CurrentUser {
  public_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  /** null when the account has no active role. */
  role: RoleName | null;
  /** true for the SUPER_ADMIN role and for Django superusers (who may have no role). */
  is_super_admin: boolean;
  /** An admin's college, or the college of a student's or teacher's profile. */
  college: CollegeSummary | null;
  /** true until a new student or teacher replaces the password an administrator gave them. */
  must_change_password: boolean;
  /** The department this user is the head of (HOD), or null. A head is still a teacher. */
  hod_department: { id: number; name: string } | null;
  student_profile_public_id: string | null;
  teacher_profile_public_id: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface AccessToken {
  access: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

/** Why the user was sent back to the login page. Shown as a message there. */
export type LogoutReason = 'signed_out' | 'expired' | 'deleted' | 'password_changed';

export const LOGOUT_MESSAGES: Record<LogoutReason, string> = {
  signed_out: 'You have been signed out.',
  expired: 'Your session has expired. Please sign in again.',
  deleted: 'Your account is no longer active.',
  password_changed: 'Your password was changed. Please sign in again.',
};
