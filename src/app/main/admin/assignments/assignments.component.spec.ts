import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AcademicYear, TeacherSubjectAssignment } from 'src/app/api/models';
import { AssignmentsService, DirectoryService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ConfirmService, ToastService } from 'src/app/core/services';
import { AdminModule } from '../admin.module';
import { AssignmentsComponent } from './assignments.component';

const item = (overrides: Partial<TeacherSubjectAssignment> = {}): TeacherSubjectAssignment =>
  ({
    id: 4,
    public_id: 'a-4',
    teacher: 1,
    teacher_name: 'Amit Patil',
    subject_offering: 9,
    subject_name: 'Machine Learning',
    academic_year_name: '2026-2027',
    created_at: '2026-10-01T10:00:00+05:30',
    ...overrides,
  }) as TeacherSubjectAssignment;

const page = <T>(results: T[], count = results.length) => ({
  count,
  next: null,
  previous: null,
  results,
});

const years = [
  { id: 1, name: '2025-2026', start_date: '2025-06-01', end_date: '2026-05-31', is_active: false },
  { id: 2, name: '2026-2027', start_date: '2026-06-01', end_date: '2027-05-31', is_active: true },
] as AcademicYear[];

const offering = {
  id: 9,
  subject_name: 'Machine Learning',
  subject_code: '58099',
  semester_number: 3,
};

describe('AssignmentsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let directory: Record<string, ReturnType<typeof vi.fn>>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let confirm: { confirm: ReturnType<typeof vi.fn> };

  function create(rows: TeacherSubjectAssignment[] = [item()], count?: number) {
    api = {
      list: vi.fn().mockReturnValue(of(page(rows, count))),
      create: vi.fn().mockReturnValue(of(item())),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };
    directory = {
      teachers: vi
        .fn()
        .mockReturnValue(of(page([{ id: 1, full_name: 'Amit Patil', employee_id: 'EMP001' }]))),
      academicYears: vi.fn().mockReturnValue(of(page(years))),
      programs: vi.fn().mockReturnValue(of(page([{ id: 7, name: 'BSc Computer Science' }]))),
      subjectOfferings: vi.fn().mockReturnValue(of(page([offering]))),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    confirm = { confirm: vi.fn().mockReturnValue(of(true)) };

    TestBed.configureTestingModule({
      imports: [AdminModule],
      providers: [
        provideRouter([]),
        { provide: AssignmentsService, useValue: api },
        { provide: DirectoryService, useValue: directory },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
      ],
    });

    const fixture = TestBed.createComponent(AssignmentsComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  afterEach(() => vi.useRealTimers());

  it('lists who teaches what', () => {
    const { element } = create();

    expect(api['list']).toHaveBeenCalledWith({
      page: 1,
      search: '',
      teacher: '',
      academic_year: '',
    });
    expect(element.querySelector('tbody')?.textContent).toContain('Amit Patil');
    expect(element.querySelector('tbody')?.textContent).toContain('Machine Learning');
    expect(element.querySelector('tbody')?.textContent).toContain('2026-2027');
  });

  it('filters by teacher and year at once, from page 1', () => {
    const { component } = create();
    component.page = 3;
    api['list'].mockClear();

    component.filters.patchValue({ teacher: '1' });
    expect(api['list']).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, teacher: '1' }),
    );

    component.filters.patchValue({ year: '2' });
    expect(api['list']).toHaveBeenLastCalledWith(
      expect.objectContaining({ teacher: '1', academic_year: '2' }),
    );
  });

  it('waits for a pause in typing before it searches', () => {
    vi.useFakeTimers();
    const { component } = create();
    api['list'].mockClear();

    component.filters.patchValue({ search: 'a' });
    component.filters.patchValue({ search: 'am' });
    component.filters.patchValue({ search: ' amit ' });
    expect(api['list']).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(api['list']).toHaveBeenCalledTimes(1);
    expect(api['list']).toHaveBeenCalledWith(expect.objectContaining({ search: 'amit' }));
  });

  it('pages through the results', () => {
    const { component, element } = create([item()], 45);

    expect(element.querySelector('.pager')?.textContent).toContain('Showing 1-20 of 45');

    api['list'].mockClear();
    component.goTo(2);
    expect(api['list']).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('explains an empty list, differently when filters are set', () => {
    const { element, fixture, component } = create([], 0);
    expect(element.querySelector('.empty-state')?.textContent).toContain('Assign a subject');

    component.filters.patchValue({ teacher: '1' });
    fixture.detectChanges();
    expect(element.querySelector('.empty-state')?.textContent).toContain('clear the filters');
  });

  describe('assigning a subject', () => {
    it('opens with the active year and lists the subjects offered in it', () => {
      const { component, element, fixture } = create();

      component.openForm();
      fixture.detectChanges();

      expect(element.querySelector('.modal-backdrop .modal')).not.toBeNull();
      expect(component.form.value.year).toBe(2);
      expect(directory['subjectOfferings']).toHaveBeenCalledWith({
        academic_year: 2,
        subject__semester__program: null,
      });
      expect(component.offerings.length).toBe(1);
    });

    it('narrows the subjects when a program or another year is chosen', () => {
      const { component } = create();
      component.openForm();
      directory['subjectOfferings'].mockClear();

      component.form.controls['program'].setValue(7);
      expect(directory['subjectOfferings']).toHaveBeenLastCalledWith({
        academic_year: 2,
        subject__semester__program: 7,
      });

      component.form.controls['year'].setValue(1);
      expect(directory['subjectOfferings']).toHaveBeenLastCalledWith({
        academic_year: 1,
        subject__semester__program: 7,
      });
      expect(component.form.value.subject_offering).toBeNull();
    });

    it('needs a teacher and a subject', () => {
      const { component } = create();
      component.openForm();

      component.save();

      expect(api['create']).not.toHaveBeenCalled();
    });

    it('creates the assignment, says so, closes and reloads', () => {
      const { component } = create();
      component.openForm();
      component.form.patchValue({ teacher: 1, subject_offering: 9 });
      api['list'].mockClear();

      component.save();

      expect(api['create']).toHaveBeenCalledWith({ teacher: 1, subject_offering: 9 });
      expect(toast.success).toHaveBeenCalledWith('Subject assigned');
      expect(component.showForm).toBe(false);
      expect(api['list']).toHaveBeenCalledTimes(1);
    });

    it('shows the server message, for example a duplicate', () => {
      const { component } = create();
      api['create'].mockReturnValue(
        throwError(
          () =>
            new GlobalException({
              status: 400,
              message: 'x',
              generalErrors: ['This teacher is already assigned to this subject.'],
            }),
        ),
      );
      component.openForm();
      component.form.patchValue({ teacher: 1, subject_offering: 9 });

      component.save();

      expect(component.formErrors).toContain('This teacher is already assigned to this subject.');
      expect(component.showForm).toBe(true);
      expect(component.saving).toBe(false);
    });
  });

  describe('removing an assignment', () => {
    it('asks first, then removes it and reloads', () => {
      const { component } = create();
      api['list'].mockClear();

      component.remove(item());

      expect(confirm.confirm).toHaveBeenCalled();
      expect(api['remove']).toHaveBeenCalledWith('a-4');
      expect(toast.success).toHaveBeenCalledWith('Assignment removed');
      expect(api['list']).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the administrator declines', () => {
      const { component } = create();
      confirm.confirm.mockReturnValue(of(false));

      component.remove(item());

      expect(api['remove']).not.toHaveBeenCalled();
    });

    it('leaves a conflict (timetable slots or sessions exist) to the error toast', () => {
      const { component } = create();
      api['remove'].mockReturnValue(
        throwError(() => new GlobalException({ status: 409, message: 'It has timetable slots.' })),
      );

      component.remove(item());

      expect(toast.error).not.toHaveBeenCalled();
    });

    it('shows other refusals itself', () => {
      const { component } = create();
      api['remove'].mockReturnValue(
        throwError(() => new GlobalException({ status: 404, message: 'Not found.' })),
      );

      component.remove(item());

      expect(toast.error).toHaveBeenCalledWith('Could not remove it', 'Not found.');
    });

    it('goes back a page when the last row of a page is removed', () => {
      const { component } = create([item()], 21);
      component.page = 2;

      component.remove(item());

      expect(component.page).toBe(1);
    });
  });
});
