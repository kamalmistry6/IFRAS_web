import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AcademicsService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ConfirmService, ToastService } from 'src/app/core/services';
import { AdminModule } from '../../admin.module';
import { RESOURCES, ResourceConfig, Row } from '../academics.config';
import { ResourceTableComponent } from './resource-table.component';

const config = (key: string): ResourceConfig => RESOURCES.find((item) => item.key === key)!;

const page = (results: Row[], count = results.length) => ({
  count,
  next: null,
  previous: null,
  results,
});

const department = {
  id: 3,
  public_id: 'd-3',
  college: 1,
  name: 'Computer Science',
  code: 'CS',
  description: '',
  is_active: true,
};
const program = {
  id: 7,
  public_id: 'p-7',
  department: 3,
  department_name: 'Computer Science',
  name: 'BSc Computer Science',
  code: 'BSc CS',
  duration_years: 3,
  description: '',
  is_active: true,
};

describe('ResourceTableComponent', () => {
  let api: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let confirm: { confirm: ReturnType<typeof vi.fn> };
  /** What each resource's list answers with. */
  let data: Record<string, Row[]>;

  function create(
    key: string,
    options: {
      platform?: boolean;
      canWrite?: boolean;
      collegeId?: number | null;
      count?: number;
    } = {},
  ) {
    api = {
      list: vi.fn((resource: string) => of(page(data[resource] ?? [], options.count))),
      create: vi.fn().mockReturnValue(of({})),
      update: vi.fn().mockReturnValue(of({})),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    confirm = { confirm: vi.fn().mockReturnValue(of(true)) };

    TestBed.configureTestingModule({
      imports: [AdminModule],
      providers: [
        provideRouter([]),
        { provide: AcademicsService, useValue: api },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
      ],
    });

    const fixture = TestBed.createComponent(ResourceTableComponent);
    const component = fixture.componentInstance;
    component.config = config(key);
    component.platform = options.platform ?? false;
    component.canWrite = options.canWrite ?? true;
    component.collegeId = options.collegeId === undefined ? 1 : options.collegeId;
    fixture.detectChanges();
    return { fixture, component, element: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    data = {
      departments: [department],
      programs: [
        program,
        { ...program, id: 8, public_id: 'p-8', name: 'MSc', duration_years: 2, is_active: false },
      ],
      colleges: [{ id: 1, name: 'College One' }],
      semesters: [],
    };
  });

  afterEach(() => vi.useRealTimers());

  describe('the list', () => {
    it('shows the rows with the columns of the resource and their status', () => {
      const { element } = create('programs');

      expect(api.list).toHaveBeenCalledWith('programs', {
        page: 1,
        search: '',
        department: '',
        is_active: '',
      });
      const rows = element.querySelectorAll('tbody tr');
      expect(rows.length).toBe(2);
      expect(rows[0].textContent).toContain('BSc Computer Science');
      expect(rows[0].textContent).toContain('3 years');
      expect(rows[0].textContent).toContain('Active');
      expect(rows[1].classList).toContain('inactive');
      expect(rows[1].textContent).toContain('Inactive');
    });

    it('sends each filter under the name the server expects', () => {
      const { component } = create('subjects');
      api.list.mockClear();

      component.filters.patchValue({ program: '7', type: 'PRACTICAL', active: 'true' });

      expect(api.list).toHaveBeenLastCalledWith('subjects', {
        page: 1,
        search: '',
        semester__program: '7',
        subject_type: 'PRACTICAL',
        is_active: 'true',
      });
    });

    it('waits for a pause in typing before it searches', () => {
      vi.useFakeTimers();
      const { component } = create('programs');
      api.list.mockClear();

      component.filters.patchValue({ search: 'b' });
      component.filters.patchValue({ search: ' bsc ' });
      expect(api.list).not.toHaveBeenCalled();
      vi.advanceTimersByTime(300);

      expect(api.list).toHaveBeenCalledTimes(1);
      expect(api.list).toHaveBeenCalledWith('programs', expect.objectContaining({ search: 'bsc' }));
    });

    it('hides the college filter from a college administrator, and shows it to a platform administrator', () => {
      expect(create('departments').component.visibleFilters.map((f) => f.name)).toEqual(['active']);

      TestBed.resetTestingModule();
      expect(
        create('departments', { platform: true }).component.visibleFilters.map((f) => f.name),
      ).toEqual(['college', 'active']);
    });

    it('pages through the results and explains an empty list', () => {
      const { component, element, fixture } = create('programs', { count: 45 });
      expect(element.querySelector('.pager')?.textContent).toContain('Showing 1-20 of 45');

      api.list.mockClear();
      component.goTo(2);
      expect(api.list).toHaveBeenCalledWith('programs', expect.objectContaining({ page: 2 }));

      data['programs'] = [];
      component.retry();
      fixture.detectChanges();
      expect(element.querySelector('.empty-state')?.textContent).toContain('No programs found');
    });

    it('shows the error and a retry button', () => {
      const { component, element, fixture } = create('programs');
      api.list.mockReturnValue(
        throwError(() => new GlobalException({ status: 0, message: 'Cannot reach the server.' })),
      );

      component.retry();
      fixture.detectChanges();

      expect(element.querySelector('.alert')?.textContent).toContain('Cannot reach the server.');
    });

    it('is read only when the user may not change it: no Add, no Edit, a note instead', () => {
      data['academic-years'] = [
        {
          id: 2,
          public_id: 'y-2',
          name: '2026-2027',
          start_date: '2026-06-01',
          end_date: '2027-05-31',
          is_active: true,
        },
      ];
      const { element } = create('academic-years', { canWrite: false });

      expect(element.textContent).not.toContain('Add academic year');
      expect(element.querySelector('tbody .actions')).toBeNull();
      expect(element.querySelector('.readonly-note')?.textContent).toContain(
        'platform administrator',
      );
      expect(element.textContent).toContain('Current year');
    });

    it('does not repeat Active / Inactive on the academic years, which show "Current"', () => {
      data['academic-years'] = [
        {
          id: 2,
          public_id: 'y-2',
          name: '2026-2027',
          start_date: 'a',
          end_date: 'b',
          is_active: true,
        },
      ];
      const { element } = create('academic-years', { platform: true });

      expect(element.querySelector('thead')?.textContent).not.toContain('Status');
    });
  });

  describe('adding', () => {
    it('adds a department for a college administrator, sending their own college and trimmed text', () => {
      const { component, fixture } = create('departments', { collegeId: 1 });
      component.openAdd();
      fixture.detectChanges();

      expect(component.fields.map((f) => f.name)).toEqual(['name', 'code', 'description']);

      component.form.patchValue({ name: ' Physics ', code: ' PH ' });
      api.list.mockClear();
      component.save();

      expect(api.create).toHaveBeenCalledWith('departments', {
        name: 'Physics',
        code: 'PH',
        description: '',
        college: 1,
      });
      expect(toast.success).toHaveBeenCalledWith('Department added');
      expect(component.showForm).toBe(false);
      expect(api.list).toHaveBeenCalledTimes(1);
    });

    it('lets a platform administrator choose the college', () => {
      const { component, element, fixture } = create('departments', {
        platform: true,
        collegeId: null,
      });
      component.openAdd();
      fixture.detectChanges();

      expect(component.fields.map((f) => f.name)).toContain('college');
      expect(element.querySelector('#f-college')).not.toBeNull();
      expect(component.fieldOptions['college'].map((o) => o.label)).toEqual(['College One']);

      component.form.patchValue({ name: 'Physics', code: 'PH' });
      component.save();
      expect(api.create).not.toHaveBeenCalled();

      component.form.patchValue({ college: 1 });
      component.save();
      expect(api.create).toHaveBeenCalledWith(
        'departments',
        expect.objectContaining({ college: 1 }),
      );
    });

    it('needs the required fields, and keeps a number inside its limits', () => {
      const { component } = create('programs');
      component.openAdd();
      component.form.patchValue({ department: 3, name: 'BSc', code: 'B', duration_years: 11 });

      component.save();

      expect(api.create).not.toHaveBeenCalled();
      expect(component.form.controls['duration_years'].errors).toHaveProperty('max');
    });

    it('sends numbers as numbers', () => {
      const { component } = create('programs');
      component.openAdd();
      component.form.patchValue({ department: 3, name: 'BSc', code: 'B', duration_years: '4' });

      component.save();

      expect(api.create).toHaveBeenCalledWith('programs', {
        department: 3,
        name: 'BSc',
        code: 'B',
        duration_years: 4,
        description: '',
      });
    });

    it('puts a server message under its field, for example a duplicate code', () => {
      const { component } = create('programs');
      api.create.mockReturnValue(
        throwError(
          () =>
            new GlobalException({
              status: 400,
              message: 'x',
              fieldErrors: { code: ['A program with this code already exists.'] },
            }),
        ),
      );
      component.openAdd();
      component.form.patchValue({ department: 3, name: 'BSc', code: 'B', duration_years: 3 });

      component.save();

      expect(component.form.controls['code'].errors).toEqual({
        server: 'A program with this code already exists.',
      });
      expect(component.showForm).toBe(true);
      expect(component.saving).toBe(false);
    });
  });

  describe('editing', () => {
    it('shows what the row belongs to as plain text and does not send it', () => {
      const { component, element, fixture } = create('programs');

      component.openEdit(program);
      fixture.detectChanges();

      expect(component.isFixed(component.fields[0])).toBe(true);
      expect(component.fixedText(component.fields[0])).toBe('Computer Science');
      expect(element.querySelector('.fixed')?.textContent).toContain('Computer Science');
      expect(element.querySelector('#f-department')).toBeNull();

      component.form.patchValue({ name: 'BSc CS (new)', duration_years: 4 });
      component.save();

      expect(api.update).toHaveBeenCalledWith('programs', 'p-7', {
        name: 'BSc CS (new)',
        code: 'BSc CS',
        duration_years: 4,
        description: '',
      });
      expect(toast.success).toHaveBeenCalledWith('Program updated');
    });
  });

  describe('Deactivate and Activate', () => {
    it('asks first, then deactivates', () => {
      const { component } = create('programs');

      component.toggleActive(program);

      expect(confirm.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ danger: true, confirmText: 'Deactivate' }),
      );
      expect(api.update).toHaveBeenCalledWith('programs', 'p-7', { is_active: false });
      expect(toast.success).toHaveBeenCalledWith('BSc Computer Science deactivated');
    });

    it('does nothing when the administrator declines', () => {
      const { component } = create('programs');
      confirm.confirm.mockReturnValue(of(false));

      component.toggleActive(program);

      expect(api.update).not.toHaveBeenCalled();
    });

    it('activates at once, except an academic year, which first says it becomes the current one', () => {
      const { component } = create('programs');
      component.toggleActive({ ...program, is_active: false });
      expect(confirm.confirm).not.toHaveBeenCalled();
      expect(api.update).toHaveBeenCalledWith('programs', 'p-7', { is_active: true });

      TestBed.resetTestingModule();
      const years = create('academic-years', { platform: true });
      years.component.toggleActive({
        id: 1,
        public_id: 'y-1',
        name: '2025-2026',
        is_active: false,
      });
      expect(confirm.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('becomes the current academic year'),
        }),
      );
      expect(api.update).toHaveBeenCalledWith('academic-years', 'y-1', { is_active: true });
    });

    it('shows the server message when it refuses', () => {
      const { component } = create('programs');
      api.update.mockReturnValue(
        throwError(() => new GlobalException({ status: 400, message: 'It is in use.' })),
      );

      component.toggleActive(program);

      expect(toast.error).toHaveBeenCalledWith('Could not deactivate it', 'It is in use.');
    });
  });

  describe('fields that depend on others', () => {
    it('lists the semesters of the program chosen for a subject, and forgets the old choice', () => {
      data['semesters'] = [{ id: 21, semester_number: 3, name: '' }];
      const { component } = create('subjects');
      component.openAdd();
      expect(component.fieldOptions['semester']).toEqual([]);

      component.form.patchValue({ program: 7 });

      expect(api.list).toHaveBeenLastCalledWith('semesters', { page_size: 100, program: 7 });
      expect(component.fieldOptions['semester'].map((o) => o.label)).toEqual(['Semester 3']);

      component.form.patchValue({ semester: 21 });
      component.form.patchValue({ program: 8 });
      expect(component.form.value.semester).toBeNull();
    });

    it('never sends the program that only narrows the semesters', () => {
      data['semesters'] = [{ id: 21, semester_number: 3 }];
      const { component } = create('subjects');
      component.openAdd();
      component.form.patchValue({ program: 7 });
      component.form.patchValue({
        semester: 21,
        name: 'Data Structures',
        code: 'CS201',
        credits: 4,
      });

      component.save();

      expect(api.create).toHaveBeenCalledWith('subjects', {
        semester: 21,
        name: 'Data Structures',
        code: 'CS201',
        subject_type: 'THEORY',
        credits: 4,
      });
    });

    it('offers only the active subjects of the program when making an offering', () => {
      data['subjects'] = [{ id: 40, name: 'ML', code: '58099' }];
      const { component } = create('subject-offerings');
      component.openAdd();

      component.form.patchValue({ program: 7 });

      expect(api.list).toHaveBeenLastCalledWith('subjects', {
        page_size: 100,
        semester__program: 7,
        is_active: true,
      });
      expect(component.fieldOptions['subject'][0].label).toBe('ML (58099)');
    });

    it('offers semester numbers up to twice the program length, without those already added', () => {
      data['semesters'] = [{ semester_number: 1 }, { semester_number: 2 }];
      const { component } = create('semesters');
      component.openAdd();

      component.form.patchValue({ program: 8 });

      // MSc has 2 years: semesters 1 to 4, and 1 and 2 are taken.
      expect(component.fieldOptions['semester_number'].map((o) => o.value)).toEqual([3, 4]);
    });
  });

  describe('academic years', () => {
    it('notes that ticking "current" switches the other years off', () => {
      const { component, fixture, element } = create('academic-years', { platform: true });
      component.openAdd();
      fixture.detectChanges();
      expect(element.querySelector('.modal-body')?.textContent).not.toContain(
        'becomes the current year',
      );

      component.form.patchValue({ is_active: true });
      fixture.detectChanges();

      expect(element.querySelector('.modal-body')?.textContent).toContain(
        'becomes the current year',
      );
    });

    it('creates a year, with a hint on the name', () => {
      const { component, element, fixture } = create('academic-years', { platform: true });
      component.openAdd();
      fixture.detectChanges();
      expect(element.querySelector('.modal-body')?.textContent).toContain('Two consecutive years');

      component.form.patchValue({
        name: '2027-2028',
        start_date: '2027-06-01',
        end_date: '2028-05-31',
      });
      component.save();

      expect(api.create).toHaveBeenCalledWith('academic-years', {
        name: '2027-2028',
        start_date: '2027-06-01',
        end_date: '2028-05-31',
        is_active: false,
      });
    });
  });
});
