import { ApiDate } from './page.model';
import { SubjectType } from './academics.model';

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
