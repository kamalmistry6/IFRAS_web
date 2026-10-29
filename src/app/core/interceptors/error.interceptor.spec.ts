import {
  HTTP_INTERCEPTORS,
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';
import { GlobalException } from '../exceptions';
import { ToastService } from '../services';
import { ErrorInterceptor } from './error.interceptor';
import { quiet } from './http-context.tokens';

const url = `${environment.apiBaseUrl}/students/`;

describe('ErrorInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let toast: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toast = { error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
        { provide: ToastService, useValue: toast },
      ],
    });

    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function failWith(
    status: number,
    body: object | null,
    context?: ReturnType<typeof quiet>,
  ): GlobalException {
    let caught: unknown;
    client.get(url, { context }).subscribe({ error: (e) => (caught = e) });
    http.expectOne(url).flush(body, { status, statusText: 'Error' });
    return caught as GlobalException;
  }

  it('hands the component a GlobalException instead of the raw response', () => {
    const exception = failWith(400, { roll_number: ['Already used.'] });

    expect(exception).toBeInstanceOf(GlobalException);
    expect(exception.fieldErrors).toEqual({ roll_number: ['Already used.'] });
  });

  it('lets the form show a 400, with no toast', () => {
    failWith(400, { phone: ['Too long.'] });

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('leaves a 401 to the auth interceptor, with no toast', () => {
    failWith(401, { detail: 'expired' });

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('leaves a 404 to the page, with no toast', () => {
    failWith(404, { detail: 'Not found.' });

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows a toast for a 403', () => {
    failWith(403, { detail: 'You do not have permission to perform this action.' });

    expect(toast.error).toHaveBeenCalledWith(
      'Not allowed',
      'You do not have permission to perform this action.',
    );
  });

  it("shows a toast for a 409 conflict, with the server's explanation", () => {
    failWith(409, { detail: 'This assignment is used by timetable slots.' });

    expect(toast.error).toHaveBeenCalledWith(
      'Conflict',
      'This assignment is used by timetable slots.',
    );
  });

  it('shows a toast for a server error', () => {
    failWith(500, null);

    expect(toast.error).toHaveBeenCalledWith(
      'Server error',
      'Something went wrong on our side. Please try again in a moment.',
    );
  });

  it('shows a toast when the server cannot be reached', () => {
    let caught: unknown;
    client.get(url).subscribe({ error: (e) => (caught = e) });
    http.expectOne(url).error(new ProgressEvent('error'));

    expect((caught as GlobalException).isNetworkError).toBe(true);
    expect(toast.error).toHaveBeenCalledWith(
      'Connection problem',
      expect.stringContaining('Cannot reach'),
    );
  });

  it('stays quiet when the caller asked to handle the error itself', () => {
    failWith(500, null, quiet());

    expect(toast.error).not.toHaveBeenCalled();
  });
});
