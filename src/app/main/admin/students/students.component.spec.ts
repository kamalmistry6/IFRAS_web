import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Program, StudentProfile } from 'src/app/api/models';
import { DirectoryService, StudentsService } from 'src/app/api/services';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ToastService } from 'src/app/core/services';
import { AdminModule } from '../admin.module';
import { StudentsComponent } from './students.component';

const student = (overrides: Partial<StudentProfile> = {}): StudentProfile =>
  ({
    id: 12,
    public_id: 's-12',
    username: 'rahul',
    first_name: 'Rahul',
    last_name: 'Sharma',
    full_name: 'Rahul Sharma',
    phone: '98470 11223',
    date_of_birth: '2006-03-12',
    ...overrides,
  }) as StudentProfile;

const programs = [
  { id: 7, name: 'BSc Computer Science', duration_years: 3 },
  { id: 8, name: 'BSc Nursing', duration_years: 4 },
  { id: 9, name: 'MSc', duration_years: 2 },
] as Program[];

const page = <T>(results: T[], count = results.length) => ({
  count,
  next: null,
  previous: null,
  results,
});

describe('StudentsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let directory: Record<string, ReturnType<typeof vi.fn>>;
  let toast: { success: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;

  function create(
    rows: StudentProfile[] = [student()],
    count?: number,
    college: object | null = { id: 1 },
    canManage = true,
  ) {
    api = {
      list: vi.fn().mockReturnValue(of(page(rows, count))),
      create: vi.fn().mockReturnValue(of(student({ id: 30, public_id: 's-30' }))),
    };
    directory = {
      academicYears: vi.fn().mockReturnValue(of(page([{ id: 2, name: '2026-2027' }]))),
      programs: vi.fn().mockReturnValue(of(page(programs))),
      colleges: vi.fn().mockReturnValue(of(page([{ id: 5, name: 'College Five' }]))),
    };
    toast = { success: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AdminModule],
      providers: [
        provideRouter([]),
        { provide: StudentsService, useValue: api },
        { provide: DirectoryService, useValue: directory },
        { provide: ToastService, useValue: toast },
        {
          provide: AuthService,
          useValue: { user: { college }, isAuthorizedNow: () => canManage },
        },
      ],
    });

    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as never;
    const fixture = TestBed.createComponent(StudentsComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  afterEach(() => vi.useRealTimers());

  it('lists the students', () => {
    const { element } = create();

    expect(api['list']).toHaveBeenCalledWith({
      page: 1,
      search: '',
      academic_year: '',
      program: '',
      year_of_study: '',
      enrollment_status: '',
    });
    expect(element.querySelector('tbody')?.textContent).toContain('Rahul Sharma');
    expect(element.querySelector('tbody')?.textContent).toContain('rahul');
  });

  it('opens the student when a row is clicked', () => {
    const { element } = create();

    element.querySelector<HTMLElement>('tbody tr')!.click();

    expect(navigate).toHaveBeenCalledWith(['/admin/students', 's-12']);
  });

  it('sends every filter with its server name, from page 1', () => {
    const { component } = create();
    component.page = 3;
    api['list'].mockClear();

    component.filters.patchValue({ year: '2', program: '7', yearOfStudy: '2', status: 'ACTIVE' });

    expect(api['list']).toHaveBeenLastCalledWith({
      page: 1,
      search: '',
      academic_year: '2',
      program: '7',
      year_of_study: '2',
      enrollment_status: 'ACTIVE',
    });
  });

  it('waits for a pause in typing before it searches', () => {
    vi.useFakeTimers();
    const { component } = create();
    api['list'].mockClear();

    component.filters.patchValue({ search: 'ra' });
    component.filters.patchValue({ search: ' rahul sharma ' });
    expect(api['list']).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(api['list']).toHaveBeenCalledTimes(1);
    expect(api['list']).toHaveBeenCalledWith(expect.objectContaining({ search: 'rahul sharma' }));
  });

  it('offers years of study up to the chosen program, or the longest one', () => {
    const { component } = create();

    expect(component.yearOptions).toEqual([1, 2, 3, 4]);

    component.filters.patchValue({ program: '9' });
    expect(component.yearOptions).toEqual([1, 2]);
  });

  it('pages through the results and explains an empty list', () => {
    const { component, element, fixture } = create([student()], 45);
    expect(element.querySelector('.pager')?.textContent).toContain('Showing 1-20 of 45');

    api['list'].mockClear();
    component.goTo(2);
    expect(api['list']).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));

    api['list'].mockReturnValue(of(page([], 0)));
    component.retry();
    fixture.detectChanges();
    expect(element.querySelector('.empty-state')?.textContent).toContain('Add your first student');
  });

  it('shows the error and a retry button', () => {
    const { component, element, fixture } = create();
    api['list'].mockReturnValue(
      throwError(() => new GlobalException({ status: 400, message: 'Enter a valid year.' })),
    );

    component.retry();
    fixture.detectChanges();

    expect(element.querySelector('.alert')?.textContent).toContain('Enter a valid year.');
  });

  describe('adding a student', () => {
    const fill = (component: StudentsComponent) =>
      component.form.patchValue({
        first_name: ' Riya ',
        last_name: 'Shah',
        username: ' riya_shah ',
        password: ' Secret#123 ',
        email: 'riya@college.edu',
        phone: ' 99999 00000 ',
        date_of_birth: '2007-01-05',
        address: ' Kochi ',
      });

    it('needs the required fields and a password of at least 8 characters', () => {
      const { component } = create();
      component.openAdd();
      component.form.patchValue({ first_name: 'Riya', password: 'short' });

      component.save();

      expect(api['create']).not.toHaveBeenCalled();
    });

    it('creates the student, with the password untouched, and opens their page ready to enrol', () => {
      const { component } = create();
      component.openAdd();
      fill(component);

      component.save();

      expect(api['create']).toHaveBeenCalledWith({
        username: 'riya_shah',
        password: ' Secret#123 ',
        first_name: 'Riya',
        last_name: 'Shah',
        email: 'riya@college.edu',
        roll_number: '',
        college: 1,
        date_of_birth: '2007-01-05',
        phone: '99999 00000',
        address: 'Kochi',
      });
      expect(toast.success).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/admin/students', 's-30'], {
        queryParams: { enrol: 1 },
      });
      expect(component.showForm).toBe(false);
    });

    it('sends the roll number when one is given', () => {
      const { component } = create();
      component.openAdd();
      fill(component);
      component.form.patchValue({ roll_number: ' 78001 ' });

      component.save();

      expect(api['create']).toHaveBeenCalledWith(expect.objectContaining({ roll_number: '78001' }));
    });

    it('lets a platform administrator choose the college', () => {
      const { component, element, fixture } = create([student()], undefined, null);

      component.openAdd();
      fixture.detectChanges();
      expect(directory['colleges']).toHaveBeenCalled();
      expect(element.querySelector('#s-college')).not.toBeNull();

      fill(component);
      component.save();
      expect(api['create']).not.toHaveBeenCalled();

      component.form.patchValue({ college: 5 });
      component.save();
      expect(api['create']).toHaveBeenCalledWith(expect.objectContaining({ college: 5 }));
    });

    it('puts a server message under its field', () => {
      const { component } = create();
      api['create'].mockReturnValue(
        throwError(
          () =>
            new GlobalException({
              status: 400,
              message: 'x',
              fieldErrors: { password: ['This password is too common.'] },
            }),
        ),
      );
      component.openAdd();
      fill(component);

      component.save();

      expect(component.form.controls['password'].errors).toEqual({
        server: 'This password is too common.',
      });
      expect(component.showForm).toBe(true);
      expect(navigate).not.toHaveBeenCalled();
    });
  });
  describe('for a head of department, who only looks', () => {
    it('does not offer to add or import students', () => {
      const { element, component } = create([student()], undefined, null, false);

      expect(component.canManage).toBe(false);
      const buttons = [...element.querySelectorAll('.page-banner button')];
      expect(buttons.length).toBe(0);
      expect(element.querySelector('.page-banner')?.textContent).toContain(
        'enrolled in your department',
      );
    });

    it('still lists the students and opens one', () => {
      const { element } = create([student()], undefined, null, false);

      element.querySelector<HTMLElement>('tbody tr')!.click();

      expect(element.querySelector('tbody')?.textContent).toContain('Rahul Sharma');
      expect(navigate).toHaveBeenCalledWith(['/admin/students', 's-12']);
    });

    it('explains an empty list without an add button', () => {
      const { element } = create([], 0, null, false);

      expect(element.textContent).toContain('enrolled in a program of your department');
      expect(element.querySelector('.empty-state button')).toBeNull();
    });
  });

  describe('importing students', () => {
    it('opens the import dialog from the banner and closes it again', () => {
      const { component, element, fixture } = create();
      expect(element.querySelector('app-student-import-dialog')).toBeNull();

      [...element.querySelectorAll<HTMLButtonElement>('.page-banner button')]
        .find((button) => button.textContent?.includes('Import students'))!
        .click();
      fixture.detectChanges();

      expect(component.showImport).toBe(true);
      expect(element.querySelector('app-student-import-dialog')).not.toBeNull();
      expect(directory['colleges']).not.toHaveBeenCalled();

      component.showImport = false;
      fixture.detectChanges();
      expect(element.querySelector('app-student-import-dialog')).toBeNull();
    });

    it('loads the colleges for a platform administrator', () => {
      const { component } = create([student()], undefined, null);

      component.openImport();

      expect(directory['colleges']).toHaveBeenCalled();
      expect(component.colleges.map((college) => college.name)).toEqual(['College Five']);
    });

    it('shows the first page again after students were created', () => {
      const { component } = create();
      component.page = 3;
      api['list'].mockClear();

      component.onImported();

      expect(component.page).toBe(1);
      expect(api['list']).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });
  });
});
