import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AttendanceCorrection,
  AttendanceSession,
  AttendanceSessionDetail,
  CorrectionCreate,
  ListQuery,
  MyAssignment,
  MyAttendanceRecord,
  MyAttendanceSummary,
  MarkRecordsRequest,
  Page,
  SessionCreate,
  TimetableSlot,
  TimetableSlotCreate,
  TimetableSlotUpdate,
  TodayResponse,
} from '../models';
import { ApiClient } from './api-client.service';

/**
 * Attendance calls for the teacher screens: today's lectures, a session and
 * its student list, marking, submitting, cancelling and corrections.
 * See docs/FRONTEND_PAGES.md (T1 and T2) for which page calls what.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceService {
  constructor(private api: ApiClient) {}

  /** The lectures of a day (today when `date` is left out). `date` is YYYY-MM-DD. */
  today(date?: string): Observable<TodayResponse> {
    return this.api.get<TodayResponse>('/attendance/today/', { date });
  }

  /** Opens the attendance session of a timetable slot (or returns the one already open). */
  startSlot(slotPublicId: string, date?: string): Observable<AttendanceSessionDetail> {
    return this.api.post<AttendanceSessionDetail>(
      `/attendance/timetable/${slotPublicId}/start/`,
      date ? { date } : {},
    );
  }

  /**
   * The teacher's own subjects. Only the ones that can still start sessions by
   * default (for the extra-lecture form); `includeInactive` adds past ones (for filters).
   */
  myAssignments(
    includeInactive = false,
    academicYear?: number | null,
  ): Observable<Page<MyAssignment>> {
    return this.api.get<Page<MyAssignment>>('/attendance/my-assignments/', {
      is_active: includeInactive ? undefined : true,
      // Without a year the server lists the subjects of the current year only.
      academic_year: academicYear ?? undefined,
      page_size: 100,
    });
  }

  /**
   * A student's own attendance: overall and per subject, for one academic year (the current one when
   * `academicYear` is left out). A 404 means the student was not enrolled that year.
   */
  myAttendance(academicYear?: number | null): Observable<MyAttendanceSummary> {
    return this.api.get<MyAttendanceSummary>('/attendance/my/', {
      academic_year: academicYear ?? undefined,
    });
  }

  /**
   * A student's own lectures, newest first. Filters: subject_offering, academic_year, date__gte,
   * date__lte, status (PRESENT or ABSENT).
   */
  myRecords(query: ListQuery): Observable<Page<MyAttendanceRecord>> {
    return this.api.get<Page<MyAttendanceRecord>>('/attendance/my/records/', query);
  }

  /** One page of sessions, newest first. Filters: date__gte, date__lte, status, teacher_assignment. */
  sessions(query: ListQuery): Observable<Page<AttendanceSession>> {
    return this.api.get<Page<AttendanceSession>>('/attendance/sessions/', query);
  }

  /**
   * Timetable slots: a teacher's own, or the whole college's for an administrator.
   * Only active slots unless `is_active` is passed as false/omitted by the caller.
   * Filters: is_active, day_of_week, teacher_assignment__teacher, teacher_assignment__subject_offering.
   */
  timetable(query: ListQuery = { is_active: true }): Observable<Page<TimetableSlot>> {
    return this.api.get<Page<TimetableSlot>>('/attendance/timetable/', {
      page_size: 100,
      ...query,
    });
  }

  /** Administrators only. */
  createSlot(slot: TimetableSlotCreate): Observable<TimetableSlot> {
    return this.api.post<TimetableSlot>('/attendance/timetable/', slot);
  }

  /** Administrators only. A slot cannot change its teacher assignment or be deleted: deactivate it. */
  updateSlot(publicId: string, changes: TimetableSlotUpdate): Observable<TimetableSlot> {
    return this.api.patch<TimetableSlot>(`/attendance/timetable/${publicId}/`, changes);
  }

  /** Starts a lecture that is not in the timetable (an extra or rescheduled one). */
  createSession(session: SessionCreate): Observable<AttendanceSessionDetail> {
    return this.api.post<AttendanceSessionDetail>('/attendance/sessions/', session);
  }

  session(publicId: string): Observable<AttendanceSessionDetail> {
    return this.api.get<AttendanceSessionDetail>(`/attendance/sessions/${publicId}/`);
  }

  /** Send only the records that changed. The answer is the updated session. */
  markRecords(
    publicId: string,
    records: MarkRecordsRequest['records'],
  ): Observable<AttendanceSessionDetail> {
    return this.api.patch<AttendanceSessionDetail>(`/attendance/sessions/${publicId}/records/`, {
      records,
    });
  }

  submit(publicId: string): Observable<AttendanceSessionDetail> {
    return this.api.post<AttendanceSessionDetail>(`/attendance/sessions/${publicId}/submit/`);
  }

  cancel(publicId: string, reason: string): Observable<AttendanceSessionDetail> {
    return this.api.post<AttendanceSessionDetail>(`/attendance/sessions/${publicId}/cancel/`, {
      reason,
    });
  }

  corrections(publicId: string): Observable<Page<AttendanceCorrection>> {
    return this.api.get<Page<AttendanceCorrection>>(
      `/attendance/sessions/${publicId}/corrections/`,
    );
  }

  correct(publicId: string, correction: CorrectionCreate): Observable<AttendanceCorrection> {
    return this.api.post<AttendanceCorrection>(
      `/attendance/sessions/${publicId}/corrections/`,
      correction,
    );
  }
}
