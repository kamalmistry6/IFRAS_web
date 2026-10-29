import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
  EMPTY,
  Subject,
  Subscription,
  catchError,
  debounceTime,
  merge,
  switchMap,
  tap,
} from 'rxjs';
import { AcademicYear, EnrollmentStatus, Program, StudentEnrollment } from 'src/app/api/models';
import { DirectoryService, StudentsService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { PAGE_SIZE, PageRange, pageRange } from 'src/app/shared/utils';
import {
  ENROLLMENT_BADGE,
  ENROLLMENT_STATUSES,
} from '../enrollment-dialog/enrollment-dialog.component';

/** A5: every enrollment of the college. Search and filter them, enrol a student, or edit one. */
@Component({
  selector: 'app-enrollments',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './enrollments.component.html',
  styleUrls: ['./enrollments.component.scss'],
})
export class EnrollmentsComponent implements OnInit, OnDestroy {
  readonly statuses = ENROLLMENT_STATUSES;
  readonly badge = ENROLLMENT_BADGE;
  readonly statusLabel = Object.fromEntries(
    ENROLLMENT_STATUSES.map((status) => [status.value, status.label]),
  ) as Record<EnrollmentStatus, string>;

  // The list, its filters and its pages
  enrollments: StudentEnrollment[] = [];
  count = 0;
  page = 1;
  filters: FormGroup;
  loading = false;
  loaded = false;
  error = '';
  years: AcademicYear[] = [];
  programs: Program[] = [];

  /** The enrollment dialog: open to enrol, or to edit `editing`. */
  showDialog = false;
  editing: StudentEnrollment | null = null;

  private readonly reload$ = new Subject<void>();
  private readonly subscription = new Subscription();

  constructor(
    fb: FormBuilder,
    private students: StudentsService,
    private directory: DirectoryService,
  ) {
    this.filters = fb.nonNullable.group({
      search: '',
      year: '',
      program: '',
      yearOfStudy: '',
      status: '',
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
            this.students.enrollments(this.query()).pipe(
              catchError((error: GlobalException) => {
                this.loading = false;
                this.error = error.message;
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe((page) => {
          this.enrollments = page.results;
          this.count = page.count;
          this.loading = false;
          this.loaded = true;
        }),
    );

    // Typing in the search box waits for a pause; the drop-downs act at once.
    const controls = this.filters.controls;
    this.subscription.add(
      merge(
        controls['search'].valueChanges.pipe(debounceTime(300)),
        controls['year'].valueChanges,
        controls['program'].valueChanges,
        controls['yearOfStudy'].valueChanges,
        controls['status'].valueChanges,
      ).subscribe(() => {
        this.page = 1;
        this.reload$.next();
      }),
    );

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

  /** 1 to the length of the chosen program, or to the longest program when none is chosen. */
  get yearOptions(): number[] {
    const chosen = this.programs.find((item) => item.id === Number(this.filters.value.program));
    const length = chosen
      ? chosen.duration_years
      : Math.max(4, ...this.programs.map((item) => item.duration_years));

    return Array.from({ length }, (_, index) => index + 1);
  }

  clearFilters(): void {
    this.filters.reset({ search: '', year: '', program: '', yearOfStudy: '', status: '' });
  }

  goTo(page: number): void {
    if (page < 1 || page > this.range.totalPages || page === this.page) return;
    this.page = page;
    this.reload$.next();
  }

  retry(): void {
    this.reload$.next();
  }

  openEnrol(): void {
    this.editing = null;
    this.showDialog = true;
  }

  openEdit(enrollment: StudentEnrollment): void {
    this.editing = enrollment;
    this.showDialog = true;
  }

  closeDialog(): void {
    this.showDialog = false;
    this.editing = null;
  }

  saved(): void {
    this.closeDialog();
    this.reload$.next();
  }

  private query() {
    const { search, year, program, yearOfStudy, status } = this.filters.getRawValue();

    return {
      page: this.page,
      search: search.trim(),
      academic_year: year,
      program,
      year_of_study: yearOfStudy,
      status,
    };
  }
}
