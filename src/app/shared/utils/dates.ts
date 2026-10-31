/** A Date as YYYY-MM-DD in the browser's own time zone (toISOString would use UTC and can shift the day). */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The first and last day of the month that `date` is in (today by default), as YYYY-MM-DD. */
export function monthRange(date: Date = new Date()): { from: string; to: string } {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from: toIsoDate(first), to: toIsoDate(last) };
}
