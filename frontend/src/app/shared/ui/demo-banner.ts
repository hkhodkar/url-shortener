import { ChangeDetectionStrategy, Component, DOCUMENT, inject, signal } from '@angular/core';
import { DemoMode } from '../../core/mock/demo-mode';
import { ConfirmDialog } from './confirm-dialog';
import { Icon } from './icon';
import { ToastService } from './toast.service';

const RESET_FLAG = 'url-shortener.demo-reset';

@Component({
  selector: 'app-demo-banner',
  imports: [Icon, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (demo.active()) {
      <aside class="demo-banner" aria-label="Demo mode">
        <app-icon class="demo-icon" name="info" [size]="16" />
        <p><strong>Demo mode</strong> – sample data stored in your browser<span class="hide-sm">, short links open through this app</span></p>
        <button type="button" class="btn btn-sm" (click)="askReset()">
          <app-icon name="reset" [size]="14" />
          Reset data
        </button>
      </aside>
    }

    @if (confirming()) {
      <app-confirm-dialog
        title="Reset demo data?"
        message="Your links and recorded visits will be removed and the sample links with three months of clicks restored."
        confirmLabel="Reset data"
        (confirmed)="reset()"
        (cancelled)="cancelReset()"
      />
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .demo-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 40px;
      padding: 4px 16px;
      border-bottom: 1px solid color-mix(in srgb, var(--primary) 20%, transparent);
      background: var(--primary-soft);
      font-size: 13px;
      line-height: 1.4;
    }

    .demo-icon {
      color: var(--primary);
    }

    p {
      min-width: 0;
      margin: 0;
      color: var(--text-muted);

      strong {
        color: var(--text);
        font-weight: 600;
      }
    }

    .btn {
      flex-shrink: 0;
      gap: 6px;
      height: 28px;
      padding: 0 10px;
    }

    @media (max-width: 560px) {
      .demo-banner {
        justify-content: space-between;
      }

      p {
        flex: 1;
      }

      .hide-sm {
        display: none;
      }
    }
  `,
})
export class DemoBanner {
  protected readonly demo = inject(DemoMode);
  private readonly document = inject(DOCUMENT);
  private readonly toast = inject(ToastService);

  protected readonly confirming = signal(false);

  constructor() {
    if (this.readFlag()) {
      this.toast.success('Demo data has been reset');
    }
  }

  protected askReset(): void {
    this.confirming.set(true);
  }

  protected cancelReset(): void {
    this.confirming.set(false);
  }

  // reload so every page fetches the fresh data
  protected reset(): void {
    this.demo.reset();
    try {
      sessionStorage.setItem(RESET_FLAG, '1');
    } catch {
      // no session storage, just skip the toast after the reload
    }
    this.document.defaultView?.location.reload();
  }

  private readFlag(): boolean {
    try {
      const set = sessionStorage.getItem(RESET_FLAG) === '1';
      sessionStorage.removeItem(RESET_FLAG);
      return set;
    } catch {
      return false;
    }
  }
}
