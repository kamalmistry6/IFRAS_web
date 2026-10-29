import { ChangeDetectionStrategy, Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  TIME_HOURS,
  TIME_MINUTES,
  TimeParts,
  fromTimeParts,
  toTimeParts,
} from 'src/app/shared/utils';

/**
 * A time of day as three drop-downs (hour, minute, AM or PM), for a form control
 * whose value is 24-hour 'HH:MM' text, which is what the API takes.
 *
 *   <app-time-select formControlName="start_time"></app-time-select>
 *
 * It replaces the browser's own time picker, which looks different in every
 * browser. The style is the global .time-select class (styles/_forms.scss).
 */
@Component({
  selector: 'app-time-select',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TimeSelectComponent), multi: true },
  ],
  template: `
    <div class="time-select" role="group" [attr.aria-labelledby]="labelledBy || null">
      <select
        class="select"
        aria-label="Hour"
        [disabled]="disabled"
        (change)="change('hour', $any($event.target).value)"
        (blur)="onTouched()"
      >
        @for (hour of hours; track hour) {
          <option [value]="hour" [selected]="parts.hour === hour">{{ hour }}</option>
        }
      </select>
      <select
        class="select"
        aria-label="Minute"
        [disabled]="disabled"
        (change)="change('minute', $any($event.target).value)"
        (blur)="onTouched()"
      >
        @for (minute of minutes; track minute) {
          <option [value]="minute" [selected]="parts.minute === minute">
            {{ minute < 10 ? '0' + minute : minute }}
          </option>
        }
      </select>
      <select
        class="select"
        aria-label="AM or PM"
        [disabled]="disabled"
        (change)="change('period', $any($event.target).value)"
        (blur)="onTouched()"
      >
        <option value="AM" [selected]="parts.period === 'AM'">AM</option>
        <option value="PM" [selected]="parts.period === 'PM'">PM</option>
      </select>
    </div>
  `,
})
export class TimeSelectComponent implements ControlValueAccessor {
  /** The id of the element that names this field (for screen readers). */
  @Input() labelledBy = '';

  readonly hours = TIME_HOURS;
  readonly minutes = TIME_MINUTES;

  parts: TimeParts = toTimeParts('');
  disabled = false;

  private onChange: (value: string) => void = () => undefined;
  onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.parts = toTimeParts(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  change(part: keyof TimeParts, value: string): void {
    const parts: TimeParts = { ...this.parts };

    if (part === 'period') parts.period = value === 'PM' ? 'PM' : 'AM';
    else parts[part] = Number(value);

    this.parts = parts;
    this.onChange(fromTimeParts(parts));
  }
}
