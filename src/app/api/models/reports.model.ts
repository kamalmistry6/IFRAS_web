import { ApiDate } from './page.model';
import { SubjectType } from './academics.model';
import { AttendanceSession } from './attendance.model';

// ---- Reports ------------------------------------------------------------------
// Only submitted lectures count, as in a student's own summary.

/** The first and last day a report was limited to. Both are null for "every lecture". */
export interface ReportPeriod {
  from: ApiDate | null;
  to: ApiDate | null;
}

/** One student in the attendance report of a subject. `percentage` is null before the first lecture. */
export interface SubjectReportStudent {
  enrollment: number;
  roll_number: string;
  student_name: string;
  username: string;
  present: number;
  absent: number;
  total: number;
  percentage: number | null;
  below_limit: boolean;
}

/** GET /reports/subject-attendance/ */
export interface SubjectAttendanceReport {
  subject: {
    subject_offering: number;
    subject_name: string;
    subject_code: string;
    subject_type: SubjectType;
    program_name: string;
    semester_number: number;
    year_of_study: number;
    academic_year: { id: number; name: string };
    teachers: string[];
  };
  period: ReportPeriod;
  /** The percentage under which a student is flagged (75). */
  limit: number;
  lectures_held: number;
  summary: {
    students: number;
    below_limit: number;
    average_percentage: number | null;
  };
  students: SubjectReportStudent[];
}

/** One student in the defaulters report. */
export interface Defaulter {
  enrollment: number;
  roll_number: string;
  student_name: string;
  username: string;
  program_name: string;
  year_of_study: number;
  present: number;
  absent: number;
  total: number;
  percentage: number;
  /** In how many subjects the student is under the same percentage. */
  subjects_below: number;
}

/** GET /reports/defaulters/ (not paginated). */
export interface DefaultersReport {
  academic_year: { id: number; name: string };
  below: number;
  period: ReportPeriod;
  count: number;
  students: Defaulter[];
}

export type ReportFormat = 'csv' | 'xlsx';

/**
 * GET /reports/dashboard/: the numbers of the dashboard. A college administrator gets their college,
 * a platform administrator everything, and a head of department their department.
 */
export interface DashboardSummary {
  scope: { level: 'platform' | 'college' | 'department'; name: string };
  /** The current academic year, or null when none is current. */
  academic_year: { id: number; name: string } | null;
  /** The first and last day of this month (what `attendance` covers). */
  month: { from: ApiDate; to: ApiDate };
  counts: { teachers: number; students: number; programs: number; subjects_offered: number };
  today: {
    date: ApiDate;
    total: number;
    not_started: number;
    open: number;
    submitted: number;
    cancelled: number;
  };
  attendance: {
    lectures_held: number;
    /** Present out of all records of this month's submitted lectures, or null when there are none. */
    percentage: number | null;
    limit: number;
    /** Students under the limit this month. */
    defaulters: number;
    /** The month before, for comparison; null when it had no submitted lecture. */
    previous_percentage: number | null;
  };
  /** Today's lectures that are over but were never submitted or cancelled. */
  needs_attention: { count: number; lectures: DashboardLecture[] };
  /** Teachers with lectures of the last `days` days that were never submitted. */
  unsubmitted_teachers: {
    days: number;
    count: number;
    teachers: { teacher_name: string; lectures: number; oldest: ApiDate }[];
  };
  /** The subjects with the lowest attendance in the month, lowest first. */
  lowest_subjects: {
    subject_offering: number;
    subject_name: string;
    subject_code: string;
    lectures: number;
    percentage: number;
  }[];
  /** Attendance for each day of the month that had a submitted lecture. */
  trend: { date: ApiDate; lectures: number; percentage: number | null }[];
  recent_sessions: AttendanceSession[];
}

export interface DashboardLecture {
  subject_name: string;
  subject_code: string;
  teacher_name: string;
  start_time: string;
  end_time: string;
  /** NOT_STARTED, or OPEN when it was started and left open. */
  state: 'NOT_STARTED' | 'OPEN';
  /** Null while it was never started. */
  session_public_id: string | null;
}
