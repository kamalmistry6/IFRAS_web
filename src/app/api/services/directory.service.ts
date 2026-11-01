import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AcademicYear,
  College,
  Department,
  ListQuery,
  Page,
  Program,
  SubjectOffering,
  TeacherProfile,
  TeacherSubjectAssignment,
} from '../models';
import { ApiClient } from './api-client.service';

/**
 * Lookups the administrator's forms and filters need: teachers, who teaches
 * what, and the academic years. Read only. (Each lookup asks for up to 100
 * rows; a college with more needs a type-ahead search, see docs/FRONTEND_PAGES.md.)
 */
@Injectable({ providedIn: 'root' })
export class DirectoryService {
  constructor(private api: ApiClient) {}

  academicYears(): Observable<Page<AcademicYear>> {
    return this.api.get<Page<AcademicYear>>('/academics/academic-years/', { page_size: 100 });
  }

  /** Every college (for a platform administrator choosing where to create someone). */
  colleges(): Observable<Page<College>> {
    return this.api.get<Page<College>>('/academics/colleges/', { page_size: 100, is_active: true });
  }

  /** The departments of the college (a head of department sees only their own). */
  departments(): Observable<Page<Department>> {
    return this.api.get<Page<Department>>('/academics/departments/', {
      page_size: 100,
      is_active: true,
    });
  }

  /** The programs of the college (BSc Computer Science ...). */
  programs(): Observable<Page<Program>> {
    return this.api.get<Page<Program>>('/academics/programs/', { page_size: 100 });
  }

  /** Subjects offered in a year. Filters: academic_year, subject__semester__program. */
  subjectOfferings(query: ListQuery = {}): Observable<Page<SubjectOffering>> {
    return this.api.get<Page<SubjectOffering>>('/academics/subject-offerings/', {
      page_size: 100,
      ...query,
    });
  }

  /** Teachers of the college. Filters: is_active, search. */
  teachers(query: ListQuery = {}): Observable<Page<TeacherProfile>> {
    return this.api.get<Page<TeacherProfile>>('/teachers/', { page_size: 100, ...query });
  }

  /** Who teaches what. Filters: academic_year, teacher, subject_offering, search. */
  subjectAssignments(query: ListQuery = {}): Observable<Page<TeacherSubjectAssignment>> {
    return this.api.get<Page<TeacherSubjectAssignment>>('/teachers/subject-assignments/', {
      page_size: 100,
      ...query,
    });
  }
}
