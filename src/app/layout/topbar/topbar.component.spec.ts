import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { UserType } from 'src/app/auth/enums';
import { CurrentUser } from 'src/app/auth/models';
import { AuthService } from 'src/app/auth/services';
import { LayoutModule } from '../layout.module';
import { TopbarComponent } from './topbar.component';

describe('TopbarComponent', () => {
  function create() {
    const auth = {
      user$: new BehaviorSubject<CurrentUser | null>({ username: 'amit' } as CurrentUser),
      userType: UserType.TEACHER,
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
    element.querySelector<HTMLButtonElement>('.menu [role="menuitem"]')!.click();

    expect(auth.logout).toHaveBeenCalledWith('signed_out');
  });
});
