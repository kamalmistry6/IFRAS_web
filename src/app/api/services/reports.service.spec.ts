import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/reports`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReportsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for the attendance of a subject, leaving out empty filters', () => {
    service
      .subjectAttendance({ subject_offering: 5, date__gte: '2026-10-01', date__lte: '' })
      .subscribe();

    const request = http.expectOne(
      `${base}/subject-attendance/?subject_offering=5&date__gte=2026-10-01`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('asks for the defaulters with their filters', () => {
    service
      .defaulters({ academic_year: 2, below: 60, program: '', year_of_study: 2, search: 'asha' })
      .subscribe();

    const request = http.expectOne(
      `${base}/defaulters/?academic_year=2&below=60&year_of_study=2&search=asha`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('downloads a report as a file, with the same filters and the format', () => {
    service.download('subject-attendance', { subject_offering: 5 }, 'xlsx').subscribe();

    const request = http.expectOne(`${base}/subject-attendance/?subject_offering=5&export=xlsx`);
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['x']));

    service.download('defaulters', { below: 75 }, 'csv').subscribe();
    http.expectOne(`${base}/defaulters/?below=75&export=csv`).flush(new Blob(['x']));
  });
});
