/**
 * A time of day from the API ('HH:MM' or 'HH:MM:SS', 24-hour) as people read it:
 * '09:00:00' -> '9:00 AM', '13:30:00' -> '1:30 PM'. Midnight is '12:00 AM', noon '12:00 PM'.
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;

  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** A time of day as three choices: hour 1 to 12, minute, AM or PM (for a time select). */
export interface TimeParts {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
}

export const TIME_HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
/** Every 5 minutes: lectures start on round times, and 60 choices are too many. */
export const TIME_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/** '14:05' -> { hour: 2, minute: 5, period: 'PM' }. Text it cannot read gives 9:00 AM. */
export function toTimeParts(time: string): TimeParts {
  const [hours, minutes] = (time ?? '').split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return { hour: 9, minute: 0, period: 'AM' };

  return {
    hour: hours % 12 === 0 ? 12 : hours % 12,
    minute: minutes,
    period: hours >= 12 ? 'PM' : 'AM',
  };
}

/** { hour: 2, minute: 5, period: 'PM' } -> '14:05' (what the API takes). */
export function fromTimeParts(parts: TimeParts): string {
  const hours = (parts.hour % 12) + (parts.period === 'PM' ? 12 : 0);
  return `${String(hours).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}
