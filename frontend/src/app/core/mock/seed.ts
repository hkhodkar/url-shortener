import { ClickEvent } from '../models/link.models';
import { DAY_MS, startOfUtcDay } from '../stats/aggregate';
import { Weighted, mulberry32, pick } from './random';

// Port of backend/app/seed.py. Same PRNG and the same order of calls, so the
// demo shows the same links and clicks as a fresh backend.

export interface LinkRow {
  id: number;
  code: string;
  target_url: string;
  title: string | null;
  is_custom: boolean;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MockData {
  links: LinkRow[];
  clicks: ClickEvent[];
}

interface DemoLink {
  code: string;
  targetUrl: string;
  title: string | null;
  isCustom: boolean;
  createdDaysAgo: number;
  popularity: number;
  shape: 'steady' | 'launch' | 'growing' | 'campaign';
  referrers: string;
  region: string;
  mobileBias?: number;
  expiresInDays?: number;
  disabledDaysAgo?: number;
  spikeDaysAgo?: number;
}

const SEED = 20260611;
const HISTORY_DAYS = 90;
const DAY_SECONDS = 86_400;

const REFERRERS: Record<string, Weighted<string | null>[]> = {
  social: [
    [null, 30],
    ['x.com', 22],
    ['linkedin.com', 18],
    ['reddit.com', 10],
    ['facebook.com', 8],
    ['news.ycombinator.com', 6],
    ['google.com', 6],
  ],
  dev: [
    [null, 25],
    ['github.com', 22],
    ['google.com', 20],
    ['stackoverflow.com', 12],
    ['news.ycombinator.com', 8],
    ['reddit.com', 7],
    ['dev.to', 6],
  ],
  email: [
    [null, 45],
    ['mail.google.com', 25],
    ['outlook.live.com', 15],
    ['linkedin.com', 8],
    ['x.com', 7],
  ],
  search: [
    [null, 20],
    ['google.com', 45],
    ['bing.com', 10],
    ['linkedin.com', 10],
    ['duckduckgo.com', 8],
    ['x.com', 7],
  ],
};

const COUNTRIES: Record<string, Weighted<string | null>[]> = {
  global: [
    ['US', 30],
    ['DE', 10],
    ['GB', 9],
    ['IN', 9],
    ['CA', 6],
    ['FR', 5],
    ['NL', 4],
    ['BR', 4],
    ['AU', 3],
    ['ES', 3],
    ['SE', 2],
    ['PL', 2],
    ['JP', 2],
    [null, 2],
  ],
  europe: [
    ['DE', 22],
    ['GB', 14],
    ['FR', 12],
    ['NL', 10],
    ['ES', 8],
    ['IT', 7],
    ['SE', 6],
    ['PL', 6],
    ['US', 5],
    ['AT', 4],
    ['CH', 4],
    [null, 2],
  ],
  us: [
    ['US', 55],
    ['CA', 12],
    ['GB', 6],
    ['IN', 6],
    ['MX', 5],
    ['DE', 4],
    ['BR', 4],
    ['AU', 4],
    [null, 2],
  ],
};

// device, browser, os, weight
const AGENTS: [string, string, string, number][] = [
  ['desktop', 'Chrome', 'Windows', 24],
  ['desktop', 'Chrome', 'macOS', 12],
  ['desktop', 'Safari', 'macOS', 7],
  ['desktop', 'Edge', 'Windows', 7],
  ['desktop', 'Firefox', 'Windows', 4],
  ['desktop', 'Firefox', 'Linux', 2],
  ['desktop', 'Chrome', 'Linux', 2],
  ['mobile', 'Safari', 'iOS', 18],
  ['mobile', 'Chrome', 'Android', 15],
  ['mobile', 'Samsung Internet', 'Android', 3],
  ['mobile', 'Chrome', 'iOS', 2],
  ['tablet', 'Safari', 'iOS', 3],
  ['tablet', 'Chrome', 'Android', 1],
];

// traffic by UTC weekday, Sunday first
const WEEKDAY_FACTOR = [0.7, 1.05, 1.15, 1.12, 1.08, 1, 0.78];

export const DEMO_LINKS: DemoLink[] = [
  {
    code: 'angular-signals',
    targetUrl: 'https://angular.dev/guide/signals',
    title: 'Angular signals guide',
    isCustom: true,
    createdDaysAgo: 120,
    popularity: 7,
    shape: 'steady',
    referrers: 'dev',
    region: 'global',
  },
  {
    code: 'spring-sale',
    targetUrl: 'https://shop.example.com/collections/spring-sale?utm_source=newsletter',
    title: 'Spring sale landing page',
    isCustom: true,
    createdDaysAgo: 80,
    popularity: 8,
    shape: 'launch',
    referrers: 'email',
    region: 'us',
    mobileBias: 1.6,
    expiresInDays: -21,
  },
  {
    code: 'portfolio',
    targetUrl: 'https://github.com/hkhodkar',
    title: 'GitHub profile',
    isCustom: true,
    createdDaysAgo: 150,
    popularity: 4,
    shape: 'steady',
    referrers: 'social',
    region: 'global',
  },
  {
    code: 'fJ3kQ9a',
    targetUrl: 'https://fastapi.tiangolo.com/tutorial/sql-databases/',
    title: 'FastAPI SQL databases tutorial',
    isCustom: false,
    createdDaysAgo: 64,
    popularity: 3.5,
    shape: 'growing',
    referrers: 'dev',
    region: 'global',
  },
  {
    code: 'webinar-nov',
    targetUrl: 'https://events.example.com/webinars/scaling-frontend-teams',
    title: 'Webinar: scaling frontend teams',
    isCustom: true,
    createdDaysAgo: 35,
    popularity: 4,
    shape: 'campaign',
    referrers: 'social',
    region: 'europe',
    mobileBias: 0.8,
    expiresInDays: 12,
    spikeDaysAgo: 9,
  },
  {
    code: 'Xb81mPq',
    targetUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302',
    title: 'MDN: 302 Found',
    isCustom: false,
    createdDaysAgo: 95,
    popularity: 2.5,
    shape: 'steady',
    referrers: 'search',
    region: 'global',
  },
  {
    code: 'careers',
    targetUrl: 'https://jobs.example.com/careers/senior-frontend-engineer',
    title: 'Senior frontend engineer job post',
    isCustom: true,
    createdDaysAgo: 28,
    popularity: 5,
    shape: 'launch',
    referrers: 'social',
    region: 'europe',
    expiresInDays: 30,
  },
  {
    code: 'release-notes',
    targetUrl: 'https://github.com/angular/angular/releases',
    title: 'Angular release notes',
    isCustom: true,
    createdDaysAgo: 70,
    popularity: 3,
    shape: 'steady',
    referrers: 'dev',
    region: 'global',
  },
  {
    code: 'q3-report',
    targetUrl: 'https://files.example.com/reports/q3-2026.pdf',
    title: 'Q3 2026 report (PDF)',
    isCustom: true,
    createdDaysAgo: 58,
    popularity: 3,
    shape: 'launch',
    referrers: 'email',
    region: 'us',
    disabledDaysAgo: 15,
  },
  {
    code: 'Lm4Tz2w',
    targetUrl: 'https://www.typescriptlang.org/docs/handbook/2/generics.html',
    title: 'TypeScript generics handbook',
    isCustom: false,
    createdDaysAgo: 45,
    popularity: 2.5,
    shape: 'growing',
    referrers: 'search',
    region: 'global',
  },
  {
    code: 'newsletter-42',
    targetUrl: 'https://newsletter.example.com/issues/42',
    title: 'Newsletter #42',
    isCustom: true,
    createdDaysAgo: 20,
    popularity: 6,
    shape: 'launch',
    referrers: 'email',
    region: 'europe',
    mobileBias: 1.4,
  },
  {
    code: 'k9Vd0Rs',
    targetUrl: 'https://sqlmodel.tiangolo.com/',
    title: null,
    isCustom: false,
    createdDaysAgo: 52,
    popularity: 2,
    shape: 'steady',
    referrers: 'dev',
    region: 'us',
  },
  {
    code: 'black-friday',
    targetUrl: 'https://shop.example.com/black-friday',
    title: 'Black Friday deals',
    isCustom: true,
    createdDaysAgo: 18,
    popularity: 5,
    shape: 'growing',
    referrers: 'social',
    region: 'us',
    mobileBias: 1.8,
    expiresInDays: 9,
  },
  {
    code: 'survey-2026',
    targetUrl: 'https://forms.example.com/s/customer-survey-2026',
    title: 'Customer survey 2026',
    isCustom: true,
    createdDaysAgo: 33,
    popularity: 4,
    shape: 'campaign',
    referrers: 'email',
    region: 'europe',
    expiresInDays: -3,
    spikeDaysAgo: 30,
  },
  {
    code: 'Qe7hN1c',
    targetUrl: 'https://www.chartjs.org/docs/latest/',
    title: 'Chart.js docs',
    isCustom: false,
    createdDaysAgo: 6,
    popularity: 2,
    shape: 'steady',
    referrers: 'dev',
    region: 'global',
  },
];

function shapeFactor(link: DemoLink, daysAgo: number): number {
  const age = link.createdDaysAgo - daysAgo;
  if (link.shape === 'launch') return 1 + 6 / (1 + age);
  if (link.shape === 'growing') return 0.25 + (1.5 * age) / link.createdDaysAgo;
  if (link.shape === 'campaign' && link.spikeDaysAgo !== undefined) {
    if (daysAgo === link.spikeDaysAgo) return 4;
    if (daysAgo === link.spikeDaysAgo - 1) return 2.2;
  }
  return 1;
}

const pad = (n: number, size: number) => String(n).padStart(size, '0');

export function createSeedData(now: Date): MockData {
  const rng = mulberry32(SEED);
  const today = startOfUtcDay(now).getTime();
  const elapsedToday = Math.floor((now.getTime() - today) / 1000);
  const links: LinkRow[] = [];
  const clicks: ClickEvent[] = [];

  DEMO_LINKS.forEach((demo, index) => {
    const id = index + 1;
    const createdAt = today - demo.createdDaysAgo * DAY_MS + ((index * 37) % 60 + 540) * 60_000;
    let expiresAt: number | null = null;
    if (demo.expiresInDays !== undefined) {
      expiresAt =
        demo.expiresInDays < 0
          ? today + demo.expiresInDays * DAY_MS + 12 * 3_600_000
          : today + (demo.expiresInDays + 1) * DAY_MS - 1000;
    }
    const updatedAt =
      demo.disabledDaysAgo !== undefined
        ? today - demo.disabledDaysAgo * DAY_MS + 10 * 3_600_000
        : createdAt;
    links.push({
      id,
      code: demo.code,
      target_url: demo.targetUrl,
      title: demo.title,
      is_custom: demo.isCustom,
      is_active: demo.disabledDaysAgo === undefined,
      expires_at: expiresAt === null ? null : new Date(expiresAt).toISOString(),
      created_at: new Date(createdAt).toISOString(),
      updated_at: new Date(updatedAt).toISOString(),
    });

    // expired and disabled links stop getting traffic the day before
    let lastDay = 0;
    if (demo.expiresInDays !== undefined && demo.expiresInDays < 0) lastDay = -demo.expiresInDays + 1;
    if (demo.disabledDaysAgo !== undefined) lastDay = demo.disabledDaysAgo + 1;

    const countries = COUNTRIES[demo.region];
    const referrers = REFERRERS[demo.referrers];
    const mobileBias = demo.mobileBias ?? 1;
    const agents: Weighted<[string, string, string]>[] = AGENTS.map(([device, browser, os, weight]) => [
      [device, browser, os],
      device === 'desktop' ? weight : weight * mobileBias,
    ]);
    const pool = Math.max(8, Math.floor(demo.popularity * 25));

    for (let daysAgo = Math.min(demo.createdDaysAgo, HISTORY_DAYS - 1); daysAgo >= lastDay; daysAgo--) {
      const dayStart = today - daysAgo * DAY_MS;
      const weekday = new Date(dayStart).getUTCDay();
      const rate = demo.popularity * shapeFactor(demo, daysAgo) * WEEKDAY_FACTOR[weekday];
      const jitter = 0.6 + 0.8 * rng();
      let count = Math.floor(rate * jitter + rng());

      const windowStart = Math.max(0, Math.trunc((createdAt - dayStart) / 1000));
      const windowEnd = daysAgo === 0 ? elapsedToday : DAY_SECONDS;
      if (daysAgo === 0) count = Math.floor((count * elapsedToday) / DAY_SECONDS);
      if (windowEnd <= windowStart) continue;

      for (let i = 0; i < count; i++) {
        const offset = windowStart + Math.floor(rng() * (windowEnd - windowStart));
        const visitor = Math.floor(rng() * pool);
        const referrer = pick(rng, referrers);
        const country = pick(rng, countries);
        const [device, browser, os] = pick(rng, agents);
        clicks.push({
          link_id: id,
          clicked_at: new Date(dayStart + offset * 1000).toISOString(),
          visitor_id: `seed${pad(index, 2)}v${pad(visitor, 4)}`,
          referrer,
          country,
          device,
          browser,
          os,
        });
      }
    }
  });
  return { links, clicks };
}
