import { HttpErrorResponse } from '@angular/common/http';

interface ValidationIssue {
  loc?: (string | number)[];
  msg?: string;
}

/** Turns a failed request into one sentence for the user. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }
  if (error.status === 0) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  const detail = (error.error as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail) && detail.length) {
    return (detail as ValidationIssue[])
      .map((issue) => (issue.msg ?? '').replace(/^Value error, /, ''))
      .filter(Boolean)
      .join('. ');
  }
  return fallback;
}
