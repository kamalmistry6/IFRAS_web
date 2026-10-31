import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MyAttendanceRecord } from 'src/app/api/models';
import { AttendanceService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { StudentModule } from '../student.module';
import { SubjectLecturesComponent } from './subject-lectures.component';

const record = (overrides: Partial<MyAttendanceRecord> = {}): MyAttendanceRecord => ({
  date: '2026-10-29',
  start_time: '09:00:00',
  end_time: '10:00:00',
  subject_offering: 5,
  subject_name: 'Machine Learning',
  subject_code: '58099',
  subject_type: 'THEORY',
  teacher_name: 'Amit Patil',
  status: 'PRESENT',
  ...overrides,
});

const page = (results: MyAttendanceRecord[], count = results.length) => ({
  count,
  next: null,
  previous: null,
  results,
});

describe('SubjectLecturesComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  function create(
    query: Record<string, string> = { year: '2' },
    rows = [record()],
    count?: number,
  ) {
    api = { myRecords: vi.fn().mockReturnValue(of(page(rows, count))) };
    TestBed.configureTestingModule({
      imports: [StudentModule],
      providers: [
        provideRouter([]),
        { provide: AttendanceService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ offering: '5' }),
              queryParamMap: convertToParamMap(query),
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(SubjectLecturesComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  it('asks for the lectures of the subject and the year', () => {
    create();

    expect(api['myRecords']).toHaveBeenCalledWith({
      page: 1,
      subject_offering: 5,
      academic_year: 2,
      date__gte: '',
      date__lte: '',
      status: '',
    });
  });

  it('leaves the year out when the address has none', () => {
    create({});

    expect(api['myRecords']).toHaveBeenCalledWith(
      expect.objectContaining({ subject_offering: 5, academic_year: undefined }),
    );
  });

  it('names the subject from its first lecture and shows each lecture', () => {
    const { element } = create({ year: '2' }, [
      record(),
      record({
        date: '2026-10-28',
        start_time: '13:30:00',
        end_time: '14:30:00',
        status: 'ABSENT',
      }),
    ]);

    expect(element.querySelector('h1')?.textContent).toContain('Machine Learning');
    expect(element.querySelector('.page-banner')?.textContent).toContain('58099');
    const rows = [...element.querySelectorAll('tbody tr')];
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('9:00 AM - 10:00 AM');
    expect(rows[0].textContent).toContain('Amit Patil');
    expect(rows[0].querySelector('.badge-success')?.textContent).toContain('Present');
    expect(rows[1].textContent).toContain('1:30 PM - 2:30 PM');
    expect(rows[1].querySelector('.badge-danger')?.textContent).toContain('Absent');
  });

  it('sends each filter with its server name, from page 1', () => {
    const { component } = create({ year: '2' }, [record()], 40);
    component.page = 2;
    api['myRecords'].mockClear();

    component.filters.patchValue({ from: '2026-10-01', to: '2026-10-31', status: 'ABSENT' });

    expect(component.page).toBe(1);
    expect(api['myRecords']).toHaveBeenLastCalledWith({
      page: 1,
      subject_offering: 5,
      academic_year: 2,
      date__gte: '2026-10-01',
      date__lte: '2026-10-31',
      status: 'ABSENT',
    });
  });

  it('clears the filters', () => {
    const { component, fixture, element } = create();
    component.filters.patchValue({ status: 'PRESENT' });
    fixture.detectChanges();
    expect(component.hasFilters).toBe(true);

    element.querySelector<HTMLButtonElement>('.clear')!.click();

    expect(component.hasFilters).toBe(false);
  });

  it('pages through the lectures', () => {
    const { component, element, fixture } = create({ year: '2' }, [record()], 45);
    expect(element.querySelector('.pager')?.textContent).toContain('Page 1 of 3');
    api['myRecords'].mockClear();

    component.goTo(2);
    fixture.detectChanges();

    expect(api['myRecords']).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    component.goTo(9);
    expect(component.page).toBe(2);
  });

  it('explains an empty list, differently when filters are on', () => {
    const { component, fixture, element } = create({ year: '2' }, []);
    expect(element.textContent).toContain('appear here once a teacher submits attendance');

    component.filters.patchValue({ status: 'ABSENT' });
    fixture.detectChanges();

    expect(element.textContent).toContain('Try a wider date range');
  });

  it('shows the error and a retry button', () => {
    const { component, fixture, element } = create();
    api['myRecords'].mockReturnValue(
      throwError(() => new GlobalException({ status: 500, message: 'Server error.' })),
    );
    component.retry();
    fixture.detectChanges();
    expect(element.querySelector('.alert-danger')?.textContent).toContain('Server error.');

    api['myRecords'].mockReturnValue(of(page([record()])));
    element.querySelector<HTMLButtonElement>('.alert-danger button')!.click();
    fixture.detectChanges();

    expect(element.querySelector('.alert-danger')).toBeNull();
  });

  it('links back to the summary', () => {
    const { element } = create();

    expect(element.querySelector('.page-banner a')?.getAttribute('href')).toBe(
      '/student/attendance',
    );
  });
});
