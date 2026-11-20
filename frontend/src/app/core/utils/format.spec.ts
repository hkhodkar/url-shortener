import {
  compactNumber,
  countryFlag,
  displayUrl,
  endOfDayIso,
  percentChange,
  relativeTime,
  toDateInput,
} from './format';

describe('format helpers', () => {
  const now = new Date('2026-11-20T12:00:00Z');

  it('describes past and future times', () => {
    expect(relativeTime('2026-11-20T11:59:30Z', now)).toBe('just now');
    expect(relativeTime('2026-11-20T11:00:00Z', now)).toBe('1 hour ago');
    expect(relativeTime('2026-11-17T12:00:00Z', now)).toBe('3 days ago');
    expect(relativeTime('2026-11-25T12:00:00Z', now)).toBe('in 5 days');
  });

  it('shortens URLs and numbers', () => {
    expect(displayUrl('https://example.com/a/')).toBe('example.com/a');
    expect(compactNumber(1234)).toBe('1,234');
    expect(compactNumber(25_300)).toBe('25.3K');
  });

  it('round trips date inputs through end of day', () => {
    const iso = endOfDayIso('2026-12-24');
    expect(toDateInput(iso)).toBe('2026-12-24');
    expect(new Date(iso).getHours()).toBe(23);
  });

  it('builds flags and percent changes', () => {
    expect(countryFlag('DE')).toBe('🇩🇪');
    expect(countryFlag('Unknown')).toBe('🌐');
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(5, 0)).toBeNull();
  });
});
