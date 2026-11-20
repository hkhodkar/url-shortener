import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Modal } from './modal';

@Component({
  selector: 'app-confirm-dialog',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="title()" [width]="440" (closed)="cancelled.emit()">
      <div class="modal-body">
        <p class="text-muted">{{ message() }}</p>
      </div>
      <footer class="modal-footer">
        <button type="button" class="btn" (click)="cancelled.emit()">Cancel</button>
        <button type="button" class="btn btn-danger" [disabled]="busy()" (click)="confirmed.emit()">
          {{ confirmLabel() }}
        </button>
      </footer>
    </app-modal>
  `,
})
export class ConfirmDialog {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Delete');
  readonly busy = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
