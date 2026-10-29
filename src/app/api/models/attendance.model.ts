import { SubjectType } from './academics.model';
import { ApiDate, ApiDateTime, ApiTime } from './page.model';

export type SessionStatus = 'OPEN' | 'SUBMITTED' | 'CANCELLED';
export type RecordStatus = 'PRESENT' | 'ABSENT';
export type RecordMethod = 'MANUAL' | 'FACE_RECOGNITION';
/** The state of one lecture in the "today" list. */
export type LectureState = 'NOT_STARTED' | SessionStatus;

/** 1 = Monday ... 7 = Sunday (ISO). JavaScript's getDay() is different. */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// ---- Sessions ----------------------------------------------------------------

export interface AttendanceSession {
  id: number;
  public_id: string;
  teacher_assignment: number;
  timetable_slot: number | null;
  subject_name: string;
  subject_code: string;
  subject_type: SubjectType;
  academic_year_name: string;
  teacher_name: string;
  date: ApiDate;
  start_time: ApiTime;
  end_time: ApiTime;
  status: SessionStatus;
  total_students: number;
  present_count: number;
  absent_count: number;
  created_by: number;
  submitted_at: ApiDateTime | null;
  submitted_by: number | null;
  cancelled_at: ApiDateTime | null;
  cancelled_by: number | null;
  cancellation_reason: string;
  created_at: ApiDateTime;
  updated_at: ApiDateTime;
}

export interface AttendanceRecord {
  public_id: string;
  enrollment: number;
  student_public_id: string;
  student_name: string;
  roll_number: string;
  status: RecordStatus;
  method: RecordMethod;
  marked_by: number | null;
  marked_by_name: string | null;
  marked_at: ApiDateTime | null;
}

/** A session with its student list (returned by the detail and action endpoints). */
export interface AttendanceSessionDetail extends AttendanceSession {
  records: AttendanceRecord[];
}

export interface SessionCreate {
  teacher_assignment: number;
  date: ApiDate;
  start_time: string;
  end_time: string;
}

/** Send only the records that changed. All-or-nothing on the server. */
export interface MarkRecordsRequest {
  records: { public_id: string; status: RecordStatus }[];
}

export interface CancelSessionRequest {
  reason: string;
}

export interface AttendanceCorrection {
  public_id: string;
  /** public_id of the corrected record. */
  record: string;
  student_name: string;
  roll_number: string;
  old_status: RecordStatus;
  new_status: RecordStatus;
  reason: string;
  changed_by: number;
  changed_by_name: string;
  changed_at: ApiDateTime;
}

export interface CorrectionCreate {
  /** public_id of the record. */
  record: string;
  status: RecordStatus;
  reason: string;
}

// ---- Timetable and today -----------------------------------------------------

export interface TimetableSlot {
  id: number;
  public_id: string;
  teacher_assignment: number;
  subject_name: string;
  subject_code: string;
  subject_type: SubjectType;
  academic_year_name: string;
  teacher_name: string;
  day_of_week: DayOfWeek;
  day_name: string;
  start_time: ApiTime;
  end_time: ApiTime;
  room: string;
  valid_from: ApiDate;
  valid_to: ApiDate;
  is_active: boolean;
  created_at: ApiDateTime;
  updated_at: ApiDateTime;
}

export interface TimetableSlotCreate {
  teacher_assignment: number;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  room?: string;
  valid_from: ApiDate;
  valid_to: ApiDate;
  is_active?: boolean;
}

/** A slot's teacher assignment cannot be changed after creation. */
export type TimetableSlotUpdate = Partial<Omit<TimetableSlotCreate, 'teacher_assignment'>>;

export interface TodaySession {
  public_id: string;
  status: SessionStatus;
  total_students: number;
  present_count: number;
  absent_count: number;
}

export interface TodayLecture {
  /** null for an extra lecture created by hand. */
  slot: number | null;
  slot_public_id: string | null;
  teacher_assignment: number;
  subject_name: string;
  subject_code: string;
  subject_type: SubjectType;
  teacher_name: string;
  start_time: ApiTime;
  end_time: ApiTime;
  room: string;
  state: LectureState;
  /** False while the user cannot start this lecture (too early, or an earlier day). */
  can_start: boolean;
  /** Why it cannot be started yet, e.g. 'You can start this lecture from 9:50 AM'. */
  start_message: string;
  session: TodaySession | null;
}

export interface TodayResponse {
  date: ApiDate;
  lectures: TodayLecture[];
}

/** A teacher's own subject assignment (GET /attendance/my-assignments/). */
export interface MyAssignment {
  /** Send this as `teacher_assignment`. */
  id: number;
  public_id: string;
  subject_offering: number;
  academic_year: number;
  academic_year_name: string;
  subject_name: string;
  subject_code: string;
  subject_type: SubjectType;
  semester_number: number;
  program_name: string;
  is_active: boolean;
}

// ---- A student's own attendance ----------------------------------------------

export interface AttendanceTotals {
  present: number;
  absent: number;
  total: number;
  /** null until there is at least one submitted lecture. */
  percentage: number | null;
}

export interface SubjectAttendance extends AttendanceTotals {
  subject_offering: number;
  subject_name: string;
  subject_code: string;
  subject_type: SubjectType;
}

export interface MyAttendanceSummary {
  academic_year: { id: number; name: string } | null;
  enrollment: {
    roll_number: string;
    program_name: string;
    year_of_study: number;
    status: string;
  } | null;
  overall: AttendanceTotals;
  subjects: SubjectAttendance[];
}

export interface MyAttendanceRecord {
  date: ApiDate;
  start_time: ApiTime;
  end_time: ApiTime;
  subject_offering: number;
  subject_name: string;
  subject_code: string;
  subject_type: SubjectType;
  teacher_name: string;
  status: RecordStatus;
}
