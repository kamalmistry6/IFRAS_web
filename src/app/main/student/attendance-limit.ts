/**
 * The lowest attendance percentage a student should keep. A constant for now: the API has no rule
 * for it yet (docs/FRONTEND_GUIDE.md, G10). Subjects under it are shown in a warning colour.
 */
export const ATTENDANCE_LIMIT = 75;

/** True when a percentage (null when there are no lectures yet) is under the limit. */
export function isLow(percentage: number | null): boolean {
  return percentage !== null && percentage < ATTENDANCE_LIMIT;
}
