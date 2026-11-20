import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Why a target URL is not accepted, or null. Mirrors the API's check. */
export function urlProblem(value: string): string | null {
  const url = value.trim();
  if (!/^https?:\/\//i.test(url)) {
    return 'URL must start with http:// or https://';
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'Enter a valid URL';
  }
  const host = parsed.hostname;
  if (/\s/.test(url) || !host || (!host.includes('.') && host !== 'localhost')) {
    return 'Enter a valid URL';
  }
  return null;
}

export function httpUrlValidator(control: AbstractControl<string | null>): ValidationErrors | null {
  const value = control.value?.trim();
  if (!value) {
    return null;
  }
  const problem = urlProblem(value);
  return problem ? { url: problem } : null;
}
