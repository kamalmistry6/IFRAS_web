import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';
import { StudentsService } from './students.service';

describe('StudentsService import', () => {
  let service: StudentsService;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/students/import/`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StudentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uploads the file as a form, with the check-only switch and the college', () => {
    const file = new File(['roll_number'], 'students.csv');

    service.importStudents(file, true, 5).subscribe();

    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect(body instanceof FormData).toBe(true);
    expect((body.get('file') as File).name).toBe('students.csv');
    expect(body.get('dry_run')).toBe('true');
    expect(body.get('college')).toBe('5');
    request.flush({});
  });

  it('leaves the college out when there is none, and sends dry_run false to import', () => {
    service.importStudents(new File(['x'], 'a.xlsx'), false).subscribe();

    const request = http.expectOne(url);
    const body = request.request.body as FormData;
    expect(body.get('dry_run')).toBe('false');
    expect(body.has('college')).toBe(false);
    request.flush({});
  });

  it('asks for the template as a file', () => {
    service.importTemplate().subscribe();

    const request = http.expectOne(`${url}template/`);
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['x']));
  });
});
