import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject, Subscription, catchError, switchMap, tap } from 'rxjs';
import { AttendanceSession, SessionStatus } from 'src/app/api/models';
import { AttendanceService, DirectoryService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { PAGE_SIZE, PageRange, formatTime, pageRange } from 'src/app/shared/utils';
import { LECTURE_STATE_BADGE, LECTURE_STATE_LABEL } from '../lecture-state';

/**
 * T4 and A9: sessions, newest first, with filters. A row opens the session.
 *
 * One component for two routes, told apart by the route's `data.scope`:
 *   'teacher'  /teacher/sessions   the teacher's own sessions
 *   'admin'    /admin/sessions     every session of the college (adds a Teacher column)
 */
@Component({
  selector: 'app-sessions-list',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './sessions-list.component.html',
  styleUrls: ['./sessions-list.component.scss'],
})
export class SessionsListComponent implements OnInit, OnDestroy {
  readonly stateLabel = LECTURE_STATE_LABEL;
  readonly stateBadge = LECTURE_STATE_BADGE;
  readonly formatTime = formatTime;
  readonly statuses: SessionStatus[] = ['OPEN', 'SUBMITTED', 'CANCELLED'];

  /** An administrator sees the whole college; a teacher only their own sessions. */
  readonly admin: boolean;
  /** Where a row leads: the same attendance screen, under the area the user is in. */
  readonly basePath: string;

  filters: FormGroup;

  sessions: AttendanceSession[] = [];
  /** The subject filter: a teacher's own subjects, or every teacher-and-subject of the college. */
  subjects: { id: number; label: string }[] = [];
  count = 0;
  page = 1;
  loading = false;
  loaded = false;
  error = '';

  /** Every load goes through here, so a slow answer to an old filter never replaces a newer one. */
  private readonly reload$ = new Subject<void>();
  private readonly subscription = new Subscription();

  constructor(
    fb: FormBuilder,
    route: ActivatedRoute,
    private attendance: AttendanceService,
    private directory: DirectoryService,
    private router: Router,
  ) {
    this.admin = route.snapshot.data['scope'] === 'admin';
    this.basePath = this.admin ? '/admin/sessions' : '/teacher/sessions';
    this.filters = fb.nonNullable.group({ from: '', to: '', status: '', subject: '' });
  }

  ngOnInit(): void {
    this.subscription.add(
      this.reload$
        .pipe(
          tap(() => {
            this.loading = true;
            this.error = '';
          }),
          switchMap(() =>
            this.attendance.sessions(this.query()).pipe(
              catchError((error: GlobalException) => {
                this.loading = false;
                this.error = error.message;
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe((page) => {
          this.sessions = page.results;
          this.count = page.count;
          this.loading = false;
          this.loaded = true;
        }),
    );

    this.subscription.add(
      this.filters.valueChanges.subscribe(() => {
        this.page = 1;
        this.reload$.next();
      }),
    );

    this.loadSubjects();
    this.reload$.next();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get range(): PageRange {
    return pageRange(this.count, this.page, PAGE_SIZE);
  }

  get hasFilters(): boolean {
    return Object.values(this.filters.getRawValue()).some((value) => !!value);
  }

  clearFilters(): void {
    this.filters.reset({ from: '', to: '', status: '', subject: '' });
  }

  goTo(page: number): void {
    if (page < 1 || page > this.range.totalPages || page === this.page) return;
    this.page = page;
    this.reload$.next();
  }

  retry(): void {
    this.reload$.next();
  }

  open(session: AttendanceSession): void {
    this.router.navigate([this.basePath, session.public_id]);
  }

  percent(session: AttendanceSession): number {
    return session.total_students === 0
      ? 0
      : Math.round((session.present_count * 100) / session.total_students);
  }

  private loadSubjects(): void {
    if (this.admin) {
      this.directory.subjectAssignments().subscribe(
        (page) =>
          (this.subjects = page.results.map((item) => ({
            id: item.id,
            label: `${item.teacher_name} - ${item.subject_name} · ${item.academic_year_name}`,
          }))),
      );
    } else {
      this.attendance.myAssignments(true).subscribe(
        (page) =>
          (this.subjects = page.results.map((item) => ({
            id: item.id,
            label: `${item.subject_name} (${item.subject_code}) · ${item.academic_year_name}`,
          }))),
      );
    }
  }

  private query() {
    const { from, to, status, subject } = this.filters.getRawValue();

    return {
      page: this.page,
      date__gte: from,
      date__lte: to,
      status,
      teacher_assignment: subject,
      // My sessions: a head of department's own teaching, not the whole department's.
      scope: this.admin ? undefined : 'own',
    };
  }
}
