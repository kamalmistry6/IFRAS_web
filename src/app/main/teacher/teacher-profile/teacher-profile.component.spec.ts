import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TeacherProfile } from 'src/app/api/models';
import { TeachersService } from 'src/app/api/services';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ToastService } from 'src/app/core/services';
import { TeacherModule } from '../teacher.module';
import { TeacherProfileComponent } from './teacher-profile.component';

const profile = (overrides: Partial<TeacherProfile> = {}): TeacherProfile =>
  ({
    id: 3,
    public_id: 't-3',
    username: 'teacher_001',
    first_name: 'Amit',
    last_name: 'Patil',
    full_name: 'Amit Patil',
    email: 'amit@example.com',
    college: 1,
    department: null,
    department_name: '',
    is_head: false,
    employee_id: 'EMP001',
    phone: '9876543210',
    date_of_joining: '2020-06-15',
    is_active: true,
    ...overrides,
  }) as TeacherProfile;

describe('TeacherProfileComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let auth: { user: object; updateCurrentUser: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn> };

  function create(data = profile()) {
    api = {
      me: vi.fn().mockReturnValue(of(data)),
      updateMe: vi
        .fn()
        .mockReturnValue(of(profile({ first_name: 'Amit K', full_name: 'Amit K Patil' }))),
    };
    auth = { user: { college: { name: 'College A' } }, updateCurrentUser: vi.fn() };
    toast = { success: vi.fn() };
    TestBed.configureTestingModule({
      imports: [TeacherModule],
      providers: [
        provideRouter([]),
        { provide: TeachersService, useValue: api },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
      ],
    });
    const fixture = TestBed.createComponent(TeacherProfileComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  it('loads the teacher and shows every detail', () => {
    const { element } = create();
    const text = element.textContent ?? '';

    expect(api['me']).toHaveBeenCalled();
    expect(text).toContain('Amit Patil');
    expect(text).toContain('teacher_001');
    expect(text).toContain('College A');
    expect(text).toContain('EMP001');
    expect(text).toContain('amit@example.com');
    expect(text).toContain('9876543210');
    expect(text).toContain('15 June 2020');
    expect(text).toContain('Active');
  });

  it('shows a dash for anything missing and an inactive status', () => {
    const { element } = create(
      profile({ email: '', phone: '', date_of_joining: null, is_active: false }),
    );
    const values = [...element.querySelectorAll('dd')].map((dd) => dd.textContent?.trim());

    expect(values).toContain('Inactive');
    expect(values.filter((value) => value === '-').length).toBe(4);
  });

  it('shows the department, and says so when the teacher is its head', () => {
    const plain = create(profile({ department: 7, department_name: 'Information Technology' }));

    expect(plain.element.textContent).toContain('Information Technology');
    expect(plain.element.textContent).not.toContain('Head of department');
  });

  it('shows the Head of department badge for the head', () => {
    const { element } = create(
      profile({ department: 7, department_name: 'Information Technology', is_head: true }),
    );

    expect(element.textContent).toContain('Head of department');
  });

  it('puts the saved name in the two boxes, and only those can be edited', () => {
    const { component, element } = create();

    expect(component.form.value).toEqual({ first_name: 'Amit', last_name: 'Patil' });
    expect(element.querySelectorAll('input[type="text"]').length).toBe(2);
    expect(element.textContent).toContain('ask your college administrator');
  });

  it('keeps Save off until the name is changed', () => {
    const { component, fixture, element } = create();
    const save = () => element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(save().disabled).toBe(true);

    component.form.patchValue({ first_name: 'Amit K' });
    fixture.detectChanges();
    expect(save().disabled).toBe(false);

    component.form.patchValue({ first_name: 'Amit' });
    fixture.detectChanges();
    expect(save().disabled).toBe(true);
  });

  it('saves the trimmed name, updates the top bar and tells the teacher', () => {
    const { component } = create();
    component.form.patchValue({ first_name: ' Amit K ', last_name: ' Patil ' });

    component.save();

    expect(api['updateMe']).toHaveBeenCalledWith({ first_name: 'Amit K', last_name: 'Patil' });
    expect(auth.updateCurrentUser).toHaveBeenCalledWith({
      first_name: 'Amit K',
      last_name: 'Patil',
    });
    expect(toast.success).toHaveBeenCalledWith('Name updated');
    expect(component.form.value).toEqual({ first_name: 'Amit K', last_name: 'Patil' });
    expect(component.changed).toBe(false);
  });

  it('needs a first and a last name', () => {
    const { component } = create();
    component.form.patchValue({ first_name: '', last_name: '   ' });

    component.save();

    expect(api['updateMe']).not.toHaveBeenCalled();
    expect(component.form.controls['first_name'].errors).toEqual({ required: true });
  });

  it('puts a server message under its box and keeps the teacher on the page', () => {
    const { component, fixture, element } = create();
    api['updateMe'].mockReturnValue(
      throwError(
        () =>
          new GlobalException({
            status: 400,
            message: 'x',
            fieldErrors: { first_name: ['This field may not be blank.'] },
          }),
      ),
    );
    component.form.patchValue({ first_name: 'Amit K' });

    component.save();
    fixture.detectChanges();

    expect(element.textContent).toContain('This field may not be blank.');
    expect(auth.updateCurrentUser).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(component.saving).toBe(false);
  });

  it('does not save twice at once', () => {
    const { component } = create();
    component.form.patchValue({ first_name: 'Amit K' });
    component.saving = true;

    component.save();

    expect(api['updateMe']).not.toHaveBeenCalled();
  });

  it('links to the password page', () => {
    const { element } = create();

    expect(element.querySelector('.page-banner a')?.getAttribute('href')).toBe('/account/password');
  });

  it('shows a failure to load, with a retry button', () => {
    const { component, fixture, element } = create();
    api['me'].mockReturnValue(
      throwError(() => new GlobalException({ status: 500, message: 'Server error.' })),
    );
    component.load();
    fixture.detectChanges();
    expect(element.querySelector('.alert-danger')?.textContent).toContain('Server error.');

    api['me'].mockReturnValue(of(profile()));
    element.querySelector<HTMLButtonElement>('.alert-danger button')!.click();
    fixture.detectChanges();

    expect(element.querySelector('.alert-danger')).toBeNull();
  });
});
