import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Shown for any address that matches no page. */
@Component({
  selector: 'app-not-found',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="empty-state">
      <span class="icon icon-search icon-xl"></span>
      <h1>Page not found</h1>
      <p>The page you were looking for does not exist or has moved.</p>
      <a class="btn btn-primary" routerLink="/">Go to my home page</a>
    </div>
  `,
})
export class NotFoundComponent {}
