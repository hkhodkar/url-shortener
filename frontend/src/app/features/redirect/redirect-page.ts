import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LinksApi } from '../../core/api/links.api';
import { DemoMode } from '../../core/mock/demo-mode';
import { countryFromLanguage, parseUserAgent, referrerDomain } from '../../core/mock/user-agent';
import { Icon } from '../../shared/ui/icon';

type Outcome = 'redirecting' | 'missing' | 'expired' | 'disabled' | 'error';

const MESSAGES: Record<Exclude<Outcome, 'redirecting'>, [string, string]> = {
  missing: ['Link not found', 'There is no short link with this code.'],
  expired: ['Link expired', 'This short link has expired.'],
  disabled: ['Link turned off', 'The owner turned this short link off.'],
  error: ['Something went wrong', 'The link could not be opened. Please try again.'],
};

/**
 * The demo's stand-in for the backend's GET /{code}: counts the visit in the
 * browser database and sends the browser on to the target URL.
 */
@Component({
  selector: 'app-redirect-page',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="box">
      @if (outcome() === 'redirecting') {
        <span class="spinner big" aria-hidden="true"></span>
        <h1>Redirecting…</h1>
        <p>Taking you to the destination of <code>{{ code() }}</code>.</p>
      } @else {
        <span class="icon-wrap"><app-icon name="link" [size]="22" /></span>
        <h1>{{ message()[0] }}</h1>
        <p>{{ message()[1] }} <code>/r/{{ code() }}</code></p>
        <a routerLink="/" class="btn btn-primary">Go to the dashboard</a>
      }
    </main>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      min-height: 100vh;
      padding: 24px;
    }

    .box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      max-width: 420px;
      text-align: center;
    }

    h1 {
      font-size: 22px;
    }

    p {
      color: var(--text-muted);
    }

    code {
      padding: 2px 6px;
      border-radius: 6px;
      background: var(--surface-muted);
      overflow-wrap: anywhere;
    }

    .big {
      width: 28px;
      height: 28px;
      border-width: 3px;
      color: var(--primary);
    }

    .icon-wrap {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: var(--warning-soft);
      color: var(--warning);
    }

    .btn {
      margin-top: 8px;
    }
  `,
})
export class RedirectPage implements OnInit {
  readonly code = input.required<string>();

  private readonly demo = inject(DemoMode);
  private readonly api = inject(LinksApi);
  private readonly document = inject(DOCUMENT);

  protected readonly outcome = signal<Outcome>('redirecting');
  protected message(): [string, string] {
    const outcome = this.outcome();
    return outcome === 'redirecting' ? ['', ''] : MESSAGES[outcome];
  }

  ngOnInit(): void {
    if (this.demo.active()) {
      this.visitInDemo();
      return;
    }
    // with a real backend, let its redirect route count the click
    this.api.get(this.code()).subscribe({
      next: (link) => (this.demo.active() ? this.visitInDemo() : this.go(link.short_url)),
      error: () => (this.demo.active() ? this.visitInDemo() : this.outcome.set('missing')),
    });
  }

  private visitInDemo(): void {
    const nav = this.document.defaultView?.navigator;
    const agent = parseUserAgent(nav?.userAgent);
    const result = this.demo.db.visit(this.code(), {
      visitor_id: this.demo.visitorId(),
      referrer: referrerDomain(this.document.referrer, this.document.location.hostname),
      country: countryFromLanguage(nav?.language),
      ...agent,
    });
    if (result.status === 'redirect') {
      this.go(result.target);
    } else {
      this.outcome.set(result.status);
    }
  }

  private go(url: string): void {
    // replace, so the back button skips this page
    this.document.location.replace(url);
  }
}
