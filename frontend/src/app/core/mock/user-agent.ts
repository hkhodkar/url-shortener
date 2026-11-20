// Same rules as backend/app/tracking.py, used when the demo records a visit.

const BROWSERS: [string, RegExp][] = [
  ['Edge', /Edg(e|A|iOS)?\//],
  ['Opera', /OPR\/|Opera/],
  ['Samsung Internet', /SamsungBrowser\//],
  ['Firefox', /Firefox\/|FxiOS\//],
  ['Chrome', /Chrome\/|CriOS\//],
  ['Safari', /Version\/[\d.]+.*Safari\//],
];
const OPERATING_SYSTEMS: [string, RegExp][] = [
  ['iOS', /iPhone|iPad|iPod/],
  ['Android', /Android/],
  ['Windows', /Windows/],
  ['macOS', /Mac OS X|Macintosh/],
  ['Linux', /Linux|X11/],
];
const BOT = /bot|crawl|spider|slurp|preview|curl|wget|python-requests|httpx/i;
const TABLET = /iPad|Tablet|Android(?!.*Mobile)/;
const MOBILE = /Mobi|iPhone|iPod|Android.*Mobile/;

export interface Agent {
  device: string;
  browser: string;
  os: string;
}

export function parseUserAgent(ua: string | null | undefined): Agent {
  if (!ua || BOT.test(ua)) {
    return { device: 'bot', browser: 'Other', os: 'Other' };
  }
  const browser = BROWSERS.find(([, pattern]) => pattern.test(ua))?.[0] ?? 'Other';
  const os = OPERATING_SYSTEMS.find(([, pattern]) => pattern.test(ua))?.[0] ?? 'Other';
  const device = TABLET.test(ua) ? 'tablet' : MOBILE.test(ua) ? 'mobile' : 'desktop';
  return { device, browser, os };
}

export function referrerDomain(referrer: string | null | undefined, ownHost?: string): string | null {
  if (!referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, '');
  if (!host || (ownHost && host === ownHost.replace(/^www\./, ''))) return null;
  return host.slice(0, 255);
}

/** Region of the browser language ("en-GB" -> "GB"), the demo has no IP lookup. */
export function countryFromLanguage(language: string | null | undefined): string | null {
  const match = /[-_]([A-Za-z]{2})\b/.exec(language ?? '');
  return match ? match[1].toUpperCase() : null;
}
