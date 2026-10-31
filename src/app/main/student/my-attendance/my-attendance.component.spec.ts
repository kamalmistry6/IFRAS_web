import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MyAttendanceSummary } from 'src/app/api/models';
import { AttendanceService, DirectoryService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { StudentModule } from '../student.module';
import { MyAttendanceComponent } from './my-attendance.component';

const summary = (overrides: Partial<MyAttendanceSummary> = {}): MyAttendanceSummary => ({
  academic_year: { id: 2, name: '2026-2027' },
  enrollment: {
    roll_number: '78001',
    program_name: 'MSc Information Technology',
    year_of_study: 2,
    status: 'ACTIVE',
  },
  overall: { present: 8, absent: 2, total: 10, percentage: 80 },
  subjects: [
    {
      subject_offering: 5,
      subject_name: 'Machine Learning',
      subject_code: '58099',
      subject_type: 'THEORY',
      present: 6,
      absent: 0,
      total: 6,
      percentage: 100,
    },
    {
      subject_offering: 6,
      subject_name: 'Cloud Computing',
      subject_code: '58031',
      subject_type: 'PRACTICAL',
      present: 2,
      absent: 2,
      total: 4,
      percentage: 50,
    },
  ],
  ...overrides,
});

const years = [
  { id: 1, name: '2025-2026' },
  { id: 2, name: '2026-2027' },
];

describe('MyAttendanceComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let navigate: ReturnType<typeof vi.fn>;

  function create(response = of(summary())) {
    api = { myAttendance: vi.fn().mockReturnValue(response) };
    TestBed.configureTestingModule({
      imports: [StudentModule],
      providers: [
        provideRouter([]),
        { provide: AttendanceService, useValue: api },
        {
          provide: DirectoryService,
          useValue: { academicYears: vi.fn().mockReturnValue(of({ results: years })) },
        },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as never;
    const fixture = TestBed.createComponent(MyAttendanceComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  it('shows the current year first, and which year the server chose', () => {
    const { component } = create();

    expect(api['myAttendance']).toHaveBeenCalledWith(null);
    expect(component.year.value).toBe(2);
  });

  it('shows the overall percentage, the counts and the enrollment', () => {
    const { element } = create();
    const text = element.textContent ?? '';

    expect(text).toContain('80%');
    expect(element.querySelector('.facts')?.textContent).toContain('8');
    expect(text).toContain('MSc Information Technology');
    expect(text).toContain('Year 2');
    expect(text).toContain('78001');
  });

  it('lists the subjects with their percentage', () => {
    const { element } = create();
    const rows = [...element.querySelectorAll('tbody tr')];

    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Machine Learning');
    expect(rows[0].textContent).toContain('6 / 6');
    expect(rows[0].textContent).toContain('100%');
    expect(rows[1].textContent).toContain('Practical');
  });

  it('flags a subject under 75% and says which one in a warning', () => {
    const { element } = create();
    const rows = [...element.querySelectorAll('tbody tr')];

    expect(rows[0].querySelector('.badge-warning')).toBeNull();
    expect(rows[1].querySelector('.badge-warning')?.textContent).toContain('Low');
    expect(rows[1].querySelector('.meter.low')).not.toBeNull();
    expect(element.querySelector('.alert-warning')?.textContent).toContain('Cloud Computing');
  });

  it('has no warning when every subject is at or above 75%', () => {
    const base = summary();
    const { element } = create(
      of(summary({ subjects: [{ ...base.subjects[0] }, { ...base.subjects[0], percentage: 75 }] })),
    );

    expect(element.querySelector('.alert-warning')).toBeNull();
  });

  it('shows a dash instead of a percentage when there are no lectures', () => {
    const base = summary();
    const { element } = create(
      of(
        summary({
          overall: { present: 0, absent: 0, total: 0, percentage: null },
          subjects: [{ ...base.subjects[0], present: 0, total: 0, percentage: null }],
        }),
      ),
    );

    expect(element.querySelector('.percent strong')?.textContent?.trim()).toBe('-');
    expect(element.querySelector('tbody .meter')?.textContent).toContain('-');
    expect(element.querySelector('.badge-warning')).toBeNull();
  });

  it('says so when the student is not enrolled yet', () => {
    const { element } = create(of(summary({ enrollment: null, subjects: [] })));

    expect(element.textContent).toContain('You are not enrolled yet');
    expect(element.querySelector('table')).toBeNull();
  });

  it('says so when no lectures are recorded yet', () => {
    const { element } = create(of(summary({ subjects: [] })));

    expect(element.textContent).toContain('No lectures recorded yet');
  });

  it('loads another year when it is chosen', () => {
    const { component } = create();
    api['myAttendance'].mockClear();

    component.year.setValue(1);

    expect(api['myAttendance']).toHaveBeenCalledWith(1);
  });

  it('explains a year the student was not enrolled in, without calling it an error', () => {
    const { component, fixture, element } = create();
    api['myAttendance'].mockReturnValue(
      throwError(() => new GlobalException({ status: 404, message: 'Not found.' })),
    );

    component.year.setValue(1);
    fixture.detectChanges();

    expect(component.notEnrolled).toBe(true);
    expect(component.error).toBe('');
    expect(element.textContent).toContain('Not enrolled in this year');
    expect(element.querySelector('.alert-danger')).toBeNull();
  });

  it('shows another failure with a retry button', () => {
    const { component, fixture, element } = create(
      throwError(() => new GlobalException({ status: 500, message: 'Server error.' })),
    );
    fixture.detectChanges();

    expect(element.querySelector('.alert-danger')?.textContent).toContain('Server error.');

    api['myAttendance'].mockReturnValue(of(summary()));
    element.querySelector<HTMLButtonElement>('.alert-danger button')!.click();
    fixture.detectChanges();

    expect(component.error).toBe('');
    expect(element.textContent).toContain('80%');
  });

  it('opens the lectures of a subject, for the year being shown', () => {
    const { element } = create();

    element.querySelectorAll<HTMLElement>('tbody tr')[1].click();

    expect(navigate).toHaveBeenCalledWith(['/student/attendance', 6], {
      queryParams: { year: 2 },
    });
  });
});
