import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AssignmentCreate, ListQuery, Page, TeacherSubjectAssignment } from '../models';
import { ApiClient } from './api-client.service';

/** Who teaches what (administrators only): list, assign and remove. */
@Injectable({ providedIn: 'root' })
export class AssignmentsService {
  constructor(private api: ApiClient) {}

  /** One page. Filters: search, teacher, academic_year, program, subject_offering. */
  list(query: ListQuery): Observable<Page<TeacherSubjectAssignment>> {
    return this.api.get<Page<TeacherSubjectAssignment>>('/teachers/subject-assignments/', query);
  }

  create(assignment: AssignmentCreate): Observable<TeacherSubjectAssignment> {
    return this.api.post<TeacherSubjectAssignment>('/teachers/subject-assignments/', assignment);
  }

  /** Answers 409 when the assignment already has timetable slots or sessions. */
  remove(publicId: string): Observable<void> {
    return this.api.delete(`/teachers/subject-assignments/${publicId}/`);
  }
}
