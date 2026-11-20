import { ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, inject, input, signal } from '@angular/core';
import { Icon } from './icon';
import { ToastService } from './toast.service';

/** Copies text to the clipboard and shows "Copied" for a moment. */
@Component({
  selector: 'app-copy-button',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (compact()) {
      <button
        type="button"
        class="icon-btn"
        [class.done]="copied()"
        [attr.aria-label]="copied() ? 'Copied' : 'Copy ' + what()"
        [title]="copied() ? 'Copied' : 'Copy ' + what()"
        (click)="copy($event)"
      >
        <app-icon [name]="copied() ? 'check' : 'copy'" [size]="16" />
      </button>
    } @else {
      <button
        type="button"
        class="btn"
        [class.btn-primary]="primary()"
        [class.done]="copied()"
        (click)="copy($event)"
      >
        <app-icon [name]="copied() ? 'check' : 'copy'" [size]="16" />
        <span aria-live="polite">{{ copied() ? 'Copied' : 'Copy' }}</span>
      </button>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .btn {
      min-width: 104px;
    }

    .icon-btn.done {
      color: var(--success);
    }

    .btn.done:not(.btn-primary) {
      border-color: var(--success);
      color: var(--success);
    }
  `,
})
export class CopyButton {
  readonly text = input.required<string>();
  readonly what = input('link');
  readonly compact = input(false);
  readonly primary = input(false);

  protected readonly copied = signal(false);

  private readonly document = inject(DOCUMENT);
  private readonly toast = inject(ToastService);
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected async copy(event: Event): Promise<void> {
    // buttons can sit inside clickable rows
    event.stopPropagation();
    try {
      await this.write(this.text());
      this.copied.set(true);
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.toast.error('Copying failed, please copy the link by hand');
    }
  }

  private async write(text: string): Promise<void> {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (clipboard?.writeText) {
      try {
        await clipboard.writeText(text);
        return;
      } catch {
        // permission denied or insecure context, try the old way below
      }
    }
    const area = this.document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    this.document.body.appendChild(area);
    area.select();
    const ok = this.document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('copy failed');
  }
}
