import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from './token-storage.service';

const KEY = 'fra.refresh';
const pair = { access: 'access-1', refresh: 'refresh-1' };

describe('TokenStorageService', () => {
  let tokens: TokenStorageService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    tokens = TestBed.inject(TokenStorageService);
  });

  it('keeps the access token in memory only', () => {
    tokens.setTokens(pair, true);

    expect(tokens.getAccessToken()).toBe('access-1');
    expect(localStorage.getItem(KEY)).toBe('refresh-1');
    // Nothing else is written: the access token never reaches storage.
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('access-1');
  });

  it('stores the refresh token in sessionStorage unless the user asked to stay signed in', () => {
    tokens.setTokens(pair, false);

    expect(sessionStorage.getItem(KEY)).toBe('refresh-1');
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(tokens.isRemembered()).toBe(false);
  });

  it('stores it in localStorage when "keep me signed in" is chosen', () => {
    tokens.setTokens(pair, true);

    expect(localStorage.getItem(KEY)).toBe('refresh-1');
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(tokens.isRemembered()).toBe(true);
    expect(tokens.getRefreshToken()).toBe('refresh-1');
  });

  it('never leaves an old refresh token behind when the choice changes', () => {
    tokens.setTokens(pair, true);
    tokens.setTokens({ access: 'a2', refresh: 'r2' }, false);

    expect(localStorage.getItem(KEY)).toBeNull();
    expect(tokens.getRefreshToken()).toBe('r2');
  });

  it('replaces just the access token after a refresh', () => {
    tokens.setTokens(pair, false);
    tokens.setAccessToken('access-2');

    expect(tokens.getAccessToken()).toBe('access-2');
    expect(tokens.getRefreshToken()).toBe('refresh-1');
  });

  it('forgets everything on clear', () => {
    tokens.setTokens(pair, true);
    tokens.clear();

    expect(tokens.getAccessToken()).toBeNull();
    expect(tokens.getRefreshToken()).toBeNull();
  });

  it('survives storage that throws (private mode, blocked storage)', () => {
    const broken = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(tokens.getRefreshToken()).toBeNull();
    expect(() => tokens.clear()).not.toThrow();

    broken.mockRestore();
  });
});
