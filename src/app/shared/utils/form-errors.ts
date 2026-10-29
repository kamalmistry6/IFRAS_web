import { AbstractControl, FormGroup } from '@angular/forms';
import { GlobalException } from 'src/app/core/exceptions';

/**
 * Puts the API's validation errors onto the matching form controls, so each
 * message appears under its field. Returns the messages that belong to no
 * field (rules across fields, or a field the form does not have): show those
 * in an <app-alert> above the form.
 *
 *   this.api.create(body).subscribe({
 *     error: (error: GlobalException) => (this.formErrors = applyServerErrors(this.form, error)),
 *   });
 *
 * The control's error clears by itself as soon as the user edits the field.
 */
export function applyServerErrors(form: FormGroup, error: GlobalException): string[] {
  const unmatched: string[] = [...(error.detail ? [error.detail] : []), ...error.generalErrors];

  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const control: AbstractControl | null = form.get(field);

    if (control) {
      control.setErrors({ server: messages.join(' ') });
      control.markAsTouched();
    } else {
      unmatched.push(`${field}: ${messages.join(' ')}`);
    }
  }

  return unmatched;
}
