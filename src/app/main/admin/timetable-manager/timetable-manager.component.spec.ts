import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AcademicYear, TimetableSlot } from 'src/app/api/models';
import { AttendanceService, DirectoryService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ConfirmService, ToastService } from 'src/app/core/services';
import { AdminModule } from '../admin.module';
import { TimetableManagerComponent } from './timetable-manager.component';

const slot = (overrides: Partial<TimetableSlot> = {}): TimetableSlot =>
  ({
    id: 1,
    public_id: 'slot-1',
    teacher_assignment: 4,
    subject_name: 'Machine Learning',
    subject_code: '58099',
    teacher_name: 'Amit Patil',
    academic_year_name: '2026-2027',
    day_of_week: 4,
    day_name: 'Thursday',
    start_time: '09:00:00',
    end_time: '10:00:00',
    room: 'B-12',
    valid_from: '2026-06-01',
    valid_to: '2027-05-31',
    is_active: true,
    ...overrides,
  }) as TimetableSlot;

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

const assignment = { id: 4, teacher_name: 'Amit Patil', subject_name: 'Machine Learning' };

describe('TimetableManagerComponent', () => {
  let attendance: Record<string, ReturnType<typeof vi.fn>>;
  let directory: Record<string, ReturnType<typeof vi.fn>>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let confirm: { confirm: ReturnType<typeof vi.fn> };

  function create(slots: TimetableSlot[] = [slot()], count?: number) {
    attendance = {
      timetable: vi.fn().mockReturnValue(of(page(slots, count))),
      createSlot: vi.fn().mockReturnValue(of(slot())),
      updateSlot: vi.fn().mockReturnValue(of(slot())),
    };
    directory = {
      teachers: vi
        .fn()
        .mockReturnValue(of(page([{ id: 1, full_name: 'Amit Patil', employee_id: 'EMP001' }]))),
      academicYears: vi.fn().mockReturnValue(of(page(years))),
      subjectAssignments: vi.fn().mockReturnValue(of(page([assignment]))),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    confirm = { confirm: vi.fn().mockReturnValue(of(true)) };

    TestBed.configureTestingModule({
      imports: [AdminModule],
      providers: [
        provideRouter([]),
        { provide: AttendanceService, useValue: attendance },
        { provide: DirectoryService, useValue: directory },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
      ],
    });

    const fixture = TestBed.createComponent(TimetableManagerComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  it('lists the active slots of the college by weekday, with the teacher', () => {
    const { element } = create();

    expect(attendance['timetable']).toHaveBeenCalledWith({
      is_active: true,
      teacher_assignment__teacher: '',
    });
    const thursday = Array.from(element.querySelectorAll('.day')).find((d) =>
      d.textContent?.includes('Thursday'),
    )!;
    expect(thursday.textContent).toContain('Machine Learning');
    expect(thursday.textContent).toContain('Amit Patil');
    expect(thursday.textContent).toContain('9:00 AM - 10:00 AM');
  });

  it('narrows the list to one teacher, and can include inactive slots', () => {
    const { component } = create();
    attendance['timetable'].mockClear();

    component.filters.patchValue({ teacher: '1' });
    expect(attendance['timetable']).toHaveBeenLastCalledWith({
      is_active: true,
      teacher_assignment__teacher: '1',
    });

    component.filters.patchValue({ showInactive: true });
    expect(attendance['timetable']).toHaveBeenLastCalledWith({
      is_active: undefined,
      teacher_assignment__teacher: '1',
    });
  });

  it('marks inactive slots and offers Activate instead of Deactivate', () => {
    const { element } = create([slot({ is_active: false })]);

    expect(element.querySelector('.slot.faded')).not.toBeNull();
    expect(element.textContent).toContain('Inactive');
    expect(element.textContent).toContain('Activate');
  });

  it('warns when there are more slots than one page holds', () => {
    const { element } = create([slot()], 250);

    expect(element.querySelector('.alert-warning')?.textContent).toContain('first 1 of 250');
  });

  describe('adding a slot', () => {
    it('opens with the active year, its dates and its assignments', () => {
      const { component, element, fixture } = create();

      component.openAdd();
      fixture.detectChanges();

      expect(element.querySelector('.modal-backdrop .modal')).not.toBeNull();
      expect(component.form.value).toMatchObject({
        year: 2,
        valid_from: '2026-06-01',
        valid_to: '2027-05-31',
      });
      expect(directory['subjectAssignments']).toHaveBeenCalledWith({ academic_year: 2 });
    });

    it('loads the assignments and the dates of another year when the year changes', () => {
      const { component } = create();
      component.openAdd();
      directory['subjectAssignments'].mockClear();

      component.form.controls['year'].setValue(1);

      expect(directory['subjectAssignments']).toHaveBeenCalledWith({ academic_year: 1 });
      expect(component.form.value).toMatchObject({
        valid_from: '2025-06-01',
        valid_to: '2026-05-31',
        teacher_assignment: null,
      });
    });

    it('needs a teacher and subject before it calls the server', () => {
      const { component } = create();
      component.openAdd();

      component.save();

      expect(attendance['createSlot']).not.toHaveBeenCalled();
    });

    it('rejects an end time that is not after the start time', () => {
      const { component } = create();
      component.openAdd();
      component.form.patchValue({ teacher_assignment: 4, start_time: '10:00', end_time: '09:00' });

      component.save();

      expect(attendance['createSlot']).not.toHaveBeenCalled();
      expect(component.formErrors[0]).toContain('end time');
    });

    it('creates the slot, says so, closes the dialog and reloads the list', () => {
      const { component } = create();
      component.openAdd();
      component.form.patchValue({
        teacher_assignment: 4,
        day_of_week: 2,
        start_time: '14:00',
        end_time: '15:30',
        room: ' Lab-2 ',
      });
      attendance['timetable'].mockClear();

      component.save();

      expect(attendance['createSlot']).toHaveBeenCalledWith({
        teacher_assignment: 4,
        day_of_week: 2,
        start_time: '14:00',
        end_time: '15:30',
        room: 'Lab-2',
        valid_from: '2026-06-01',
        valid_to: '2027-05-31',
      });
      expect(toast.success).toHaveBeenCalledWith('Slot added');
      expect(component.showForm).toBe(false);
      expect(attendance['timetable']).toHaveBeenCalledTimes(1);
    });

    it('shows the server message, for example a clash with another lecture', () => {
      const { component } = create();
      attendance['createSlot'].mockReturnValue(
        throwError(
          () =>
            new GlobalException({
              status: 400,
              message: 'x',
              generalErrors: ['This teacher already has a lecture at this time.'],
            }),
        ),
      );
      component.openAdd();
      component.form.patchValue({ teacher_assignment: 4 });

      component.save();

      expect(component.formErrors).toContain('This teacher already has a lecture at this time.');
      expect(component.showForm).toBe(true);
      expect(component.saving).toBe(false);
    });
  });

  describe('editing a slot', () => {
    it('fills the form and shows who teaches what without letting it change', () => {
      const { component, element, fixture } = create();

      component.openEdit(slot());
      fixture.detectChanges();

      expect(component.form.value).toMatchObject({
        day_of_week: 4,
        start_time: '09:00',
        end_time: '10:00',
        room: 'B-12',
      });
      expect(element.querySelector('.fixed')?.textContent).toContain('Amit Patil');
      expect(element.querySelector('#slot-assignment')).toBeNull();
    });

    it('sends the changes without the teacher assignment', () => {
      const { component } = create();
      component.openEdit(slot());
      component.form.patchValue({ room: 'C-3', start_time: '09:30' });

      component.save();

      expect(attendance['updateSlot']).toHaveBeenCalledWith('slot-1', {
        day_of_week: 4,
        start_time: '09:30',
        end_time: '10:00',
        room: 'C-3',
        valid_from: '2026-06-01',
        valid_to: '2027-05-31',
      });
      expect(toast.success).toHaveBeenCalledWith('Slot updated');
    });
  });

  describe('deactivating and activating', () => {
    it('asks first, then deactivates', () => {
      const { component } = create();

      component.toggleActive(slot());

      expect(confirm.confirm).toHaveBeenCalled();
      expect(attendance['updateSlot']).toHaveBeenCalledWith('slot-1', { is_active: false });
      expect(toast.success).toHaveBeenCalledWith('Slot deactivated');
    });

    it('does nothing when the administrator declines', () => {
      const { component } = create();
      confirm.confirm.mockReturnValue(of(false));

      component.toggleActive(slot());

      expect(attendance['updateSlot']).not.toHaveBeenCalled();
    });

    it('activates at once, and shows the clash message if the server refuses', () => {
      const { component } = create();
      component.toggleActive(slot({ is_active: false }));
      expect(confirm.confirm).not.toHaveBeenCalled();
      expect(attendance['updateSlot']).toHaveBeenCalledWith('slot-1', { is_active: true });

      attendance['updateSlot'].mockReturnValue(
        throwError(
          () => new GlobalException({ status: 400, message: 'It clashes with another slot.' }),
        ),
      );
      component.toggleActive(slot({ is_active: false }));
      expect(toast.error).toHaveBeenCalledWith(
        'Could not change the slot',
        'It clashes with another slot.',
      );
    });
  });
});
