import { BreakdownItem, ClickEvent, LinkStats, TimelinePoint } from '../models/link.models';

export const DAY_MS = 86_400_000;
export const BREAKDOWN_LIMIT = 10;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** One point per UTC day from `start`, days without clicks included. */
export function buildTimeline(clicks: ClickEvent[], start: Date, days: number): TimelinePoint[] {
  const buckets = new Map<string, { clicks: number; visitors: Set<string> }>();
  for (let i = 0; i < days; i++) {
    buckets.set(dayKey(new Date(start.getTime() + i * DAY_MS)), { clicks: 0, visitors: new Set() });
  }
  for (const click of clicks) {
    const bucket = buckets.get(click.clicked_at.slice(0, 10));
    if (bucket) {
      bucket.clicks++;
      bucket.visitors.add(click.visitor_id);
    }
  }
  return [...buckets].map(([date, bucket]) => ({
    date,
    clicks: bucket.clicks,
    unique_visitors: bucket.visitors.size,
  }));
}

/** Counts per label, most common first, ties sorted by label like the API does. */
export function breakdown(
  clicks: ClickEvent[],
  pick: (click: ClickEvent) => string | null,
  fallback: string,
  limit = BREAKDOWN_LIMIT,
): BreakdownItem[] {
  const counts = new Map<string, number>();
  for (const click of clicks) {
    const label = pick(click) || fallback;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
    .slice(0, limit);
}

export function uniqueVisitors(clicks: ClickEvent[]): number {
  return new Set(clicks.map((click) => click.visitor_id)).size;
}

/** The same numbers as GET /api/links/{code}/stats, from the raw clicks of one link. */
export function aggregateLinkStats(
  code: string,
  clicks: ClickEvent[],
  range: number,
  now: Date,
): LinkStats {
  const end = startOfUtcDay(now);
  const start = new Date(end.getTime() - (range - 1) * DAY_MS);
  const from = start.toISOString();
  const inRange = clicks.filter((click) => click.clicked_at >= from);
  return {
    code,
    range,
    start: dayKey(start),
    end: dayKey(end),
    total_clicks: inRange.length,
    unique_visitors: uniqueVisitors(inRange),
    all_time_clicks: clicks.length,
    timeline: buildTimeline(inRange, start, range),
    referrers: breakdown(inRange, (c) => c.referrer, 'Direct'),
    countries: breakdown(inRange, (c) => c.country, 'Unknown'),
    devices: breakdown(inRange, (c) => c.device, 'Other'),
    browsers: breakdown(inRange, (c) => c.browser, 'Other'),
    operating_systems: breakdown(inRange, (c) => c.os, 'Other'),
  };
}
