import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { College, Department, TeacherProfile } from 'src/app/api/models';
import { DirectoryService, TeachersService } from 'src/app/api/services';
import { AppPermission } from 'src/app/auth/enums';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ToastService } from 'src/app/core/services';
import { PAGE_SIZE, PageRange, applyServerErrors, pageRange } from 'src/app/shared/utils';

/** A6: the teachers of the college. Search, add, edit, and deactivate (inactive teachers cannot take attendance). */
@Component({
  selector: 'app-teachers',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './teachers.component.html',
  styleUrls: ['./teachers.component.scss'],
})
export class TeachersComponent implements OnInit, OnDestroy {
  // The list, its filters and its pages
  teachers: TeacherProfile[] = [];
  count = 0;
  page = 1;
  filters: FormGroup;
  loading = false;
  loaded = false;
  error = '';

  // The add and edit dialog
  showForm = false;
  /** The teacher being edited, or null when adding. */
  editing: TeacherProfile | null = null;
  form: FormGroup;
  formErrors: string[] = [];
  saving = false;
  showPassword = false;
  /** Only a platform administrator chooses the college; a college administrator's own is used. */
  colleges: College[] = [];
  /** The departments to choose from (administrators only). */
  departments: Department[] = [];

  private readonly reload$ = new Subject<void>();
  private readonly subscription = new Subscription();

  constructor(
    fb: FormBuilder,
    private teachersApi: TeachersService,
    private directory: DirectoryService,
    private auth: AuthService,
    private toast: ToastService,
  ) {
    this.filters = fb.nonNullable.group({ search: '', status: '' });
    this.form = fb.nonNullable.group({
      first_name: ['', [Validators.required]],
      last_name: ['', [Validators.required]],
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      email: ['', [Validators.email]],
      college: [null as number | null],
      department: [null as number | null],
      is_head: [false],
      employee_id: ['', [Validators.required]],
      phone: [''],
      date_of_joining: [''],
      is_active: [true],
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
            this.teachersApi.list(this.query()).pipe(
              catchError((error: GlobalException) => {
                this.loading = false;
                this.error = error.message;
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe((page) => {
          this.teachers = page.results;
          this.count = page.count;
          this.loading = false;
          this.loaded = true;
        }),
    );

    // Typing in the search box waits for a pause; the status drop-down acts at once.
    this.subscription.add(
      merge(
        this.filters.controls['search'].valueChanges.pipe(debounceTime(300)),
        this.filters.controls['status'].valueChanges,
      ).subscribe(() => {
        this.page = 1;
        this.reload$.next();
      }),
    );

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

  /** A college administrator creates teachers in their own college; a platform administrator picks one. */
  get mustChooseCollege(): boolean {
    return !this.auth.user?.college;
  }

  /**
   * Administrators say which department a teacher is in and who heads it. A head of department
   * adds teachers to their own department only, and cannot change either.
   */
  get canAssignDepartment(): boolean {
    return this.auth.isAuthorizedNow({ permissions: [AppPermission.TEACHERS_DEPARTMENT_MANAGE] });
  }

  /** The head of department of the chosen department, when it is not the teacher being edited. */
  get otherHead(): string {
    const id = this.form.getRawValue().department as number | null;
    const department = this.departments.find((item) => item.id === id);

    if (!department || !department.head || department.head === this.editing?.id) return '';
    return department.head_name;
  }

  /** The departments of the college the teacher is in (a platform administrator picks the college first). */
  get departmentChoices(): Department[] {
    const college = this.form.getRawValue().college as number | null;
    return college ? this.departments.filter((item) => item.college === college) : this.departments;
  }

  clearFilters(): void {
    this.filters.reset({ search: '', status: '' });
  }

  goTo(page: number): void {
    if (page < 1 || page > this.range.totalPages || page === this.page) return;
    this.page = page;
    this.reload$.next();
  }

  retry(): void {
    this.reload$.next();
  }

  // ---- Add and edit ----------------------------------------------------------------

  openAdd(): void {
    this.editing = null;
    this.formErrors = [];
    this.showPassword = false;
    this.form.reset({
      first_name: '',
      last_name: '',
      username: '',
      password: '',
      email: '',
      college: this.auth.user?.college?.id ?? null,
      department: null,
      is_head: false,
      employee_id: '',
      phone: '',
      date_of_joining: '',
      is_active: true,
    });
    this.setCreateOnlyFields(true);
    this.showForm = true;

    if (this.mustChooseCollege && this.colleges.length === 0) {
      this.directory.colleges().subscribe((page) => (this.colleges = page.results));
    }
    this.loadDepartments();
  }

  openEdit(teacher: TeacherProfile): void {
    this.editing = teacher;
    this.formErrors = [];
    this.form.reset({
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      username: teacher.username,
      password: '',
      email: teacher.email,
      college: teacher.college,
      department: teacher.department,
      is_head: teacher.is_head,
      employee_id: teacher.employee_id,
      phone: teacher.phone,
      date_of_joining: teacher.date_of_joining ?? '',
      is_active: teacher.is_active,
    });
    this.setCreateOnlyFields(false);
    this.showForm = true;
    this.loadDepartments();
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
    const details = {
      first_name: value.first_name.trim(),
      last_name: value.last_name.trim(),
      employee_id: value.employee_id.trim(),
      phone: value.phone.trim(),
      date_of_joining: value.date_of_joining || null,
      is_active: value.is_active,
    };

    // Department and headship are for administrators; for a head of department the server uses
    // their own department and ignores both, so they are not sent.
    const structure = this.canAssignDepartment
      ? { department: value.department, is_head: !!value.department && !!value.is_head }
      : {};

    const request = this.editing
      ? this.teachersApi.update(this.editing.public_id, { ...details, ...structure })
      : this.teachersApi.create({
          ...details,
          username: value.username.trim(),
          // Never trimmed: the server decides if spaces around a password are allowed.
          password: value.password,
          email: value.email.trim(),
          college: value.college,
          ...(this.canAssignDepartment ? { department: value.department } : {}),
        });

    this.saving = true;
    this.formErrors = [];

    request.subscribe({
      next: () => {
        this.saving = false;
        this.toast.success(this.editing ? 'Teacher updated' : 'Teacher added');
        this.closeForm();
        this.reload$.next();
      },
      error: (error: GlobalException) => {
        this.saving = false;
        this.formErrors = applyServerErrors(this.form, error);
      },
    });
  }

  // ---- Helpers ---------------------------------------------------------------------

  /** Administrators choose the department from the college's list. */
  private loadDepartments(): void {
    if (!this.canAssignDepartment || this.departments.length > 0) return;

    this.directory.departments().subscribe((page) => (this.departments = page.results));
  }

  /** The login fields and the college are chosen once, when the teacher is created. */
  private setCreateOnlyFields(creating: boolean): void {
    for (const name of ['username', 'password', 'email', 'college']) {
      const control = this.form.controls[name];

      if (creating) control.enable({ emitEvent: false });
      else control.disable({ emitEvent: false });
    }

    // Validators of the disabled fields do not count; the college needs one only when it is chosen.
    this.form.controls['college'].setValidators(
      creating && this.mustChooseCollege ? [Validators.required] : [],
    );
    this.form.controls['college'].updateValueAndValidity({ emitEvent: false });
  }

  private query() {
    const { search, status } = this.filters.getRawValue();

    return {
      page: this.page,
      search: search.trim(),
      is_active: status === 'active' ? true : status === 'inactive' ? false : undefined,
    };
  }
}
