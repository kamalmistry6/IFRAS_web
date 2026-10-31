import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { UserType } from 'src/app/auth/enums';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ToastService } from 'src/app/core/services';
import { AccountModule } from '../account.module';
import { ChangePasswordComponent } from './change-password.component';

describe('ChangePasswordComponent', () => {
  let auth: { user: object; userType: UserType; changePassword: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;

  function create(mustChange = false) {
    auth = {
      user: { must_change_password: mustChange },
      userType: UserType.STUDENT,
      changePassword: vi.fn().mockReturnValue(of(undefined)),
    };
    toast = { success: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AccountModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true) as never;
    const fixture = TestBed.createComponent(ChangePasswordComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  const fill = (
    component: ChangePasswordComponent,
    values = { old_password: '78001', new_password: 'Tn4#kP8!wQz2', confirm: 'Tn4#kP8!wQz2' },
  ) => component.form.patchValue(values);

  it('shows the rules before anything is typed', () => {
    const { element } = create();

    expect(element.querySelector('.rules')?.textContent).toContain('At least 8 characters');
    expect(element.querySelector('.rules')?.textContent).toContain('No space at the start');
  });

  it('needs all three boxes', () => {
    const { component } = create();

    component.save();

    expect(auth.changePassword).not.toHaveBeenCalled();
    expect(component.form.controls['old_password'].errors).toEqual({ required: true });
    expect(component.form.controls['new_password'].errors).toEqual({ required: true });
    expect(component.form.controls['confirm'].errors).toEqual({ required: true });
  });

  it('refuses a confirmation that differs, and checks it again when the new password changes', () => {
    const { component } = create();
    fill(component, { old_password: 'a', new_password: 'Tn4#kP8!wQz2', confirm: 'Tn4#kP8!wQz' });

    component.save();

    expect(auth.changePassword).not.toHaveBeenCalled();
    expect(component.form.controls['confirm'].errors).toEqual({
      differs: 'The two new passwords are not the same.',
    });

    component.form.patchValue({ new_password: 'Tn4#kP8!wQz' });
    expect(component.form.controls['confirm'].valid).toBe(true);
  });

  it('sends the passwords exactly as typed, without the confirmation', () => {
    const { component } = create();
    fill(component, { old_password: ' old ', new_password: ' New#Pass9 ', confirm: ' New#Pass9 ' });

    component.save();

    expect(auth.changePassword).toHaveBeenCalledWith({
      old_password: ' old ',
      new_password: ' New#Pass9 ',
    });
  });

  it('puts the server messages next to their boxes', () => {
    const { component, fixture, element } = create();
    auth.changePassword.mockReturnValue(
      throwError(
        () =>
          new GlobalException({
            status: 400,
            message: 'x',
            fieldErrors: {
              old_password: ['The current password is incorrect.'],
              new_password: ['This password is too common.', 'This password is entirely numeric.'],
            },
          }),
      ),
    );
    fill(component);

    component.save();
    fixture.detectChanges();

    const text = element.textContent ?? '';
    expect(text).toContain('The current password is incorrect.');
    expect(text).toContain('This password is too common. This password is entirely numeric.');
    expect(component.saving).toBe(false);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('does not send twice while it is saving', () => {
    const { component } = create();
    fill(component);
    component.saving = true;

    component.save();

    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it('shows or hides what is typed', () => {
    const { component, fixture, element } = create();
    const box = () => element.querySelector<HTMLInputElement>('#new-password')!;
    expect(box().type).toBe('password');

    component.togglePasswords();
    fixture.detectChanges();

    expect(box().type).toBe('text');
  });

  describe('when the user chose to change it', () => {
    it('stays on the page, clears the boxes and offers a way back', () => {
      const { component, element } = create(false);
      expect(component.forced).toBe(false);
      expect(element.querySelector('.alert-warning')).toBeNull();
      expect(element.querySelector('.actions a')?.textContent).toContain('Cancel');
      fill(component);

      component.save();

      expect(toast.success).toHaveBeenCalledWith(
        'Password changed',
        'Your other devices have been signed out.',
      );
      expect(navigate).not.toHaveBeenCalled();
      expect(component.form.value).toEqual({ old_password: '', new_password: '', confirm: '' });
    });
  });

  describe('at the first sign-in', () => {
    it('explains why, and gives no way out of the page', () => {
      const { component, element } = create(true);

      expect(component.forced).toBe(true);
      expect(element.querySelector('.alert-warning')?.textContent).toContain(
        'password you were given',
      );
      expect(element.querySelector('.actions a')).toBeNull();
    });

    it('goes to the home page after the password was changed', () => {
      const { component } = create(true);
      fill(component);

      component.save();

      expect(toast.success).toHaveBeenCalledWith('Password changed', 'You can use the app now.');
      expect(navigate).toHaveBeenCalledWith('/student/attendance');
    });

    it('stays when the change is refused', () => {
      const { component } = create(true);
      auth.changePassword.mockReturnValue(
        throwError(() => new GlobalException({ status: 400, message: 'No.' })),
      );
      fill(component);

      component.save();

      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
