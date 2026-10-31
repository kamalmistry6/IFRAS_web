import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DefaultersReport } from 'src/app/api/models';
import { DirectoryService, ReportsService } from 'src/app/api/services';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { monthRange } from 'src/app/shared/utils';
import { ReportsModule } from '../reports.module';
import { DefaultersReportComponent } from './defaulters-report.component';

const report = (overrides: Partial<DefaultersReport> = {}): DefaultersReport => ({
  academic_year: { id: 2, name: '2026-2027' },
  below: 75,
  period: { from: null, to: null },
  count: 2,
  students: [
    {
      enrollment: 4,
      roll_number: '78004',
      student_name: 'Dev Shah',
      username: 'dev',
      program_name: 'MSc IT',
      year_of_study: 2,
      present: 0,
      absent: 4,
      total: 4,
      percentage: 0,
      subjects_below: 1,
    },
    {
      enrollment: 3,
      roll_number: '78003',
      student_name: 'Ravi Kumar',
      username: 'ravi',
      program_name: 'MSc IT',
      year_of_study: 2,
      present: 3,
      absent: 3,
      total: 6,
      percentage: 50,
      subjects_below: 2,
    },
  ],
  ...overrides,
});

const page = <T>(results: T[]) => ({ count: results.length, next: null, previous: null, results });

const month = monthRange();

/** What the report asks for when it opens: the current year, 75 % and the current month. */
const defaults = {
  academic_year: 2,
  below: 75,
  program: '',
  year_of_study: '',
  subject_offering: '',
  date__gte: month.from,
  date__lte: month.to,
  search: '',
  college: '',
};

describe('DefaultersReportComponent', () => {
  let reports: Record<string, ReturnType<typeof vi.fn>>;
  let directory: Record<string, ReturnType<typeof vi.fn>>;

  function create(college: object | null = { id: 1 }) {
    reports = {
      defaulters: vi.fn().mockReturnValue(of(report())),
      download: vi.fn().mockReturnValue(of(new Blob(['x']))),
    };
    directory = {
      academicYears: vi.fn().mockReturnValue(
        of(
          page([
            { id: 1, name: '2025-2026', is_active: false },
            { id: 2, name: '2026-2027', is_active: true },
          ]),
        ),
      ),
      programs: vi.fn().mockReturnValue(
        of(
          page([
            { id: 7, name: 'MSc IT', duration_years: 2 },
            { id: 8, name: 'BSc CS', duration_years: 3 },
          ]),
        ),
      ),
      subjectOfferings: vi.fn().mockReturnValue(
        of(
          page([
            {
              id: 5,
              subject_name: 'Machine Learning',
              subject_code: 'ML99',
              program_name: 'MSc IT',
            },
          ]),
        ),
      ),
      colleges: vi.fn().mockReturnValue(of(page([{ id: 5, name: 'College Five' }]))),
    };
    TestBed.configureTestingModule({
      imports: [ReportsModule],
      providers: [
        { provide: ReportsService, useValue: reports },
        { provide: DirectoryService, useValue: directory },
        { provide: AuthService, useValue: { user: { college } } },
      ],
    });
    const fixture = TestBed.createComponent(DefaultersReportComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  afterEach(() => vi.useRealTimers());

  it('starts on the current year with 75%, and shows the students under it', () => {
    const { element } = create();

    expect(reports['defaulters']).toHaveBeenCalledWith(defaults);
    const text = element.textContent ?? '';
    expect(text).toContain('2 students are below 75% in 2026-2027');
    const rows = [...element.querySelectorAll('tbody tr')];
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Dev Shah');
    expect(rows[0].textContent).toContain('0 / 4');
    expect(rows[0].textContent).toContain('1 subject');
    expect(rows[1].textContent).toContain('50%');
    expect(rows[1].textContent).toContain('2 subjects');
  });

  it('says "student is" for one student', () => {
    const { component, fixture, element } = create();
    reports['defaulters'].mockReturnValue(
      of(report({ count: 1, students: [report().students[0]] })),
    );

    component.retry();
    fixture.detectChanges();

    expect(element.querySelector('.summary')?.textContent).toContain('1 student is below 75%');
  });

  it('explains an empty report, differently when filters are on', () => {
    const { component, fixture, element } = create();
    reports['defaulters'].mockReturnValue(of(report({ count: 0, students: [] })));

    component.filters.patchValue({ program: '8' });
    fixture.detectChanges();
    expect(element.textContent).toContain('Nobody is below 75%');
    expect(element.textContent).toContain('Try a higher percentage');
    expect(element.querySelector('table')).toBeNull();

    component.clearFilters();
    fixture.detectChanges();
    expect(element.textContent).toContain('no lecture has been submitted yet');
  });

  it('sends every filter with its server name', () => {
    const { component } = create();
    reports['defaulters'].mockClear();

    component.filters.patchValue({
      program: '7',
      yearOfStudy: '2',
      subject: '5',
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(reports['defaulters']).toHaveBeenLastCalledWith({
      ...defaults,
      program: '7',
      year_of_study: '2',
      subject_offering: '5',
      date__gte: '2026-10-01',
      date__lte: '2026-10-31',
    });
  });

  it('waits for a pause in typing before it searches or changes the percentage', () => {
    vi.useFakeTimers();
    const { component } = create();
    reports['defaulters'].mockClear();

    component.filters.patchValue({ search: 'ra' });
    component.filters.patchValue({ search: ' ravi ' });
    component.filters.patchValue({ below: 60 });
    expect(reports['defaulters']).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);

    expect(reports['defaulters']).toHaveBeenCalledTimes(1);
    expect(reports['defaulters']).toHaveBeenCalledWith({ ...defaults, search: 'ravi', below: 60 });
  });

  it('falls back to 75% when the percentage box is emptied', () => {
    vi.useFakeTimers();
    const { component } = create();
    reports['defaulters'].mockClear();

    component.filters.patchValue({ below: null });
    vi.advanceTimersByTime(300);

    expect(reports['defaulters']).toHaveBeenLastCalledWith(expect.objectContaining({ below: 75 }));
  });

  it('offers years of study up to the chosen program, or the longest one', () => {
    const { component } = create();
    expect(component.yearOptions).toEqual([1, 2, 3, 4]);

    component.filters.patchValue({ program: '7' });
    expect(component.yearOptions).toEqual([1, 2]);
  });

  it('forgets the subject and loads the subjects of another year', () => {
    const { component } = create();
    component.filters.patchValue({ subject: '5' });
    directory['subjectOfferings'].mockClear();
    reports['defaulters'].mockClear();

    component.filters.patchValue({ year: 1 });

    expect(component.filters.value.subject).toBe('');
    expect(directory['subjectOfferings']).toHaveBeenCalledWith({
      academic_year: 1,
      is_active: true,
    });
    expect(reports['defaulters']).toHaveBeenLastCalledWith({
      ...defaults,
      academic_year: 1,
      date__gte: '',
      date__lte: '',
    });
  });

  it('starts on the current month and says so', () => {
    const { component, fixture, element } = create();
    reports['defaulters'].mockReturnValue(
      of(report({ period: { from: month.from, to: month.to } })),
    );
    component.retry();
    fixture.detectChanges();

    expect(component.filters.value.from).toBe(month.from);
    expect(component.hasFilters).toBe(false);
    expect(element.querySelector('.summary')?.textContent).toMatch(
      /Lectures from \d+ \w+ \d{4} to \d+ \w+ \d{4}/,
    );
  });

  it('counts the whole year with its button, and says so', () => {
    const { component, fixture, element } = create();
    const button = () =>
      [...element.querySelectorAll<HTMLButtonElement>('.clear')].find((item) =>
        item.textContent?.includes('Whole year'),
      );

    button()!.click();
    fixture.detectChanges();

    expect(reports['defaulters']).toHaveBeenLastCalledWith({
      ...defaults,
      date__gte: '',
      date__lte: '',
    });
    expect(component.hasDates).toBe(false);
    expect(button()).toBeUndefined();
    expect(element.querySelector('.summary')?.textContent).toContain(
      'Lectures of the whole academic year',
    );
    // it differs from where the report opens, so Clear is offered
    expect(component.hasFilters).toBe(true);
  });

  it('starts a past year on the whole year', () => {
    const { component } = create();

    component.filters.patchValue({ year: 1 });

    expect(reports['defaulters']).toHaveBeenLastCalledWith({
      ...defaults,
      academic_year: 1,
      date__gte: '',
      date__lte: '',
    });
    expect(component.hasFilters).toBe(false);
  });

  it('clears every filter, including the percentage', () => {
    const { component } = create();
    expect(component.hasFilters).toBe(false);

    component.filters.patchValue({ program: '7', below: 50, search: 'x' });
    expect(component.hasFilters).toBe(true);

    component.clearFilters();

    expect(component.hasFilters).toBe(false);
    expect(component.filters.value.below).toBe(75);
    expect(component.filters.value.from).toBe(month.from);
    expect(component.filters.value.to).toBe(month.to);
  });

  it('lets a platform administrator choose a college, but not a college administrator', () => {
    const own = create();
    expect(own.component.mustChooseCollege).toBe(false);
    expect(own.element.querySelector('#df-college')).toBeNull();
    expect(directory['colleges']).not.toHaveBeenCalled();
    TestBed.resetTestingModule();

    const platform = create(null);
    expect(directory['colleges']).toHaveBeenCalled();
    expect(platform.element.querySelector('#df-college')).not.toBeNull();

    platform.component.filters.patchValue({ college: '5' });
    expect(reports['defaulters']).toHaveBeenLastCalledWith(
      expect.objectContaining({ college: '5' }),
    );
  });

  it('shows a failure with a retry button', () => {
    const { component, fixture, element } = create();
    reports['defaulters'].mockReturnValue(
      throwError(() => new GlobalException({ status: 500, message: 'Server error.' })),
    );
    component.retry();
    fixture.detectChanges();
    expect(element.querySelector('.alert-danger')?.textContent).toContain('Server error.');

    reports['defaulters'].mockReturnValue(of(report()));
    element.querySelector<HTMLButtonElement>('.alert-danger button')!.click();
    fixture.detectChanges();

    expect(element.querySelector('.alert-danger')).toBeNull();
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

    it('downloads the same report with the same filters', () => {
      const { component, element } = create();
      component.filters.patchValue({ program: '7' });

      [...element.querySelectorAll<HTMLButtonElement>('.downloads button')][0].click();

      expect(reports['download']).toHaveBeenCalledWith(
        'defaulters',
        { ...defaults, program: '7' },
        'xlsx',
      );
      expect(link?.download).toBe('defaulters-2026-2027.xlsx');
    });

    it('downloads CSV too', () => {
      const { element } = create();

      [...element.querySelectorAll<HTMLButtonElement>('.downloads button')][1].click();

      expect(link?.download).toBe('defaulters-2026-2027.csv');
    });

    it('cannot download an empty report', () => {
      const { component, fixture, element } = create();
      reports['defaulters'].mockReturnValue(of(report({ count: 0, students: [] })));
      component.retry();
      fixture.detectChanges();

      const buttons = [...element.querySelectorAll<HTMLButtonElement>('.downloads button')];

      expect(buttons.every((button) => button.disabled)).toBe(true);
    });

    it('shows why a download failed', () => {
      const { component } = create();
      reports['download'].mockReturnValue(
        throwError(() => new GlobalException({ status: 500, message: 'Server error.' })),
      );

      component.download('csv');

      expect(component.error).toBe('Server error.');
      expect(component.downloading).toBe('');
    });
  });
});
