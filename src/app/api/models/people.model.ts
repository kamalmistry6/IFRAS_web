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
  /** The roll number the student was added with. The enrol dialog suggests it. */
  roll_number: string;
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
  roll_number?: string;
  date_of_birth?: ApiDate | null;
  phone?: string;
  address?: string;
}

/** One row of a student import. `ready` is a row that a check found fine (nothing created yet). */
export interface StudentImportRow {
  /** The row number in the file (the header is row 1). */
  row: number;
  username: string;
  name: string;
  status: 'created' | 'ready' | 'skipped' | 'error';
  message: string;
}

export interface StudentImportResult {
  dry_run: boolean;
  total: number;
  /** Created, or ready to be created when `dry_run` is true. */
  created: number;
  skipped: number;
  failed: number;
  rows: StudentImportRow[];
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
  /** The department the teacher works in, or null. */
  department: number | null;
  department_name: string;
  /** True for the head of the teacher's department (HOD). */
  is_head: boolean;
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
  /** A head of department's new teachers always go to their own department. */
  department?: number | null;
  employee_id: string;
  phone?: string;
  date_of_joining?: ApiDate | null;
  is_active?: boolean;
}

/**
 * What an administrator can edit. `department` and `is_head` are for administrators only: the
 * server ignores them from a head of department. Moving or deactivating a head must send `is_head`.
 */
export type TeacherUpdate = Partial<
  Pick<
    TeacherProfile,
    | 'first_name'
    | 'last_name'
    | 'employee_id'
    | 'phone'
    | 'date_of_joining'
    | 'is_active'
    | 'department'
    | 'is_head'
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
