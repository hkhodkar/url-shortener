import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatNumber } from '../../core/utils/format';

export interface BreakdownRow {
  label: string;
  count: number;
  prefix?: string;
}

/** Labels with a proportional bar, used for countries and operating systems. */
@Component({
  selector: 'app-breakdown-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length) {
      <ul>
        @for (row of rows(); track row.label) {
          <li>
            <div class="line">
              <span class="label">
                @if (row.prefix) {
                  <span class="prefix" aria-hidden="true">{{ row.prefix }}</span>
                }
                {{ row.label }}
              </span>
              <span class="count num">
                {{ format(row.count) }}
                <span class="share">{{ row.share }}%</span>
              </span>
            </div>
            <div class="bar"><span [style.width.%]="row.width"></span></div>
          </li>
        }
      </ul>
    } @else {
      <p class="none">No clicks in this period</p>
    }
  `,
  styles: `
    ul {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .line {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 6px;
      font-size: 13px;
    }

    .label {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .prefix {
      font-size: 16px;
      line-height: 1;
    }

    .count {
      flex-shrink: 0;
      font-weight: 600;
    }

    .share {
      display: inline-block;
      min-width: 38px;
      color: var(--text-muted);
      font-weight: 400;
      text-align: right;
    }

    .bar {
      height: 6px;
      border-radius: 999px;
      background: var(--surface-muted);
      overflow: hidden;

      span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: var(--chart-1);
      }
    }

    .none {
      padding: 24px 0;
      color: var(--text-muted);
      text-align: center;
    }
  `,
})
export class BreakdownList {
  readonly items = input.required<BreakdownRow[]>();
  readonly total = input.required<number>();

  protected readonly rows = computed(() => {
    const items = this.items();
    const max = Math.max(1, ...items.map((item) => item.count));
    const total = Math.max(1, this.total());
    return items.map((item) => ({
      ...item,
      width: (item.count / max) * 100,
      share: Math.round((item.count / total) * 100),
    }));
  });

  protected readonly format = formatNumber;
}
