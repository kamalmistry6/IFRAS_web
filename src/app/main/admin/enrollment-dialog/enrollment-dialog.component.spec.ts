import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AcademicYear, Program, StudentEnrollment, StudentProfile } from 'src/app/api/models';
import { DirectoryService, StudentsService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ToastService } from 'src/app/core/services';
import { AdminModule } from '../admin.module';
import { EnrollmentDialogComponent } from './enrollment-dialog.component';

const years = [
  { id: 1, name: '2025-2026', is_active: false },
  { id: 2, name: '2026-2027', is_active: true },
] as AcademicYear[];

const programs = [
  { id: 7, name: 'BSc Computer Science', duration_years: 3 },
  { id: 8, name: 'MSc', duration_years: 2 },
] as Program[];

const student = {
  id: 12,
  public_id: 's-12',
  full_name: 'Rahul Sharma',
  username: 'rahul',
} as StudentProfile;

const enrollment = {
  public_id: 'e-1',
  student: 12,
  student_name: 'Rahul Sharma',
  academic_year: 2,
  academic_year_name: '2026-2027',
  program: 7,
  program_name: 'BSc Computer Science',
  year_of_study: 2,
  roll_number: '78012',
  status: 'ACTIVE',
} as StudentEnrollment;

const page = <T>(results: T[]) => ({ count: results.length, next: null, previous: null, results });

describe('EnrollmentDialogComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let toast: { success: ReturnType<typeof vi.fn> };

  function create(inputs: { student?: StudentProfile; enrollment?: StudentEnrollment } = {}) {
    api = {
      list: vi.fn().mockReturnValue(of(page([student]))),
      createEnrollment: vi.fn().mockReturnValue(of(enrollment)),
      updateEnrollment: vi.fn().mockReturnValue(of(enrollment)),
    };
    toast = { success: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AdminModule],
      providers: [
        provideRouter([]),
        { provide: StudentsService, useValue: api },
        {
          provide: DirectoryService,
          useValue: {
            academicYears: vi.fn().mockReturnValue(of(page(years))),
            programs: vi.fn().mockReturnValue(of(page(programs))),
          },
        },
        { provide: ToastService, useValue: toast },
      ],
    });

    const fixture = TestBed.createComponent(EnrollmentDialogComponent);
    const component = fixture.componentInstance;
    Object.assign(component, inputs);
    const saved = vi.fn();
    const closed = vi.fn();
    component.saved.subscribe(saved);
    component.closed.subscribe(closed);
    fixture.detectChanges();
    return { fixture, component, saved, closed, element: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => vi.useRealTimers());

  it('enrols a known student: the active year is chosen and the student shown as fixed', () => {
    const { component, element } = create({ student });

    expect(component.form.value.academic_year).toBe(2);
    expect(component.form.value.student).toBe(12);
    expect(element.querySelector('.fixed')?.textContent).toContain('Rahul Sharma');
    expect(element.querySelector('#enrol-student')).toBeNull();
  });

  describe('the roll number of the student', () => {
    it('is filled in for a known student, and can still be changed', () => {
      const { component } = create({ student: { ...student, roll_number: '78001' } });

      expect(component.form.value.roll_number).toBe('78001');

      component.form.patchValue({ roll_number: '78002' });
      expect(component.form.value.roll_number).toBe('78002');
    });

    it('is filled in when a student is picked from the search, and replaced when another is picked', () => {
      const { component } = create();

      component.choose({ ...student, roll_number: '78001' });
      expect(component.form.value.roll_number).toBe('78001');

      component.choose({ ...student, id: 13, roll_number: '78002' });
      expect(component.form.value.roll_number).toBe('78002');
    });

    it('stays as it is when the student has no roll number', () => {
      const { component } = create();
      component.form.patchValue({ roll_number: 'typed' });

      component.choose({ ...student, roll_number: '' });

      expect(component.form.value.roll_number).toBe('typed');
    });

    it('is not touched when an enrollment is edited', () => {
      const { component } = create({ enrollment });

      expect(component.form.getRawValue().roll_number).toBe('78012');
    });
  });

  it('offers years of study up to the length of the chosen program', () => {
    const { component } = create({ student });

    expect(component.yearOptions).toEqual([1, 2, 3, 4]);

    component.form.patchValue({ program: 8 });
    expect(component.yearOptions).toEqual([1, 2]);

    component.form.patchValue({ program: 7 });
    expect(component.yearOptions).toEqual([1, 2, 3]);
  });

  it('needs a program, a year of study and a roll number', () => {
    const { component } = create({ student });

    component.save();

    expect(api['createEnrollment']).not.toHaveBeenCalled();
  });

  it('enrols the student and tells the page that opened it', () => {
    const { component, saved } = create({ student });
    component.form.patchValue({ program: 7, year_of_study: 2, roll_number: ' 78012 ' });

    component.save();

    expect(api['createEnrollment']).toHaveBeenCalledWith({
      student: 12,
      academic_year: 2,
      program: 7,
      year_of_study: 2,
      roll_number: '78012',
      status: 'ACTIVE',
    });
    expect(toast.success).toHaveBeenCalledWith('Student enrolled');
    expect(saved).toHaveBeenCalled();
  });

  it('shows the server message next to its field, for example a roll number already used', () => {
    const { component, saved } = create({ student });
    api['createEnrollment'].mockReturnValue(
      throwError(
        () =>
          new GlobalException({
            status: 400,
            message: 'x',
            fieldErrors: { roll_number: ['This roll number is already used in this year.'] },
          }),
      ),
    );
    component.form.patchValue({ program: 7, year_of_study: 2, roll_number: '78012' });

    component.save();

    expect(component.form.controls['roll_number'].errors).toEqual({
      server: 'This roll number is already used in this year.',
    });
    expect(saved).not.toHaveBeenCalled();
    expect(component.saving).toBe(false);
  });

  it('edits an enrollment: the student and year are fixed and only the rest is sent', () => {
    const { component, element } = create({ enrollment });

    expect(component.editing).toBe(true);
    expect(component.form.controls['student'].disabled).toBe(true);
    expect(component.form.controls['academic_year'].disabled).toBe(true);
    expect(element.textContent).toContain('cannot be changed');

    component.form.patchValue({ status: 'WITHDRAWN', roll_number: '78099' });
    component.save();

    expect(api['updateEnrollment']).toHaveBeenCalledWith('e-1', {
      program: 7,
      year_of_study: 2,
      roll_number: '78099',
      status: 'WITHDRAWN',
    });
    expect(toast.success).toHaveBeenCalledWith('Enrollment updated');
  });

  it('searches for the student by name, after a pause, when none was given', () => {
    vi.useFakeTimers();
    const { component } = create();

    component.studentSearch.setValue('rah');
    component.studentSearch.setValue('rahul ');
    expect(api['list']).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);

    expect(api['list']).toHaveBeenCalledTimes(1);
    expect(api['list']).toHaveBeenCalledWith({ search: 'rahul', page_size: 20 });
    expect(component.candidates.length).toBe(1);

    component.choose(component.candidates[0]);
    expect(component.form.value.student).toBe(12);
    expect(component.candidates).toEqual([]);

    component.clearChoice();
    expect(component.form.value.student).toBeNull();
  });

  it('closes with Escape, with the Close button, and with a click outside', () => {
    const { closed, element } = create({ student });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toHaveBeenCalledTimes(1);

    element.querySelector<HTMLElement>('.modal-backdrop')!.click();
    expect(closed).toHaveBeenCalledTimes(2);
  });
});
