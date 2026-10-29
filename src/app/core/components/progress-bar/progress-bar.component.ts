import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LoadingService } from '../../services';

/** A thin bar across the top of the page while API calls are running. */
@Component({
  selector: 'app-progress-bar',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      class="bar"
      [class.active]="loading.isLoading$ | async"
      role="progressbar"
      aria-label="Loading"
    ></div>
  `,
  styles: [
    `
      .bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        z-index: var(--z-toast);
        background: linear-gradient(90deg, transparent, var(--color-primary), transparent);
        background-size: 40% 100%;
        background-repeat: no-repeat;
        opacity: 0;
        // The short delay stops a flicker on calls that finish instantly.
        transition: opacity 150ms linear 200ms;
        animation: slide 1.1s ease-in-out infinite;
        pointer-events: none;
      }
      .bar.active {
        opacity: 1;
      }
      @keyframes slide {
        from {
          background-position: -40% 0;
        }
        to {
          background-position: 140% 0;
        }
      }
    `,
  ],
})
export class ProgressBarComponent {
  constructor(readonly loading: LoadingService) {}
}
