import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { HOME_ROUTE } from 'src/app/auth/enums';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ToastService } from 'src/app/core/services';
import { applyServerErrors } from 'src/app/shared/utils';

/** The two new-password boxes must say the same. Checked in the browser only: the API has no such field. */
function sameAsNewPassword(control: AbstractControl): ValidationErrors | null {
  const other = control.parent?.get('new_password')?.value;
  return control.value && control.value !== other
    ? { differs: 'The two new passwords are not the same.' }
    : null;
}

/**
 * C4: the signed-in user changes their own password.
 *
 * Also the page a new student or teacher is sent to at the first sign-in: they must replace the
 * password an administrator gave them before they can use anything else. In that case there is no
 * way out of the page, and after saving the user goes to their home page.
 */
@Component({
  selector: 'app-change-password',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.scss'],
})
export class ChangePasswordComponent {
  readonly rules = [
    'At least 8 characters.',
    'Not a very common password, and not only digits.',
    'Not too similar to your username or name.',
    'No space at the start or the end.',
    'Different from your current password.',
  ];

  /** The user was given this password by an administrator and has to choose their own. */
  readonly forced: boolean;
  readonly home: string;

  form: FormGroup;
  formErrors: string[] = [];
  saving = false;
  showPasswords = false;

  constructor(
    fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private toast: ToastService,
  ) {
    this.forced = !!auth.user?.must_change_password;
    this.home = auth.userType ? HOME_ROUTE[auth.userType] : '/';

    this.form = fb.nonNullable.group({
      old_password: ['', [Validators.required]],
      new_password: ['', [Validators.required]],
      confirm: ['', [Validators.required, sameAsNewPassword]],
    });

    // The confirmation is checked again whenever the new password changes.
    this.form.controls['new_password'].valueChanges.subscribe(() =>
      this.form.controls['confirm'].updateValueAndValidity({ emitEvent: false }),
    );
  }

  togglePasswords(): void {
    this.showPasswords = !this.showPasswords;
  }

  save(): void {
    if (this.saving) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { old_password, new_password } = this.form.getRawValue();

    this.saving = true;
    this.formErrors = [];

    // Never trimmed: the server decides if spaces around a password are allowed.
    this.auth.changePassword({ old_password, new_password }).subscribe({
      next: () => {
        this.saving = false;
        this.form.reset({ old_password: '', new_password: '', confirm: '' });

        if (this.forced) {
          this.toast.success('Password changed', 'You can use the app now.');
          void this.router.navigateByUrl(this.home);
        } else {
          this.toast.success('Password changed', 'Your other devices have been signed out.');
        }
      },
      error: (error: GlobalException) => {
        this.saving = false;
        this.formErrors = applyServerErrors(this.form, error);
      },
    });
  }
}
