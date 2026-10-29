import { ValidationErrors } from '@angular/forms';

/**
 * Turns the errors of a form control into one readable sentence.
 * A `server` error (set by applyServerErrors) carries the API's own message.
 */
export function validationMessage(errors: ValidationErrors | null): string | null {
  if (!errors) return null;

  if (typeof errors['server'] === 'string') return errors['server'];
  if (errors['required']) return 'This field is required.';
  if (errors['email']) return 'Enter a valid email address.';
  if (errors['minlength']) return `Use at least ${errors['minlength'].requiredLength} characters.`;
  if (errors['maxlength']) return `Use at most ${errors['maxlength'].requiredLength} characters.`;
  if (errors['min']) return `The value must be at least ${errors['min'].min}.`;
  if (errors['max']) return `The value must be at most ${errors['max'].max}.`;
  if (errors['pattern']) return 'This value is not in the expected format.';
  if (errors['mismatch']) return 'The values do not match.';

  // A custom validator may return its own message: { myRule: 'Text to show' }
  const custom = Object.values(errors).find((value) => typeof value === 'string');
  return custom ?? 'This value is not valid.';
}
