import { HttpErrorResponse } from '@angular/common/http';
import { GlobalException } from './global-exception';

function fail(status: number, error: unknown): GlobalException {
  return GlobalException.fromHttp(new HttpErrorResponse({ status, error }));
}

describe('GlobalException.fromHttp', () => {
  it('reads field errors into fieldErrors and uses the first as the message', () => {
    const exception = fail(400, { roll_number: ['Already used.'], phone: ['Too long.'] });

    expect(exception.isValidation).toBe(true);
    expect(exception.fieldErrors).toEqual({ roll_number: ['Already used.'], phone: ['Too long.'] });
    expect(exception.message).toBe('Already used.');
  });

  it('reads non_field_errors as general errors', () => {
    const exception = fail(400, { non_field_errors: ['This teacher already has a lecture then.'] });

    expect(exception.generalErrors).toEqual(['This teacher already has a lecture then.']);
    expect(exception.fieldErrors).toEqual({});
    expect(exception.message).toBe('This teacher already has a lecture then.');
  });

  it('reads detail and code', () => {
    const exception = fail(401, { detail: 'User account has been deleted', code: 'user_deleted' });

    expect(exception.isUnauthorized).toBe(true);
    expect(exception.code).toBe('user_deleted');
    expect(exception.detail).toBe('User account has been deleted');
    expect(exception.message).toBe('User account has been deleted');
  });

  it('ignores the token library\'s extra "messages" list', () => {
    const exception = fail(401, {
      detail: 'Given token not valid for any token type',
      code: 'token_not_valid',
      messages: [{ token_class: 'AccessToken', message: 'Token is expired' }],
    });

    expect(exception.fieldErrors).toEqual({});
    expect(exception.code).toBe('token_not_valid');
  });

  it('flattens nested list errors (marking several records at once)', () => {
    const exception = fail(400, { records: [{ public_id: ['Not a valid UUID.'] }, {}] });

    expect(exception.fieldErrors['records']).toEqual(['public_id: Not a valid UUID.']);
  });

  it('keeps all messages in one list, general ones first', () => {
    const exception = fail(400, {
      non_field_errors: ['General.'],
      email: ['Bad email.'],
    });

    expect(exception.allMessages).toEqual(['General.', 'Bad email.']);
  });

  it('describes a call that never reached the server', () => {
    const exception = fail(0, null);

    expect(exception.isNetworkError).toBe(true);
    expect(exception.title).toBe('Connection problem');
    expect(exception.message).toContain('Cannot reach the server');
  });

  it('does not show an HTML error page from a proxy as a message', () => {
    const exception = fail(502, '<html><body>Bad gateway</body></html>');

    expect(exception.isServerError).toBe(true);
    expect(exception.generalErrors).toEqual([]);
    expect(exception.message).toContain('Something went wrong on our side');
  });

  it('classifies the statuses the screens care about', () => {
    expect(fail(403, {}).isForbidden).toBe(true);
    expect(fail(404, {}).isNotFound).toBe(true);
    expect(fail(409, { detail: 'In use.' }).isConflict).toBe(true);
    expect(fail(500, {}).isServerError).toBe(true);
  });

  it('is a real Error, so it can be thrown and logged', () => {
    const exception = fail(400, { detail: 'Nope.' });

    expect(exception).toBeInstanceOf(Error);
    expect(exception.name).toBe('GlobalException');
  });
});
