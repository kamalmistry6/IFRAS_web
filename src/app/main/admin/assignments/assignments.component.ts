import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  EMPTY,
  Subject,
  Subscription,
  catchError,
  debounceTime,
  filter,
  merge,
  switchMap,
  tap,
} from 'rxjs';
import {
  AcademicYear,
  Program,
  SubjectOffering,
  TeacherProfile,
  TeacherSubjectAssignment,
} from 'src/app/api/models';
import { AssignmentsService, DirectoryService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ConfirmService, ToastService } from 'src/app/core/services';
import { PAGE_SIZE, PageRange, applyServerErrors, pageRange } from 'src/app/shared/utils';

/** A7: who teaches what. Assign a subject offering to a teacher, or remove an assignment. */
@Component({
  selector: 'app-assignments',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './assignments.component.html',
  styleUrls: ['./assignments.component.scss'],
})
export class AssignmentsComponent implements OnInit, OnDestroy {
  // The list, its filters and its pages
  assignments: TeacherSubjectAssignment[] = [];
  count = 0;
  page = 1;
  filters: FormGroup;
  loading = false;
  loaded = false;
  error = '';

  // Lookups for the filters and the form
  teachers: TeacherProfile[] = [];
  years: AcademicYear[] = [];
  programs: Program[] = [];
  offerings: SubjectOffering[] = [];

  // The "assign" dialog
  showForm = false;
  form: FormGroup;
  formErrors: string[] = [];
  saving = false;
  loadingOfferings = false;

  private readonly reload$ = new Subject<void>();
  private readonly subscription = new Subscription();

  constructor(
    fb: FormBuilder,
    private assignmentsApi: AssignmentsService,
    private directory: DirectoryService,
    private confirm: ConfirmService,
    private toast: ToastService,
  ) {
    this.filters = fb.nonNullable.group({ search: '', teacher: '', year: '' });
    this.form = fb.nonNullable.group({
      teacher: [null as number | null, [Validators.required]],
      year: [null as number | null, [Validators.required]],
      program: [null as number | null],
      subject_offering: [null as number | null, [Validators.required]],
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
            this.assignmentsApi.list(this.query()).pipe(
              catchError((error: GlobalException) => {
                this.loading = false;
                this.error = error.message;
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe((page) => {
          this.assignments = page.results;
          this.count = page.count;
          this.loading = false;
          this.loaded = true;
        }),
    );

    // Typing in the search box waits for a pause; the drop-downs act at once.
    this.subscription.add(
      merge(
        this.filters.controls['search'].valueChanges.pipe(debounceTime(300)),
        this.filters.controls['teacher'].valueChanges,
        this.filters.controls['year'].valueChanges,
      ).subscribe(() => {
        this.page = 1;
        this.reload$.next();
      }),
    );

    // The subjects on offer depend on the year and the program chosen in the dialog.
    this.subscription.add(
      merge(this.form.controls['year'].valueChanges, this.form.controls['program'].valueChanges)
        .pipe(filter(() => this.showForm))
        .subscribe(() => this.loadOfferings()),
    );

    this.directory
      .teachers({ is_active: true })
      .subscribe((page) => (this.teachers = page.results));
    this.directory.academicYears().subscribe((page) => (this.years = page.results));
    this.directory.programs().subscribe((page) => (this.programs = page.results));
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
    this.filters.reset({ search: '', teacher: '', year: '' });
  }

  goTo(page: number): void {
    if (page < 1 || page > this.range.totalPages || page === this.page) return;
    this.page = page;
    this.reload$.next();
  }

  retry(): void {
    this.reload$.next();
  }

  // ---- Assign ------------------------------------------------------------------------

  openForm(): void {
    const year = this.years.find((item) => item.is_active) ?? this.years[0] ?? null;

    this.formErrors = [];
    this.offerings = [];
    this.form.reset({
      teacher: null,
      year: null,
      program: null,
      subject_offering: null,
    });
    this.showForm = true;
    // Setting the year last loads the subjects on offer for it.
    this.form.controls['year'].setValue(year?.id ?? null);
  }

  /** Escape closes the dialog. */
  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.showForm) this.closeForm();
  }

  closeForm(): void {
    this.showForm = false;
    this.formErrors = [];
  }

  save(): void {
    if (this.saving) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { teacher, subject_offering } = this.form.getRawValue();

    this.saving = true;
    this.formErrors = [];

    this.assignmentsApi.create({ teacher, subject_offering }).subscribe({
      next: () => {
        this.saving = false;
        this.toast.success('Subject assigned');
        this.closeForm();
        this.reload$.next();
      },
      error: (error: GlobalException) => {
        this.saving = false;
        this.formErrors = applyServerErrors(this.form, error);
      },
    });
  }

  // ---- Remove ------------------------------------------------------------------------

  remove(item: TeacherSubjectAssignment): void {
    this.confirm
      .confirm({
        title: 'Remove this assignment?',
        message: `${item.teacher_name} will no longer teach ${item.subject_name} (${item.academic_year_name}).`,
        confirmText: 'Remove',
        danger: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.assignmentsApi.remove(item.public_id)),
      )
      .subscribe({
        next: () => {
          this.toast.success('Assignment removed');
          // Removing the last row of a page leaves that page empty: go back one.
          if (this.assignments.length === 1 && this.page > 1) this.page--;
          this.reload$.next();
        },
        // A 409 (it already has timetable slots or sessions) is shown by the error
        // interceptor with the server's message; other refusals are shown here.
        error: (error: GlobalException) => {
          if (!error.isConflict) this.toast.error('Could not remove it', error.message);
        },
      });
  }

  // ---- Helpers -----------------------------------------------------------------------

  offeringLabel(item: SubjectOffering): string {
    return `${item.subject_name} (${item.subject_code}) - Sem ${item.semester_number}`;
  }

  private loadOfferings(): void {
    const { year, program } = this.form.getRawValue();

    this.form.patchValue({ subject_offering: null }, { emitEvent: false });
    this.offerings = [];

    if (!year) return;

    this.loadingOfferings = true;
    this.directory
      .subjectOfferings({ academic_year: year, subject__semester__program: program })
      .subscribe({
        next: (page) => {
          this.offerings = page.results;
          this.loadingOfferings = false;
        },
        error: () => (this.loadingOfferings = false),
      });
  }

  private query() {
    const { search, teacher, year } = this.filters.getRawValue();

    return { page: this.page, search: search.trim(), teacher, academic_year: year };
  }
}
