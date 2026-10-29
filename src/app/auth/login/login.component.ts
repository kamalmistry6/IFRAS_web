import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { GlobalException } from 'src/app/core/exceptions';
import { ToastService } from 'src/app/core/services';
import { applyServerErrors } from 'src/app/shared/utils';
import { HOME_ROUTE } from '../enums';
import { LOGOUT_MESSAGES, LogoutReason } from '../models';
import { AuthService } from '../services';

@Component({
  selector: 'app-login',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  readonly appName = environment.appName;

  form!: FormGroup;
  loading = false;
  showPassword = false;
  showForgotHint = false;

  /** Problems that belong to no field, e.g. "Wrong username or password". */
  formErrors: string[] = [];

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
      remember: [false],
    });

    this.showReason();
  }

  submit(): void {
    if (this.loading) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { username, password, remember } = this.form.getRawValue();

    this.loading = true;
    this.formErrors = [];

    this.auth.login({ username: username.trim(), password }, remember).subscribe({
      next: () => {
        this.toast.success('Signed in successfully');
        this.router.navigateByUrl(this.destination());
      },
      error: (error: GlobalException) => {
        this.loading = false;
        this.formErrors = this.errorMessages(error);
      },
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * There is no self-service password reset (it needs email). An administrator
   * resets the password, so the link explains that instead of opening a page.
   */
  toggleForgotHint(): void {
    this.showForgotHint = !this.showForgotHint;
  }

  /** The login call answers 401 for a wrong password and for a deleted or inactive account alike. */
  private errorMessages(error: GlobalException): string[] {
    if (error.isUnauthorized) return ['Wrong username or password.'];
    if (error.isNetworkError || error.isServerError) return [error.message];
    return applyServerErrors(this.form, error);
  }

  private showReason(): void {
    const reason = this.route.snapshot.queryParamMap.get('reason') as LogoutReason | null;
    if (!reason || !(reason in LOGOUT_MESSAGES)) return;

    // Why the user is here (signed out, session expired, password changed ...).
    if (reason === 'signed_out') this.toast.info(LOGOUT_MESSAGES[reason]);
    else this.toast.warning(LOGOUT_MESSAGES[reason]);
  }

  /**
   * Where to go after signing in: the page the user wanted (?returnUrl=), or
   * their own home page. Only addresses inside the app are accepted, so a
   * crafted link cannot send someone to another website.
   */
  private destination(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const safe =
      returnUrl &&
      returnUrl.startsWith('/') &&
      !returnUrl.startsWith('//') &&
      !returnUrl.startsWith('/login');

    if (safe) return returnUrl;

    const userType = this.auth.userType;
    return userType ? HOME_ROUTE[userType] : '/';
  }
}
