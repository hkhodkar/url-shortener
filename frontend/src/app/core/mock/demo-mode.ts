import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { MockDb } from './mock-db';

/** Min and max delay of mock responses in ms, so loading states still show. */
export const MOCK_LATENCY = new InjectionToken<readonly [number, number]>('MOCK_LATENCY', {
  factory: () => [150, 300],
});

/** Where the mock database keeps its changes. */
export const MOCK_STORAGE = new InjectionToken<Storage | null>('MOCK_STORAGE', {
  factory: () => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null; // storage blocked by the browser
    }
  },
});

/** Short links in the demo point at the app's own /r/<code> route. */
export const DEMO_SHORT_BASE = new InjectionToken<string>('DEMO_SHORT_BASE', {
  factory: () =>
    typeof document === 'undefined'
      ? 'http://localhost/r'
      : new URL('r', document.baseURI).href,
});

/**
 * Demo mode answers API calls from an in-browser database instead of the
 * backend. It is always on in the demo build and switches on by itself when
 * no API is reachable.
 */
@Injectable({ providedIn: 'root' })
export class DemoMode {
  private readonly storage = inject(MOCK_STORAGE);
  private readonly shortBase = inject(DEMO_SHORT_BASE);
  private readonly enabled = signal(environment.demo);
  private readonly version = signal(0);
  private database?: MockDb;

  readonly active = this.enabled.asReadonly();
  /** Goes up on every reset so pages can reload their data. */
  readonly resets = this.version.asReadonly();

  get db(): MockDb {
    return (this.database ??= new MockDb(this.storage, () => new Date(), this.shortBase));
  }

  enable(): void {
    this.enabled.set(true);
  }

  reset(): void {
    this.db.reset();
    this.version.update((n) => n + 1);
  }

  /** A random id per browser, so unique visitors work in the demo too. */
  visitorId(): string {
    const key = 'url-shortener.visitor';
    try {
      let id = this.storage?.getItem(key);
      if (!id) {
        id = Math.random().toString(36).slice(2, 12);
        this.storage?.setItem(key, id);
      }
      return id;
    } catch {
      return 'anonymous';
    }
  }
}
