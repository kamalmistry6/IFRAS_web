import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
  EMPTY,
  Subject,
  Subscription,
  catchError,
  debounceTime,
  merge,
  switchMap,
  tap,
} from 'rxjs';
import {
  AcademicYear,
  College,
  DefaultersReport,
  Program,
  ReportFormat,
  SubjectOffering,
} from 'src/app/api/models';
import { DirectoryService, ReportsService } from 'src/app/api/services';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { monthRange, saveBlob } from 'src/app/shared/utils';

/** The percentage the report starts with. The server uses the same value when none is sent. */
export const DEFAULT_BELOW = 75;

/**
 * Report 2: the students whose attendance is under a percentage, lowest first. Counted over every
 * submitted lecture of the academic year, or only one subject and a range of dates. Administrators
 * only. The report can be downloaded as Excel or CSV.
 */
@Component({
  selector: 'app-defaulters-report',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './defaulters-report.component.html',
  styleUrls: ['./defaulters-report.component.scss'],
})
export class DefaultersReportComponent implements OnInit, OnDestroy {
  filters: FormGroup;
  years: AcademicYear[] = [];
  programs: Program[] = [];
  subjects: SubjectOffering[] = [];
  /** A platform administrator can look at one college or at all of them. */
  colleges: College[] = [];

  report: DefaultersReport | null = null;
  loading = false;
  error = '';
  downloading: ReportFormat | '' = '';

  private readonly reload$ = new Subject<void>();
  private readonly subscription = new Subscription();

  constructor(
    fb: FormBuilder,
    private auth: AuthService,
    private reports: ReportsService,
    private directory: DirectoryService,
  ) {
    this.filters = fb.group({
      year: [null as number | null],
      program: [''],
      yearOfStudy: [''],
      subject: [''],
      below: [DEFAULT_BELOW],
      from: [''],
      to: [''],
      search: [''],
      college: [''],
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
            this.reports.defaulters(this.query()).pipe(
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

    // Another year means other subjects and other dates: the old choices go.
    this.subscription.add(
      controls['year'].valueChanges.subscribe(() => {
        controls['subject'].setValue('', { emitEvent: false });
        this.filters.patchValue(this.defaultDates(), { emitEvent: false });
        this.loadSubjects();
        this.reload$.next();
      }),
    );

    // Typing waits for a pause (one pause for both typed boxes); the other boxes act at once.
    this.subscription.add(
      merge(
        merge(controls['search'].valueChanges, controls['below'].valueChanges).pipe(
          debounceTime(300),
        ),
        controls['program'].valueChanges,
        controls['yearOfStudy'].valueChanges,
        controls['subject'].valueChanges,
        controls['from'].valueChanges,
        controls['to'].valueChanges,
        controls['college'].valueChanges,
      ).subscribe(() => this.reload$.next()),
    );

    this.directory.programs().subscribe((page) => (this.programs = page.results));
    if (this.mustChooseCollege) {
      this.directory.colleges().subscribe((page) => (this.colleges = page.results));
    }
    this.directory.academicYears().subscribe((page) => {
      this.years = page.results;
      const current = this.years.find((item) => item.is_active) ?? this.years[0];
      // This loads the subjects and the report (an empty list of years has no current year: ask anyway).
      if (current) controls['year'].setValue(current.id);
      else this.reload$.next();
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /** A platform administrator belongs to no college and may pick one. */
  get mustChooseCollege(): boolean {
    return !this.auth.user?.college;
  }

  /** 1 to the length of the chosen program, or to the longest program when none is chosen. */
  get yearOptions(): number[] {
    const chosen = this.programs.find(
      (item) => item.id === Number(this.filters.getRawValue().program),
    );
    const length = chosen
      ? chosen.duration_years
      : Math.max(4, ...this.programs.map((item) => item.duration_years));

    return Array.from({ length }, (_, index) => index + 1);
  }

  get hasFilters(): boolean {
    const value = this.filters.getRawValue();
    return !!(
      value.program ||
      value.yearOfStudy ||
      value.subject ||
      value.from !== this.defaultDates().from ||
      value.to !== this.defaultDates().to ||
      value.search ||
      value.college ||
      Number(value.below) !== DEFAULT_BELOW
    );
  }

  clearFilters(): void {
    this.filters.patchValue({
      program: '',
      yearOfStudy: '',
      subject: '',
      below: DEFAULT_BELOW,
      ...this.defaultDates(),
      search: '',
      college: '',
    });
  }

  get hasDates(): boolean {
    const { from, to } = this.filters.getRawValue();
    return !!(from || to);
  }

  /** Count every lecture of the academic year. */
  wholeYear(): void {
    this.filters.patchValue({ from: '', to: '' });
  }

  retry(): void {
    this.reload$.next();
  }

  download(format: ReportFormat): void {
    if (this.downloading) return;

    this.downloading = format;
    this.error = '';

    this.reports.download('defaulters', this.query(), format).subscribe({
      next: (blob) => {
        this.downloading = '';
        saveBlob(blob, `defaulters-${this.report?.academic_year.name ?? 'report'}.${format}`);
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

  private loadSubjects(): void {
    const year = this.filters.controls['year'].value as number | null;
    this.subjects = [];
    if (!year) return;

    this.directory
      .subjectOfferings({ academic_year: year, is_active: true })
      .subscribe((page) => (this.subjects = page.results));
  }

  private query() {
    // getRawValue(), not .value: a control tells its listeners about a change before the group's
    // cached value is updated.
    const { year, program, yearOfStudy, subject, below, from, to, search, college } =
      this.filters.getRawValue();

    return {
      academic_year: year,
      below: below || DEFAULT_BELOW,
      program,
      year_of_study: yearOfStudy,
      subject_offering: subject,
      date__gte: from,
      date__lte: to,
      search: (search ?? '').trim(),
      college,
    };
  }
}
