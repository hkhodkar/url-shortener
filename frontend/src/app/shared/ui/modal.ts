import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="backdrop" (mousedown)="onBackdropDown($event)" (click)="onBackdropClick($event)">
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        [style.max-width.px]="width()"
      >
        <header class="modal-header">
          <h2>{{ title() }}</h2>
          <button type="button" class="icon-btn" aria-label="Close" (click)="close()">
            <app-icon name="x" />
          </button>
        </header>
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: grid;
      place-items: center;
      padding: 16px;
      background: rgba(10, 14, 26, 0.55);
      backdrop-filter: blur(2px);
      animation: fade-in 0.15s ease-out;
    }

    .modal {
      width: 100%;
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: var(--shadow-lg);
      animation: pop-in 0.18s ease-out;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 24px 0;

      h2 {
        font-size: 18px;
      }
    }

    :host ::ng-deep .modal-body {
      padding: 20px 24px 24px;
    }

    :host ::ng-deep .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 24px;
      border-top: 1px solid var(--border);
    }

    @media (max-width: 560px) {
      .modal-header {
        padding: 16px 16px 0;
      }

      :host ::ng-deep .modal-body {
        padding: 16px;
      }

      :host ::ng-deep .modal-footer {
        padding: 12px 16px;
      }
    }

    @keyframes fade-in {
      from {
        opacity: 0;
      }
    }

    @keyframes pop-in {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
      }
    }
  `,
})
export class Modal {
  readonly title = input.required<string>();
  readonly width = input(560);
  readonly closed = output<void>();

  private pressedOnBackdrop = false;

  protected close(): void {
    this.closed.emit();
  }

  protected onBackdropDown(event: MouseEvent): void {
    this.pressedOnBackdrop = event.target === event.currentTarget;
  }

  // only close when the click both started and ended on the backdrop,
  // so selecting text in an input and releasing outside keeps the dialog open
  protected onBackdropClick(event: MouseEvent): void {
    if (this.pressedOnBackdrop && event.target === event.currentTarget) {
      this.close();
    }
    this.pressedOnBackdrop = false;
  }
}
