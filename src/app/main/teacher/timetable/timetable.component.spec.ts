import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TimetableSlot } from 'src/app/api/models';
import { AttendanceService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { isoWeekday } from '../../attendance/timetable-grid';
import { TeacherModule } from '../teacher.module';
import { TimetableComponent } from './timetable.component';

const slot = (overrides: Partial<TimetableSlot>): TimetableSlot =>
  ({
    id: 1,
    public_id: 'p1',
    day_of_week: 4,
    start_time: '09:00:00',
    end_time: '10:00:00',
    subject_name: 'Machine Learning',
    subject_code: '58099',
    room: 'B-12',
    valid_from: '2000-01-01',
    valid_to: '2999-12-31',
    ...overrides,
  }) as TimetableSlot;

const page = (results: TimetableSlot[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

describe('TimetableComponent', () => {
  let attendance: { timetable: ReturnType<typeof vi.fn> };

  function create(slots: TimetableSlot[]) {
    attendance = { timetable: vi.fn().mockReturnValue(of(page(slots))) };
    TestBed.configureTestingModule({
      imports: [TeacherModule],
      providers: [provideRouter([]), { provide: AttendanceService, useValue: attendance }],
    });
    const fixture = TestBed.createComponent(TimetableComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  it('shows the slots under their weekday with time, subject and room', () => {
    const { element } = create([slot({})]);

    const thursday = Array.from(element.querySelectorAll('.day')).find((d) =>
      d.textContent?.includes('Thursday'),
    )!;
    expect(thursday.textContent).toContain('9:00 AM - 10:00 AM');
    expect(thursday.textContent).toContain('Machine Learning');
    expect(thursday.textContent).toContain('Room B-12');
    expect(element.querySelectorAll('.day').length).toBe(6);
  });

  it('says there are no lectures on empty days', () => {
    const { element } = create([slot({})]);

    expect(element.querySelectorAll('.none').length).toBe(5);
  });

  it('marks the column of the current weekday as today', () => {
    const weekday = isoWeekday(new Date());
    const { element, component } = create([slot({ day_of_week: weekday })]);

    expect(component.todayNumber).toBe(weekday);
    expect(element.querySelectorAll('.day.today').length).toBe(1);
  });

  it('hides ended and upcoming slots until asked, and counts them', () => {
    const { element, fixture, component } = create([
      slot({ id: 1 }),
      slot({ id: 2, public_id: 'p2', subject_name: 'Old Subject', valid_to: '2001-01-01' }),
      slot({ id: 3, public_id: 'p3', subject_name: 'Next Year', valid_from: '2998-01-01' }),
    ]);

    expect(component.hiddenCount).toBe(2);
    expect(component.weeklyCount).toBe(1);
    expect(element.textContent).not.toContain('Old Subject');

    component.showAll = true;
    fixture.detectChanges();

    expect(element.textContent).toContain('Old Subject');
    expect(element.textContent).toContain('Ended');
    expect(element.textContent).toContain('Starts');
    expect(element.querySelectorAll('.slot.faded').length).toBe(2);
  });

  it('explains an empty timetable', () => {
    const { element } = create([]);

    expect(element.textContent).toContain('No timetable yet');
  });

  it('shows the error and a retry button', () => {
    const { element, fixture, component } = create([]);
    attendance.timetable.mockReturnValue(
      throwError(() => new GlobalException({ status: 0, message: 'Cannot reach the server.' })),
    );

    component.load();
    fixture.detectChanges();

    expect(element.querySelector('.alert')?.textContent).toContain('Cannot reach the server.');
  });
});
