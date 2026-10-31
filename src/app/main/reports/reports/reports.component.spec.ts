import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AttendanceService, DirectoryService, ReportsService } from 'src/app/api/services';
import { UserType } from 'src/app/auth/enums';
import { AuthService } from 'src/app/auth/services';
import { isAuthorized } from 'src/app/auth/utils/authorization';
import { ReportsModule } from '../reports.module';
import { ReportsComponent } from './reports.component';

const page = (results: unknown[] = []) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

describe('ReportsComponent', () => {
  function create(userType: UserType) {
    TestBed.configureTestingModule({
      imports: [ReportsModule],
      providers: [
        {
          provide: AuthService,
          useValue: {
            userType,
            user: { college: { id: 1 } },
            isAuthorizedNow: (rule: object) => isAuthorized(userType, rule),
          },
        },
        {
          provide: ReportsService,
          useValue: {
            subjectAttendance: vi.fn(),
            defaulters: vi.fn().mockReturnValue(
              of({
                academic_year: { id: 2, name: '2026-2027' },
                below: 75,
                period: { from: null, to: null },
                count: 0,
                students: [],
              }),
            ),
          },
        },
        {
          provide: DirectoryService,
          useValue: {
            academicYears: vi
              .fn()
              .mockReturnValue(of(page([{ id: 2, name: '2026-2027', is_active: true }]))),
            programs: vi.fn().mockReturnValue(of(page())),
            subjectOfferings: vi.fn().mockReturnValue(of(page())),
          },
        },
        {
          provide: AttendanceService,
          useValue: { myAssignments: vi.fn().mockReturnValue(of(page())) },
        },
      ],
    });
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  it.each([UserType.ADMIN, UserType.SUPER_ADMIN])('gives %s both reports as tabs', (userType) => {
    const { component, element } = create(userType);

    expect(component.tabs.map((tab) => tab.label)).toEqual(['Subject attendance', 'Defaulters']);
    expect([...element.querySelectorAll('.tab')].map((tab) => tab.textContent?.trim())).toEqual([
      'Subject attendance',
      'Defaulters',
    ]);
  });

  it('opens on the subject report', () => {
    const { element } = create(UserType.ADMIN);

    expect(element.querySelector('app-subject-attendance-report')).not.toBeNull();
    expect(element.querySelector('app-defaulters-report')).toBeNull();
    expect(element.querySelector('.tab.active')?.textContent).toContain('Subject attendance');
  });

  it('switches to the defaulters report and back', () => {
    const { fixture, element } = create(UserType.ADMIN);
    const tabs = () => [...element.querySelectorAll<HTMLButtonElement>('.tab')];

    tabs()[1].click();
    fixture.detectChanges();
    expect(element.querySelector('app-defaulters-report')).not.toBeNull();
    expect(element.querySelector('app-subject-attendance-report')).toBeNull();
    expect(tabs()[1].getAttribute('aria-current')).toBe('page');

    tabs()[0].click();
    fixture.detectChanges();
    expect(element.querySelector('app-subject-attendance-report')).not.toBeNull();
  });

  it('gives a teacher the subject report only, with no tabs', () => {
    const { component, element } = create(UserType.TEACHER);

    expect(component.tabs.map((tab) => tab.label)).toEqual(['Subject attendance']);
    expect(element.querySelector('.tabs')).toBeNull();
    expect(element.querySelector('app-subject-attendance-report')).not.toBeNull();
    expect(element.querySelector('.page-banner p')?.textContent).toContain('your subjects');
  });
});
