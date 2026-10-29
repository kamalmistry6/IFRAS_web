import { Pipe, PipeTransform } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { validationMessage } from '../utils/validation-messages';

/**
 * The error message of a form control, once the user has touched or changed it
 * (and null before that, or when the control is valid). Use it under a field:
 *
 *   <p class="form-error" *ngIf="form.controls['username'] | formError as error">{{ error }}</p>
 *
 * It also shows the API's own message when it was put there by applyServerErrors().
 * The pipe is impure on purpose: a control's state changes without its object
 * changing, so it has to be checked on every pass.
 */
@Pipe({ name: 'formError', pure: false, standalone: false })
export class FormErrorPipe implements PipeTransform {
  transform(control: AbstractControl | null | undefined): string | null {
    if (!control || !control.invalid || !(control.touched || control.dirty)) return null;
    return validationMessage(control.errors);
  }
}
