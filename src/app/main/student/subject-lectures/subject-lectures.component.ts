import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, Subject, Subscription, catchError, switchMap, tap } from 'rxjs';
import { MyAttendanceRecord } from 'src/app/api/models';
import { AttendanceService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { PAGE_SIZE, PageRange, formatTime, pageRange } from 'src/app/shared/utils';

/** ST2: every lecture of one subject, newest first, present or absent. */
@Component({
  selector: 'app-subject-lectures',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './subject-lectures.component.html',
  styleUrls: ['./subject-lectures.component.scss'],
})
export class SubjectLecturesComponent implements OnInit, OnDestroy {
  readonly formatTime = formatTime;

  /** The subject offering (from the address) and the academic year ST1 was showing (optional). */
  readonly offering: number;
  readonly year: number | null;

  filters: FormGroup;

  records: MyAttendanceRecord[] = [];
  /** Taken from the first lecture: the page is opened by id and does not know the name before. */
  subjectName = '';
  subjectCode = '';
  count = 0;
  page = 1;
  loading = false;
  loaded = false;
  error = '';

  private readonly reload$ = new Subject<void>();
  private readonly subscription = new Subscription();

  constructor(
    fb: FormBuilder,
    route: ActivatedRoute,
    private attendance: AttendanceService,
  ) {
    this.offering = Number(route.snapshot.paramMap.get('offering'));
    const year = Number(route.snapshot.queryParamMap.get('year'));
    this.year = year > 0 ? year : null;
    this.filters = fb.nonNullable.group({ from: '', to: '', status: '' });
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
            this.attendance.myRecords(this.query()).pipe(
              catchError((error: GlobalException) => {
                this.loading = false;
                this.error = error.message;
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe((page) => {
          this.records = page.results;
          this.count = page.count;
          this.loading = false;
          this.loaded = true;

          const first = page.results[0];
          if (first && !this.subjectName) {
            this.subjectName = first.subject_name;
            this.subjectCode = first.subject_code;
          }
        }),
    );

    this.subscription.add(
      this.filters.valueChanges.subscribe(() => {
        this.page = 1;
        this.reload$.next();
      }),
    );

    this.reload$.next();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get range(): PageRange {
    return pageRange(this.count, this.page, PAGE_SIZE);
  }

  get hasFilters(): boolean {
    return Object.values(this.filters.getRawValue()).some((value) => !!value);
  }

  clearFilters(): void {
    this.filters.reset({ from: '', to: '', status: '' });
  }

  goTo(page: number): void {
    if (page < 1 || page > this.range.totalPages || page === this.page) return;
    this.page = page;
    this.reload$.next();
  }

  retry(): void {
    this.reload$.next();
  }

  private query() {
    const { from, to, status } = this.filters.getRawValue();

    return {
      page: this.page,
      subject_offering: this.offering,
      academic_year: this.year ?? undefined,
      date__gte: from,
      date__lte: to,
      status,
    };
  }
}
