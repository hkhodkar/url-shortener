import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from './icon';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class.error]="toast.kind === 'error'" role="status">
          <app-icon class="kind" [name]="toast.kind === 'error' ? 'alert' : 'check'" />
          <span class="message">{{ toast.message }}</span>
          <button
            type="button"
            class="icon-btn"
            aria-label="Dismiss"
            (click)="toastService.dismiss(toast.id)"
          >
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 200;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: min(420px, calc(100vw - 40px));
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 8px 10px 14px;
      border: 1px solid var(--border);
      border-left: 4px solid var(--success);
      border-radius: var(--radius-sm);
      background: var(--surface);
      box-shadow: var(--shadow-lg);
      animation: slide-in 0.2s ease-out;

      .kind {
        color: var(--success);
      }

      &.error {
        border-left-color: var(--danger);

        .kind {
          color: var(--danger);
        }
      }
    }

    .message {
      flex: 1;
    }

    @keyframes slide-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
  `,
})
export class ToastContainer {
  protected readonly toastService = inject(ToastService);
}
