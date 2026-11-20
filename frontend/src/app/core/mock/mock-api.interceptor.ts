import {
  HttpErrorResponse,
  HttpEvent,
  HttpHeaders,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, map, throwError, timer } from 'rxjs';
import { DemoMode, MOCK_LATENCY } from './demo-mode';
import { handleMockRequest } from './mock-api';

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Content',
};

export function isApiUrl(url: string): boolean {
  return /^\/api(\/|\?|$)/.test(url);
}

/**
 * True when there is no API behind the host at all: the server is down, or a
 * static host / proxy answered instead of FastAPI (which always sends JSON).
 */
export function backendUnavailable(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) return false;
  if (error.status === 0) return true;
  if ((error.headers?.get('content-type') ?? '').includes('json')) return false;
  if ([404, 502, 503, 504].includes(error.status)) return true;
  // the dev server proxy answers an empty 500 when nothing listens on the API port
  return error.status === 500 && (error.error === null || error.error === '');
}

/**
 * Sends `/api` calls to the mock API while demo mode is on. Otherwise they go
 * to the real backend, and if that turns out to be missing the app switches to
 * demo mode and answers the request from the mock instead.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiUrl(req.url)) {
    return next(req);
  }
  const demo = inject(DemoMode);
  const latency = inject(MOCK_LATENCY);
  const fromMock = () => mockResponse(req, demo, latency);

  if (demo.active()) {
    return fromMock();
  }
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!backendUnavailable(error)) {
        return throwError(() => error);
      }
      demo.enable();
      return fromMock();
    }),
  );
};

function mockResponse(
  req: HttpRequest<unknown>,
  demo: DemoMode,
  [min, max]: readonly [number, number],
): Observable<HttpEvent<unknown>> {
  const url = req.urlWithParams;
  const headers = new HttpHeaders({ 'content-type': 'application/json' });
  return timer(min + Math.random() * (max - min)).pipe(
    map(() => {
      const { status, body } = handleMockRequest(demo.db, req.method, url, req.body);
      const statusText = STATUS_TEXT[status] ?? '';
      // copy, so components never hold references into the mock database
      const copy = body === null ? null : structuredClone(body);
      if (status >= 400) {
        throw new HttpErrorResponse({ error: copy, status, statusText, url, headers });
      }
      return new HttpResponse({ body: copy, status, statusText, url, headers });
    }),
  );
}
