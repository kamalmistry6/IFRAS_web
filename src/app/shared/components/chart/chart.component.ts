import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Filler,
  LineController,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

// Only what the app draws, so the rest of Chart.js stays out of the bundle.
Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  LineController,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

/** Any Chart.js configuration (line, bar, doughnut ...); its options are typed by the builder. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyChartConfig = ChartConfiguration<any, any, any>;

/** A theme colour from the design tokens (src/styles/_tokens.scss), so charts follow the theme. */
export function themeColor(name: string, fallback = '#6b7280'): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`);
  return value.trim() || fallback;
}

/**
 * A Chart.js chart. Give it a configuration; it draws it, and draws it again when the
 * configuration changes. The parent sets the height (the chart fills its box):
 *
 *   <app-chart [config]="trend" label="Attendance by day" style="height: 16rem"></app-chart>
 */
@Component({
  selector: 'app-chart',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<canvas #canvas role="img" [attr.aria-label]="label"></canvas>`,
  styles: [
    `
      :host {
        position: relative;
        display: block;
        min-height: 4rem;
      }
    `,
  ],
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) config!: AnyChartConfig;
  /** What the chart shows, for people who cannot see it. */
  @Input() label = '';

  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private ready = false;

  ngAfterViewInit(): void {
    this.ready = true;
    this.draw();
  }

  ngOnChanges(): void {
    if (this.ready) this.draw();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private draw(): void {
    this.chart?.destroy();
    this.chart = null;

    try {
      this.chart = new Chart(this.canvas.nativeElement, this.config);
    } catch {
      // No canvas (a test browser, an old device): the page still works without the picture.
    }
  }
}
