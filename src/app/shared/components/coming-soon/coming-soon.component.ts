import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * A stand-in for a screen that is not built yet. It reads from the route:
 *
 *   {
 *     path: 'students',
 *     component: ComingSoonComponent,
 *     title: 'Students',
 *     data: { description: 'Search, add and edit students.', apis: ['GET /students/'] },
 *   }
 *
 * The `apis` list shows which endpoints the real screen will call (see
 * docs/FRONTEND_PAGES.md). To build the screen, replace `component` with the
 * real one; nothing else changes.
 */
@Component({
  selector: 'app-coming-soon',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <header class="page-header">
      <div>
        <h1>{{ title }}</h1>
        @if (description) {
          <p>{{ description }}</p>
        }
      </div>
    </header>

    <section class="card">
      <div class="card-header"><h3>Not built yet</h3></div>
      <div class="card-body">
        <p class="text-muted">This screen is planned. When it is built it will use:</p>
        <ul class="apis">
          @for (api of apis; track api) {
            <li>
              <code>{{ api }}</code>
            </li>
          } @empty {
            <li class="text-subtle">No API calls listed.</li>
          }
        </ul>
      </div>
    </section>
  `,
  styles: [
    `
      .apis {
        margin: 0;
        padding-left: var(--space-5);
      }
      code {
        font-family: ui-monospace, Consolas, monospace;
        font-size: var(--text-sm);
      }
    `,
  ],
})
export class ComingSoonComponent {
  readonly title: string;
  readonly description: string;
  readonly apis: string[];

  constructor(route: ActivatedRoute) {
    const snapshot = route.snapshot;
    this.title = (snapshot.title as string | undefined) ?? 'Coming soon';
    this.description = snapshot.data['description'] ?? '';
    this.apis = snapshot.data['apis'] ?? [];
  }
}
