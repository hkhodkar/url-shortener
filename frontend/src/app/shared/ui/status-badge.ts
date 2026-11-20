import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LinkStatus } from '../../core/models/link.models';

const LABELS: Record<LinkStatus, string> = {
  active: 'Active',
  expired: 'Expired',
  disabled: 'Disabled',
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="status()">{{ label() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class StatusBadge {
  readonly status = input.required<LinkStatus>();
  protected readonly label = computed(() => LABELS[this.status()]);
}
