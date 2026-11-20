import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, catchError, map, of, switchMap, timer } from 'rxjs';
import { AliasCheck } from '../models/link.models';
import { aliasProblem } from './alias-rules';

/** Checks length, characters and reserved words without asking the server. */
export function aliasFormatValidator(control: AbstractControl<string | null>): ValidationErrors | null {
  const alias = control.value?.trim();
  if (!alias) {
    return null;
  }
  const problem = aliasProblem(alias);
  return problem ? { alias: problem } : null;
}

/**
 * Asks the API whether the alias is still free. Angular drops the previous
 * check on every keystroke, so the timer works as a debounce.
 */
export function aliasAvailableValidator(
  check: (alias: string) => Observable<AliasCheck>,
  debounceMs = 400,
): AsyncValidatorFn {
  return (control: AbstractControl<string | null>) => {
    const alias = control.value?.trim();
    if (!alias) {
      return of(null);
    }
    return timer(debounceMs).pipe(
      switchMap(() => check(alias)),
      map((result) =>
        result.available ? null : { aliasTaken: result.reason ?? 'This alias is not available' },
      ),
      // if the check itself fails the server still validates on submit
      catchError(() => of(null)),
    );
  };
}
