import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TeacherProfile } from 'src/app/api/models';
import { TeachersService } from 'src/app/api/services';
import { CollegeSummary } from 'src/app/auth/models';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ToastService } from 'src/app/core/services';
import { applyServerErrors } from 'src/app/shared/utils';

/**
 * T6: a teacher's own details. The name can be corrected here; everything else is set by an
 * administrator and shown as plain text.
 */
@Component({
  selector: 'app-teacher-profile',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './teacher-profile.component.html',
  styleUrls: ['./teacher-profile.component.scss'],
})
export class TeacherProfileComponent implements OnInit {
  profile: TeacherProfile | null = null;
  college: CollegeSummary | null = null;
  loading = false;
  error = '';

  form: FormGroup;
  formErrors: string[] = [];
  saving = false;

  constructor(
    fb: FormBuilder,
    private teachers: TeachersService,
    private auth: AuthService,
    private toast: ToastService,
  ) {
    this.form = fb.nonNullable.group({
      first_name: ['', [Validators.required, Validators.maxLength(150)]],
      last_name: ['', [Validators.required, Validators.maxLength(150)]],
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.college = this.auth.user?.college ?? null;
    this.loading = true;
    this.error = '';

    this.teachers.me().subscribe({
      next: (profile) => {
        this.profile = profile;
        this.loading = false;
        this.form.reset({ first_name: profile.first_name, last_name: profile.last_name });
      },
      error: (error: GlobalException) => {
        this.loading = false;
        this.error = error.message;
      },
    });
  }

  /** True once the boxes differ from what is saved. */
  get changed(): boolean {
    const { first_name, last_name } = this.form.getRawValue();
    return (
      !!this.profile &&
      (first_name.trim() !== this.profile.first_name || last_name.trim() !== this.profile.last_name)
    );
  }

  save(): void {
    if (this.saving) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { first_name, last_name } = this.form.getRawValue();

    this.saving = true;
    this.formErrors = [];

    this.teachers
      .updateMe({ first_name: first_name.trim(), last_name: last_name.trim() })
      .subscribe({
        next: (profile) => {
          this.saving = false;
          this.profile = profile;
          this.form.reset({ first_name: profile.first_name, last_name: profile.last_name });
          // The name in the top bar follows at once.
          this.auth.updateCurrentUser({
            first_name: profile.first_name,
            last_name: profile.last_name,
          });
          this.toast.success('Name updated');
        },
        error: (error: GlobalException) => {
          this.saving = false;
          this.formErrors = applyServerErrors(this.form, error);
        },
      });
  }
}
