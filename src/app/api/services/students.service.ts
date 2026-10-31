import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  EnrollmentCreate,
  EnrollmentUpdate,
  ListQuery,
  Page,
  StudentCreate,
  StudentImportResult,
  StudentEnrollment,
  StudentProfile,
  StudentUpdate,
} from '../models';
import { ApiClient } from './api-client.service';

/** Students and their enrollments (administrators only). */
@Injectable({ providedIn: 'root' })
export class StudentsService {
  constructor(private api: ApiClient) {}

  /**
   * One page of students. Filters: search, academic_year, program, year_of_study and
   * enrollment_status (these four match ONE enrollment together), college (platform administrators).
   */
  list(query: ListQuery): Observable<Page<StudentProfile>> {
    return this.api.get<Page<StudentProfile>>('/students/', query);
  }

  get(publicId: string): Observable<StudentProfile> {
    return this.api.get<StudentProfile>(`/students/${publicId}/`);
  }

  create(student: StudentCreate): Observable<StudentProfile> {
    return this.api.post<StudentProfile>('/students/', student);
  }

  /**
   * Creates students from a spreadsheet (.xlsx, .xls or .csv). With `dryRun` nothing is created: the
   * rows are only checked. The first password of each student is their roll number.
   * A platform administrator must give the `college`.
   */
  importStudents(
    file: File,
    dryRun: boolean,
    college?: number | null,
  ): Observable<StudentImportResult> {
    const body = new FormData();
    body.append('file', file);
    body.append('dry_run', String(dryRun));
    if (college) body.append('college', String(college));

    return this.api.post<StudentImportResult>('/students/import/', body);
  }

  /** The empty Excel file to fill in for an import. */
  importTemplate(): Observable<Blob> {
    return this.api.getBlob('/students/import/template/');
  }

  /** An administrator can correct the name. The email and username cannot be changed. */
  update(publicId: string, changes: StudentUpdate): Observable<StudentProfile> {
    return this.api.patch<StudentProfile>(`/students/${publicId}/`, changes);
  }

  /** Filters: student (integer id), search, academic_year, program, year_of_study, status. */
  enrollments(query: ListQuery): Observable<Page<StudentEnrollment>> {
    return this.api.get<Page<StudentEnrollment>>('/students/enrollments/', query);
  }

  createEnrollment(enrollment: EnrollmentCreate): Observable<StudentEnrollment> {
    return this.api.post<StudentEnrollment>('/students/enrollments/', enrollment);
  }

  /** The student and the academic year of an enrollment cannot be changed. */
  updateEnrollment(publicId: string, changes: EnrollmentUpdate): Observable<StudentEnrollment> {
    return this.api.patch<StudentEnrollment>(`/students/enrollments/${publicId}/`, changes);
  }
}
