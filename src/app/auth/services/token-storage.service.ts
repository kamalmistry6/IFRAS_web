import { Injectable } from '@angular/core';
import { TokenPair } from '../models';

const REFRESH_KEY = 'fra.refresh';

/**
 * Where the tokens live.
 *
 *  - The short-lived access token (5 minutes) is kept only in memory, so a
 *    script on the page cannot copy it from storage.
 *  - The refresh token (1 day) is kept in storage so a page reload keeps the
 *    user signed in: localStorage when "Keep me signed in" is ticked (survives
 *    closing the browser), otherwise sessionStorage (cleared with the tab).
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private accessToken: string | null = null;

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  getRefreshToken(): string | null {
    return this.read(localStorage) ?? this.read(sessionStorage);
  }

  /** True when the refresh token was stored with "Keep me signed in". */
  isRemembered(): boolean {
    return this.read(localStorage) !== null;
  }

  setTokens(tokens: TokenPair, remember: boolean): void {
    this.accessToken = tokens.access;
    this.clearRefreshToken();
    this.write(remember ? localStorage : sessionStorage, tokens.refresh);
  }

  clear(): void {
    this.accessToken = null;
    this.clearRefreshToken();
  }

  private clearRefreshToken(): void {
    this.remove(localStorage);
    this.remove(sessionStorage);
  }

  // Storage can throw (blocked, private mode, full), so every access is guarded.

  private read(storage: Storage): string | null {
    try {
      return storage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  }

  private write(storage: Storage, value: string): void {
    try {
      storage.setItem(REFRESH_KEY, value);
    } catch {
      // Without storage the user simply signs in again after a reload.
    }
  }

  private remove(storage: Storage): void {
    try {
      storage.removeItem(REFRESH_KEY);
    } catch {
      // nothing to remove
    }
  }
}
