import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ListQuery, Page, TeacherCreate, TeacherProfile, TeacherUpdate } from '../models';
import { ApiClient } from './api-client.service';

/** Teachers of the college (administrators only): list, add and edit. */
@Injectable({ providedIn: 'root' })
export class TeachersService {
  constructor(private api: ApiClient) {}

  /** One page. Filters: search (name, username, employee id, phone), is_active, college. */
  list(query: ListQuery): Observable<Page<TeacherProfile>> {
    return this.api.get<Page<TeacherProfile>>('/teachers/', query);
  }

  create(teacher: TeacherCreate): Observable<TeacherProfile> {
    return this.api.post<TeacherProfile>('/teachers/', teacher);
  }

  /** The signed-in teacher's own profile. */
  me(): Observable<TeacherProfile> {
    return this.api.get<TeacherProfile>('/teachers/me/');
  }

  /** A teacher can change only their own name; the server ignores anything else. */
  updateMe(changes: Pick<TeacherProfile, 'first_name' | 'last_name'>): Observable<TeacherProfile> {
    return this.api.patch<TeacherProfile>('/teachers/me/', changes);
  }

  /** Email and username cannot be changed. Setting `is_active` to false deactivates the teacher. */
  update(publicId: string, changes: TeacherUpdate): Observable<TeacherProfile> {
    return this.api.patch<TeacherProfile>(`/teachers/${publicId}/`, changes);
  }
}
