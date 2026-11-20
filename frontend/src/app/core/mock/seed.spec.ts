import { createSeedData } from './seed';
import { mulberry32 } from './random';
import { countryFromLanguage, parseUserAgent, referrerDomain } from './user-agent';

describe('demo seed', () => {
  const now = new Date('2026-11-20T10:30:00Z');

  it('matches the backend seed for the same moment', () => {
    // numbers taken from backend/app/seed.py build_demo_data() at the same time
    const { links, clicks } = createSeedData(now);
    const perLink = links.map((link) => clicks.filter((c) => c.link_id === link.id).length);
    expect(clicks).toHaveLength(3602);
    expect(perLink).toEqual([604, 692, 363, 228, 155, 213, 254, 210, 205, 105, 259, 93, 87, 125, 9]);

    expect(links[4]).toMatchObject({
      code: 'webinar-nov',
      created_at: '2026-10-16T09:28:00.000Z',
      expires_at: '2026-12-02T23:59:59.000Z',
    });
    const webinar = clicks.filter((c) => c.link_id === 5);
    expect(webinar[7]).toEqual({
      link_id: 5,
      clicked_at: '2026-10-18T09:58:36.000Z',
      visitor_id: 'seed04v0062',
      referrer: 'x.com',
      country: 'FR',
      device: 'mobile',
      browser: 'Chrome',
      os: 'Android',
    });
  });

  it('never puts clicks in the future or before a link existed', () => {
    const { links, clicks } = createSeedData(now);
    const created = new Map(links.map((link) => [link.id, link.created_at]));
    for (const click of clicks) {
      expect(click.clicked_at <= now.toISOString()).toBe(true);
      expect(click.clicked_at >= created.get(click.link_id)!).toBe(true);
    }
  });

  it('uses a deterministic generator', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('visit parsing', () => {
  it('reads device, browser and os from the user agent', () => {
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
    const edge =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';
    expect(parseUserAgent(iphone)).toEqual({ device: 'mobile', browser: 'Safari', os: 'iOS' });
    expect(parseUserAgent(edge)).toEqual({ device: 'desktop', browser: 'Edge', os: 'Windows' });
    expect(parseUserAgent('curl/8.7.1').device).toBe('bot');
  });

  it('keeps only the referring host and the language region', () => {
    expect(referrerDomain('https://www.linkedin.com/feed/')).toBe('linkedin.com');
    expect(referrerDomain('https://demo.app/x', 'demo.app')).toBeNull();
    expect(referrerDomain('')).toBeNull();
    expect(countryFromLanguage('en-GB')).toBe('GB');
    expect(countryFromLanguage('fr')).toBeNull();
  });
});
