import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AliasCheck,
  Link,
  LinkCreate,
  LinkQuery,
  LinkStats,
  LinkUpdate,
  Meta,
  Page,
  StatsRange,
  Summary,
} from '../models/link.models';

const BASE = '/api/links';

function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class LinksApi {
  private readonly http = inject(HttpClient);

  list(query: LinkQuery): Observable<Page<Link>> {
    return this.http.get<Page<Link>>(BASE, { params: toParams(query) });
  }

  get(code: string): Observable<Link> {
    return this.http.get<Link>(`${BASE}/${encodeURIComponent(code)}`);
  }

  create(payload: LinkCreate): Observable<Link> {
    return this.http.post<Link>(BASE, payload);
  }

  update(code: string, changes: LinkUpdate): Observable<Link> {
    return this.http.patch<Link>(`${BASE}/${encodeURIComponent(code)}`, changes);
  }

  delete(code: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/${encodeURIComponent(code)}`);
  }

  checkAlias(alias: string): Observable<AliasCheck> {
    return this.http.get<AliasCheck>(`${BASE}/check-alias`, { params: { alias } });
  }

  stats(code: string, range: StatsRange): Observable<LinkStats> {
    return this.http.get<LinkStats>(`${BASE}/${encodeURIComponent(code)}/stats`, {
      params: { range },
    });
  }

  meta(): Observable<Meta> {
    return this.http.get<Meta>('/api/meta');
  }

  summary(): Observable<Summary> {
    return this.http.get<Summary>('/api/summary');
  }
}
