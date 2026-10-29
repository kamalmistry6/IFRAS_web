import { ChangeDetectionStrategy, Component, NgModule } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared.module';

@Component({
  selector: 'app-host',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<app-time-select [formControl]="control"></app-time-select>`,
})
class HostComponent {
  control = new FormControl('14:45', { nonNullable: true });
}

// A host component has to belong to a module for the template to be compiled.
@NgModule({ declarations: [HostComponent], imports: [SharedModule, ReactiveFormsModule] })
class HostModule {}

describe('TimeSelectComponent', () => {
  function create() {
    TestBed.configureTestingModule({ imports: [HostModule] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const selects = Array.from(element.querySelectorAll<HTMLSelectElement>('select'));
    return { fixture, host: fixture.componentInstance, selects };
  }

  const choose = (select: HTMLSelectElement, value: string) => {
    select.value = value;
    select.dispatchEvent(new Event('change'));
  };

  it('shows the value of the control as hour, minute and AM or PM', () => {
    const { selects } = create();

    expect(selects.map((s) => s.value)).toEqual(['2', '45', 'PM']);
  });

  it('writes 24-hour text back to the control when a drop-down changes', () => {
    const { selects, host } = create();

    choose(selects[0], '9');
    expect(host.control.value).toBe('21:45');

    choose(selects[2], 'AM');
    expect(host.control.value).toBe('09:45');

    choose(selects[1], '5');
    expect(host.control.value).toBe('09:05');
  });

  it('follows a value set from outside, and can be disabled', () => {
    const { selects, host, fixture } = create();

    host.control.setValue('00:00');
    fixture.detectChanges();
    expect(selects.map((s) => s.value)).toEqual(['12', '0', 'AM']);

    host.control.disable();
    fixture.detectChanges();
    expect(selects.every((s) => s.disabled)).toBe(true);
  });
});
