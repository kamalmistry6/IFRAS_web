import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AcademicsService } from 'src/app/api/services';
import { AppPermission } from 'src/app/auth/enums';
import { AuthService } from 'src/app/auth/services';
import { AdminModule } from '../admin.module';
import { AcademicsComponent } from './academics.component';
import { RESOURCES } from './academics.config';

describe('AcademicsComponent', () => {
  let api: { list: ReturnType<typeof vi.fn> };

  function create(superAdmin: boolean) {
    api = {
      list: vi.fn().mockReturnValue(of({ count: 0, next: null, previous: null, results: [] })),
    };
    const platformOnly = [AppPermission.ACADEMICS_PLATFORM_MANAGE];

    TestBed.configureTestingModule({
      imports: [AdminModule],
      providers: [
        provideRouter([]),
        { provide: AcademicsService, useValue: api },
        {
          provide: AuthService,
          useValue: {
            user: { is_super_admin: superAdmin, college: superAdmin ? null : { id: 1 } },
            // A college administrator has ACADEMICS_MANAGE but not the platform permission.
            isAuthorizedNow: (rule: { permissions: AppPermission[] }) =>
              superAdmin || !rule.permissions.some((p) => platformOnly.includes(p)),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AcademicsComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  const tabNames = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('.tab')).map((tab) => tab.textContent?.trim());

  it('has a tab for each resource, in the order of setting up a college', () => {
    const { element } = create(false);

    expect(tabNames(element)).toEqual([
      'Departments',
      'Programs',
      'Semesters',
      'Subjects',
      'Subject offerings',
      'Academic years',
      'Colleges',
    ]);
    expect(RESOURCES.length).toBe(7);
  });

  it('starts on Departments and loads that resource', () => {
    const { element } = create(false);

    expect(element.querySelector('.tab.active')?.textContent).toContain('Departments');
    expect(api.list).toHaveBeenCalledWith('departments', expect.any(Object));
  });

  it('switches the table when another tab is chosen, with fresh filters', () => {
    const { element, fixture } = create(false);

    element.querySelectorAll<HTMLButtonElement>('.tab')[1].click();
    fixture.detectChanges();

    expect(element.querySelector('.tab.active')?.textContent).toContain('Programs');
    expect(api.list).toHaveBeenCalledWith('programs', {
      page: 1,
      search: '',
      department: '',
      is_active: '',
    });
    expect(element.querySelectorAll('app-resource-table').length).toBe(1);
  });

  it('lets a college administrator change everything except colleges and academic years', () => {
    const { component } = create(false);
    const byKey = (key: string) => RESOURCES.find((tab) => tab.key === key)!;

    expect(component.platform).toBe(false);
    expect(component.canWrite(byKey('programs'))).toBe(true);
    expect(component.canWrite(byKey('academic-years'))).toBe(false);
    expect(component.canWrite(byKey('colleges'))).toBe(false);
    expect(component.collegeId).toBe(1);
  });

  it('lets a platform administrator change all of them', () => {
    const { component } = create(true);

    expect(component.platform).toBe(true);
    expect(RESOURCES.every((tab) => component.canWrite(tab))).toBe(true);
    expect(component.collegeId).toBeNull();
  });
});
