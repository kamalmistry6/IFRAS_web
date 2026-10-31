import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';
import { TeachersService } from './teachers.service';

describe('TeachersService own profile', () => {
  let service: TeachersService;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/teachers/me/`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TeachersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the signed-in teacher', () => {
    service.me().subscribe();

    const request = http.expectOne(url);
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('changes only the name', () => {
    service.updateMe({ first_name: 'Amit', last_name: 'Patil' }).subscribe();

    const request = http.expectOne(url);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ first_name: 'Amit', last_name: 'Patil' });
    request.flush({});
  });
});
