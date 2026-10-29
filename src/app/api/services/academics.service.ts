import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ListQuery, Page } from '../models';
import { ApiClient } from './api-client.service';

/**
 * The academic structure, one generic set of calls for every resource:
 * colleges, departments, programs, semesters, subjects, academic-years, subject-offerings.
 * See docs/FRONTEND_PAGES.md (A10) for the filters of each.
 *
 *   this.academics.list<Program>('programs', { department: 3, page: 2 })
 */
@Injectable({ providedIn: 'root' })
export class AcademicsService {
  constructor(private api: ApiClient) {}

  list<T>(resource: string, query: ListQuery = {}): Observable<Page<T>> {
    return this.api.get<Page<T>>(`/academics/${resource}/`, query);
  }

  create<T>(resource: string, body: object): Observable<T> {
    return this.api.post<T>(`/academics/${resource}/`, body);
  }

  /** There is no delete: send `{ is_active: false }` to deactivate. */
  update<T>(resource: string, publicId: string, body: object): Observable<T> {
    return this.api.patch<T>(`/academics/${resource}/${publicId}/`, body);
  }
}
