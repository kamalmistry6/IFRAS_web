import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DashboardSummary,
  DefaultersReport,
  ListQuery,
  ReportFormat,
  SubjectAttendanceReport,
} from '../models';
import { ApiClient } from './api-client.service';

export type ReportName = 'subject-attendance' | 'defaulters';

/** Attendance reports (docs: the reports of IFRAS_api). Each can also be downloaded as Excel or CSV. */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  constructor(private api: ApiClient) {}

  /**
   * Every student of one subject with present, absent, lectures and percentage.
   * Query: subject_offering (required), date__gte, date__lte.
   */
  subjectAttendance(query: ListQuery): Observable<SubjectAttendanceReport> {
    return this.api.get<SubjectAttendanceReport>('/reports/subject-attendance/', query);
  }

  /**
   * Students under a percentage in one academic year (administrators only).
   * Query: academic_year, below, program, year_of_study, subject_offering, date__gte, date__lte,
   * search, college (platform administrators).
   */
  defaulters(query: ListQuery): Observable<DefaultersReport> {
    return this.api.get<DefaultersReport>('/reports/defaulters/', query);
  }

  /**
   * The dashboard numbers for the user's scope: the college, everything, or the department.
   * `month` (YYYY-MM) is for the attendance numbers; without it, this month.
   */
  dashboard(month?: string): Observable<DashboardSummary> {
    return this.api.get<DashboardSummary>('/reports/dashboard/', month ? { month } : {});
  }

  /** The same report as a file. Send the same query as for the screen. */
  download(report: ReportName, query: ListQuery, format: ReportFormat): Observable<Blob> {
    return this.api.getBlob(`/reports/${report}/`, { ...query, export: format });
  }
}
