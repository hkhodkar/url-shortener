import { ClickEvent } from '../models/link.models';
import { aggregateLinkStats, breakdown, buildTimeline } from './aggregate';

function click(clicked_at: string, extra: Partial<ClickEvent> = {}): ClickEvent {
  return {
    link_id: 1,
    clicked_at,
    visitor_id: 'a',
    referrer: null,
    country: 'DE',
    device: 'desktop',
    browser: 'Chrome',
    os: 'Windows',
    ...extra,
  };
}

describe('stats aggregation', () => {
  const now = new Date('2026-11-20T15:00:00Z');
  const clicks = [
    click('2026-11-20T09:00:00.000Z', { referrer: 'x.com', device: 'mobile' }),
    click('2026-11-20T10:00:00.000Z'),
    click('2026-11-17T08:00:00.000Z', { visitor_id: 'b', referrer: 'x.com', country: null }),
    click('2026-11-14T23:59:59.000Z', { visitor_id: 'c' }), // first day of the 7 day window
    click('2026-10-30T12:00:00.000Z', { visitor_id: 'd', referrer: 'github.com' }),
  ];

  it('counts clicks and unique visitors in the range', () => {
    const week = aggregateLinkStats('abc', clicks, 7, now);
    expect(week.start).toBe('2026-11-14');
    expect(week.end).toBe('2026-11-20');
    expect(week.total_clicks).toBe(4);
    expect(week.unique_visitors).toBe(3);
    expect(week.all_time_clicks).toBe(5);

    const month = aggregateLinkStats('abc', clicks, 30, now);
    expect(month.total_clicks).toBe(5);
    expect(month.timeline).toHaveLength(30);
  });

  it('fills every day of the timeline', () => {
    const start = new Date('2026-11-17T00:00:00Z');
    const timeline = buildTimeline(clicks, start, 4);
    expect(timeline).toEqual([
      { date: '2026-11-17', clicks: 1, unique_visitors: 1 },
      { date: '2026-11-18', clicks: 0, unique_visitors: 0 },
      { date: '2026-11-19', clicks: 0, unique_visitors: 0 },
      { date: '2026-11-20', clicks: 2, unique_visitors: 1 },
    ]);
  });

  it('labels missing values and sorts by count, then label', () => {
    const week = aggregateLinkStats('abc', clicks, 7, now);
    expect(week.referrers).toEqual([
      { label: 'Direct', count: 2 },
      { label: 'x.com', count: 2 },
    ]);
    expect(week.countries).toEqual([
      { label: 'DE', count: 3 },
      { label: 'Unknown', count: 1 },
    ]);
    expect(week.devices).toEqual([
      { label: 'desktop', count: 3 },
      { label: 'mobile', count: 1 },
    ]);
  });

  it('keeps only the top entries', () => {
    const many = Array.from({ length: 15 }, (_, i) => click('2026-11-20T00:00:00Z', { referrer: `site${i}.com` }));
    expect(breakdown(many, (c) => c.referrer, 'Direct', 10)).toHaveLength(10);
  });
});
