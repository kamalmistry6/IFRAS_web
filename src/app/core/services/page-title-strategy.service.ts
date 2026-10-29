import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';

/**
 * Sets the browser tab title from the route's `title`, e.g.
 *   { path: 'today', title: 'Today' }   ->   "Today · Face Attendance"
 * and publishes the plain title (`title$`) for the top bar to show.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleStrategyService extends TitleStrategy {
  private readonly titleSubject = new BehaviorSubject<string>('');

  /** The current page's title, without the app name. */
  readonly title$ = this.titleSubject.asObservable();

  constructor(private title: Title) {
    super();
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const pageTitle = this.buildTitle(snapshot) ?? '';
    this.titleSubject.next(pageTitle);
    this.title.setTitle(pageTitle ? `${pageTitle} · ${environment.appName}` : environment.appName);
  }
}
