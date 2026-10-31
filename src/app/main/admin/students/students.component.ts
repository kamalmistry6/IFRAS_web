import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
import { AcademicYear, College, Program, StudentProfile } from 'src/app/api/models';
import { DirectoryService, StudentsService } from 'src/app/api/services';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ToastService } from 'src/app/core/services';
import { PAGE_SIZE, PageRange, applyServerErrors, pageRange } from 'src/app/shared/utils';
import { ENROLLMENT_STATUSES } from '../enrollment-dialog/enrollment-dialog.component';

/** A2 and A3: the students of the college. Search and filter them, open one, or add a new one. */
@Component({
  selector: 'app-students',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './students.component.html',
  styleUrls: ['./students.component.scss'],
})
export class StudentsComponent implements OnInit, OnDestroy {
  readonly statuses = ENROLLMENT_STATUSES;

  // The list, its filters and its pages
  students: StudentProfile[] = [];
  count = 0;
  page = 1;
  filters: FormGroup;
  loading = false;
  loaded = false;
  error = '';
  years: AcademicYear[] = [];
  programs: Program[] = [];

  // The "import students" dialog
  showImport = false;

  // The "add student" dialog
  showForm = false;
  form: FormGroup;
  formErrors: string[] = [];
  saving = false;
  showPassword = false;
  /** Only a platform administrator chooses the college; a college administrator's own is used. */
  colleges: College[] = [];

  private readonly reload$ = new Subject<void>();
  private readonly subscription = new Subscription();

  constructor(
    fb: FormBuilder,
    private studentsApi: StudentsService,
    private directory: DirectoryService,
    private auth: AuthService,
    private router: Router,
    private toast: ToastService,
  ) {
    this.filters = fb.nonNullable.group({
      search: '',
      year: '',
      program: '',
      yearOfStudy: '',
      status: '',
    });
    this.form = fb.nonNullable.group({
      first_name: ['', [Validators.required]],
      last_name: ['', [Validators.required]],
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      email: ['', [Validators.email]],
      roll_number: [''],
      college: [null as number | null],
      date_of_birth: [''],
      phone: [''],
      address: [''],
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
            this.studentsApi.list(this.query()).pipe(
              catchError((error: GlobalException) => {
                this.loading = false;
                this.error = error.message;
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe((page) => {
          this.students = page.results;
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

  get mustChooseCollege(): boolean {
    return !this.auth.user?.college;
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

  open(student: StudentProfile): void {
    this.router.navigate(['/admin/students', student.public_id]);
  }

  // ---- Import --------------------------------------------------------------------------

  openImport(): void {
    this.showImport = true;

    if (this.mustChooseCollege && this.colleges.length === 0) {
      this.directory.colleges().subscribe((page) => (this.colleges = page.results));
    }
  }

  /** Students were created: show them. */
  onImported(): void {
    this.page = 1;
    this.reload$.next();
  }

  // ---- Add -----------------------------------------------------------------------------

  openAdd(): void {
    this.formErrors = [];
    this.showPassword = false;
    this.form.reset({
      first_name: '',
      last_name: '',
      username: '',
      password: '',
      email: '',
      roll_number: '',
      college: this.auth.user?.college?.id ?? null,
      date_of_birth: '',
      phone: '',
      address: '',
    });
    this.form.controls['college'].setValidators(
      this.mustChooseCollege ? [Validators.required] : [],
    );
    this.form.controls['college'].updateValueAndValidity({ emitEvent: false });
    this.showForm = true;

    if (this.mustChooseCollege && this.colleges.length === 0) {
      this.directory.colleges().subscribe((page) => (this.colleges = page.results));
    }
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

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  save(): void {
    if (this.saving) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.saving = true;
    this.formErrors = [];

    this.studentsApi
      .create({
        username: value.username.trim(),
        // Never trimmed: the server decides if spaces around a password are allowed.
        password: value.password,
        first_name: value.first_name.trim(),
        last_name: value.last_name.trim(),
        email: value.email.trim(),
        roll_number: value.roll_number.trim(),
        college: value.college,
        date_of_birth: value.date_of_birth || null,
        phone: value.phone.trim(),
        address: value.address.trim(),
      })
      .subscribe({
        next: (student) => {
          this.saving = false;
          this.toast.success('Student added', 'Now enrol them in a program.');
          this.closeForm();
          // The new student's page opens with the enrol dialog ready.
          this.router.navigate(['/admin/students', student.public_id], {
            queryParams: { enrol: 1 },
          });
        },
        error: (error: GlobalException) => {
          this.saving = false;
          this.formErrors = applyServerErrors(this.form, error);
        },
      });
  }

  // ---- Helpers -------------------------------------------------------------------------

  private query() {
    const { search, year, program, yearOfStudy, status } = this.filters.getRawValue();

    return {
      page: this.page,
      search: search.trim(),
      academic_year: year,
      program,
      year_of_study: yearOfStudy,
      enrollment_status: status,
    };
  }
}
