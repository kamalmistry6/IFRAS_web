import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AttendanceSession, DashboardSummary } from 'src/app/api/models';
import { ReportsService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { AdminModule } from '../admin.module';
import { DashboardComponent } from './dashboard.component';

const session = (overrides: Partial<AttendanceSession> = {}): AttendanceSession =>
  ({
    public_id: 's1',
    date: '2026-10-30',
    start_time: '09:00:00',
    end_time: '10:00:00',
    subject_name: 'Networks',
    subject_code: 'IT301',
    teacher_name: 'Amit Patil',
    status: 'SUBMITTED',
    present_count: 18,
    total_students: 20,
    ...overrides,
  }) as AttendanceSession;

const summary = (overrides: Partial<DashboardSummary> = {}): DashboardSummary =>
  ({
    scope: { level: 'department', name: 'Information Technology' },
    academic_year: { id: 1, name: '2026-27' },
    month: { from: '2026-10-01', to: '2026-10-31' },
    counts: { teachers: 5, students: 120, programs: 2, subjects_offered: 9 },
    today: { date: '2026-10-31', total: 4, not_started: 1, open: 1, submitted: 2, cancelled: 0 },
    attendance: {
      lectures_held: 12,
      percentage: 71.5,
      limit: 75,
      defaulters: 3,
      previous_percentage: 80,
    },
    needs_attention: { count: 0, lectures: [] },
    unsubmitted_teachers: { days: 7, count: 0, teachers: [] },
    lowest_subjects: [],
    trend: [
      { date: '2026-10-05', lectures: 2, percentage: 80 },
      { date: '2026-10-06', lectures: 1, percentage: 60 },
    ],
    recent_sessions: [session()],
    ...overrides,
  }) as unknown as DashboardSummary;

describe('DashboardComponent', () => {
  let api: { dashboard: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;

  function create(result = of(summary())) {
    api = { dashboard: vi.fn().mockReturnValue(result) };
    TestBed.configureTestingModule({
      imports: [AdminModule],
      providers: [provideRouter([]), { provide: ReportsService, useValue: api }],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as never;
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  it('names the department the head looks after', () => {
    const { component, element } = create();

    expect(component.scopeText).toBe('Information Technology department');
    expect(element.textContent).toContain('Information Technology department');
    expect(element.textContent).toContain('2026-27');
  });

  it('names the college or platform as it is for an administrator', () => {
    const { component } = create(
      of(summary({ scope: { level: 'college', name: 'College A' } } as never)),
    );

    expect(component.scopeText).toBe('College A');
  });

  it('shows the four totals', () => {
    const { element } = create();
    const tiles = [...element.querySelectorAll('.tile')].map((tile) => tile.textContent);

    expect(tiles.length).toBe(4);
    expect(tiles[1]).toContain('120');
    expect(tiles[1]).toContain('Students');
  });

  it("shows today's lectures by state next to the ring, with the total in its middle", () => {
    const { element, component } = create();
    const states = [...element.querySelectorAll('.states li')].map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim(),
    );

    expect(element.querySelector('.donut .center')?.textContent).toContain('4');
    expect(states).toEqual(['Not started1', 'In progress1', 'Submitted2', 'Cancelled0']);
    expect(component.todayChart?.type).toBe('doughnut');
  });

  it('draws the attendance of each day against the limit', () => {
    const { component } = create();
    const [attendance] = component.trendChart!.data.datasets;

    expect(component.trendChart?.type).toBe('line');
    expect(component.trendChart!.data.labels?.length).toBe(31);
    expect(attendance.data[4]).toBe(80);
    expect(attendance.data[5]).toBe(60);
    // a day without a lecture is a gap, not a zero
    expect(attendance.data[0]).toBeNull();
    // the limit is drawn by a plugin, so hovering it cannot leave the tooltip without an item
    expect(component.trendChart!.data.datasets.length).toBe(1);
    expect(component.trendChart!.plugins?.[0].id).toBe('limitLine');
  });

  it('draws no trend, ring or subjects without a submitted lecture, and says so', () => {
    const { component, element } = create(
      of(
        summary({
          today: {
            date: '2026-10-31',
            total: 0,
            not_started: 0,
            open: 0,
            submitted: 0,
            cancelled: 0,
          },
          attendance: {
            lectures_held: 0,
            percentage: null,
            limit: 75,
            defaulters: 0,
            previous_percentage: null,
          },
          trend: [],
          recent_sessions: [],
        } as never),
      ),
    );
    const text = element.textContent ?? '';

    expect(component.trendChart).toBeNull();
    expect(component.ringChart).toBeNull();
    expect(component.todayChart).toBeNull();
    expect(component.subjectsChart).toBeNull();
    expect(text).toContain('No lectures are scheduled for today.');
    expect(text).toContain('No lecture has been submitted in this month yet.');
    expect(text).toContain('No sessions yet');
  });

  it('colours the ring amber under the limit and counts the defaulters', () => {
    const { component, element } = create();

    expect(component.low).toBe(true);
    expect(element.querySelector('.ring .center.low')).not.toBeNull();
    expect(element.querySelector('.facts')?.textContent).toContain('Students below 75%');
    expect(element.querySelector('.facts')?.textContent).toContain('3');
  });

  it('is not low at or above the limit', () => {
    const { component, element } = create(
      of(
        summary({
          attendance: {
            lectures_held: 5,
            percentage: 75,
            limit: 75,
            defaulters: 0,
            previous_percentage: null,
          },
        } as never),
      ),
    );

    expect(component.low).toBe(false);
    expect(element.querySelector('.ring .center.low')).toBeNull();
  });

  it('opens a session from the latest list', () => {
    const { element } = create();

    element.querySelector<HTMLElement>('tbody tr')!.click();

    expect(navigate).toHaveBeenCalledWith(['/admin/sessions', 's1']);
  });

  it('lists the lectures that are over but not submitted, and opens a started one', () => {
    const { element } = create(
      of(
        summary({
          needs_attention: {
            count: 2,
            lectures: [
              {
                subject_name: 'Networks',
                subject_code: 'IT301',
                teacher_name: 'Amit Patil',
                start_time: '09:00:00',
                end_time: '10:00:00',
                state: 'OPEN',
                session_public_id: 's9',
              },
              {
                subject_name: 'Maths',
                subject_code: 'IT101',
                teacher_name: 'Riya Shah',
                start_time: '10:00:00',
                end_time: '11:00:00',
                state: 'NOT_STARTED',
                session_public_id: null,
              },
            ],
          },
        } as never),
      ),
    );
    const rows = element.querySelectorAll<HTMLButtonElement>('.attention .row-link');

    expect(element.querySelector('.attention .count')?.textContent).toContain('2');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('AP');
    expect(rows[1].disabled).toBe(true);

    rows[0].click();

    expect(navigate).toHaveBeenCalledWith(['/admin/sessions', 's9']);
  });

  it('says nothing is waiting when every lecture is closed', () => {
    const { element } = create();

    expect(element.querySelector('.attention')?.textContent).toContain(
      'Every lecture that is over has been closed.',
    );
    expect(element.querySelector('.behind')?.textContent).toContain(
      'No teacher has an unsubmitted lecture.',
    );
  });

  it('lists the teachers behind, the most behind first as the server sends them', () => {
    const { element } = create(
      of(
        summary({
          unsubmitted_teachers: {
            days: 7,
            count: 2,
            teachers: [
              { teacher_name: 'Amit Patil', lectures: 3, oldest: '2026-10-27' },
              { teacher_name: 'Riya Shah', lectures: 1, oldest: '2026-10-30' },
            ],
          },
        } as never),
      ),
    );
    const text = element.querySelector('.behind')?.textContent ?? '';

    expect(text).toContain('last 7 days');
    expect(text).toContain('3 lectures');
    expect(text).toContain('1 lecture');
    expect(text.indexOf('Amit Patil')).toBeLessThan(text.indexOf('Riya Shah'));
  });

  it('draws the lowest subjects as bars, amber under the limit', () => {
    // The test page has no stylesheet, so give the two colours the chart reads.
    document.documentElement.style.setProperty('--color-warning', '#d97706');
    document.documentElement.style.setProperty('--color-primary', '#5046e5');
    const { component } = create(
      of(
        summary({
          lowest_subjects: [
            {
              subject_offering: 1,
              subject_name: 'Networks',
              subject_code: 'IT301',
              lectures: 4,
              percentage: 60,
            },
            {
              subject_offering: 2,
              subject_name: 'Maths',
              subject_code: 'IT101',
              lectures: 1,
              percentage: 90,
            },
          ],
        } as never),
      ),
    );
    const [bars] = component.subjectsChart!.data.datasets;
    const colours = bars.backgroundColor as string[];

    expect(component.subjectsChart?.type).toBe('bar');
    expect(component.subjectsChart!.data.labels).toEqual(['Networks', 'Maths']);
    expect(bars.data).toEqual([60, 90]);
    expect(colours[0]).not.toBe(colours[1]);
    expect(component.subjectsHeight).toBe('7rem');

    document.documentElement.style.removeProperty('--color-warning');
    document.documentElement.style.removeProperty('--color-primary');
  });

  it('compares with the month before', () => {
    const { component, element } = create();

    expect(component.change).toBe(-8.5);
    expect(element.querySelector('.facts')?.textContent).toContain('8.5 pts');
  });

  it('shows no comparison when the month before had no lecture', () => {
    const { component } = create(
      of(
        summary({
          attendance: {
            lectures_held: 2,
            percentage: 80,
            limit: 75,
            defaulters: 0,
            previous_percentage: null,
          },
        } as never),
      ),
    );

    expect(component.change).toBeNull();
  });

  it('asks again for the chosen month, and for this month when it is cleared', () => {
    const { component } = create();
    expect(api.dashboard).toHaveBeenLastCalledWith(undefined);

    component.month.setValue('2026-09');
    component.changeMonth();
    expect(api.dashboard).toHaveBeenLastCalledWith('2026-09');

    component.clearMonth();
    expect(component.month.value).toBe('');
    expect(api.dashboard).toHaveBeenLastCalledWith(undefined);
  });

  it('makes initials from a name', () => {
    const { component } = create();

    expect(component.initials('Amit Kumar Patil')).toBe('AK');
    expect(component.initials('riya')).toBe('R');
  });

  it('shows the error and tries again on request', () => {
    const { component, element, fixture } = create(
      throwError(() => new GlobalException({ status: 500, message: 'Server error' })) as never,
    );
    expect(element.textContent).toContain('Server error');

    api.dashboard.mockReturnValue(of(summary()));
    component.load();
    fixture.detectChanges();

    expect(component.error).toBe('');
    expect(component.data).not.toBeNull();
  });
});
