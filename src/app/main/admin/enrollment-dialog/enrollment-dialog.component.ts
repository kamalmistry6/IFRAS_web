import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Subscription, debounceTime, filter, switchMap } from 'rxjs';
import {
  AcademicYear,
  EnrollmentStatus,
  Program,
  StudentEnrollment,
  StudentProfile,
} from 'src/app/api/models';
import { DirectoryService, StudentsService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ToastService } from 'src/app/core/services';
import { applyServerErrors } from 'src/app/shared/utils';

export const ENROLLMENT_STATUSES: { value: EnrollmentStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

/** The badge colour of each enrollment status. */
export const ENROLLMENT_BADGE: Record<EnrollmentStatus, string> = {
  ACTIVE: 'badge-success',
  COMPLETED: 'badge-info',
  WITHDRAWN: 'badge-warning',
  SUSPENDED: 'badge-danger',
};

/**
 * The dialog that enrols a student, or edits an enrollment (A4 and A5).
 *
 *   <app-enrollment-dialog [student]="student" (saved)="reload()" (closed)="open = false">
 *   </app-enrollment-dialog>
 *
 * Give it `student` when the student is already known (the student's page); leave
 * it out and the dialog searches students by name. Give it `enrollment` to edit one:
 * its student and academic year cannot be changed.
 */
@Component({
  selector: 'app-enrollment-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './enrollment-dialog.component.html',
  styleUrls: ['./enrollment-dialog.component.scss'],
})
export class EnrollmentDialogComponent implements OnInit, OnDestroy {
  @Input() student: StudentProfile | null = null;
  @Input() enrollment: StudentEnrollment | null = null;
  @Output() saved = new EventEmitter<StudentEnrollment>();
  @Output() closed = new EventEmitter<void>();

  readonly statuses = ENROLLMENT_STATUSES;

  form: FormGroup;
  years: AcademicYear[] = [];
  programs: Program[] = [];
  formErrors: string[] = [];
  saving = false;

  // Searching for the student (when none was given)
  readonly studentSearch = new FormControl('', { nonNullable: true });
  candidates: StudentProfile[] = [];
  chosen: StudentProfile | null = null;

  private readonly subscription = new Subscription();

  constructor(
    fb: FormBuilder,
    private students: StudentsService,
    private directory: DirectoryService,
    private toast: ToastService,
  ) {
    this.form = fb.nonNullable.group({
      student: [null as number | null, [Validators.required]],
      academic_year: [null as number | null, [Validators.required]],
      program: [null as number | null, [Validators.required]],
      year_of_study: [null as number | null, [Validators.required]],
      roll_number: ['', [Validators.required]],
      status: ['ACTIVE' as EnrollmentStatus],
    });
  }

  ngOnInit(): void {
    if (this.enrollment) {
      const item = this.enrollment;
      this.form.reset({
        student: item.student,
        academic_year: item.academic_year,
        program: item.program,
        year_of_study: item.year_of_study,
        roll_number: item.roll_number,
        status: item.status,
      });
      // These two are fixed once an enrollment exists.
      this.form.controls['student'].disable({ emitEvent: false });
      this.form.controls['academic_year'].disable({ emitEvent: false });
    } else if (this.student) {
      this.form.patchValue({ student: this.student.id });
    }

    this.directory.academicYears().subscribe((page) => {
      this.years = page.results;

      if (!this.enrollment && !this.form.value.academic_year) {
        const year = this.years.find((item) => item.is_active) ?? this.years[0];
        if (year) this.form.patchValue({ academic_year: year.id });
      }
    });
    this.directory.programs().subscribe((page) => (this.programs = page.results));

    // Looking for a student waits for a pause in typing.
    this.subscription.add(
      this.studentSearch.valueChanges
        .pipe(
          debounceTime(300),
          filter(() => !this.student && !this.enrollment),
          switchMap((text) => this.students.list({ search: text.trim(), page_size: 20 })),
        )
        .subscribe((page) => (this.candidates = page.results)),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get editing(): boolean {
    return !!this.enrollment;
  }

  /** 1 to the length of the chosen program (a three-year degree has years 1, 2 and 3). */
  get yearOptions(): number[] {
    const program = this.programs.find((item) => item.id === Number(this.form.value.program));
    const length = program?.duration_years ?? 4;
    return Array.from({ length }, (_, index) => index + 1);
  }

  choose(student: StudentProfile): void {
    this.chosen = student;
    this.candidates = [];
    this.studentSearch.setValue('', { emitEvent: false });
    this.form.patchValue({ student: student.id });
  }

  clearChoice(): void {
    this.chosen = null;
    this.form.patchValue({ student: null });
  }

  /** Escape closes the dialog. */
  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.closed.emit();
  }

  save(): void {
    if (this.saving) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const details = {
      program: Number(value.program),
      year_of_study: Number(value.year_of_study),
      roll_number: value.roll_number.trim(),
      status: value.status,
    };

    const request = this.enrollment
      ? this.students.updateEnrollment(this.enrollment.public_id, details)
      : this.students.createEnrollment({
          student: value.student,
          academic_year: value.academic_year,
          ...details,
        });

    this.saving = true;
    this.formErrors = [];

    request.subscribe({
      next: (saved) => {
        this.saving = false;
        this.toast.success(this.enrollment ? 'Enrollment updated' : 'Student enrolled');
        this.saved.emit(saved);
      },
      error: (error: GlobalException) => {
        this.saving = false;
        this.formErrors = applyServerErrors(this.form, error);
      },
    });
  }
}
