import { AbstractControl, ValidationErrors } from '@angular/forms';
import { endOfDayIso } from '../utils/format';

/**
 * The picked day (a date input value) must not be over yet. Untouched values
 * are left alone, so editing a link that already expired doesn't block saving.
 */
export function notPastDayValidator(control: AbstractControl<string | null>): ValidationErrors | null {
  const value = control.value;
  if (!value || control.pristine) return null;
  return new Date(endOfDayIso(value)).getTime() > Date.now() ? null : { pastDate: true };
}
