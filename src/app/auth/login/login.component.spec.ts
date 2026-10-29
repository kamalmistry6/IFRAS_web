import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { GlobalException } from 'src/app/core/exceptions';
import { ToastService } from 'src/app/core/services';
import { UserType } from '../enums';
import { CurrentUser } from '../models';
import { AuthService } from '../services';
import { LoginComponent } from './login.component';
import { LoginModule } from './login.module';

const teacher = { username: 'teacher_001' } as CurrentUser;

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let element: HTMLElement;
  let toast: {
    info: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
    success: ReturnType<typeof vi.fn>;
  };
  let navigate: ReturnType<typeof vi.fn>;
  let auth: { login: ReturnType<typeof vi.fn>; userType: UserType | null };

  function create(
    query: Record<string, string> = {},
    userType: UserType | null = UserType.TEACHER,
  ) {
    toast = { info: vi.fn(), warning: vi.fn(), success: vi.fn() };
    auth = { login: vi.fn().mockReturnValue(of(teacher)), userType };

    // Module-based components are tested through their module, which is what
    // declares them and gives them the shared components their template uses.
    TestBed.configureTestingModule({
      imports: [LoginModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    });

    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true) as never;
    fixture = TestBed.createComponent(LoginComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  }

  const field = (id: string) => element.querySelector<HTMLInputElement>(`#${id}`)!;

  function type(id: string, value: string): void {
    const input = field(id);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function signIn(username = 'teacher_001', password = 'secret'): void {
    type('username', username);
    type('password', password);
    submit();
  }

  it('asks for a username and a password before it calls the server', () => {
    create();

    submit();

    expect(auth.login).not.toHaveBeenCalled();
    expect(element.textContent).toContain('This field is required.');
  });

  it("signs in and goes to the user's own home page", () => {
    create();

    signIn();

    expect(auth.login).toHaveBeenCalledWith({ username: 'teacher_001', password: 'secret' }, false);
    expect(navigate).toHaveBeenCalledWith('/teacher/today');
    expect(toast.success).toHaveBeenCalledWith('Signed in successfully');
  });

  it.each([
    [UserType.ADMIN, '/admin/dashboard'],
    [UserType.SUPER_ADMIN, '/admin/dashboard'],
    [UserType.STUDENT, '/student/attendance'],
  ])('sends a %s to %s', (userType, home) => {
    create({}, userType);

    signIn();

    expect(navigate).toHaveBeenCalledWith(home);
  });

  it('trims spaces around the username but never touches the password', () => {
    create();

    signIn('  teacher_001  ', ' pass word ');

    expect(auth.login).toHaveBeenCalledWith(
      { username: 'teacher_001', password: ' pass word ' },
      false,
    );
  });

  it('remembers the user when "Keep me signed in" is ticked', () => {
    create();
    const checkbox = element.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    checkbox.click();

    signIn();

    expect(auth.login).toHaveBeenCalledWith(expect.anything(), true);
  });

  describe('returning to the page the user wanted', () => {
    it('follows an address inside the app', () => {
      create({ returnUrl: '/teacher/sessions' });

      signIn();

      expect(navigate).toHaveBeenCalledWith('/teacher/sessions');
    });

    it.each([
      ['another website', 'https://evil.example/steal'],
      ['a protocol-relative address', '//evil.example'],
      ['the login page itself', '/login'],
    ])('ignores %s and goes home instead', (_name, returnUrl) => {
      create({ returnUrl });

      signIn();

      expect(navigate).toHaveBeenCalledWith('/teacher/today');
    });
  });

  describe('when signing in fails', () => {
    const failWith = (exception: GlobalException) =>
      auth.login.mockReturnValue(throwError(() => exception) as Observable<never>);

    it('says "Wrong username or password" for a 401', () => {
      create();
      failWith(
        new GlobalException({
          status: 401,
          message: 'No active account found with the given credentials',
        }),
      );

      signIn();

      expect(element.textContent).toContain('Wrong username or password.');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('can be tried again after a failure', () => {
      create();
      failWith(new GlobalException({ status: 401, message: 'x' }));
      signIn();

      auth.login.mockReturnValue(of(teacher));
      submit();

      expect(navigate).toHaveBeenCalledWith('/teacher/today');
    });

    it("shows the server's own message when the server cannot be reached", () => {
      create();
      failWith(
        new GlobalException({
          status: 0,
          message: 'Cannot reach the server. Check your connection and try again.',
        }),
      );

      signIn();

      expect(element.textContent).toContain('Cannot reach the server.');
    });

    it('puts a field error from the API under that field', () => {
      create();
      failWith(
        new GlobalException({
          status: 400,
          message: 'x',
          fieldErrors: { username: ['This field may not be blank.'] },
        }),
      );

      signIn();

      expect(element.textContent).toContain('This field may not be blank.');
    });
  });

  describe('why the user is here', () => {
    it.each([
      ['expired', 'warning', 'Your session has expired. Please sign in again.'],
      ['deleted', 'warning', 'Your account is no longer active.'],
      ['password_changed', 'warning', 'Your password was changed. Please sign in again.'],
      ['signed_out', 'info', 'You have been signed out.'],
    ] as const)('explains "%s" with a toast', (reason, kind, text) => {
      create({ reason });

      expect(toast[kind]).toHaveBeenCalledWith(text);
    });

    it('ignores a reason it does not know', () => {
      create({ reason: '<script>alert(1)</script>' });

      expect(toast.info).not.toHaveBeenCalled();
      expect(toast.warning).not.toHaveBeenCalled();
    });
  });

  it('shows a hint instead of a reset flow when "Forgot password?" is pressed', () => {
    create();
    expect(element.textContent).not.toContain('administrator');

    element.querySelector<HTMLButtonElement>('button.link')!.click();
    fixture.detectChanges();

    expect(element.querySelector('.alert')?.textContent).toContain('administrator');
  });

  it('can show and hide the password', () => {
    create();
    expect(field('password').type).toBe('password');

    element.querySelector<HTMLButtonElement>('.toggle')!.click();
    fixture.detectChanges();

    expect(field('password').type).toBe('text');
  });
});
