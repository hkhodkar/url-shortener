import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Link, LinkStats, Page } from '../models/link.models';
import { DemoMode, MOCK_LATENCY, MOCK_STORAGE } from './demo-mode';
import { backendUnavailable, mockApiInterceptor } from './mock-api.interceptor';

describe('mockApiInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let demo: DemoMode;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        provideHttpClientTesting(),
        { provide: MOCK_LATENCY, useValue: [0, 0] },
        { provide: MOCK_STORAGE, useValue: null },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    demo = TestBed.inject(DemoMode);
  });

  afterEach(() => backend.verify());

  it('uses the real API while it answers', async () => {
    const result = firstValueFrom(http.get('/api/health'));
    backend.expectOne('/api/health').flush({ status: 'ok' });
    expect(await result).toEqual({ status: 'ok' });
    expect(demo.active()).toBe(false);
  });

  it('switches to demo mode when the API is missing', async () => {
    const result = firstValueFrom(http.get<Page<Link>>('/api/links', { params: { page_size: 3 } }));
    backend
      .expectOne((req) => req.url === '/api/links')
      .flush('<html>not found</html>', { status: 404, statusText: 'Not Found' });
    const page = await result;
    expect(demo.active()).toBe(true);
    expect(page.items).toHaveLength(3);
    expect(page.total).toBe(15);

    // later calls skip the network
    const stats = await firstValueFrom(
      http.get<LinkStats>('/api/links/portfolio/stats', { params: { range: 7 } }),
    );
    expect(stats.timeline).toHaveLength(7);
  });

  it('answers with FastAPI style errors in demo mode', async () => {
    demo.enable();
    const conflict = await firstValueFrom(
      http.post('/api/links', { target_url: 'https://x.org', alias: 'portfolio' }),
    ).catch((e: HttpErrorResponse) => e);
    expect(conflict).toBeInstanceOf(HttpErrorResponse);
    expect((conflict as HttpErrorResponse).status).toBe(409);

    const invalid = (await firstValueFrom(
      http.post('/api/links', { target_url: 'ftp://x.org', alias: 'a b' }),
    ).catch((e) => e)) as HttpErrorResponse;
    expect(invalid.status).toBe(422);
    expect(invalid.error.detail.map((issue: { loc: string[] }) => issue.loc[1])).toEqual([
      'target_url',
      'alias',
    ]);

    const missing = (await firstValueFrom(http.get('/api/links/nope')).catch((e) => e)) as HttpErrorResponse;
    expect(missing.status).toBe(404);
    const badRange = (await firstValueFrom(
      http.get('/api/links/portfolio/stats', { params: { range: 14 } }),
    ).catch((e) => e)) as HttpErrorResponse;
    expect(badRange.status).toBe(422);
  });

  it('creates, edits and deletes through the mock', async () => {
    demo.enable();
    const created = await firstValueFrom(
      http.post<Link>('/api/links', { target_url: ' https://angular.dev ', title: ' Docs ' }),
    );
    expect(created.target_url).toBe('https://angular.dev');
    expect(created.title).toBe('Docs');

    const edited = await firstValueFrom(
      http.patch<Link>(`/api/links/${created.code}`, { is_active: false, title: null }),
    );
    expect(edited.status).toBe('disabled');
    expect(edited.title).toBeNull();

    await firstValueFrom(http.delete(`/api/links/${created.code}`));
    const check = await firstValueFrom(
      http.get<{ available: boolean }>('/api/links/check-alias', { params: { alias: created.code } }),
    );
    expect(check.available).toBe(true);
  });

  it('only treats non JSON failures as a missing backend', () => {
    expect(backendUnavailable(new HttpErrorResponse({ status: 0 }))).toBe(true);
    expect(backendUnavailable(new HttpErrorResponse({ status: 502 }))).toBe(true);
    const json = new HttpErrorResponse({
      status: 404,
      headers: new HttpHeaders({ 'content-type': 'application/json' }),
    });
    expect(backendUnavailable(json)).toBe(false);
  });
});
