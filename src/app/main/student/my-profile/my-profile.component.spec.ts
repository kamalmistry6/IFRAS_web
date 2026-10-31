import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { StudentProfile } from 'src/app/api/models';
import { StudentsService } from 'src/app/api/services';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';
import { StudentModule } from '../student.module';
import { MyProfileComponent } from './my-profile.component';

const profile = (overrides: Partial<StudentProfile> = {}): StudentProfile =>
  ({
    id: 12,
    public_id: 'sp-1',
    username: '78001',
    first_name: 'Dipali',
    last_name: 'Jadhav',
    full_name: 'Dipali Jadhav',
    email: 'dipali@example.com',
    roll_number: '78001',
    phone: '9876543210',
    date_of_birth: '2005-05-01',
    address: 'Pune',
    ...overrides,
  }) as StudentProfile;

describe('MyProfileComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  function create(
    user: object | null = { student_profile_public_id: 'sp-1', college: { name: 'College A' } },
    data: StudentProfile = profile(),
  ) {
    api = { get: vi.fn().mockReturnValue(of(data)) };
    TestBed.configureTestingModule({
      imports: [StudentModule],
      providers: [
        provideRouter([]),
        { provide: StudentsService, useValue: api },
        { provide: AuthService, useValue: { user } },
      ],
    });
    const fixture = TestBed.createComponent(MyProfileComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  it('loads the profile of the signed-in student and shows the details', () => {
    const { element } = create();
    const text = element.textContent ?? '';

    expect(api['get']).toHaveBeenCalledWith('sp-1');
    expect(text).toContain('Dipali Jadhav');
    expect(text).toContain('College A');
    expect(text).toContain('78001');
    expect(text).toContain('dipali@example.com');
    expect(text).toContain('9876543210');
    expect(text).toContain('1 May 2005');
    expect(text).toContain('Pune');
  });

  it('shows a dash for anything missing', () => {
    const { element } = create(
      { student_profile_public_id: 'sp-1', college: null },
      profile({ roll_number: '', phone: '', date_of_birth: null, address: '' }),
    );

    const values = [...element.querySelectorAll('dd')].map((dd) => dd.textContent?.trim());

    // college, roll number, phone, date of birth and address
    expect(values.filter((value) => value === '-').length).toBe(5);
  });

  it('is read only and says who corrects the details', () => {
    const { element } = create();

    expect(element.querySelector('input, textarea, select')).toBeNull();
    expect(element.textContent).toContain('ask your college administrator');
  });

  it('links to the password page', () => {
    const { element } = create();

    expect(element.querySelector('.page-banner a')?.getAttribute('href')).toBe('/account/password');
  });

  it('explains an account without a student profile, without calling the server', () => {
    const { element } = create({ student_profile_public_id: null, college: null });

    expect(api['get']).not.toHaveBeenCalled();
    expect(element.querySelector('.alert-danger')?.textContent).toContain('no student profile');
  });

  it('shows a failure with a retry button', () => {
    const { component, fixture, element } = create();
    api['get'].mockReturnValue(
      throwError(() => new GlobalException({ status: 500, message: 'Server error.' })),
    );
    component.load();
    fixture.detectChanges();
    expect(element.querySelector('.alert-danger')?.textContent).toContain('Server error.');

    api['get'].mockReturnValue(of(profile()));
    element.querySelector<HTMLButtonElement>('.alert-danger button')!.click();
    fixture.detectChanges();

    expect(element.querySelector('.alert-danger')).toBeNull();
  });
});
