import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { EMPTY, Subject, Subscription, catchError, switchMap, tap } from 'rxjs';
import {
  AcademicYear,
  ReportFormat,
  SubjectAttendanceReport,
  SubjectReportStudent,
} from 'src/app/api/models';
import { AttendanceService, DirectoryService, ReportsService } from 'src/app/api/services';
import { UserType } from 'src/app/auth/enums';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { monthRange, saveBlob } from 'src/app/shared/utils';

interface Choice {
  id: number;
  label: string;
}

/**
 * Report 1: the attendance of every student in one subject, for one academic year and optionally
 * a range of dates. An administrator chooses among the subjects of the college, a teacher among
 * their own. The report can be downloaded as Excel or CSV.
 */
@Component({
  selector: 'app-subject-attendance-report',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './subject-attendance-report.component.html',
  styleUrls: ['./subject-attendance-report.component.scss'],
})
export class SubjectAttendanceReportComponent implements OnInit, OnDestroy {
  /** A teacher chooses among their own subjects; an administrator among every subject of the college. */
  readonly teacher: boolean;

  filters: FormGroup;
  years: AcademicYear[] = [];
  subjects: Choice[] = [];

  report: SubjectAttendanceReport | null = null;
  /** Show only the students under the limit. */
  lowOnly = false;
  loading = false;
  error = '';
  /** The format being downloaded, while it is. */
  downloading: ReportFormat | '' = '';

  /** Every load goes through here, so a slow answer to an old choice never replaces a newer one. */
  private readonly reload$ = new Subject<void>();
  private readonly subscription = new Subscription();

  constructor(
    fb: FormBuilder,
    auth: AuthService,
    private reports: ReportsService,
    private directory: DirectoryService,
    private attendance: AttendanceService,
  ) {
    this.teacher = auth.userType === UserType.TEACHER;
    this.filters = fb.group({
      year: [null as number | null],
      subject: [null as number | null],
      from: [''],
      to: [''],
    });
  }

  ngOnInit(): void {
    this.subscription.add(
      this.reload$
        .pipe(
          tap(() => {
            this.loading = true;
            this.error = '';
          }),
          switchMap(() =>
            this.reports.subjectAttendance(this.query()).pipe(
              catchError((error: GlobalException) => {
                this.loading = false;
                this.error = error.message;
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe((report) => {
          this.report = report;
          this.loading = false;
        }),
    );

    const controls = this.filters.controls;

    // Another year means other subjects and other dates: the old choice and its report go.
    this.subscription.add(
      controls['year'].valueChanges.subscribe(() => {
        controls['subject'].setValue(null, { emitEvent: false });
        this.filters.patchValue(this.defaultDates(), { emitEvent: false });
        this.report = null;
        this.loadSubjects();
      }),
    );
    this.subscription.add(controls['subject'].valueChanges.subscribe(() => this.reload()));
    this.subscription.add(controls['from'].valueChanges.subscribe(() => this.reload()));
    this.subscription.add(controls['to'].valueChanges.subscribe(() => this.reload()));

    this.directory.academicYears().subscribe((page) => {
      this.years = page.results;
      const current = this.years.find((item) => item.is_active) ?? this.years[0];
      if (current) controls['year'].setValue(current.id);
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /**
   * The chosen subject. Read from the control, not from `filters.value`: a control tells its own
   * listeners about a change before the group's cached value is updated.
   */
  get subject(): number | null {
    return this.filters.controls['subject'].value;
  }

  /** The students to show: all of them, or only those under the limit. */
  get students(): SubjectReportStudent[] {
    const all = this.report?.students ?? [];
    return this.lowOnly ? all.filter((student) => student.below_limit) : all;
  }

  get hasDates(): boolean {
    const { from, to } = this.filters.getRawValue();
    return !!(from || to);
  }

  /** Count every lecture of the academic year. */
  wholeYear(): void {
    this.filters.patchValue({ from: '', to: '' });
  }

  /** Count only the lectures of the current month. */
  thisMonth(): void {
    this.filters.patchValue(monthRange());
  }

  toggleLowOnly(): void {
    this.lowOnly = !this.lowOnly;
  }

  retry(): void {
    this.reload();
  }

  download(format: ReportFormat): void {
    if (!this.subject || this.downloading) return;

    this.downloading = format;
    this.error = '';

    this.reports.download('subject-attendance', this.query(), format).subscribe({
      next: (blob) => {
        this.downloading = '';
        const code = this.report?.subject.subject_code ?? 'subject';
        saveBlob(blob, `attendance-${code}.${format}`);
      },
      error: (error: GlobalException) => {
        this.downloading = '';
        this.error = error.message;
      },
    });
  }

  /**
   * The current month when the current academic year is chosen. A past year has no current month, so
   * it starts on the whole year.
   */
  private defaultDates(): { from: string; to: string } {
    const chosen = this.years.find((item) => item.id === this.filters.controls['year'].value);
    return chosen?.is_active ? monthRange() : { from: '', to: '' };
  }

  private reload(): void {
    if (!this.subject) {
      this.report = null;
      return;
    }
    this.reload$.next();
  }

  private loadSubjects(): void {
    const year = this.filters.controls['year'].value as number | null;
    this.subjects = [];
    if (!year) return;

    if (this.teacher) {
      this.attendance.myAssignments(true, year).subscribe(
        (page) =>
          (this.subjects = page.results.map((item) => ({
            id: item.subject_offering,
            label: `${item.subject_name} (${item.subject_code}) · ${item.program_name}`,
          }))),
      );
    } else {
      this.directory.subjectOfferings({ academic_year: year, is_active: true }).subscribe(
        (page) =>
          (this.subjects = page.results.map((item) => ({
            id: item.id,
            label: `${item.subject_name} (${item.subject_code}) · ${item.program_name} · Sem ${item.semester_number}`,
          }))),
      );
    }
  }

  private query() {
    const { subject, from, to } = this.filters.getRawValue();

    return { subject_offering: subject, date__gte: from, date__lte: to };
  }
}
