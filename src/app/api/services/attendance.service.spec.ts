import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/attendance`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AttendanceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for the lectures of a day', () => {
    service.today('2026-10-29').subscribe();

    const request = http.expectOne(`${base}/today/?date=2026-10-29`);
    expect(request.request.method).toBe('GET');
    request.flush({ date: '2026-10-29', lectures: [] });
  });

  it('leaves the date out for today', () => {
    service.today().subscribe();

    http.expectOne(`${base}/today/`).flush({ date: '2026-10-29', lectures: [] });
  });

  it('starts a slot, sending the date only when given', () => {
    service.startSlot('slot-1', '2026-10-29').subscribe();
    const request = http.expectOne(`${base}/timetable/slot-1/start/`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ date: '2026-10-29' });
    request.flush({});

    service.startSlot('slot-1').subscribe();
    http.expectOne(`${base}/timetable/slot-1/start/`).flush({});
  });

  it('asks for the own attendance of a student, for a year when one is chosen', () => {
    service.myAttendance().subscribe();
    http.expectOne(`${base}/my/`).flush({});

    service.myAttendance(2).subscribe();
    const request = http.expectOne(`${base}/my/?academic_year=2`);
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('asks for the own lectures of a student with the filters', () => {
    service.myRecords({ subject_offering: 5, status: 'ABSENT', page: 2 }).subscribe();

    const request = http.expectOne(`${base}/my/records/?subject_offering=5&status=ABSENT&page=2`);
    expect(request.request.method).toBe('GET');
    request.flush({ count: 0, next: null, previous: null, results: [] });
  });

  it('sends only the changed records', () => {
    service.markRecords('s1', [{ public_id: 'r1', status: 'PRESENT' }]).subscribe();

    const request = http.expectOne(`${base}/sessions/s1/records/`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ records: [{ public_id: 'r1', status: 'PRESENT' }] });
    request.flush({});
  });

  it('submits, cancels with a reason and posts a correction', () => {
    service.submit('s1').subscribe();
    http.expectOne(`${base}/sessions/s1/submit/`).flush({});

    service.cancel('s1', 'Holiday').subscribe();
    const cancel = http.expectOne(`${base}/sessions/s1/cancel/`);
    expect(cancel.request.body).toEqual({ reason: 'Holiday' });
    cancel.flush({});

    service.correct('s1', { record: 'r1', status: 'ABSENT', reason: 'Left early' }).subscribe();
    const correct = http.expectOne(`${base}/sessions/s1/corrections/`);
    expect(correct.request.method).toBe('POST');
    correct.flush({});
  });
});
