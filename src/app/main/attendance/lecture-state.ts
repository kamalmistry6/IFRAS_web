import { LectureState } from 'src/app/api/models';

export const LECTURE_STATE_LABEL: Record<LectureState, string> = {
  NOT_STARTED: 'Not started',
  OPEN: 'In progress',
  SUBMITTED: 'Submitted',
  CANCELLED: 'Cancelled',
};

/** The badge class for each state (see styles/_ui.scss). */
export const LECTURE_STATE_BADGE: Record<LectureState, string> = {
  NOT_STARTED: 'badge',
  OPEN: 'badge-info',
  SUBMITTED: 'badge-success',
  CANCELLED: 'badge-danger',
};

/** Today as YYYY-MM-DD in the browser's own time zone (toISOString would use UTC). */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
