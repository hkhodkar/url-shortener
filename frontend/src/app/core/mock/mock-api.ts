import { LinkSort, LinkStatus } from '../models/link.models';
import { aliasProblem } from '../validators/alias-rules';
import { urlProblem } from '../validators/url.validator';
import { LinkChanges, MockApiError, MockDb, NewLink } from './mock-db';

export interface MockResponse {
  status: number;
  body: unknown;
}

interface Issue {
  type: string;
  loc: (string | number)[];
  msg: string;
  input: unknown;
}

const SORTS: LinkSort[] = [
  'created_at',
  '-created_at',
  'clicks',
  '-clicks',
  'title',
  '-title',
  'expires_at',
  '-expires_at',
  'code',
  '-code',
];
const STATUSES: LinkStatus[] = ['active', 'expired', 'disabled'];
const RANGES = [7, 30, 90];

/** Collects FastAPI style validation issues and throws them as one 422. */
class Validator {
  readonly issues: Issue[] = [];

  constructor(private readonly where: 'body' | 'query') {}

  fail(field: string, msg: string, input: unknown, type = 'value_error'): void {
    this.issues.push({ type, loc: [this.where, field], msg, input });
  }

  done(): void {
    if (this.issues.length) throw new MockApiError(422, this.issues);
  }
}

function readQuery(params: URLSearchParams) {
  const v = new Validator('query');
  const int = (name: string, fallback: number, min: number, max = Infinity) => {
    const raw = params.get(name);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value)) {
      v.fail(name, 'Input should be a valid integer', raw, 'int_parsing');
    } else if (value < min || value > max) {
      v.fail(name, `Input should be between ${min} and ${max}`, raw, 'range');
    }
    return value;
  };
  const choice = <T extends string>(name: string, values: readonly T[]): T | null => {
    const raw = params.get(name);
    if (raw === null || raw === '') return null;
    if (!values.includes(raw as T)) v.fail(name, `Input should be ${values.join(', ')}`, raw, 'enum');
    return raw as T;
  };
  return { v, int, choice };
}

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new MockApiError(422, [
      { type: 'model_attributes_type', loc: ['body'], msg: 'Input should be an object', input: body },
    ]);
  }
  return body as Record<string, unknown>;
}

function optionalText(v: Validator, body: Record<string, unknown>, field: string, max: number) {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    v.fail(field, 'Input should be a valid string', value, 'string_type');
    return null;
  }
  const text = value.trim();
  if (text.length > max) v.fail(field, `String should have at most ${max} characters`, value);
  return text || null;
}

function targetUrl(v: Validator, value: unknown): string {
  if (typeof value !== 'string') {
    v.fail('target_url', value === undefined ? 'Field required' : 'Input should be a valid string', value);
    return '';
  }
  const url = value.trim();
  const problem = urlProblem(url);
  if (problem) v.fail('target_url', `Value error, ${problem}`, value);
  return url;
}

function expiry(v: Validator, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const date = typeof value === 'string' ? new Date(value) : null;
  if (!date || isNaN(date.getTime())) {
    v.fail('expires_at', 'Input should be a valid datetime', value, 'datetime_parsing');
    return null;
  }
  return date.toISOString();
}

function rejectExtra(v: Validator, body: Record<string, unknown>, allowed: string[]): void {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) v.fail(key, 'Extra inputs are not permitted', body[key], 'extra_forbidden');
  }
}

function parseNewLink(raw: unknown): NewLink {
  const body = asObject(raw);
  const v = new Validator('body');
  rejectExtra(v, body, ['target_url', 'alias', 'title', 'expires_at']);
  const link: NewLink = {
    target_url: targetUrl(v, body['target_url']),
    alias: optionalText(v, body, 'alias', 64),
    title: optionalText(v, body, 'title', 120),
    expires_at: expiry(v, body['expires_at']),
  };
  if (link.alias) {
    const problem = aliasProblem(link.alias);
    if (problem) v.fail('alias', `Value error, ${problem}`, body['alias']);
  }
  v.done();
  return link;
}

function parseChanges(raw: unknown): LinkChanges {
  const body = asObject(raw);
  const v = new Validator('body');
  rejectExtra(v, body, ['target_url', 'title', 'expires_at', 'is_active']);
  const changes: LinkChanges = {};
  if ('target_url' in body) {
    changes.target_url = body['target_url'] === null ? null : targetUrl(v, body['target_url']);
  }
  if ('title' in body) changes.title = optionalText(v, body, 'title', 120);
  if ('expires_at' in body) changes.expires_at = expiry(v, body['expires_at']);
  if ('is_active' in body) {
    const value = body['is_active'];
    if (value !== null && typeof value !== 'boolean') {
      v.fail('is_active', 'Input should be a valid boolean', value, 'bool_type');
    }
    changes.is_active = value as boolean;
  }
  v.done();
  return changes;
}

/**
 * Routes one request to the mock database. Mirrors the FastAPI routes,
 * including status codes and error bodies.
 */
export function handleMockRequest(db: MockDb, method: string, url: string, body: unknown): MockResponse {
  const parsed = new URL(url, 'http://mock.local');
  const path = parsed.pathname.replace(/\/+$/, '');
  const params = parsed.searchParams;

  try {
    if (path === '/api/health' && method === 'GET') {
      return { status: 200, body: { status: 'ok' } };
    }
    if (path === '/api/meta' && method === 'GET') {
      return { status: 200, body: db.meta() };
    }
    if (path === '/api/summary' && method === 'GET') {
      return { status: 200, body: db.summary() };
    }
    if (path === '/api/links') {
      if (method === 'GET') {
        const { v, int, choice } = readQuery(params);
        const filter = {
          search: params.get('search'),
          status: choice('status', STATUSES),
          sort: choice('sort', SORTS) ?? '-created_at',
          page: int('page', 1, 1),
          page_size: int('page_size', 10, 1, 100),
        };
        v.done();
        return { status: 200, body: db.listLinks(filter) };
      }
      if (method === 'POST') {
        return { status: 201, body: db.createLink(parseNewLink(body)) };
      }
      return methodNotAllowed();
    }
    if (path === '/api/links/check-alias' && method === 'GET') {
      const alias = params.get('alias');
      if (alias === null) {
        throw new MockApiError(422, [
          { type: 'missing', loc: ['query', 'alias'], msg: 'Field required', input: null },
        ]);
      }
      return { status: 200, body: db.checkAlias(alias) };
    }

    const stats = /^\/api\/links\/([^/]+)\/stats$/.exec(path);
    if (stats && method === 'GET') {
      const code = decodeURIComponent(stats[1]);
      const range = Number(params.get('range') ?? 30);
      db.getLink(code); // 404 first, like the API
      if (!RANGES.includes(range)) throw new MockApiError(422, 'range must be 7, 30 or 90');
      return { status: 200, body: db.stats(code, range) };
    }

    const item = /^\/api\/links\/([^/]+)$/.exec(path);
    if (item) {
      const code = decodeURIComponent(item[1]);
      switch (method) {
        case 'GET':
          return { status: 200, body: db.getLink(code) };
        case 'PATCH':
          return { status: 200, body: db.updateLink(code, parseChanges(body)) };
        case 'DELETE':
          db.deleteLink(code);
          return { status: 204, body: null };
        default:
          return methodNotAllowed();
      }
    }
    return { status: 404, body: { detail: 'Not Found' } };
  } catch (error) {
    if (error instanceof MockApiError) {
      return { status: error.status, body: { detail: error.detail } };
    }
    throw error;
  }
}

function methodNotAllowed(): MockResponse {
  return { status: 405, body: { detail: 'Method Not Allowed' } };
}
