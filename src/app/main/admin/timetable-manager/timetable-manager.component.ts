import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EMPTY, Subject, Subscription, catchError, filter, switchMap, tap } from 'rxjs';
import {
  AcademicYear,
  DayOfWeek,
  TeacherProfile,
  TeacherSubjectAssignment,
  TimetableSlot,
} from 'src/app/api/models';
import { AttendanceService, DirectoryService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ConfirmService, ToastService } from 'src/app/core/services';
import { applyServerErrors, formatTime } from 'src/app/shared/utils';
import {
  DayColumn,
  WEEKDAYS,
  groupByDay,
  isoWeekday,
} from 'src/app/main/attendance/timetable-grid';

/** A8: the weekly timetable of the whole college. Add, edit, deactivate and activate slots. */
@Component({
  selector: 'app-timetable-manager',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './timetable-manager.component.html',
  styleUrls: ['./timetable-manager.component.scss'],
})
export class TimetableManagerComponent implements OnInit, OnDestroy {
  readonly formatTime = formatTime;
  readonly weekdays = WEEKDAYS;
  readonly todayNumber = isoWeekday(new Date());

  // The list and its filters
  slots: TimetableSlot[] = [];
  count = 0;
  teachers: TeacherProfile[] = [];
  filters: FormGroup;
  loading = false;
  loaded = false;
  error = '';

  // The add and edit form
  showForm = false;
  /** The slot being edited, or null when adding. */
  editing: TimetableSlot | null = null;
  form: FormGroup;
  years: AcademicYear[] = [];
  assignments: TeacherSubjectAssignment[] = [];
  formErrors: string[] = [];
  saving = false;

  private readonly reload$ = new Subject<void>();
  private readonly subscription = new Subscription();

  constructor(
    fb: FormBuilder,
    private attendance: AttendanceService,
    private directory: DirectoryService,
    private confirm: ConfirmService,
    private toast: ToastService,
  ) {
    this.filters = fb.nonNullable.group({ teacher: '', showInactive: false });
    this.form = fb.nonNullable.group({
      year: [null as number | null],
      teacher_assignment: [null as number | null, [Validators.required]],
      day_of_week: [this.todayNumber as DayOfWeek, [Validators.required]],
      start_time: ['09:00', [Validators.required]],
      end_time: ['10:00', [Validators.required]],
      room: [''],
      valid_from: ['', [Validators.required]],
      valid_to: ['', [Validators.required]],
    });
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
            this.attendance.timetable(this.query()).pipe(
              catchError((error: GlobalException) => {
                this.loading = false;
                this.error = error.message;
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe((page) => {
          this.slots = page.results;
          this.count = page.count;
          this.loading = false;
          this.loaded = true;
        }),
    );

    this.subscription.add(this.filters.valueChanges.subscribe(() => this.reload$.next()));

    // Choosing another academic year lists the assignments of that year.
    this.subscription.add(
      this.form.controls['year'].valueChanges
        .pipe(filter(() => this.showForm && !this.editing))
        .subscribe((yearId) => this.chooseYear(yearId)),
    );

    this.directory
      .teachers({ is_active: true })
      .subscribe((page) => (this.teachers = page.results));
    this.directory.academicYears().subscribe((page) => (this.years = page.results));
    this.reload$.next();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get days(): DayColumn[] {
    return groupByDay(this.slots);
  }

  /** More slots than one page holds: ask the administrator to narrow the list. */
  get truncated(): boolean {
    return this.count > this.slots.length;
  }

  get hasFilters(): boolean {
    return !!this.filters.value.teacher || !!this.filters.value.showInactive;
  }

  clearFilters(): void {
    this.filters.reset({ teacher: '', showInactive: false });
  }

  retry(): void {
    this.reload$.next();
  }

  // ---- Add and edit ----------------------------------------------------------------

  openAdd(): void {
    const year = this.years.find((item) => item.is_active) ?? this.years[0] ?? null;

    this.editing = null;
    this.formErrors = [];
    this.form.reset({
      year: year?.id ?? null,
      teacher_assignment: null,
      day_of_week: this.todayNumber,
      start_time: '09:00',
      end_time: '10:00',
      room: '',
      valid_from: year?.start_date ?? '',
      valid_to: year?.end_date ?? '',
    });
    this.showForm = true;

    if (year) this.loadAssignments(year.id);
  }

  openEdit(slot: TimetableSlot): void {
    this.editing = slot;
    this.formErrors = [];
    this.form.reset({
      year: null,
      teacher_assignment: slot.teacher_assignment,
      day_of_week: slot.day_of_week,
      start_time: slot.start_time.slice(0, 5),
      end_time: slot.end_time.slice(0, 5),
      room: slot.room,
      valid_from: slot.valid_from,
      valid_to: slot.valid_to,
    });
    this.showForm = true;
  }

  /** Escape closes the dialog. */
  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.showForm) this.closeForm();
  }

  closeForm(): void {
    this.showForm = false;
    this.editing = null;
    this.formErrors = [];
  }

  save(): void {
    if (this.saving) return;

    const value = this.form.getRawValue();

    if (value.start_time && value.end_time && value.end_time <= value.start_time) {
      this.formErrors = ['The end time must be after the start time.'];
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const details = {
      day_of_week: Number(value.day_of_week) as DayOfWeek,
      start_time: value.start_time,
      end_time: value.end_time,
      room: value.room.trim(),
      valid_from: value.valid_from,
      valid_to: value.valid_to,
    };

    const request = this.editing
      ? this.attendance.updateSlot(this.editing.public_id, details)
      : this.attendance.createSlot({ teacher_assignment: value.teacher_assignment, ...details });

    this.saving = true;
    this.formErrors = [];

    request.subscribe({
      next: () => {
        this.saving = false;
        this.toast.success(this.editing ? 'Slot updated' : 'Slot added');
        this.closeForm();
        this.reload$.next();
      },
      error: (error: GlobalException) => {
        this.saving = false;
        this.formErrors = applyServerErrors(this.form, error);
      },
    });
  }

  // ---- Deactivate and activate -----------------------------------------------------

  toggleActive(slot: TimetableSlot): void {
    const activating = !slot.is_active;

    const apply = () =>
      this.attendance.updateSlot(slot.public_id, { is_active: activating }).subscribe({
        next: () => {
          this.toast.success(activating ? 'Slot activated' : 'Slot deactivated');
          this.reload$.next();
        },
        error: (error: GlobalException) =>
          this.toast.error('Could not change the slot', error.message),
      });

    if (activating) {
      apply();
      return;
    }

    this.confirm
      .confirm({
        title: 'Deactivate this slot?',
        message:
          `${slot.subject_name} on ${slot.day_name} at ${formatTime(slot.start_time)} will ` +
          "disappear from the teacher's timetable and Today page. Past sessions are kept.",
        confirmText: 'Deactivate',
        danger: true,
      })
      .pipe(filter(Boolean))
      .subscribe(apply);
  }

  // ---- Helpers ---------------------------------------------------------------------

  /** The label of an assignment in the drop-down: "Amit Patil - Machine Learning". */
  assignmentLabel(item: TeacherSubjectAssignment): string {
    return `${item.teacher_name} - ${item.subject_name}`;
  }

  private chooseYear(yearId: number | null): void {
    this.form.patchValue({ teacher_assignment: null }, { emitEvent: false });
    this.assignments = [];

    const year = this.years.find((item) => item.id === Number(yearId));
    if (!year) return;

    this.form.patchValue(
      { valid_from: year.start_date, valid_to: year.end_date },
      { emitEvent: false },
    );
    this.loadAssignments(year.id);
  }

  private loadAssignments(yearId: number): void {
    this.directory
      .subjectAssignments({ academic_year: yearId })
      .subscribe((page) => (this.assignments = page.results));
  }

  private query() {
    const { teacher, showInactive } = this.filters.getRawValue();

    return {
      is_active: showInactive ? undefined : true,
      teacher_assignment__teacher: teacher,
    };
  }
}
