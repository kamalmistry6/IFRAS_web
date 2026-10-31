import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SubjectAttendanceReport, SubjectReportStudent } from 'src/app/api/models';
import { AttendanceService, DirectoryService, ReportsService } from 'src/app/api/services';
import { UserType } from 'src/app/auth/enums';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { monthRange } from 'src/app/shared/utils';
import { ReportsModule } from '../reports.module';
import { SubjectAttendanceReportComponent } from './subject-attendance-report.component';

const student = (overrides: Partial<SubjectReportStudent> = {}): SubjectReportStudent => ({
  enrollment: 1,
  roll_number: '78001',
  student_name: 'Asha Rao',
  username: 'asha',
  present: 4,
  absent: 0,
  total: 4,
  percentage: 100,
  below_limit: false,
  ...overrides,
});

const report = (overrides: Partial<SubjectAttendanceReport> = {}): SubjectAttendanceReport => ({
  subject: {
    subject_offering: 5,
    subject_name: 'Machine Learning',
    subject_code: 'ML99',
    subject_type: 'THEORY',
    program_name: 'MSc IT',
    semester_number: 3,
    year_of_study: 2,
    academic_year: { id: 2, name: '2026-2027' },
    teachers: ['Amit Patil'],
  },
  period: { from: null, to: null },
  limit: 75,
  lectures_held: 4,
  summary: { students: 3, below_limit: 1, average_percentage: 56.3 },
  students: [
    student(),
    student({
      enrollment: 2,
      roll_number: '78003',
      student_name: 'Ravi Kumar',
      username: 'ravi',
      present: 2,
      absent: 2,
      percentage: 50,
      below_limit: true,
    }),
    student({
      enrollment: 3,
      roll_number: '78005',
      student_name: 'New Student',
      username: 'new',
      present: 0,
      absent: 0,
      total: 0,
      percentage: null,
    }),
  ],
  ...overrides,
});

const years = [
  { id: 1, name: '2025-2026', is_active: false },
  { id: 2, name: '2026-2027', is_active: true },
];

const page = <T>(results: T[]) => ({ count: results.length, next: null, previous: null, results });

describe('SubjectAttendanceReportComponent', () => {
  let reports: Record<string, ReturnType<typeof vi.fn>>;
  let directory: Record<string, ReturnType<typeof vi.fn>>;
  let attendance: Record<string, ReturnType<typeof vi.fn>>;

  function create(userType = UserType.ADMIN) {
    reports = {
      subjectAttendance: vi.fn().mockReturnValue(of(report())),
      download: vi.fn().mockReturnValue(of(new Blob(['x']))),
    };
    directory = {
      academicYears: vi.fn().mockReturnValue(of(page(years))),
      subjectOfferings: vi.fn().mockReturnValue(
        of(
          page([
            {
              id: 5,
              subject_name: 'Machine Learning',
              subject_code: 'ML99',
              program_name: 'MSc IT',
              semester_number: 3,
            },
          ]),
        ),
      ),
    };
    attendance = {
      myAssignments: vi.fn().mockReturnValue(
        of(
          page([
            {
              subject_offering: 7,
              subject_name: 'Cloud Computing',
              subject_code: 'CC31',
              program_name: 'MSc IT',
            },
          ]),
        ),
      ),
    };
    TestBed.configureTestingModule({
      imports: [ReportsModule],
      providers: [
        { provide: ReportsService, useValue: reports },
        { provide: DirectoryService, useValue: directory },
        { provide: AttendanceService, useValue: attendance },
        { provide: AuthService, useValue: { userType } },
      ],
    });
    const fixture = TestBed.createComponent(SubjectAttendanceReportComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  const choose = (
    component: SubjectAttendanceReportComponent,
    fixture: { detectChanges(): void },
    subject = 5,
  ) => {
    component.filters.patchValue({ subject });
    fixture.detectChanges();
  };

  describe('before a subject is chosen', () => {
    it('starts on the current academic year and asks for a subject', () => {
      const { component, element } = create();

      expect(component.filters.value.year).toBe(2);
      expect(reports['subjectAttendance']).not.toHaveBeenCalled();
      expect(element.textContent).toContain('Choose a subject');
    });

    it('offers an administrator the active subjects of the college for that year', () => {
      const { component } = create();

      expect(directory['subjectOfferings']).toHaveBeenCalledWith({
        academic_year: 2,
        is_active: true,
      });
      expect(component.subjects).toEqual([
        { id: 5, label: 'Machine Learning (ML99) · MSc IT · Sem 3' },
      ]);
      expect(attendance['myAssignments']).not.toHaveBeenCalled();
    });

    it('offers a teacher only their own subjects, by the offering id', () => {
      const { component, element } = create(UserType.TEACHER);

      expect(attendance['myAssignments']).toHaveBeenCalledWith(true, 2);
      expect(directory['subjectOfferings']).not.toHaveBeenCalled();
      expect(component.subjects).toEqual([{ id: 7, label: 'Cloud Computing (CC31) · MSc IT' }]);
      expect(element.textContent).toContain('one of your subjects');
    });
  });

  describe('the report', () => {
    it('is loaded when a subject is chosen, for the current month', () => {
      const { component, fixture } = create();
      const month = monthRange();

      choose(component, fixture);

      expect(reports['subjectAttendance']).toHaveBeenCalledWith({
        subject_offering: 5,
        date__gte: month.from,
        date__lte: month.to,
      });
    });

    it('shows the subject, its numbers and a row for each student', () => {
      const { component, fixture, element } = create();

      choose(component, fixture);

      const text = element.textContent ?? '';
      expect(text).toContain('Machine Learning');
      expect(text).toContain('ML99 · MSc IT · Semester 3 · 2026-2027');
      expect(text).toContain('Taught by Amit Patil');
      const facts = [...element.querySelectorAll('.facts dd')].map((dd) => dd.textContent?.trim());
      expect(facts).toEqual(['4', '3', '1', '56.3%']);
      const rows = [...element.querySelectorAll('tbody tr')];
      expect(rows.length).toBe(3);
      expect(rows[0].textContent).toContain('Asha Rao');
      expect(rows[0].textContent).toContain('100%');
    });

    it('flags a student under the limit and shows a dash before the first lecture', () => {
      const { component, fixture, element } = create();

      choose(component, fixture);
      const rows = [...element.querySelectorAll('tbody tr')];

      expect(rows[0].querySelector('.badge-warning')).toBeNull();
      expect(rows[1].querySelector('.badge-warning')?.textContent).toContain('Low');
      expect(rows[1].querySelector('.meter.low')).not.toBeNull();
      expect(rows[2].querySelector('.meter')?.textContent).toContain('-');
      expect(rows[2].querySelector('.badge-warning')).toBeNull();
    });

    it('loads again when a date is chosen, and again when the dates are cleared', () => {
      const { component, fixture, element } = create();
      choose(component, fixture);
      reports['subjectAttendance'].mockClear();

      component.filters.patchValue({ from: '2026-10-01', to: '2026-10-31' });
      fixture.detectChanges();

      expect(reports['subjectAttendance']).toHaveBeenLastCalledWith({
        subject_offering: 5,
        date__gte: '2026-10-01',
        date__lte: '2026-10-31',
      });
      expect(component.hasDates).toBe(true);

      element.querySelector<HTMLButtonElement>('.clear')!.click();

      expect(component.hasDates).toBe(false);
      expect(reports['subjectAttendance']).toHaveBeenLastCalledWith({
        subject_offering: 5,
        date__gte: '',
        date__lte: '',
      });
    });

    it('starts on the current month and says so', () => {
      const { component, fixture, element } = create();
      const month = monthRange();
      reports['subjectAttendance'].mockReturnValue(
        of(report({ period: { from: month.from, to: month.to } })),
      );

      choose(component, fixture);

      expect(component.filters.value.from).toBe(month.from);
      expect(component.filters.value.to).toBe(month.to);
      expect(element.querySelector('.period')?.textContent).toMatch(
        /Lectures from \d+ \w+ \d{4} to \d+ \w+ \d{4}/,
      );
    });

    it('says "the whole academic year" when no dates are chosen', () => {
      const { component, fixture, element } = create();
      choose(component, fixture);

      component.wholeYear();
      fixture.detectChanges();

      expect(component.hasDates).toBe(false);
      expect(element.querySelector('.period')?.textContent).toContain(
        'Lectures of the whole academic year',
      );
    });

    it('switches between the whole year and this month with its button', () => {
      const { component, fixture, element } = create();
      const button = () => element.querySelector<HTMLButtonElement>('.clear')!;
      expect(button().textContent).toContain('Whole year');

      button().click();
      fixture.detectChanges();
      expect(component.filters.value.from).toBe('');
      expect(button().textContent).toContain('This month');

      button().click();
      fixture.detectChanges();
      expect(component.filters.value.from).toBe(monthRange().from);
      expect(component.filters.value.to).toBe(monthRange().to);
    });

    it('starts a past year on the whole year, and the current year again on this month', () => {
      const { component } = create();
      expect(component.filters.value.from).toBe(monthRange().from);

      component.filters.patchValue({ year: 1 });
      expect(component.filters.value.from).toBe('');
      expect(component.filters.value.to).toBe('');

      component.filters.patchValue({ year: 2 });
      expect(component.filters.value.from).toBe(monthRange().from);
      expect(component.filters.value.to).toBe(monthRange().to);
    });

    it('shows only the students under the limit when asked', () => {
      const { component, fixture, element } = create();
      choose(component, fixture);

      [...element.querySelectorAll<HTMLButtonElement>('.chip')][1].click();
      fixture.detectChanges();

      const rows = [...element.querySelectorAll('tbody tr')];
      expect(component.lowOnly).toBe(true);
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('Ravi Kumar');

      [...element.querySelectorAll<HTMLButtonElement>('.chip')][0].click();
      fixture.detectChanges();
      expect(element.querySelectorAll('tbody tr').length).toBe(3);
    });

    it('says so when nobody is under the limit, or there are no students', () => {
      const { component, fixture, element } = create();
      reports['subjectAttendance'].mockReturnValue(
        of(
          report({
            summary: { students: 1, below_limit: 0, average_percentage: 100 },
            students: [student()],
          }),
        ),
      );
      choose(component, fixture);
      component.toggleLowOnly();
      fixture.detectChanges();
      expect(element.textContent).toContain('Nobody is below 75%');

      reports['subjectAttendance'].mockReturnValue(
        of(
          report({
            summary: { students: 0, below_limit: 0, average_percentage: null },
            students: [],
          }),
        ),
      );
      component.toggleLowOnly();
      component.filters.patchValue({ to: '2026-10-31' });
      fixture.detectChanges();
      expect(element.textContent).toContain('No students found');
      expect(element.querySelector('.facts')?.textContent).toContain('-');
    });

    it('forgets the subject and its report when another year is chosen', () => {
      const { component, fixture, element } = create();
      choose(component, fixture);
      directory['subjectOfferings'].mockClear();

      component.filters.patchValue({ year: 1 });
      fixture.detectChanges();

      expect(component.filters.value.subject).toBeNull();
      expect(component.report).toBeNull();
      expect(directory['subjectOfferings']).toHaveBeenCalledWith({
        academic_year: 1,
        is_active: true,
      });
      expect(element.textContent).toContain('Choose a subject');
    });

    it('shows a failure with a retry button', () => {
      const { component, fixture, element } = create();
      reports['subjectAttendance'].mockReturnValue(
        throwError(() => new GlobalException({ status: 500, message: 'Server error.' })),
      );
      choose(component, fixture);
      expect(element.querySelector('.alert-danger')?.textContent).toContain('Server error.');

      reports['subjectAttendance'].mockReturnValue(of(report()));
      element.querySelector<HTMLButtonElement>('.alert-danger button')!.click();
      fixture.detectChanges();

      expect(element.querySelector('.alert-danger')).toBeNull();
      expect(element.textContent).toContain('Machine Learning');
    });
  });

  describe('downloading', () => {
    let link: HTMLAnchorElement | undefined;

    beforeEach(() => {
      link = undefined;
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        link = this;
      });
    });

    afterEach(() => vi.restoreAllMocks());

    it('downloads the same report as Excel, named after the subject', () => {
      const { component, fixture, element } = create();
      component.filters.patchValue({ from: '2026-10-01' });
      choose(component, fixture);

      [...element.querySelectorAll<HTMLButtonElement>('.downloads button')][0].click();

      expect(reports['download']).toHaveBeenCalledWith(
        'subject-attendance',
        { subject_offering: 5, date__gte: '2026-10-01', date__lte: monthRange().to },
        'xlsx',
      );
      expect(link?.download).toBe('attendance-ML99.xlsx');
      expect(component.downloading).toBe('');
    });

    it('downloads CSV too', () => {
      const { component, fixture, element } = create();
      choose(component, fixture);

      [...element.querySelectorAll<HTMLButtonElement>('.downloads button')][1].click();

      expect(reports['download']).toHaveBeenCalledWith(
        'subject-attendance',
        expect.anything(),
        'csv',
      );
      expect(link?.download).toBe('attendance-ML99.csv');
    });

    it('does nothing without a subject, or while another download runs', () => {
      const { component, fixture } = create();

      component.download('csv');
      expect(reports['download']).not.toHaveBeenCalled();

      choose(component, fixture);
      component.downloading = 'xlsx';
      component.download('csv');
      expect(reports['download']).not.toHaveBeenCalled();
    });

    it('shows why a download failed', () => {
      const { component, fixture } = create();
      choose(component, fixture);
      reports['download'].mockReturnValue(
        throwError(() => new GlobalException({ status: 500, message: 'Server error.' })),
      );

      component.download('xlsx');

      expect(component.error).toBe('Server error.');
      expect(component.downloading).toBe('');
      expect(link).toBeUndefined();
    });
  });
});
