import { ApiDate, ApiDateTime } from './page.model';

// ---- Students ----------------------------------------------------------------

export interface StudentProfile {
  /** Integer id: send this in request bodies (e.g. an enrollment's `student`). */
  id: number;
  /** UUID: used in URLs (/students/{public_id}/). */
  public_id: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  /** Read only: it cannot be changed after the account is created. */
  email: string;
  college: number;
  date_of_birth: ApiDate | null;
  phone: string;
  address: string;
  created_at: ApiDateTime;
  updated_at: ApiDateTime;
}

export interface StudentCreate {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  email?: string;
  college: number;
  date_of_birth?: ApiDate | null;
  phone?: string;
  address?: string;
}

/** Only an administrator can edit a student, including their name. */
export type StudentUpdate = Partial<
  Pick<StudentProfile, 'first_name' | 'last_name' | 'date_of_birth' | 'phone' | 'address'>
>;

export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN' | 'SUSPENDED';

export interface StudentEnrollment {
  public_id: string;
  student: number;
  student_public_id: string;
  student_name: string;
  academic_year: number;
  academic_year_name: string;
  program: number;
  program_name: string;
  year_of_study: number;
  roll_number: string;
  status: EnrollmentStatus;
  created_at: ApiDateTime;
  updated_at: ApiDateTime;
}

export interface EnrollmentCreate {
  student: number;
  academic_year: number;
  program: number;
  year_of_study: number;
  roll_number: string;
  status?: EnrollmentStatus;
}

export type EnrollmentUpdate = Partial<
  Pick<StudentEnrollment, 'program' | 'year_of_study' | 'roll_number' | 'status'>
>;

// ---- Teachers ----------------------------------------------------------------

export interface TeacherProfile {
  id: number;
  public_id: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  /** Read only. */
  email: string;
  college: number;
  employee_id: string;
  phone: string;
  date_of_joining: ApiDate | null;
  is_active: boolean;
  created_at: ApiDateTime;
  updated_at: ApiDateTime;
}

export interface TeacherCreate {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  email?: string;
  college: number;
  employee_id: string;
  phone?: string;
  date_of_joining?: ApiDate | null;
  is_active?: boolean;
}

/** What an administrator can edit. */
export type TeacherUpdate = Partial<
  Pick<
    TeacherProfile,
    'first_name' | 'last_name' | 'employee_id' | 'phone' | 'date_of_joining' | 'is_active'
  >
>;

/** What a teacher can edit on their own profile: only their name. */
export type TeacherSelfUpdate = Partial<Pick<TeacherProfile, 'first_name' | 'last_name'>>;

export interface TeacherSubjectAssignment {
  /** Integer id: timetable slots and sessions refer to an assignment by this. */
  id: number;
  public_id: string;
  teacher: number;
  teacher_name: string;
  subject_offering: number;
  subject_name: string;
  academic_year_name: string;
  created_at: ApiDateTime;
}

export interface AssignmentCreate {
  teacher: number;
  subject_offering: number;
}
