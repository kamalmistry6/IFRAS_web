import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Program, StudentEnrollment } from 'src/app/api/models';
import { DirectoryService, StudentsService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ToastService } from 'src/app/core/services';
import { AdminModule } from '../admin.module';
import { EnrollmentsComponent } from './enrollments.component';

const enrollment = (overrides: Partial<StudentEnrollment> = {}): StudentEnrollment =>
  ({
    public_id: 'e-1',
    student: 12,
    student_public_id: 's-12',
    student_name: 'Rahul Sharma',
    academic_year: 2,
    academic_year_name: '2026-2027',
    program: 7,
    program_name: 'BSc Computer Science',
    year_of_study: 2,
    roll_number: '78012',
    status: 'ACTIVE',
    ...overrides,
  }) as StudentEnrollment;

const programs = [
  { id: 7, name: 'BSc Computer Science', duration_years: 3 },
  { id: 9, name: 'MSc', duration_years: 2 },
] as Program[];

const page = <T>(results: T[], count = results.length) => ({
  count,
  next: null,
  previous: null,
  results,
});

describe('EnrollmentsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  function create(rows: StudentEnrollment[] = [enrollment()], count?: number) {
    api = {
      enrollments: vi.fn().mockReturnValue(of(page(rows, count))),
      list: vi.fn().mockReturnValue(of(page([]))),
    };

    TestBed.configureTestingModule({
      imports: [AdminModule],
      providers: [
        provideRouter([]),
        { provide: StudentsService, useValue: api },
        {
          provide: DirectoryService,
          useValue: {
            academicYears: vi
              .fn()
              .mockReturnValue(of(page([{ id: 2, name: '2026-2027', is_active: true }]))),
            programs: vi.fn().mockReturnValue(of(page(programs))),
          },
        },
        { provide: ToastService, useValue: { success: vi.fn() } },
      ],
    });

    const fixture = TestBed.createComponent(EnrollmentsComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  afterEach(() => vi.useRealTimers());

  it('lists the enrollments with year, program, roll number and status', () => {
    const { element } = create([
      enrollment(),
      enrollment({ public_id: 'e-2', status: 'WITHDRAWN' }),
    ]);

    expect(api['enrollments']).toHaveBeenCalledWith({
      page: 1,
      search: '',
      academic_year: '',
      program: '',
      year_of_study: '',
      status: '',
    });
    const rows = element.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Rahul Sharma');
    expect(rows[0].textContent).toContain('2026-2027');
    expect(rows[0].textContent).toContain('Year 2');
    expect(rows[0].textContent).toContain('78012');
    expect(rows[1].textContent).toContain('Withdrawn');
  });

  it('links the student name to their page', () => {
    const { element } = create();

    const link = element.querySelector<HTMLAnchorElement>('tbody a.student')!;

    expect(link.getAttribute('href')).toBe('/admin/students/s-12');
  });

  it('sends every filter with its server name, from page 1', () => {
    const { component } = create();
    component.page = 3;
    api['enrollments'].mockClear();

    component.filters.patchValue({ year: '2', program: '7', yearOfStudy: '2', status: 'ACTIVE' });

    expect(api['enrollments']).toHaveBeenLastCalledWith({
      page: 1,
      search: '',
      academic_year: '2',
      program: '7',
      year_of_study: '2',
      status: 'ACTIVE',
    });
  });

  it('waits for a pause in typing before it searches', () => {
    vi.useFakeTimers();
    const { component } = create();
    api['enrollments'].mockClear();

    component.filters.patchValue({ search: '780' });
    component.filters.patchValue({ search: ' 78012 ' });
    expect(api['enrollments']).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(api['enrollments']).toHaveBeenCalledTimes(1);
    expect(api['enrollments']).toHaveBeenCalledWith(expect.objectContaining({ search: '78012' }));
  });

  it('offers years of study up to the chosen program', () => {
    const { component } = create();
    expect(component.yearOptions).toEqual([1, 2, 3, 4]);

    component.filters.patchValue({ program: '9' });
    expect(component.yearOptions).toEqual([1, 2]);
  });

  it('opens the dialog to enrol (no student chosen yet) or to edit a row', () => {
    const { component, fixture, element } = create();

    component.openEnrol();
    fixture.detectChanges();
    expect(element.querySelector('app-enrollment-dialog')).not.toBeNull();
    expect(component.editing).toBeNull();

    component.closeDialog();
    fixture.detectChanges();
    expect(element.querySelector('app-enrollment-dialog')).toBeNull();

    element.querySelector<HTMLElement>('tbody tr')!.click();
    expect(component.editing?.public_id).toBe('e-1');
    expect(component.showDialog).toBe(true);
  });

  it('reloads the list when the dialog saves, and closes it', () => {
    const { component } = create();
    component.openEnrol();
    api['enrollments'].mockClear();

    component.saved();

    expect(component.showDialog).toBe(false);
    expect(api['enrollments']).toHaveBeenCalledTimes(1);
  });

  it('pages through the results and explains an empty list', () => {
    const { component, element, fixture } = create([enrollment()], 45);
    expect(element.querySelector('.pager')?.textContent).toContain('Showing 1-20 of 45');

    api['enrollments'].mockClear();
    component.goTo(2);
    expect(api['enrollments']).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));

    api['enrollments'].mockReturnValue(of(page([], 0)));
    component.retry();
    fixture.detectChanges();
    expect(element.querySelector('.empty-state')?.textContent).toContain('Enrol a student');
  });

  it('shows the error and a retry button', () => {
    const { component, element, fixture } = create();
    api['enrollments'].mockReturnValue(
      throwError(() => new GlobalException({ status: 0, message: 'Cannot reach the server.' })),
    );

    component.retry();
    fixture.detectChanges();

    expect(element.querySelector('.alert')?.textContent).toContain('Cannot reach the server.');
  });
});
