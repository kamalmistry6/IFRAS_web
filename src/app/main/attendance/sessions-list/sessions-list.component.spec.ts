import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AttendanceSession } from 'src/app/api/models';
import { AttendanceService, DirectoryService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { AttendanceModule } from '../attendance.module';
import { SessionsListComponent } from './sessions-list.component';

function session(overrides: Partial<AttendanceSession> = {}): AttendanceSession {
  return {
    public_id: 's1',
    subject_name: 'Machine Learning',
    subject_code: '58099',
    date: '2026-10-29',
    start_time: '09:00:00',
    end_time: '10:00:00',
    status: 'SUBMITTED',
    total_students: 3,
    present_count: 2,
    absent_count: 1,
    ...overrides,
  } as AttendanceSession;
}

const page = (results: AttendanceSession[], count = results.length) => ({
  count,
  next: null,
  previous: null,
  results,
});

describe('SessionsListComponent', () => {
  let attendance: Record<string, ReturnType<typeof vi.fn>>;
  let directory: Record<string, ReturnType<typeof vi.fn>>;
  let navigate: ReturnType<typeof vi.fn>;

  function create(
    results: AttendanceSession[] = [session()],
    count?: number,
    scope: 'teacher' | 'admin' = 'teacher',
  ) {
    attendance = {
      sessions: vi.fn().mockReturnValue(of(page(results, count))),
      myAssignments: vi.fn().mockReturnValue(
        of({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 4,
              subject_name: 'Machine Learning',
              subject_code: '58099',
              academic_year_name: '2026-2027',
            },
          ],
        }),
      ),
    };

    directory = {
      subjectAssignments: vi.fn().mockReturnValue(
        of({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 4,
              teacher_name: 'Amit Patil',
              subject_name: 'Machine Learning',
              academic_year_name: '2026-2027',
            },
          ],
        }),
      ),
    };

    TestBed.configureTestingModule({
      imports: [AttendanceModule],
      providers: [
        provideRouter([]),
        { provide: AttendanceService, useValue: attendance },
        { provide: DirectoryService, useValue: directory },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { scope } } } },
      ],
    });

    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as never;
    const fixture = TestBed.createComponent(SessionsListComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  it('loads the first page of sessions and lists them', () => {
    const { element } = create();

    expect(attendance['sessions']).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    expect(element.querySelectorAll('tbody tr').length).toBe(1);
    expect(element.textContent).toContain('Machine Learning');
    expect(element.textContent).toContain('9:00 AM - 10:00 AM');
    expect(element.textContent).toContain('2 / 3');
  });

  it('fills the subject filter with all of the teachers subjects, past years included', () => {
    const { element } = create();

    expect(attendance['myAssignments']).toHaveBeenCalledWith(true);
    expect(element.querySelector('#subject')?.textContent).toContain('2026-2027');
  });

  it('opens a session when its row is clicked', () => {
    const { element } = create();

    element.querySelector<HTMLElement>('tbody tr')!.click();

    expect(navigate).toHaveBeenCalledWith(['/teacher/sessions', 's1']);
  });

  it('asks the server again, from page 1, when a filter changes', () => {
    const { component } = create();
    attendance['sessions'].mockClear();

    component.page = 3;
    component.filters.patchValue({ status: 'OPEN', from: '2026-10-01', subject: '4' });

    expect(attendance['sessions']).toHaveBeenLastCalledWith({
      page: 1,
      date__gte: '2026-10-01',
      date__lte: '',
      status: 'OPEN',
      teacher_assignment: '4',
      scope: 'own',
    });
    expect(component.page).toBe(1);
  });

  it('clears every filter at once', () => {
    const { component } = create();
    component.filters.patchValue({ status: 'OPEN' });
    expect(component.hasFilters).toBe(true);

    component.clearFilters();

    expect(component.hasFilters).toBe(false);
  });

  it('pages through the results', () => {
    const { component, element, fixture } = create([session()], 45);
    fixture.detectChanges();

    expect(element.querySelector('.pager')?.textContent).toContain('Showing 1-20 of 45');
    expect(element.querySelector('.pager')?.textContent).toContain('Page 1 of 3');

    attendance['sessions'].mockClear();
    component.goTo(2);

    expect(attendance['sessions']).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));

    component.goTo(9);
    expect(component.page).toBe(2);
  });

  it('says so when there are no sessions, and hints at the filters when some are set', () => {
    const { element, fixture, component } = create([], 0);
    expect(element.querySelector('.empty-state')?.textContent).toContain('No sessions found');

    component.filters.patchValue({ status: 'OPEN' });
    fixture.detectChanges();
    expect(element.querySelector('.empty-state')?.textContent).toContain('clear the filters');
  });

  it('shows the error and tries again on request', () => {
    const { element, fixture, component } = create();
    attendance['sessions'].mockReturnValue(
      throwError(() => new GlobalException({ status: 0, message: 'Cannot reach the server.' })),
    );

    component.retry();
    fixture.detectChanges();
    expect(element.querySelector('.alert')?.textContent).toContain('Cannot reach the server.');

    attendance['sessions'].mockReturnValue(of(page([session()])));
    component.retry();
    fixture.detectChanges();
    expect(element.querySelector('.alert')).toBeNull();
  });

  describe('for an administrator', () => {
    it('lists every session of the college with a Teacher column', () => {
      const { element, component } = create(
        [session({ teacher_name: 'Amit Patil' })],
        undefined,
        'admin',
      );

      expect(component.admin).toBe(true);
      expect(element.querySelector('h1')?.textContent).toBe('Sessions');
      expect(element.querySelector('thead')?.textContent).toContain('Teacher');
      expect(element.querySelector('tbody')?.textContent).toContain('Amit Patil');
    });

    it('fills the filter with every teacher and subject, not only their own', () => {
      const { element } = create([session()], undefined, 'admin');

      expect(directory['subjectAssignments']).toHaveBeenCalled();
      expect(attendance['myAssignments']).not.toHaveBeenCalled();
      expect(element.querySelector('#subject')?.textContent).toContain(
        'Amit Patil - Machine Learning',
      );
    });

    it('opens a session under the admin area', () => {
      const { element } = create([session()], undefined, 'admin');

      element.querySelector<HTMLElement>('tbody tr')!.click();

      expect(navigate).toHaveBeenCalledWith(['/admin/sessions', 's1']);
    });
  });

  describe('for a teacher', () => {
    it('has no Teacher column and opens sessions under the teacher area', () => {
      const { element, component } = create();

      expect(component.admin).toBe(false);
      expect(element.querySelector('thead')?.textContent).not.toContain('Teacher');
      expect(directory['subjectAssignments']).not.toHaveBeenCalled();
    });
  });
});
