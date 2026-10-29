import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  EnrollmentCreate,
  EnrollmentUpdate,
  ListQuery,
  Page,
  StudentCreate,
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
