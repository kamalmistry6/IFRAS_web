import { ApiDate } from './page.model';

export type SubjectType = 'THEORY' | 'PRACTICAL';

export interface College {
  id: number;
  public_id: string;
  name: string;
  code: string;
  address: string;
  email: string;
  phone: string;
  is_active: boolean;
}

export type CollegeCreate = Pick<College, 'name' | 'code'> &
  Partial<Pick<College, 'address' | 'email' | 'phone' | 'is_active'>>;

export interface Department {
  id: number;
  public_id: string;
  college: number;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
}

export type DepartmentCreate = Pick<Department, 'college' | 'name' | 'code'> &
  Partial<Pick<Department, 'description' | 'is_active'>>;

export interface Program {
  id: number;
  public_id: string;
  department: number;
  department_name: string;
  name: string;
  code: string;
  duration_years: number;
  description: string;
  is_active: boolean;
}

export type ProgramCreate = Pick<Program, 'department' | 'name' | 'code' | 'duration_years'> &
  Partial<Pick<Program, 'description' | 'is_active'>>;

export interface Semester {
  id: number;
  public_id: string;
  program: number;
  program_name: string;
  semester_number: number;
  name: string;
  is_active: boolean;
}

export type SemesterCreate = Pick<Semester, 'program' | 'semester_number'> &
  Partial<Pick<Semester, 'name' | 'is_active'>>;

export interface Subject {
  id: number;
  public_id: string;
  semester: number;
  semester_number: number;
  program: number;
  name: string;
  code: string;
  subject_type: SubjectType;
  credits: number;
  is_active: boolean;
}

export type SubjectCreate = Pick<Subject, 'semester' | 'name' | 'code' | 'subject_type'> &
  Partial<Pick<Subject, 'credits' | 'is_active'>>;

export interface AcademicYear {
  id: number;
  public_id: string;
  /** Looks like 2026-2027 (plain hyphen). */
  name: string;
  start_date: ApiDate;
  end_date: ApiDate;
  is_active: boolean;
}

export type AcademicYearCreate = Pick<AcademicYear, 'name' | 'start_date' | 'end_date'> &
  Partial<Pick<AcademicYear, 'is_active'>>;

export interface SubjectOffering {
  id: number;
  public_id: string;
  academic_year: number;
  academic_year_name: string;
  subject: number;
  subject_name: string;
  subject_code: string;
  subject_type: SubjectType;
  semester_number: number;
  program: number;
  program_name: string;
  is_active: boolean;
}

export type SubjectOfferingCreate = Pick<SubjectOffering, 'academic_year' | 'subject'> &
  Partial<Pick<SubjectOffering, 'is_active'>>;

/**
 * What can be edited after creation. A record's parent links (a department's
 * college, a semester's program and number, ...) are fixed once created.
 */
export type Editable<T, K extends keyof T> = Partial<Pick<T, K>>;

export type CollegeUpdate = Editable<
  College,
  'name' | 'code' | 'address' | 'email' | 'phone' | 'is_active'
>;
export type DepartmentUpdate = Editable<Department, 'name' | 'code' | 'description' | 'is_active'>;
export type ProgramUpdate = Editable<
  Program,
  'name' | 'code' | 'duration_years' | 'description' | 'is_active'
>;
export type SemesterUpdate = Editable<Semester, 'name' | 'is_active'>;
export type SubjectUpdate = Editable<
  Subject,
  'name' | 'code' | 'subject_type' | 'credits' | 'is_active'
>;
export type AcademicYearUpdate = Editable<
  AcademicYear,
  'name' | 'start_date' | 'end_date' | 'is_active'
>;
export type SubjectOfferingUpdate = Editable<SubjectOffering, 'is_active'>;
