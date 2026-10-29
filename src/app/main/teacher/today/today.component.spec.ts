import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TodayLecture } from 'src/app/api/models';
import { AttendanceService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { TeacherModule } from '../teacher.module';
import { TodayComponent } from './today.component';

function lecture(overrides: Partial<TodayLecture> = {}): TodayLecture {
  return {
    slot: 1,
    slot_public_id: 'slot-1',
    teacher_assignment: 4,
    subject_name: 'Data Structures',
    subject_code: 'CS201',
    subject_type: 'THEORY',
    teacher_name: 'Amit Patil',
    start_time: '09:00:00',
    end_time: '10:00:00',
    room: 'B-12',
    state: 'NOT_STARTED',
    can_start: true,
    start_message: '',
    session: null,
    ...overrides,
  } as TodayLecture;
}

const session = {
  public_id: 'sess-1',
  status: 'OPEN',
  total_students: 3,
  present_count: 1,
  absent_count: 2,
};

describe('TodayComponent', () => {
  let attendance: Record<string, ReturnType<typeof vi.fn>>;
  let navigate: ReturnType<typeof vi.fn>;

  function create(lectures: TodayLecture[]) {
    attendance = {
      today: vi.fn().mockReturnValue(of({ date: '2026-10-29', lectures })),
      startSlot: vi.fn().mockReturnValue(of({ public_id: 'sess-9' })),
      myAssignments: vi.fn().mockReturnValue(
        of({
          count: 1,
          next: null,
          previous: null,
          results: [{ id: 4, subject_name: 'ML', subject_code: '58099', subject_type: 'THEORY' }],
        }),
      ),
      createSession: vi.fn().mockReturnValue(of({ public_id: 'sess-new' })),
    };

    TestBed.configureTestingModule({
      imports: [TeacherModule],
      providers: [provideRouter([]), { provide: AttendanceService, useValue: attendance }],
    });

    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as never;
    const fixture = TestBed.createComponent(TodayComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const buttons = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('.lecture button')).map((b) => b.textContent?.trim());

  it('lists the lectures with a button that fits each state', () => {
    const { element } = create([
      lecture({ state: 'NOT_STARTED' }),
      lecture({ slot_public_id: 'slot-2', state: 'OPEN', session: session as never }),
      lecture({ slot_public_id: 'slot-3', state: 'SUBMITTED', session: session as never }),
      lecture({ slot_public_id: 'slot-4', state: 'CANCELLED' }),
    ]);

    expect(element.querySelectorAll('.lecture').length).toBe(4);
    expect(buttons(element)).toEqual(['Start attendance', 'Continue', 'View']);
    expect(element.textContent).toContain('Cancelled');
  });

  it('disables Start and says why while it is too early', () => {
    const { element } = create([
      lecture({ can_start: false, start_message: 'You can start this lecture from 9:50 AM.' }),
    ]);
    const button = element.querySelector<HTMLButtonElement>('.lecture .btn-primary')!;

    expect(button.disabled).toBe(true);
    expect(element.querySelector('.start-note')?.textContent).toContain('from 9:50 AM');
  });

  it('shows no note when the lecture can be started', () => {
    const { element } = create([lecture()]);

    expect(element.querySelector('.start-note')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('.lecture .btn-primary')!.disabled).toBe(false);
  });

  it('shows an empty message when there are no lectures', () => {
    const { element } = create([]);

    expect(element.textContent).toContain('No lectures scheduled for this day');
  });

  it('starts the session of a slot and opens it', () => {
    const { element, fixture } = create([lecture()]);

    element.querySelector<HTMLButtonElement>('.lecture .btn-primary')!.click();
    fixture.detectChanges();

    expect(attendance['startSlot']).toHaveBeenCalledWith('slot-1', expect.any(String));
    expect(navigate).toHaveBeenCalledWith(['/teacher/sessions', 'sess-9']);
  });

  it('opens an existing session without starting a new one', () => {
    const { element } = create([lecture({ state: 'OPEN', session: session as never })]);

    element.querySelector<HTMLButtonElement>('.lecture .btn-primary')!.click();

    expect(attendance['startSlot']).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/teacher/sessions', 'sess-1']);
  });

  it('shows the error and a retry button when loading fails', () => {
    const { element, fixture } = create([]);
    attendance['today'].mockReturnValue(
      throwError(() => new GlobalException({ status: 0, message: 'Cannot reach the server.' })),
    );

    fixture.componentInstance.load();
    fixture.detectChanges();

    expect(element.querySelector('.alert')?.textContent).toContain('Cannot reach the server.');
  });

  it('asks for another day when the date changes', () => {
    const { fixture } = create([]);

    fixture.componentInstance.changeDate('2026-10-20');

    expect(attendance['today']).toHaveBeenLastCalledWith('2026-10-20');
  });

  describe('extra lecture', () => {
    function fill(component: TodayComponent, values: Record<string, unknown>) {
      component.openExtra();
      component.extraForm.patchValue(values);
    }

    it('loads the subjects of the teacher when the form opens', () => {
      const { fixture } = create([]);

      fixture.componentInstance.openExtra();
      fixture.detectChanges();

      expect(attendance['myAssignments']).toHaveBeenCalledTimes(1);
      expect(fixture.nativeElement.textContent).toContain('Start an extra lecture');
      expect(fixture.componentInstance.assignments.length).toBe(1);
    });

    it('opens in a dialog that closes with Escape or a click outside it', () => {
      const { fixture } = create([]);
      const element = fixture.nativeElement as HTMLElement;

      fixture.componentInstance.openExtra();
      fixture.detectChanges();
      expect(element.querySelector('.modal-backdrop .modal')).not.toBeNull();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(element.querySelector('.modal')).toBeNull();

      fixture.componentInstance.openExtra();
      fixture.detectChanges();
      element.querySelector<HTMLElement>('.modal-backdrop')!.click();
      fixture.detectChanges();
      expect(element.querySelector('.modal')).toBeNull();
    });

    it('starts the times at now and an hour later, on 5-minute steps', () => {
      const { fixture } = create([]);
      const component = fixture.componentInstance;

      component.openExtra();
      const { start_time, end_time } = component.extraForm.getRawValue();

      expect(start_time).toMatch(/^\d\d:\d[05]$/);
      const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
      expect(minutes(end_time) - minutes(start_time)).toBeLessThanOrEqual(60);
    });

    it('shows three drop-downs per time instead of the browser time picker', () => {
      const { fixture } = create([]);
      const element = fixture.nativeElement as HTMLElement;

      fixture.componentInstance.openExtra();
      fixture.detectChanges();

      expect(element.querySelectorAll('.time-select').length).toBe(2);
      expect(element.querySelectorAll('.time-select select').length).toBe(6);
      expect(element.querySelector('input[type="time"]')).toBeNull();
    });

    it('needs a subject and times before it calls the server', () => {
      const { fixture } = create([]);
      fixture.componentInstance.openExtra();

      fixture.componentInstance.startExtra();

      expect(attendance['createSession']).not.toHaveBeenCalled();
    });

    it('rejects an end time that is not after the start time', () => {
      const { fixture } = create([]);
      fill(fixture.componentInstance, {
        teacher_assignment: 4,
        start_time: '10:00',
        end_time: '09:00',
      });

      fixture.componentInstance.startExtra();

      expect(attendance['createSession']).not.toHaveBeenCalled();
      expect(fixture.componentInstance.extraErrors[0]).toContain('end time');
    });

    it('creates the session and opens it', () => {
      const { fixture } = create([]);
      fill(fixture.componentInstance, {
        teacher_assignment: 4,
        date: '2026-10-29',
        start_time: '14:00',
        end_time: '15:00',
      });

      fixture.componentInstance.startExtra();

      expect(attendance['createSession']).toHaveBeenCalledWith({
        teacher_assignment: 4,
        date: '2026-10-29',
        start_time: '14:00',
        end_time: '15:00',
      });
      expect(navigate).toHaveBeenCalledWith(['/teacher/sessions', 'sess-new']);
    });

    it('shows the server message, for example an overlap', () => {
      const { fixture } = create([]);
      attendance['createSession'].mockReturnValue(
        throwError(
          () =>
            new GlobalException({
              status: 400,
              message: 'x',
              generalErrors: ['This overlaps another lecture.'],
            }),
        ),
      );
      fill(fixture.componentInstance, {
        teacher_assignment: 4,
        start_time: '09:00',
        end_time: '10:00',
      });

      fixture.componentInstance.startExtra();

      expect(fixture.componentInstance.extraErrors).toContain('This overlaps another lecture.');
      expect(fixture.componentInstance.savingExtra).toBe(false);
    });
  });
});
