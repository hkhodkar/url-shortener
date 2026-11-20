const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('en');
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const dayFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });

let regionNames: Intl.DisplayNames | null = null;

export function formatNumber(value: number): string {
  return whole.format(value);
}

export function compactNumber(value: number): string {
  return value < 10_000 ? whole.format(value) : compact.format(value);
}

export function formatDate(iso: string | null): string {
  return iso ? dateFormat.format(new Date(iso)) : '';
}

export function formatDateTime(iso: string | null): string {
  return iso ? dateTimeFormat.format(new Date(iso)) : '';
}

/** "Nov 14" for a YYYY-MM-DD day key (UTC). */
export function formatDay(day: string): string {
  return dayFormat.format(new Date(`${day}T00:00:00Z`));
}

export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) {
    return '';
  }
  const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  const future = seconds < 0;
  const abs = Math.abs(seconds);
  const say = (amount: number, unit: string) => {
    const text = `${amount} ${unit}${amount === 1 ? '' : 's'}`;
    return future ? `in ${text}` : `${text} ago`;
  };
  if (abs < 60) return future ? 'in a moment' : 'just now';
  if (abs < 3600) return say(Math.floor(abs / 60), 'minute');
  if (abs < 86_400) return say(Math.floor(abs / 3600), 'hour');
  if (abs < 86_400 * 30) return say(Math.floor(abs / 86_400), 'day');
  return formatDate(iso);
}

/** "example.com/some/path" without the scheme and a trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) {
    return code;
  }
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Flag emoji from a two letter country code. */
export function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) {
    return '🌐';
  }
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** yyyy-mm-dd in local time, the format of a date input. */
export function toDateInput(value: Date | string | null): string {
  if (!value) {
    return '';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A date input value means "until the end of that day" in the user's time zone. */
export function endOfDayIso(dateInput: string): string {
  const [year, month, day] = dateInput.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59).toISOString();
}

export function percentChange(current: number, previous: number): number | null {
  if (!previous) {
    return null;
  }
  return Math.round(((current - previous) / previous) * 100);
}
