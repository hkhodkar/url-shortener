import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-pagination',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="range">
      @if (total() > 0) {
        {{ from() }}-{{ to() }} of {{ total() }}
      } @else {
        No results
      }
    </span>
    <div class="buttons">
      <button
        type="button"
        class="icon-btn"
        aria-label="Previous page"
        [disabled]="page() <= 1"
        (click)="go(page() - 1)"
      >
        <app-icon name="chevron-left" />
      </button>
      <span class="current">Page {{ page() }} of {{ pages() }}</span>
      <button
        type="button"
        class="icon-btn"
        aria-label="Next page"
        [disabled]="page() >= pages()"
        (click)="go(page() + 1)"
      >
        <app-icon name="chevron-right" />
      </button>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 20px;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 13px;
    }

    .buttons {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .current {
      min-width: 92px;
      text-align: center;
    }
  `,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();

  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  protected readonly to = computed(() => Math.min(this.page() * this.pageSize(), this.total()));

  protected go(page: number): void {
    this.pageChange.emit(page);
  }
}
