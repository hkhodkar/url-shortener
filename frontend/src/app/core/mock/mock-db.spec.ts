import { MockApiError, MockDb, STORAGE_KEY } from './mock-db';

class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

describe('MockDb', () => {
  const now = new Date('2026-11-20T10:30:00Z');
  let storage: MemoryStorage;
  let db: MockDb;

  beforeEach(() => {
    storage = new MemoryStorage();
    db = new MockDb(storage, () => now, 'https://demo.app/r');
  });

  it('lists the seeded links with click totals and statuses', () => {
    const page = db.listLinks({ sort: '-clicks', page: 1, page_size: 5 });
    expect(page.total).toBe(15);
    expect(page.items).toHaveLength(5);
    expect(page.items[0]).toMatchObject({ code: 'spring-sale', clicks: 692, status: 'expired' });
    expect(page.items[0].short_url).toBe('https://demo.app/r/spring-sale');
    const clicks = page.items.map((link) => link.clicks);
    expect(clicks).toEqual([...clicks].sort((a, b) => b - a));
  });

  it('filters by status and search', () => {
    const codes = (status: 'active' | 'expired' | 'disabled') =>
      db.listLinks({ status, sort: 'code', page: 1, page_size: 50 }).items.map((l) => l.code);
    expect(codes('expired')).toEqual(['spring-sale', 'survey-2026']);
    expect(codes('disabled')).toEqual(['q3-report']);
    expect(codes('active')).toHaveLength(12);

    const found = db.listLinks({ search: 'TIANGOLO', sort: 'title', page: 1, page_size: 10 });
    expect(found.items.map((l) => l.code)).toEqual(['fJ3kQ9a', 'k9Vd0Rs']);
  });

  it('sorts links without an expiry last in both directions', () => {
    const asc = db.listLinks({ sort: 'expires_at', page: 1, page_size: 50 }).items;
    const desc = db.listLinks({ sort: '-expires_at', page: 1, page_size: 50 }).items;
    expect(asc[0].code).toBe('spring-sale');
    expect(desc[0].code).toBe('careers');
    expect(asc.at(-1)!.expires_at).toBeNull();
    expect(desc.at(-1)!.expires_at).toBeNull();
  });

  it('creates links with an alias or a random base62 code', () => {
    const custom = db.createLink({
      target_url: 'https://example.com',
      alias: 'my-alias',
      title: null,
      expires_at: null,
    });
    expect(custom).toMatchObject({ code: 'my-alias', is_custom: true, clicks: 0, status: 'active' });

    const random = db.createLink({ target_url: 'https://example.com', alias: null, title: 'T', expires_at: null });
    expect(random.code).toMatch(/^[0-9a-zA-Z]{7}$/);
    expect(random.is_custom).toBe(false);

    expect(() =>
      db.createLink({ target_url: 'https://x.org', alias: 'MY-ALIAS', title: null, expires_at: null }),
    ).toThrow(MockApiError);
    expect(db.checkAlias('My-Alias')).toEqual({
      alias: 'My-Alias',
      available: false,
      reason: 'This alias is already taken',
    });
    expect(db.checkAlias('docs').reason).toBe('This word is reserved');
    expect(db.checkAlias('fresh-one').available).toBe(true);
  });

  it('updates, disables and deletes links', () => {
    const updated = db.updateLink('portfolio', { title: 'Profile', is_active: false });
    expect(updated).toMatchObject({ title: 'Profile', status: 'disabled' });
    expect(updated.updated_at).toBe(now.toISOString());
    expect(() => db.updateLink('portfolio', { expires_at: '2020-01-01T00:00:00Z' })).toThrow(
      'The expiry date must be in the future',
    );
    db.deleteLink('portfolio');
    expect(() => db.getLink('portfolio')).toThrow('Link not found');
    expect(db.summary().total_links).toBe(14);
  });

  it('records visits like the redirect route', () => {
    const visit = { visitor_id: 'me', referrer: null, country: 'DE', device: 'desktop', browser: 'Chrome', os: 'macOS' };
    expect(db.visit('portfolio', visit)).toEqual({ status: 'redirect', target: 'https://github.com/hkhodkar' });
    expect(db.getLink('portfolio').clicks).toBe(364);
    expect(db.visit('spring-sale', visit)).toEqual({ status: 'expired' });
    expect(db.visit('q3-report', visit)).toEqual({ status: 'disabled' });
    expect(db.visit('nope', visit)).toEqual({ status: 'missing' });
    expect(db.stats('portfolio', 7).timeline.at(-1)!.clicks).toBeGreaterThan(0);
  });

  it('builds the dashboard summary', () => {
    const summary = db.summary();
    expect(summary.total_links).toBe(15);
    expect(summary.active_links).toBe(12);
    expect(summary.total_clicks).toBe(3602);
    expect(summary.timeline).toHaveLength(30);
    expect(summary.top_links[0].code).toBe('spring-sale');
    expect(summary.recent_links[0].code).toBe('Qe7hN1c');
    expect(summary.clicks_last_7_days).toBe(
      summary.timeline.slice(-7).reduce((sum, day) => sum + day.clicks, 0),
    );
  });

  it('keeps changes in storage until reset', () => {
    db.updateLink('careers', { title: 'Saved title' });
    expect(storage.getItem(STORAGE_KEY)).toContain('Saved title');

    const reloaded = new MockDb(storage, () => now);
    expect(reloaded.getLink('careers').title).toBe('Saved title');

    reloaded.reset();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(reloaded.getLink('careers').title).toBe('Senior frontend engineer job post');
  });
});
