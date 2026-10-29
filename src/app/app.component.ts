import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The root of the app. Only the things that must exist on EVERY page live
 * here: the progress bar, the page outlet, the toasts and the confirm dialog.
 * The signed-in frame (top bar, sidebar) is the ShellComponent.
 */
@Component({
  selector: 'app-root',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-progress-bar></app-progress-bar>
    <router-outlet></router-outlet>
    <app-toast-container></app-toast-container>
    <app-confirm-dialog></app-confirm-dialog>
  `,
})
export class AppComponent {}
