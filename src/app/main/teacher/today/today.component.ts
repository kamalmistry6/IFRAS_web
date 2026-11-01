import { ChangeDetectionStrategy, Component, HostListener, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MyAssignment, TodayLecture } from 'src/app/api/models';
import { AttendanceService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { formatTime } from 'src/app/shared/utils';
import { applyServerErrors } from 'src/app/shared/utils';
import { LECTURE_STATE_BADGE, LECTURE_STATE_LABEL, todayIso } from '../../attendance/lecture-state';

type LectureAction = 'start' | 'continue' | 'view' | null;

/** T1: the lectures of a day, with one button to start or continue attendance. */
@Component({
  selector: 'app-today',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './today.component.html',
  styleUrls: ['./today.component.scss'],
})
export class TodayComponent implements OnInit {
  readonly stateLabel = LECTURE_STATE_LABEL;
  readonly stateBadge = LECTURE_STATE_BADGE;
  readonly formatTime = formatTime;

  date = todayIso();
  lectures: TodayLecture[] = [];
  loading = false;
  loaded = false;
  error = '';
  /** The slot whose Start button was pressed, so it cannot be pressed twice. */
  startingSlot: string | null = null;

  /** The "extra lecture" form: a lecture that is not in the timetable. */
  showExtra = false;
  extraForm!: FormGroup;
  assignments: MyAssignment[] = [];
  /** Server messages that belong to no field (overlap, no students enrolled ...). */
  extraErrors: string[] = [];
  savingExtra = false;

  constructor(
    private attendance: AttendanceService,
    private router: Router,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.extraForm = this.fb.group({
      teacher_assignment: [null as number | null, [Validators.required]],
      date: [this.date, [Validators.required]],
      start_time: [this.defaultTimes().start_time, [Validators.required]],
      end_time: [this.defaultTimes().end_time, [Validators.required]],
    });

    this.load();
  }

  /** Today as YYYY-MM-DD: an extra lecture cannot be in the future. */
  readonly today = todayIso();

  get isToday(): boolean {
    return this.date === todayIso();
  }

  changeDate(date: string): void {
    if (!date) return;
    this.date = date;
    this.load();
  }

  goToToday(): void {
    this.changeDate(todayIso());
  }

  load(): void {
    this.loading = true;
    this.error = '';

    // 'own': a head of department's own lectures, not the whole department's.
    this.attendance.today(this.date, 'own').subscribe({
      next: (response) => {
        this.lectures = response.lectures;
        this.loading = false;
        this.loaded = true;
      },
      error: (error: GlobalException) => {
        this.loading = false;
        this.error = error.message;
      },
    });
  }

  /** What the button on a lecture does. A cancelled lecture has none. */
  action(lecture: TodayLecture): LectureAction {
    switch (lecture.state) {
      case 'NOT_STARTED':
        return lecture.slot_public_id ? 'start' : null;
      case 'OPEN':
        return 'continue';
      case 'SUBMITTED':
        return 'view';
      default:
        return null;
    }
  }

  open(lecture: TodayLecture): void {
    const action = this.action(lecture);

    if (action === 'start' && lecture.slot_public_id) {
      this.start(lecture.slot_public_id);
    } else if (lecture.session) {
      this.openSession(lecture.session.public_id);
    }
  }

  openExtra(): void {
    this.showExtra = true;
    this.extraErrors = [];
    this.extraForm.patchValue({ date: this.date, ...this.defaultTimes() });

    if (this.assignments.length === 0) {
      this.attendance.myAssignments().subscribe((page) => (this.assignments = page.results));
    }
  }

  /** Starts now (to the 5 minutes below it) and ends an hour later. */
  private defaultTimes(): { start_time: string; end_time: string } {
    const now = new Date();
    const start = now.getHours() * 60 + Math.floor(now.getMinutes() / 5) * 5;
    const end = Math.min(start + 60, 23 * 60 + 55);
    const text = (minutes: number) =>
      `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

    return { start_time: text(start), end_time: text(end) };
  }

  /** Escape closes the dialog. */
  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.showExtra) this.closeExtra();
  }

  closeExtra(): void {
    this.showExtra = false;
    this.extraErrors = [];
    this.extraForm.reset({
      teacher_assignment: null,
      date: this.date,
      ...this.defaultTimes(),
    });
  }

  startExtra(): void {
    if (this.savingExtra) return;

    const { start_time, end_time } = this.extraForm.getRawValue();
    if (start_time && end_time && end_time <= start_time) {
      this.extraErrors = ['The end time must be after the start time.'];
      return;
    }

    if (this.extraForm.invalid) {
      this.extraForm.markAllAsTouched();
      return;
    }

    this.savingExtra = true;
    this.extraErrors = [];

    this.attendance.createSession(this.extraForm.getRawValue()).subscribe({
      next: (session) => this.openSession(session.public_id),
      error: (error: GlobalException) => {
        this.savingExtra = false;
        this.extraErrors = applyServerErrors(this.extraForm, error);
      },
    });
  }

  private start(slotPublicId: string): void {
    if (this.startingSlot) return;
    this.startingSlot = slotPublicId;

    this.attendance.startSlot(slotPublicId, this.date).subscribe({
      next: (session) => this.openSession(session.public_id),
      error: (error: GlobalException) => {
        this.startingSlot = null;
        this.error = error.message;
      },
    });
  }

  private openSession(publicId: string): void {
    this.router.navigate(['/teacher/sessions', publicId]);
  }
}
