import { TimetableSlot } from 'src/app/api/models';
import { groupByDay, isoWeekday, slotPeriod } from './timetable-grid';

const slot = (overrides: Partial<TimetableSlot>): TimetableSlot =>
  ({
    id: 1,
    day_of_week: 1,
    start_time: '09:00:00',
    valid_from: '2026-06-01',
    valid_to: '2027-05-31',
    ...overrides,
  }) as TimetableSlot;

describe('groupByDay', () => {
  it('groups by weekday and sorts each day by start time', () => {
    const days = groupByDay([
      slot({ id: 1, day_of_week: 4, start_time: '11:00:00' }),
      slot({ id: 2, day_of_week: 4, start_time: '09:00:00' }),
      slot({ id: 3, day_of_week: 2 }),
    ]);

    expect(days.find((d) => d.number === 4)!.slots.map((s) => s.id)).toEqual([2, 1]);
    expect(days.find((d) => d.number === 2)!.slots.map((s) => s.id)).toEqual([3]);
  });

  it('always shows Monday to Saturday, and Sunday only when it has a lecture', () => {
    expect(groupByDay([]).map((d) => d.name)).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]);
    expect(groupByDay([slot({ day_of_week: 7 })]).map((d) => d.name)).toContain('Sunday');
  });
});

describe('slotPeriod', () => {
  it('tells running, upcoming and ended slots apart, inclusive of both end dates', () => {
    expect(slotPeriod(slot({}), '2026-10-29')).toBe('current');
    expect(slotPeriod(slot({}), '2026-06-01')).toBe('current');
    expect(slotPeriod(slot({}), '2027-05-31')).toBe('current');
    expect(slotPeriod(slot({}), '2026-05-31')).toBe('upcoming');
    expect(slotPeriod(slot({}), '2027-06-01')).toBe('ended');
  });
});

describe('isoWeekday', () => {
  it('numbers Monday 1 and Sunday 7 (JavaScript has Sunday as 0)', () => {
    expect(isoWeekday(new Date(2026, 9, 26))).toBe(1); // Monday
    expect(isoWeekday(new Date(2026, 9, 29))).toBe(4); // Thursday
    expect(isoWeekday(new Date(2026, 9, 25))).toBe(7); // Sunday
  });
});
