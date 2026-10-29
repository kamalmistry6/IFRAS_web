import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Shown when a signed-in user opens a page their role is not allowed to use. */
@Component({
  selector: 'app-forbidden',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="empty-state">
      <span class="icon icon-shield icon-xl"></span>
      <h1>You do not have access to this page</h1>
      <p>
        Your account is not allowed to open it. If you think this is a mistake, contact your
        administrator.
      </p>
      <a class="btn btn-primary" routerLink="/">Go to my home page</a>
    </div>
  `,
})
export class ForbiddenComponent {}
