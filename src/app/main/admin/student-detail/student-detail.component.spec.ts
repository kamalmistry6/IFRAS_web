import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { StudentEnrollment, StudentProfile } from 'src/app/api/models';
import { DirectoryService, StudentsService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { AuthService } from 'src/app/auth/services';
import { ToastService } from 'src/app/core/services';
import { AdminModule } from '../admin.module';
import { StudentDetailComponent } from './student-detail.component';

const student = {
  id: 12,
  public_id: 's-12',
  username: 'rahul',
  first_name: 'Rahul',
  last_name: 'Sharma',
  full_name: 'Rahul Sharma',
  email: 'rahul@college.edu',
  date_of_birth: '2006-03-12',
  phone: '98470 11223',
  address: 'Kochi',
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

describe('StudentDetailComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let toast: { success: ReturnType<typeof vi.fn> };

  function create(
    enrollments: StudentEnrollment[] = [enrollment],
    query: Record<string, string> = {},
    getResult: unknown = of(student),
    canManage = true,
  ) {
    api = {
      get: vi.fn().mockReturnValue(getResult),
      enrollments: vi.fn().mockReturnValue(of(page(enrollments))),
      update: vi.fn().mockReturnValue(of({ ...student, phone: '11111' })),
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
            academicYears: vi.fn().mockReturnValue(of(page([]))),
            programs: vi.fn().mockReturnValue(of(page([]))),
          },
        },
        { provide: ToastService, useValue: toast },
        {
          provide: AuthService,
          useValue: { user: null, isAuthorizedNow: () => canManage },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 's-12' }),
              queryParamMap: convertToParamMap(query),
            },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(StudentDetailComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  it('loads the student and then their enrollments by the integer id', () => {
    const { element } = create();

    expect(api['get']).toHaveBeenCalledWith('s-12');
    expect(api['enrollments']).toHaveBeenCalledWith({ student: 12, page_size: 100 });
    expect(element.querySelector('h1')?.textContent).toContain('Rahul Sharma');
    expect(element.querySelector('.enrollments')?.textContent).toContain('2026-2027');
    expect(element.querySelector('.enrollments')?.textContent).toContain('Roll 78012');
  });

  it('shows the username and email as plain text, and fills the editable fields', () => {
    const { component, element } = create();

    expect(element.querySelector('.fixed')?.textContent).toContain('rahul@college.edu');
    expect(element.querySelector('input[formControlName="username"]')).toBeNull();
    expect(component.form.value).toMatchObject({
      first_name: 'Rahul',
      date_of_birth: '2006-03-12',
      phone: '98470 11223',
    });
  });

  it('keeps Save disabled until something changes, then saves only the editable fields', () => {
    const { component, fixture, element } = create();
    const save = () => element.querySelector<HTMLButtonElement>('.profile .btn-primary')!;
    expect(save().disabled).toBe(true);

    component.form.patchValue({ phone: ' 11111 ', date_of_birth: '' });
    component.form.markAsDirty();
    fixture.detectChanges();
    expect(save().disabled).toBe(false);

    component.saveProfile();

    expect(api['update']).toHaveBeenCalledWith('s-12', {
      first_name: 'Rahul',
      last_name: 'Sharma',
      date_of_birth: null,
      phone: '11111',
      address: 'Kochi',
    });
    expect(toast.success).toHaveBeenCalledWith('Student updated');
  });

  it('will not save a blank name', () => {
    const { component } = create();
    component.form.patchValue({ first_name: '' });

    component.saveProfile();

    expect(api['update']).not.toHaveBeenCalled();
  });

  it('shows a server message under its field', () => {
    const { component } = create();
    api['update'].mockReturnValue(
      throwError(
        () =>
          new GlobalException({
            status: 400,
            message: 'x',
            fieldErrors: { first_name: ['Names cannot be blank.'] },
          }),
      ),
    );
    component.form.patchValue({ phone: '1' });

    component.saveProfile();

    expect(component.form.controls['first_name'].errors).toEqual({
      server: 'Names cannot be blank.',
    });
  });

  it('opens the dialog to enrol, or to edit one enrollment, and reloads when it is saved', () => {
    const { component, fixture, element } = create();

    component.openEnrol();
    fixture.detectChanges();
    expect(element.querySelector('app-enrollment-dialog')).not.toBeNull();
    expect(component.editingEnrollment).toBeNull();

    component.closeEnrollment();
    component.openEdit(enrollment);
    expect(component.editingEnrollment).toBe(enrollment);

    api['enrollments'].mockClear();
    component.enrollmentSaved();
    expect(component.showEnrollment).toBe(false);
    expect(api['enrollments']).toHaveBeenCalledTimes(1);
  });

  it('opens the enrol dialog by itself for a student who was just added and has no enrollment', () => {
    const { component } = create([], { enrol: '1' });

    expect(component.showEnrollment).toBe(true);
  });

  it('does not open it by itself when the student is already enrolled', () => {
    const { component } = create([enrollment], { enrol: '1' });

    expect(component.showEnrollment).toBe(false);
  });

  it('says so when the student does not exist', () => {
    const { element } = create(
      [],
      {},
      throwError(() => new GlobalException({ status: 404, message: 'Not found.' })),
    );

    expect(element.querySelector('.alert')?.textContent).toContain('This student does not exist.');
    expect(api['enrollments']).not.toHaveBeenCalled();
  });
  describe('for a head of department, who only looks', () => {
    it('shows the profile but lets nothing be edited or saved', () => {
      const { component, element } = create([enrollment], {}, of(student), false);

      expect(component.canManage).toBe(false);
      expect(component.form.disabled).toBe(true);
      expect(element.querySelector('button[type="submit"]')).toBeNull();
      expect(element.textContent).toContain('Only the college administrator changes');
      expect(element.textContent).toContain(student.full_name);
    });

    it('lists the enrollments without enrol or edit buttons', () => {
      const { component, element } = create([enrollment], {}, of(student), false);

      expect(component.canEnrol).toBe(false);
      expect(element.querySelector('.enrollments .list')?.textContent).toContain('78012');
      expect(element.querySelector('.enrollments button')).toBeNull();
    });

    it('does not open the enrol dialog by itself, even when the address asks for it', () => {
      const { component } = create([], { enrol: '1' }, of(student), false);

      expect(component.showEnrollment).toBe(false);
    });
  });
});
