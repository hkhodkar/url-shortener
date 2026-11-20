import {
  AliasCheck,
  ClickEvent,
  Link,
  LinkSort,
  LinkStats,
  LinkStatus,
  Meta,
  Page,
  Summary,
} from '../models/link.models';
import {
  DAY_MS,
  aggregateLinkStats,
  buildTimeline,
  startOfUtcDay,
} from '../stats/aggregate';
import {
  ALIAS_MAX_LENGTH,
  ALIAS_MIN_LENGTH,
  RESERVED_WORDS,
  aliasProblem,
} from '../validators/alias-rules';
import { LinkRow, MockData, createSeedData } from './seed';

export const STORAGE_KEY = 'url-shortener.demo-data';
const STORAGE_VERSION = 1;
const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface ListFilter {
  search?: string | null;
  status?: LinkStatus | null;
  sort: LinkSort;
  page: number;
  page_size: number;
}

export interface NewLink {
  target_url: string;
  alias: string | null;
  title: string | null;
  expires_at: string | null;
}

/** PATCH body, `null` for target_url or is_active is rejected like the API does. */
export interface LinkChanges {
  target_url?: string | null;
  title?: string | null;
  expires_at?: string | null;
  is_active?: boolean | null;
}

export interface Visit {
  visitor_id: string;
  referrer: string | null;
  country: string | null;
  device: string;
  browser: string;
  os: string;
}

export type VisitResult =
  | { status: 'redirect'; target: string }
  | { status: 'missing' | 'expired' | 'disabled' };

/** An error the mock API answers with, `detail` follows FastAPI's error body. */
export class MockApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(typeof detail === 'string' ? detail : `HTTP ${status}`);
  }
}

type SortValue = string | number | null;

function compare(a: SortValue, b: SortValue): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
}

/**
 * In-memory version of the FastAPI backend: same rules, same response shapes.
 * Changes are saved to storage (localStorage in the browser) so they survive a
 * reload.
 */
export class MockDb {
  private data: MockData;

  constructor(
    private readonly storage: Storage | null = null,
    private readonly clock: () => Date = () => new Date(),
    private readonly shortBaseUrl = 'http://localhost/r',
    private readonly random: () => number = Math.random,
  ) {
    this.data = this.load() ?? createSeedData(this.clock());
  }

  /** Throws away all changes and starts again from the demo data. */
  reset(): void {
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      // storage not available, nothing to clear
    }
    this.data = createSeedData(this.clock());
  }

  listLinks(filter: ListFilter): Page<Link> {
    const now = this.clock();
    const term = filter.search?.trim().toLowerCase();
    const totals = this.clickTotals();
    let rows = this.data.links.filter(
      (link) =>
        (!term ||
          [link.title, link.code, link.target_url].some((field) =>
            field?.toLowerCase().includes(term),
          )) &&
        (!filter.status || this.status(link, now) === filter.status),
    );

    const descending = filter.sort.startsWith('-');
    const field = filter.sort.replace(/^-/, '');
    const value: (link: LinkRow) => SortValue = {
      created_at: (link: LinkRow) => link.created_at,
      clicks: (link: LinkRow) => totals.get(link.id)?.clicks ?? 0,
      title: (link: LinkRow) => (link.title ?? link.target_url).toLowerCase(),
      expires_at: (link: LinkRow) => link.expires_at,
      code: (link: LinkRow) => link.code,
    }[field]!;
    rows = [...rows].sort((a, b) => {
      if (field === 'expires_at') {
        // links without an expiry date always go last
        const missing = Number(a.expires_at === null) - Number(b.expires_at === null);
        if (missing) return missing;
      }
      return (descending ? -1 : 1) * compare(value(a), value(b)) || b.id - a.id;
    });

    const start = (filter.page - 1) * filter.page_size;
    return {
      items: rows.slice(start, start + filter.page_size).map((link) => this.toLink(link, totals, now)),
      total: rows.length,
      page: filter.page,
      page_size: filter.page_size,
    };
  }

  getLink(code: string): Link {
    return this.toLink(this.find(code), this.clickTotals(), this.clock());
  }

  checkAlias(alias: string): AliasCheck {
    alias = alias.trim();
    const problem = aliasProblem(alias);
    if (problem) return { alias, available: false, reason: problem };
    if (this.aliasTaken(alias)) {
      return { alias, available: false, reason: 'This alias is already taken' };
    }
    return { alias, available: true, reason: null };
  }

  createLink(input: NewLink): Link {
    const now = this.clock();
    this.ensureFuture(input.expires_at, now);
    let code: string;
    if (input.alias) {
      if (this.aliasTaken(input.alias)) {
        throw new MockApiError(409, `The alias '${input.alias}' is already taken`);
      }
      code = input.alias;
    } else {
      do {
        code = this.randomCode();
      } while (this.aliasTaken(code));
    }
    const link: LinkRow = {
      id: this.data.links.reduce((max, row) => Math.max(max, row.id), 0) + 1,
      code,
      target_url: input.target_url,
      title: input.title,
      is_custom: !!input.alias,
      is_active: true,
      expires_at: input.expires_at,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    this.data.links.push(link);
    this.save();
    return this.getLink(code);
  }

  updateLink(code: string, changes: LinkChanges): Link {
    const link = this.find(code);
    const now = this.clock();
    for (const field of ['target_url', 'is_active'] as const) {
      if (field in changes && changes[field] === null) {
        throw new MockApiError(422, `${field} cannot be empty`);
      }
    }
    if ('expires_at' in changes) {
      this.ensureFuture(changes.expires_at ?? null, now);
    }
    Object.assign(link, changes);
    if (Object.keys(changes).length) {
      link.updated_at = now.toISOString();
    }
    this.save();
    return this.getLink(code);
  }

  deleteLink(code: string): void {
    const link = this.find(code);
    this.data.links = this.data.links.filter((row) => row.id !== link.id);
    this.data.clicks = this.data.clicks.filter((click) => click.link_id !== link.id);
    this.save();
  }

  stats(code: string, range: number): LinkStats {
    const link = this.find(code);
    const clicks = this.data.clicks.filter((click) => click.link_id === link.id);
    return aggregateLinkStats(link.code, clicks, range, this.clock());
  }

  summary(): Summary {
    const now = this.clock();
    const today = startOfUtcDay(now).getTime();
    const weekStart = new Date(today - 6 * DAY_MS).toISOString();
    const previousStart = new Date(today - 13 * DAY_MS).toISOString();
    const clicks = this.data.clicks;
    const list = (sort: LinkSort) => this.listLinks({ sort, page: 1, page_size: 5 }).items;
    return {
      total_links: this.data.links.length,
      active_links: this.data.links.filter((link) => this.status(link, now) === 'active').length,
      total_clicks: clicks.length,
      clicks_last_7_days: clicks.filter((c) => c.clicked_at >= weekStart).length,
      clicks_previous_7_days: clicks.filter(
        (c) => c.clicked_at >= previousStart && c.clicked_at < weekStart,
      ).length,
      timeline: buildTimeline(clicks, new Date(today - 29 * DAY_MS), 30),
      top_links: list('-clicks'),
      recent_links: list('-created_at'),
    };
  }

  meta(): Meta {
    return {
      short_base_url: this.shortBaseUrl,
      alias_min_length: ALIAS_MIN_LENGTH,
      alias_max_length: ALIAS_MAX_LENGTH,
      reserved_words: [...RESERVED_WORDS].sort(),
    };
  }

  /** What GET /{code} does on the backend: count the click and say where to go. */
  visit(code: string, visit: Visit): VisitResult {
    const link = this.data.links.find((row) => row.code === code);
    if (!link) return { status: 'missing' };
    const status = this.status(link, this.clock());
    if (status !== 'active') return { status };
    this.data.clicks.push({ link_id: link.id, clicked_at: this.clock().toISOString(), ...visit });
    this.save();
    return { status: 'redirect', target: link.target_url };
  }

  private status(link: LinkRow, now: Date): LinkStatus {
    if (!link.is_active) return 'disabled';
    if (link.expires_at && new Date(link.expires_at) <= now) return 'expired';
    return 'active';
  }

  private clickTotals(): Map<number, { clicks: number; last: string }> {
    const totals = new Map<number, { clicks: number; last: string }>();
    for (const click of this.data.clicks) {
      const total = totals.get(click.link_id);
      if (!total) {
        totals.set(click.link_id, { clicks: 1, last: click.clicked_at });
      } else {
        total.clicks++;
        if (click.clicked_at > total.last) total.last = click.clicked_at;
      }
    }
    return totals;
  }

  private toLink(row: LinkRow, totals: Map<number, { clicks: number; last: string }>, now: Date): Link {
    const total = totals.get(row.id);
    return {
      ...row,
      short_url: `${this.shortBaseUrl}/${row.code}`,
      status: this.status(row, now),
      clicks: total?.clicks ?? 0,
      last_clicked_at: total?.last ?? null,
    };
  }

  private find(code: string): LinkRow {
    const link = this.data.links.find((row) => row.code === code);
    if (!link) throw new MockApiError(404, 'Link not found');
    return link;
  }

  private aliasTaken(alias: string): boolean {
    const lower = alias.toLowerCase();
    return this.data.links.some((link) => link.code.toLowerCase() === lower);
  }

  private ensureFuture(expiresAt: string | null, now: Date): void {
    if (expiresAt && new Date(expiresAt) <= now) {
      throw new MockApiError(422, 'The expiry date must be in the future');
    }
  }

  private randomCode(): string {
    let code = '';
    for (let i = 0; i < 7; i++) code += BASE62[Math.floor(this.random() * 62)];
    return code;
  }

  private load(): MockData | null {
    try {
      const saved = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null');
      return saved?.version === STORAGE_VERSION ? (saved.data as MockData) : null;
    } catch {
      return null;
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, data: this.data }));
    } catch {
      // storage full or disabled, changes then only last until a reload
    }
  }
}
