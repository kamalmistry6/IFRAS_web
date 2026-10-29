import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { UserType } from 'src/app/auth/enums';
import { AuthService } from 'src/app/auth/services';
import { LayoutModule } from '../layout.module';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  function create(userType: UserType | null) {
    const auth = {
      userType$: new BehaviorSubject<UserType | null>(userType),
      userType,
      fullName: 'Fr. Joseph',
      logout: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [LayoutModule],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });

    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    return { fixture, auth, element: fixture.nativeElement as HTMLElement };
  }

  const labels = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('nav .label')).map((node) => node.textContent?.trim());

  it.each([
    [UserType.TEACHER, ['Dashboard', 'Today', 'My timetable', 'My sessions']],
    [
      UserType.ADMIN,
      [
        'Dashboard',
        'Academic setup',
        'Sessions',
        'Students',
        'Enrollments',
        'Teachers',
        'Assignments',
        'Timetable',
      ],
    ],
    [
      UserType.SUPER_ADMIN,
      [
        'Dashboard',
        'Academic setup',
        'Sessions',
        'Students',
        'Enrollments',
        'Teachers',
        'Assignments',
        'Timetable',
      ],
    ],
    [UserType.STUDENT, ['My attendance']],
  ])('shows a %s only the menu items for that role', (userType, expected) => {
    const { element } = create(userType);

    expect(labels(element)).toEqual(expected);
  });

  it('has no user card: the name is shown in the top bar', () => {
    const { element } = create(UserType.TEACHER);

    expect(element.textContent).not.toContain('Fr. Joseph');
  });

  it('signs out from the Logout button', () => {
    const { element, auth } = create(UserType.TEACHER);

    element.querySelector<HTMLButtonElement>('.logout')!.click();

    expect(auth.logout).toHaveBeenCalledWith('signed_out');
  });
});
