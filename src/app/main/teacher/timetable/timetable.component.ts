import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { TimetableSlot } from 'src/app/api/models';
import { AttendanceService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { formatTime } from 'src/app/shared/utils';
import { todayIso } from '../../attendance/lecture-state';
import {
  DayColumn,
  SlotPeriod,
  groupByDay,
  isoWeekday,
  slotPeriod,
} from '../../attendance/timetable-grid';

/** T5: the teacher's weekly timetable, read only. Changes are asked from an administrator. */
@Component({
  selector: 'app-timetable',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './timetable.component.html',
  styleUrls: ['./timetable.component.scss'],
})
export class TimetableComponent implements OnInit {
  readonly formatTime = formatTime;
  /** Today's weekday, so its column can be marked. */
  readonly todayNumber = isoWeekday(new Date());

  slots: TimetableSlot[] = [];
  /** Slots that ended or have not started yet are hidden until this is ticked. */
  showAll = false;
  loading = false;
  loaded = false;
  error = '';

  private readonly today = todayIso();

  constructor(private attendance: AttendanceService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.attendance.timetable().subscribe({
      next: (page) => {
        this.slots = page.results;
        this.loading = false;
        this.loaded = true;
      },
      error: (error: GlobalException) => {
        this.loading = false;
        this.error = error.message;
      },
    });
  }

  period(slot: TimetableSlot): SlotPeriod {
    return slotPeriod(slot, this.today);
  }

  /** How many slots are hidden because they are not running now. */
  get hiddenCount(): number {
    return this.slots.filter((slot) => this.period(slot) !== 'current').length;
  }

  /** Lectures per week that are running now. */
  get weeklyCount(): number {
    return this.slots.length - this.hiddenCount;
  }

  get days(): DayColumn[] {
    const shown = this.showAll
      ? this.slots
      : this.slots.filter((slot) => this.period(slot) === 'current');

    return groupByDay(shown);
  }
}
