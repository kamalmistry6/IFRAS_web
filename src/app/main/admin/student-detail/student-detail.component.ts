import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { EnrollmentStatus, StudentEnrollment, StudentProfile } from 'src/app/api/models';
import { StudentsService } from 'src/app/api/services';
import { AppPermission } from 'src/app/auth/enums';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ToastService } from 'src/app/core/services';
import { applyServerErrors } from 'src/app/shared/utils';
import {
  ENROLLMENT_BADGE,
  ENROLLMENT_STATUSES,
} from '../enrollment-dialog/enrollment-dialog.component';

/** A4: one student. Edit the profile and manage the enrollments. */
@Component({
  selector: 'app-student-detail',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './student-detail.component.html',
  styleUrls: ['./student-detail.component.scss'],
})
export class StudentDetailComponent implements OnInit {
  readonly badge = ENROLLMENT_BADGE;
  readonly statusLabel = Object.fromEntries(
    ENROLLMENT_STATUSES.map((status) => [status.value, status.label]),
  ) as Record<EnrollmentStatus, string>;

  student: StudentProfile | null = null;
  enrollments: StudentEnrollment[] = [];
  loading = true;
  error = '';

  form: FormGroup;
  formErrors: string[] = [];
  saving = false;

  /** The enrollment dialog: open to enrol, or to edit `editingEnrollment`. */
  showEnrollment = false;
  editingEnrollment: StudentEnrollment | null = null;

  private readonly publicId: string;
  private readonly enrolAtOnce: boolean;

  constructor(
    route: ActivatedRoute,
    fb: FormBuilder,
    private students: StudentsService,
    private toast: ToastService,
    private auth: AuthService,
  ) {
    this.publicId = route.snapshot.paramMap.get('id') ?? '';
    // Coming from "Add student": open the enrol dialog straight away (if the user may enrol).
    this.enrolAtOnce =
      route.snapshot.queryParamMap.get('enrol') === '1' &&
      auth.isAuthorizedNow({ permissions: [AppPermission.ENROLLMENTS_MANAGE] });

    this.form = fb.nonNullable.group({
      first_name: ['', [Validators.required]],
      last_name: ['', [Validators.required]],
      date_of_birth: [''],
      phone: [''],
      address: [''],
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.students
      .get(this.publicId)
      .pipe(
        tap((student) => {
          this.student = student;
          this.form.reset({
            first_name: student.first_name,
            last_name: student.last_name,
            date_of_birth: student.date_of_birth ?? '',
            phone: student.phone,
            address: student.address,
          });
          // A head of department only looks: the boxes cannot be edited.
          if (!this.canManage) this.form.disable({ emitEvent: false });
        }),
        switchMap((student) => this.students.enrollments({ student: student.id, page_size: 100 })),
      )
      .subscribe({
        next: (page) => {
          this.enrollments = page.results;
          this.loading = false;

          if (this.enrolAtOnce && this.enrollments.length === 0) this.openEnrol();
        },
        error: (error: GlobalException) => {
          this.loading = false;
          this.error = error.isNotFound ? 'This student does not exist.' : error.message;
        },
      });
  }

  /** Administrators edit the profile; a head of department only looks. */
  get canManage(): boolean {
    return this.auth.isAuthorizedNow({ permissions: [AppPermission.STUDENTS_MANAGE] });
  }

  /** Administrators enrol the student and edit their enrollments. */
  get canEnrol(): boolean {
    return this.auth.isAuthorizedNow({ permissions: [AppPermission.ENROLLMENTS_MANAGE] });
  }

  /** The enrollments alone, after one was added or changed. */
  reloadEnrollments(): void {
    if (!this.student) return;

    this.students
      .enrollments({ student: this.student.id, page_size: 100 })
      .subscribe((page) => (this.enrollments = page.results));
  }

  saveProfile(): void {
    if (!this.student || this.saving) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.saving = true;
    this.formErrors = [];

    this.students
      .update(this.student.public_id, {
        first_name: value.first_name.trim(),
        last_name: value.last_name.trim(),
        date_of_birth: value.date_of_birth || null,
        phone: value.phone.trim(),
        address: value.address.trim(),
      })
      .subscribe({
        next: (student) => {
          this.saving = false;
          this.student = student;
          this.form.markAsPristine();
          this.toast.success('Student updated');
        },
        error: (error: GlobalException) => {
          this.saving = false;
          this.formErrors = applyServerErrors(this.form, error);
        },
      });
  }

  openEnrol(): void {
    this.editingEnrollment = null;
    this.showEnrollment = true;
  }

  openEdit(enrollment: StudentEnrollment): void {
    this.editingEnrollment = enrollment;
    this.showEnrollment = true;
  }

  closeEnrollment(): void {
    this.showEnrollment = false;
    this.editingEnrollment = null;
  }

  enrollmentSaved(): void {
    this.closeEnrollment();
    this.reloadEnrollments();
  }
}
