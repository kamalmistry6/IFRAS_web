import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { UserType } from 'src/app/auth/enums';
import { CurrentUser } from 'src/app/auth/models';
import { AuthService } from 'src/app/auth/services';
import { LayoutModule } from '../layout.module';
import { TopbarComponent } from './topbar.component';

describe('TopbarComponent', () => {
  function create(userType = UserType.TEACHER) {
    const auth = {
      user$: new BehaviorSubject<CurrentUser | null>({
        username: 'amit',
        college: { name: 'College A' },
      } as CurrentUser),
      userType,
      fullName: 'Amit Patil',
      logout: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [LayoutModule],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });

    const fixture = TestBed.createComponent(TopbarComponent);
    fixture.detectChanges();
    return { fixture, auth, element: fixture.nativeElement as HTMLElement };
  }

  it('shows the name and role next to the avatar', () => {
    const { element } = create();

    expect(element.querySelector('.who')?.textContent).toContain('Amit Patil');
    expect(element.querySelector('.who')?.textContent).toContain('Teacher');
    expect(element.querySelector('.avatar')?.textContent?.trim()).toBe('AP');
  });

  it('opens the account menu and signs out from it', () => {
    const { fixture, auth, element } = create();

    element.querySelector<HTMLButtonElement>('.user-button')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.menu button[role="menuitem"]')!.click();

    expect(auth.logout).toHaveBeenCalledWith('signed_out');
  });

  it('does not repeat the name, username or college inside the menu', () => {
    const { fixture, element } = create(UserType.STUDENT);

    element.querySelector<HTMLButtonElement>('.user-button')!.click();
    fixture.detectChanges();
    const menu = element.querySelector('.menu')!.textContent ?? '';

    expect(menu).not.toContain('Amit Patil');
    expect(menu).not.toContain('amit');
    expect(menu).not.toContain('College A');
  });

  it('gives a student only My profile and Sign out', () => {
    const { fixture, element } = create(UserType.STUDENT);

    element.querySelector<HTMLButtonElement>('.user-button')!.click();
    fixture.detectChanges();
    const items = [...element.querySelectorAll('.menu [role="menuitem"]')];

    expect(items.map((item) => item.textContent?.trim())).toEqual(['My profile', 'Sign out']);
    expect(items[0].getAttribute('href')).toBe('/student/profile');
  });

  it('gives a teacher My profile and Sign out too', () => {
    const { fixture, element } = create(UserType.TEACHER);

    element.querySelector<HTMLButtonElement>('.user-button')!.click();
    fixture.detectChanges();
    const items = [...element.querySelectorAll('.menu [role="menuitem"]')];

    expect(items.map((item) => item.textContent?.trim())).toEqual(['My profile', 'Sign out']);
    expect(items[0].getAttribute('href')).toBe('/teacher/profile');
  });

  it('offers the password page to an administrator, who has no profile page yet', () => {
    const { fixture, element } = create(UserType.ADMIN);

    element.querySelector<HTMLButtonElement>('.user-button')!.click();
    fixture.detectChanges();
    const items = [...element.querySelectorAll('.menu [role="menuitem"]')];

    expect(items.map((item) => item.textContent?.trim())).toEqual(['Change password', 'Sign out']);
    expect(items[0].getAttribute('href')).toBe('/account/password');
  });

  it('closes the menu when a link in it is used', () => {
    const { fixture, element } = create();

    element.querySelector<HTMLButtonElement>('.user-button')!.click();
    fixture.detectChanges();
    const link = element.querySelector<HTMLAnchorElement>('.menu a[role="menuitem"]')!;
    expect(link.getAttribute('href')).toBe('/teacher/profile');
    expect(link.textContent).toContain('My profile');

    link.click();
    fixture.detectChanges();

    expect(element.querySelector('.menu')).toBeNull();
  });
});
