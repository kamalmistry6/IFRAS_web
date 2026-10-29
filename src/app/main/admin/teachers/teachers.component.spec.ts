import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TeacherProfile } from 'src/app/api/models';
import { DirectoryService, TeachersService } from 'src/app/api/services';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ToastService } from 'src/app/core/services';
import { AdminModule } from '../admin.module';
import { TeachersComponent } from './teachers.component';

const teacher = (overrides: Partial<TeacherProfile> = {}): TeacherProfile =>
  ({
    id: 1,
    public_id: 't-1',
    username: 'teacher_001',
    first_name: 'Amit',
    last_name: 'Patil',
    full_name: 'Amit Patil',
    email: 'amit@college.edu',
    college: 1,
    employee_id: 'EMP001',
    phone: '98470 11223',
    date_of_joining: '2024-06-10',
    is_active: true,
    ...overrides,
  }) as TeacherProfile;

const page = <T>(results: T[], count = results.length) => ({
  count,
  next: null,
  previous: null,
  results,
});

describe('TeachersComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let directory: Record<string, ReturnType<typeof vi.fn>>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function create(
    rows: TeacherProfile[] = [teacher()],
    count?: number,
    college: object | null = { id: 1 },
  ) {
    api = {
      list: vi.fn().mockReturnValue(of(page(rows, count))),
      create: vi.fn().mockReturnValue(of(teacher())),
      update: vi.fn().mockReturnValue(of(teacher())),
    };
    directory = {
      colleges: vi.fn().mockReturnValue(of(page([{ id: 5, name: 'College Five' }]))),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AdminModule],
      providers: [
        provideRouter([]),
        { provide: TeachersService, useValue: api },
        { provide: DirectoryService, useValue: directory },
        { provide: ToastService, useValue: toast },
        { provide: AuthService, useValue: { user: { college } } },
      ],
    });

    const fixture = TestBed.createComponent(TeachersComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  afterEach(() => vi.useRealTimers());

  it('lists the teachers with their status', () => {
    const { element } = create([teacher(), teacher({ id: 2, public_id: 't-2', is_active: false })]);

    expect(api['list']).toHaveBeenCalledWith({ page: 1, search: '', is_active: undefined });
    const rows = element.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Amit Patil');
    expect(rows[0].textContent).toContain('EMP001');
    expect(rows[0].textContent).toContain('Active');
    expect(rows[1].textContent).toContain('Inactive');
  });

  it('filters by status at once and by search after a pause', () => {
    vi.useFakeTimers();
    const { component } = create();
    api['list'].mockClear();

    component.filters.patchValue({ status: 'inactive' });
    expect(api['list']).toHaveBeenLastCalledWith({ page: 1, search: '', is_active: false });

    component.filters.patchValue({ status: 'active' });
    expect(api['list']).toHaveBeenLastCalledWith({ page: 1, search: '', is_active: true });

    api['list'].mockClear();
    component.filters.patchValue({ search: ' pat' });
    component.filters.patchValue({ search: ' patil ' });
    expect(api['list']).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(api['list']).toHaveBeenCalledTimes(1);
    expect(api['list']).toHaveBeenCalledWith(expect.objectContaining({ search: 'patil' }));
  });

  it('pages through the results and explains an empty list', () => {
    const { component, element, fixture } = create([teacher()], 45);
    expect(element.querySelector('.pager')?.textContent).toContain('Showing 1-20 of 45');

    api['list'].mockClear();
    component.goTo(2);
    expect(api['list']).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));

    api['list'].mockReturnValue(of(page([], 0)));
    component.retry();
    fixture.detectChanges();
    expect(element.querySelector('.empty-state')?.textContent).toContain('Add your first teacher');
  });

  describe('adding a teacher', () => {
    const fill = (component: TeachersComponent) =>
      component.form.patchValue({
        first_name: ' Riya ',
        last_name: 'Shah',
        username: ' riya_shah ',
        password: ' Secret#123 ',
        email: 'riya@college.edu',
        employee_id: ' EMP009 ',
        phone: '99999 00000',
        date_of_joining: '2026-08-01',
      });

    it('opens an empty form for the college of the administrator', () => {
      const { component, element, fixture } = create();

      component.openAdd();
      fixture.detectChanges();

      expect(element.querySelector('.modal-backdrop .modal')).not.toBeNull();
      expect(component.form.value.is_active).toBe(true);
      expect(element.querySelector('#t-college')).toBeNull();
      expect(element.querySelector('#t-username')).not.toBeNull();
    });

    it('needs the required fields and a password of at least 8 characters', () => {
      const { component } = create();
      component.openAdd();
      component.form.patchValue({ first_name: 'Riya', password: 'short' });

      component.save();

      expect(api['create']).not.toHaveBeenCalled();
      expect(component.form.controls['password'].errors).toHaveProperty('minlength');
    });

    it('sends the details trimmed, but the password exactly as typed', () => {
      const { component } = create();
      component.openAdd();
      fill(component);
      api['list'].mockClear();

      component.save();

      expect(api['create']).toHaveBeenCalledWith({
        first_name: 'Riya',
        last_name: 'Shah',
        username: 'riya_shah',
        password: ' Secret#123 ',
        email: 'riya@college.edu',
        college: 1,
        employee_id: 'EMP009',
        phone: '99999 00000',
        date_of_joining: '2026-08-01',
        is_active: true,
      });
      expect(toast.success).toHaveBeenCalledWith('Teacher added');
      expect(component.showForm).toBe(false);
      expect(api['list']).toHaveBeenCalledTimes(1);
    });

    it('lets a platform administrator choose the college', () => {
      const { component, element, fixture } = create([teacher()], undefined, null);

      component.openAdd();
      fixture.detectChanges();

      expect(directory['colleges']).toHaveBeenCalled();
      expect(element.querySelector('#t-college')).not.toBeNull();

      fill(component);
      component.save();
      expect(api['create']).not.toHaveBeenCalled();

      component.form.patchValue({ college: 5 });
      component.save();
      expect(api['create']).toHaveBeenCalledWith(expect.objectContaining({ college: 5 }));
    });

    it('puts a server message under its field, for example a taken username', () => {
      const { component } = create();
      api['create'].mockReturnValue(
        throwError(
          () =>
            new GlobalException({
              status: 400,
              message: 'x',
              fieldErrors: { username: ['This username is already taken.'] },
            }),
        ),
      );
      component.openAdd();
      fill(component);

      component.save();

      expect(component.form.controls['username'].errors).toEqual({
        server: 'This username is already taken.',
      });
      expect(component.showForm).toBe(true);
      expect(component.saving).toBe(false);
    });
  });

  describe('editing a teacher', () => {
    it('fills the form and shows the username and email as fixed', () => {
      const { component, element, fixture } = create();

      component.openEdit(teacher());
      fixture.detectChanges();

      expect(component.form.getRawValue()).toMatchObject({
        first_name: 'Amit',
        employee_id: 'EMP001',
        date_of_joining: '2024-06-10',
      });
      expect(element.querySelector('.fixed')?.textContent).toContain('teacher_001');
      expect(element.querySelector('#t-username')).toBeNull();
      expect(element.querySelector('#t-password')).toBeNull();
    });

    it('opens when a row is clicked', () => {
      const { element, component } = create();

      element.querySelector<HTMLElement>('tbody tr')!.click();

      expect(component.editing?.public_id).toBe('t-1');
    });

    it('sends only the editable fields', () => {
      const { component } = create();
      component.openEdit(teacher());
      component.form.patchValue({ phone: '11111', is_active: false });

      component.save();

      expect(api['update']).toHaveBeenCalledWith('t-1', {
        first_name: 'Amit',
        last_name: 'Patil',
        employee_id: 'EMP001',
        phone: '11111',
        date_of_joining: '2024-06-10',
        is_active: false,
      });
      expect(toast.success).toHaveBeenCalledWith('Teacher updated');
    });

    it('sends no date of joining when it is cleared', () => {
      const { component } = create();
      component.openEdit(teacher());
      component.form.patchValue({ date_of_joining: '' });

      component.save();

      expect(api['update']).toHaveBeenCalledWith(
        't-1',
        expect.objectContaining({ date_of_joining: null }),
      );
    });
  });
});
