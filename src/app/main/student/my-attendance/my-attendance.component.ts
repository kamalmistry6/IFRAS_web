import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, Subject, Subscription, catchError, switchMap, tap } from 'rxjs';
import { AcademicYear, MyAttendanceSummary, SubjectAttendance } from 'src/app/api/models';
import { AttendanceService, DirectoryService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ATTENDANCE_LIMIT, isLow } from '../attendance-limit';

/**
 * ST1: a student's attendance, overall and per subject, for one academic year.
 * A subject opens its lectures (ST2).
 */
@Component({
  selector: 'app-my-attendance',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './my-attendance.component.html',
  styleUrls: ['./my-attendance.component.scss'],
})
export class MyAttendanceComponent implements OnInit, OnDestroy {
  readonly limit = ATTENDANCE_LIMIT;
  readonly isLow = isLow;

  summary: MyAttendanceSummary | null = null;
  years: AcademicYear[] = [];
  /** The academic year shown. Empty until the server says which one is current. */
  year = new FormControl<number | null>(null);

  loading = false;
  loaded = false;
  error = '';
  /** The server answered 404: the student was not enrolled in the chosen year. */
  notEnrolled = false;

  /** Every load goes through here, so a slow answer for an old year never replaces a newer one. */
  private readonly reload$ = new Subject<void>();
  private readonly subscription = new Subscription();

  constructor(
    private attendance: AttendanceService,
    private directory: DirectoryService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.reload$
        .pipe(
          tap(() => {
            this.loading = true;
            this.error = '';
            this.notEnrolled = false;
          }),
          switchMap(() =>
            this.attendance.myAttendance(this.year.value).pipe(
              catchError((error: GlobalException) => {
                this.loading = false;
                this.loaded = true;
                this.summary = null;
                if (error.status === 404) this.notEnrolled = true;
                else this.error = error.message;
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe((summary) => {
          this.summary = summary;
          this.loading = false;
          this.loaded = true;
          // Show which year the server picked, without loading it again.
          if (this.year.value === null && summary.academic_year) {
            this.year.setValue(summary.academic_year.id, { emitEvent: false });
          }
        }),
    );

    this.subscription.add(this.year.valueChanges.subscribe(() => this.reload$.next()));

    this.directory.academicYears().subscribe((page) => (this.years = page.results));
    this.reload$.next();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  retry(): void {
    this.reload$.next();
  }

  open(subject: SubjectAttendance): void {
    const year = this.summary?.academic_year?.id;
    void this.router.navigate(['/student/attendance', subject.subject_offering], {
      queryParams: year ? { year } : {},
    });
  }

  /** The bar width: 0 when there is no percentage. */
  width(percentage: number | null): number {
    return percentage ?? 0;
  }

  get lowSubjectNames(): string {
    return this.lowSubjects.map((subject) => subject.subject_name).join(', ');
  }

  get lowSubjects(): SubjectAttendance[] {
    return (this.summary?.subjects ?? []).filter((subject) => isLow(subject.percentage));
  }
}
