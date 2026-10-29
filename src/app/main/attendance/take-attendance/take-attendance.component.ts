import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, Subject, Subscription, catchError, concatMap, filter, map, switchMap } from 'rxjs';
import {
  AttendanceCorrection,
  AttendanceRecord,
  AttendanceSessionDetail,
  RecordStatus,
} from 'src/app/api/models';
import { AttendanceService } from 'src/app/api/services';
import { UserType } from 'src/app/auth/enums';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { formatTime } from 'src/app/shared/utils';
import { ConfirmService, ToastService } from 'src/app/core/services';
import { LECTURE_STATE_BADGE, LECTURE_STATE_LABEL } from '../lecture-state';

interface MarkChange {
  record: AttendanceRecord;
  status: RecordStatus;
  previous: RecordStatus;
}

/**
 * T2: one page for a session. What it offers depends on the session's status:
 * OPEN lets the teacher mark, submit or cancel; SUBMITTED is read-only with
 * corrections; CANCELLED is read-only.
 */
@Component({
  selector: 'app-take-attendance',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './take-attendance.component.html',
  styleUrls: ['./take-attendance.component.scss'],
})
export class TakeAttendanceComponent implements OnInit, OnDestroy {
  readonly stateLabel = LECTURE_STATE_LABEL;
  readonly stateBadge = LECTURE_STATE_BADGE;
  readonly formatTime = formatTime;

  session: AttendanceSessionDetail | null = null;
  corrections: AttendanceCorrection[] = [];
  loading = true;
  error = '';

  /** Marks that are on their way to the server. */
  saving = 0;
  submitting = false;

  showCancel = false;
  cancelReason = '';
  cancelling = false;

  /** The student whose correction form is open. */
  correcting: AttendanceRecord | null = null;
  correctionReason = '';
  savingCorrection = false;

  /** The search box and the All / Present / Absent chips above the student list. */
  search = '';
  filter: 'ALL' | RecordStatus = 'ALL';

  private readonly sessionId: string;
  /** Marks go to the server one after another, so a quick series of taps stays in order. */
  private readonly changes$ = new Subject<MarkChange[]>();
  private readonly subscription = new Subscription();

  constructor(
    route: ActivatedRoute,
    private attendance: AttendanceService,
    private confirm: ConfirmService,
    private toast: ToastService,
    private location: Location,
    private auth: AuthService,
  ) {
    this.sessionId = route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    this.subscription.add(
      this.changes$
        .pipe(
          concatMap((changes) =>
            this.attendance
              .markRecords(
                this.sessionId,
                changes.map((change) => ({
                  public_id: change.record.public_id,
                  status: change.status,
                })),
              )
              .pipe(
                map((updated) => ({ changes, updated })),
                catchError((error: GlobalException) => {
                  this.saving--;
                  this.undo(changes);
                  this.onSaveError(error);
                  return EMPTY;
                }),
              ),
          ),
        )
        .subscribe(({ updated }) => {
          this.saving--;
          this.applyCounts(updated);
        }),
    );

    this.load();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get isOpen(): boolean {
    return this.session?.status === 'OPEN';
  }

  get isSubmitted(): boolean {
    return this.session?.status === 'SUBMITTED';
  }

  get isCancelled(): boolean {
    return this.session?.status === 'CANCELLED';
  }

  get unmarkedPresent(): AttendanceRecord[] {
    return (this.session?.records ?? []).filter((record) => record.status !== 'PRESENT');
  }

  /** Present and absent counts, worked out from the list so they follow every tap at once. */
  get counts(): { all: number; present: number; absent: number } {
    const records = this.session?.records ?? [];
    const present = records.filter((record) => record.status === 'PRESENT').length;
    return { all: records.length, present, absent: records.length - present };
  }

  get percentPresent(): number {
    const { all, present } = this.counts;
    return all === 0 ? 0 : Math.round((present * 100) / all);
  }

  /** The students that match the search box and the chosen chip. */
  get visibleRecords(): AttendanceRecord[] {
    const term = this.search.trim().toLowerCase();

    return (this.session?.records ?? []).filter(
      (record) =>
        (this.filter === 'ALL' || record.status === this.filter) &&
        (!term ||
          record.student_name.toLowerCase().includes(term) ||
          record.roll_number.toLowerCase().includes(term)),
    );
  }

  /** Who marked the attendance, once for the whole list (for a submitted session). */
  get markedBy(): string {
    const names = (this.session?.records ?? [])
      .map((record) => record.marked_by_name)
      .filter((name): name is string => !!name);

    return [...new Set(names)].join(', ');
  }

  initial(record: AttendanceRecord): string {
    return (record.student_name[0] ?? '?').toUpperCase();
  }

  /** Where Back goes when there is no history to go back to: a teacher's Today, an administrator's sessions. */
  get backLink(): string {
    return this.auth.userType === UserType.TEACHER ? '/teacher/today' : '/admin/sessions';
  }

  /** Back to where the teacher came from (Today or My sessions); Today if there is nowhere to go back to. */
  goBack(event: Event): void {
    if (window.history.length > 1) {
      event.preventDefault();
      this.location.back();
    }
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.attendance.session(this.sessionId).subscribe({
      next: (session) => {
        this.session = session;
        this.loading = false;
        this.loadCorrections();
      },
      error: (error: GlobalException) => {
        this.loading = false;
        this.error = error.isNotFound ? 'This session does not exist.' : error.message;
      },
    });
  }

  // ---- Marking (OPEN) -----------------------------------------------------------

  setStatus(record: AttendanceRecord, status: RecordStatus): void {
    if (!this.isOpen || record.status === status) return;
    this.send([{ record, status, previous: record.status }]);
  }

  markAllPresent(): void {
    const changes = this.unmarkedPresent.map<MarkChange>((record) => ({
      record,
      status: 'PRESENT',
      previous: record.status,
    }));

    if (changes.length > 0) this.send(changes);
  }

  submit(): void {
    const session = this.session;
    if (!session || this.submitting) return;

    this.confirm
      .confirm({
        title: 'Submit attendance?',
        message:
          `${session.present_count} present and ${session.absent_count} absent ` +
          `out of ${session.total_students}. After submitting you can only correct single students.`,
        confirmText: 'Submit',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.submitting = true;
          return this.attendance.submit(this.sessionId);
        }),
      )
      .subscribe({
        next: (updated) => {
          this.submitting = false;
          this.session = updated;
          this.toast.success('Attendance submitted');
          this.loadCorrections();
        },
        error: (error: GlobalException) => {
          this.submitting = false;
          this.onActionError(error);
        },
      });
  }

  // ---- Cancelling (OPEN) --------------------------------------------------------

  openCancel(): void {
    this.showCancel = true;
  }

  closeCancel(): void {
    this.showCancel = false;
    this.cancelReason = '';
  }

  cancelLecture(): void {
    const reason = this.cancelReason.trim();
    if (!reason || this.cancelling) return;

    this.cancelling = true;
    this.attendance.cancel(this.sessionId, reason).subscribe({
      next: (updated) => {
        this.cancelling = false;
        this.session = updated;
        this.closeCancel();
        this.toast.success('Lecture cancelled');
      },
      error: (error: GlobalException) => {
        this.cancelling = false;
        this.onActionError(error);
      },
    });
  }

  // ---- Corrections (SUBMITTED) --------------------------------------------------

  openCorrection(record: AttendanceRecord): void {
    this.correcting = record;
    this.correctionReason = '';
  }

  closeCorrection(): void {
    this.correcting = null;
    this.correctionReason = '';
  }

  /** The status a correction would change the record to. */
  flipped(record: AttendanceRecord): RecordStatus {
    return record.status === 'PRESENT' ? 'ABSENT' : 'PRESENT';
  }

  saveCorrection(): void {
    const record = this.correcting;
    const reason = this.correctionReason.trim();
    if (!record || !reason || this.savingCorrection) return;

    this.savingCorrection = true;
    this.attendance
      .correct(this.sessionId, { record: record.public_id, status: this.flipped(record), reason })
      .pipe(switchMap(() => this.attendance.session(this.sessionId)))
      .subscribe({
        next: (updated) => {
          this.savingCorrection = false;
          this.session = updated;
          this.closeCorrection();
          this.toast.success('Correction saved');
          this.loadCorrections();
        },
        error: (error: GlobalException) => {
          this.savingCorrection = false;
          this.onActionError(error);
        },
      });
  }

  // ---- Helpers ------------------------------------------------------------------

  private send(changes: MarkChange[]): void {
    // Show the new marks at once; they are put back if the server refuses them.
    for (const change of changes) change.record.status = change.status;
    this.saving++;
    this.changes$.next(changes);
  }

  private undo(changes: MarkChange[]): void {
    for (const change of changes) change.record.status = change.previous;
  }

  /** The server's totals replace ours; the student rows stay as the teacher left them. */
  private applyCounts(updated: AttendanceSessionDetail): void {
    if (!this.session) return;
    this.session.present_count = updated.present_count;
    this.session.absent_count = updated.absent_count;
    this.session.total_students = updated.total_students;
  }

  private loadCorrections(): void {
    if (this.session?.status !== 'SUBMITTED') {
      this.corrections = [];
      return;
    }

    this.attendance.corrections(this.sessionId).subscribe({
      next: (page) => (this.corrections = page.results),
      error: () => (this.corrections = []),
    });
  }

  private onSaveError(error: GlobalException): void {
    if (error.status === 400) {
      // Someone else submitted or cancelled this session meanwhile.
      this.toast.error('Could not save', error.message);
      this.load();
    }
  }

  /** The interceptor already shows 403, 409, 5xx and network problems; other messages are shown here. */
  private onActionError(error: GlobalException): void {
    if (error.status === 400 || error.status === 404) {
      this.toast.error('Could not complete this', error.message);
    }
  }
}
