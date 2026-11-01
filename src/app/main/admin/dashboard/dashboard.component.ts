import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { ChartConfiguration, Plugin } from 'chart.js';
import { AttendanceSession, DashboardLecture, DashboardSummary } from 'src/app/api/models';
import { ReportsService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { AnyChartConfig, themeColor } from 'src/app/shared/components/chart/chart.component';
import { formatTime } from 'src/app/shared/utils';
import { LECTURE_STATE_BADGE, LECTURE_STATE_LABEL } from '../../attendance/lecture-state';

/** A dashed horizontal line at `value` (the attendance limit), drawn over the chart. */
function limitLine(value: number, color: string): Plugin<'line'> {
  return {
    id: 'limitLine',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const y = scales['y'].getPixelForValue(value);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      ctx.restore();
    },
  };
}

/** One slice of "today's lectures": what to call it and which theme colour draws it. */
interface StateSlice {
  key: 'not_started' | 'open' | 'submitted' | 'cancelled';
  label: string;
  color: string;
}

const STATE_SLICES: StateSlice[] = [
  { key: 'not_started', label: LECTURE_STATE_LABEL['NOT_STARTED'], color: 'border-strong' },
  { key: 'open', label: LECTURE_STATE_LABEL['OPEN'], color: 'info' },
  { key: 'submitted', label: LECTURE_STATE_LABEL['SUBMITTED'], color: 'success' },
  { key: 'cancelled', label: LECTURE_STATE_LABEL['CANCELLED'], color: 'danger' },
];

/**
 * A1: today at a glance, for the college administrator (the college), the platform
 * administrator (everything) and the head of a department (their department): totals, what needs
 * attention, this month's attendance as charts, and the latest sessions.
 */
@Component({
  selector: 'app-dashboard',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  readonly stateLabel = LECTURE_STATE_LABEL;
  readonly stateBadge = LECTURE_STATE_BADGE;
  readonly slices = STATE_SLICES;
  readonly formatTime = formatTime;

  /** The month of the attendance numbers (YYYY-MM); empty is this month. */
  readonly month = new FormControl('', { nonNullable: true });

  data: DashboardSummary | null = null;
  loading = false;
  error = '';

  trendChart: AnyChartConfig | null = null;
  ringChart: AnyChartConfig | null = null;
  todayChart: AnyChartConfig | null = null;
  subjectsChart: AnyChartConfig | null = null;

  constructor(
    private reports: ReportsService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  /** Called by the month box. */
  changeMonth(): void {
    this.load();
  }

  clearMonth(): void {
    this.month.setValue('');
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.reports.dashboard(this.month.value || undefined).subscribe({
      next: (data) => {
        this.data = data;
        this.loading = false;
        this.buildCharts(data);
      },
      error: (error: GlobalException) => {
        this.loading = false;
        this.error = error.message;
      },
    });
  }

  /** "Information Technology department", "College A", "All colleges". */
  get scopeText(): string {
    if (!this.data) return '';
    const { level, name } = this.data.scope;
    return level === 'department' ? `${name} department` : name;
  }

  /** This month's attendance is under the limit. */
  get low(): boolean {
    const percentage = this.data?.attendance.percentage;
    return (
      percentage !== null && percentage !== undefined && percentage < this.data!.attendance.limit
    );
  }

  /** This month's percentage compared with the month before, in points; null if either is missing. */
  get change(): number | null {
    const { percentage, previous_percentage: previous } = this.data?.attendance ?? {};
    if (percentage === null || percentage === undefined) return null;
    if (previous === null || previous === undefined) return null;
    return Math.round((percentage - previous) * 10) / 10;
  }

  /** The height of the subjects chart: a row for each subject. */
  get subjectsHeight(): string {
    return `${Math.max(this.data?.lowest_subjects.length ?? 0, 1) * 3 + 1}rem`;
  }

  open(session: AttendanceSession): void {
    void this.router.navigate(['/admin/sessions', session.public_id]);
  }

  /** A lecture that was started opens its session; one never started has nothing to open. */
  openLecture(lecture: DashboardLecture): void {
    if (lecture.session_public_id) {
      void this.router.navigate(['/admin/sessions', lecture.session_public_id]);
    }
  }

  percent(session: AttendanceSession): number {
    return session.total_students === 0
      ? 0
      : Math.round((session.present_count * 100) / session.total_students);
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }

  // ---- Charts ----------------------------------------------------------------------------

  private buildCharts(d: DashboardSummary): void {
    this.trendChart = this.buildTrend(d);
    this.ringChart = this.buildRing(d);
    this.todayChart = this.buildToday(d);
    this.subjectsChart = this.buildSubjects(d);
  }

  /** Attendance for each day of the month, with the limit as a dashed line. */
  private buildTrend(d: DashboardSummary): ChartConfiguration<'line'> | null {
    if (d.trend.length === 0) return null;

    const lastDay = Number(d.month.to.slice(8, 10));
    const byDay = new Map(d.trend.map((point) => [Number(point.date.slice(8, 10)), point]));
    const days = Array.from({ length: lastDay }, (_, index) => index + 1);
    const primary = themeColor('primary');
    const grid = themeColor('border');
    const muted = themeColor('text-subtle');

    return {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Attendance',
            data: days.map((day) => byDay.get(day)?.percentage ?? null),
            borderColor: primary,
            backgroundColor: themeColor('primary-soft'),
            borderWidth: 2,
            fill: 'origin',
            tension: 0.3,
            spanGaps: true,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: primary,
            pointBorderColor: themeColor('surface'),
            pointBorderWidth: 2,
          },
        ],
      },
      plugins: [limitLine(d.attendance.limit, themeColor('warning'))],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        scales: {
          x: { grid: { display: false }, ticks: { color: muted, maxTicksLimit: 16 } },
          y: {
            min: 0,
            max: 100,
            grid: { color: grid },
            border: { display: false },
            ticks: { color: muted, stepSize: 25, callback: (value) => `${value}%` },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => {
                const day = Number(items[0]?.label);
                const date = new Date(
                  `${d.month.from.slice(0, 8)}${String(day).padStart(2, '0')}T00:00:00`,
                );
                return date.toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                });
              },
              label: (item) => {
                const lectures = byDay.get(Number(item.label))?.lectures ?? 0;
                return `${item.formattedValue}% · ${lectures} ${lectures === 1 ? 'lecture' : 'lectures'}`;
              },
            },
          },
        },
      },
    };
  }

  /** The month's attendance as a ring: green at or over the limit, amber under it. */
  private buildRing(d: DashboardSummary): ChartConfiguration<'doughnut'> | null {
    const percentage = d.attendance.percentage;
    if (d.attendance.lectures_held === 0 || percentage === null) return null;

    return {
      type: 'doughnut',
      data: {
        labels: ['Present', 'Absent'],
        datasets: [
          {
            data: [percentage, 100 - percentage],
            backgroundColor: [
              themeColor(percentage < d.attendance.limit ? 'warning' : 'success'),
              themeColor('border'),
            ],
            borderWidth: 0,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '78%',
        plugins: {
          tooltip: { callbacks: { label: (item) => `${item.label}: ${item.formattedValue}%` } },
        },
      },
    };
  }

  /** Today's lectures by state. */
  private buildToday(d: DashboardSummary): ChartConfiguration<'doughnut'> | null {
    if (d.today.total === 0) return null;

    return {
      type: 'doughnut',
      data: {
        labels: STATE_SLICES.map((slice) => slice.label),
        datasets: [
          {
            data: STATE_SLICES.map((slice) => d.today[slice.key]),
            backgroundColor: STATE_SLICES.map((slice) => themeColor(slice.color)),
            borderColor: themeColor('surface'),
            borderWidth: 3,
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%' },
    };
  }

  /** The subjects with the lowest attendance: a bar each, amber under the limit. */
  private buildSubjects(d: DashboardSummary): ChartConfiguration<'bar'> | null {
    if (d.lowest_subjects.length === 0) return null;

    const under = themeColor('warning');
    const fine = themeColor('primary');
    const muted = themeColor('text-subtle');

    return {
      type: 'bar',
      data: {
        labels: d.lowest_subjects.map((subject) => subject.subject_name),
        datasets: [
          {
            data: d.lowest_subjects.map((subject) => subject.percentage),
            backgroundColor: d.lowest_subjects.map((subject) =>
              subject.percentage < d.attendance.limit ? under : fine,
            ),
            borderRadius: 4,
            maxBarThickness: 20,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            min: 0,
            max: 100,
            grid: { color: themeColor('border') },
            border: { display: false },
            ticks: { color: muted, stepSize: 25, callback: (value) => `${value}%` },
          },
          y: { grid: { display: false }, ticks: { color: themeColor('text-muted') } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (item) => {
                const subject = d.lowest_subjects[item.dataIndex];
                return `${item.formattedValue}% · ${subject.lectures} ${subject.lectures === 1 ? 'lecture' : 'lectures'}`;
              },
            },
          },
        },
      },
    };
  }
}
