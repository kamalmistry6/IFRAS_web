import { DayOfWeek, TimetableSlot } from 'src/app/api/models';

export const WEEKDAYS: { number: DayOfWeek; name: string }[] = [
  { number: 1, name: 'Monday' },
  { number: 2, name: 'Tuesday' },
  { number: 3, name: 'Wednesday' },
  { number: 4, name: 'Thursday' },
  { number: 5, name: 'Friday' },
  { number: 6, name: 'Saturday' },
  { number: 7, name: 'Sunday' },
];

/** Is the slot running now, still to start, or finished? (Dates are YYYY-MM-DD, so text compares correctly.) */
export type SlotPeriod = 'current' | 'upcoming' | 'ended';

export function slotPeriod(slot: TimetableSlot, today: string): SlotPeriod {
  if (today < slot.valid_from) return 'upcoming';
  if (today > slot.valid_to) return 'ended';
  return 'current';
}

export interface DayColumn {
  number: DayOfWeek;
  name: string;
  slots: TimetableSlot[];
}

/**
 * The slots grouped by weekday, each day sorted by start time. Monday to
 * Saturday are always there; Sunday only when it has a lecture.
 */
export function groupByDay(slots: TimetableSlot[]): DayColumn[] {
  return WEEKDAYS.map((day) => ({
    ...day,
    slots: slots
      .filter((slot) => slot.day_of_week === day.number)
      .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.id - b.id),
  })).filter((day) => day.number !== 7 || day.slots.length > 0);
}

/** 1 = Monday ... 7 = Sunday for a JavaScript date (whose getDay() has Sunday as 0). */
export function isoWeekday(date: Date): DayOfWeek {
  return (((date.getDay() + 6) % 7) + 1) as DayOfWeek;
}
