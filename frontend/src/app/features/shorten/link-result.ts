import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Link } from '../../core/models/link.models';
import { displayUrl, formatDate } from '../../core/utils/format';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { CopyButton } from '../../shared/ui/copy-button';
import { Icon } from '../../shared/ui/icon';
import { QrCode } from '../../shared/ui/qr-code';

@Component({
  selector: 'app-link-result',
  imports: [RouterLink, CopyButton, Icon, QrCode, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card result" aria-live="polite" aria-labelledby="result-title">
      <div class="success">
        <app-icon name="check" [size]="16" />
        <h2 id="result-title">Your link is ready</h2>
      </div>

      <div class="short">
        <a class="short-url" [href]="link().short_url" target="_blank" rel="noopener">
          {{ shortText() }}
        </a>
        <app-copy-button [text]="link().short_url" [primary]="true" />
      </div>

      <dl class="facts">
        <div>
          <dt>Goes to</dt>
          <dd class="truncate" [appTooltip]="link().target_url">{{ target() }}</dd>
        </div>
        @if (link().title) {
          <div>
            <dt>Title</dt>
            <dd>{{ link().title }}</dd>
          </div>
        }
        <div>
          <dt>Expires</dt>
          <dd>{{ link().expires_at ? formatDate(link().expires_at) : 'Never' }}</dd>
        </div>
      </dl>

      <div class="qr">
        <app-qr-code [value]="link().short_url" [fileName]="'qr-' + link().code" />
      </div>

      <div class="actions">
        <a class="btn" [routerLink]="['/links', link().code]">
          <app-icon name="bar-chart" [size]="16" />
          View stats
        </a>
        <button type="button" class="btn btn-ghost" (click)="another.emit()">
          <app-icon name="plus" [size]="16" />
          Shorten another
        </button>
      </div>
    </section>
  `,
  styles: `
    .result {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding: 24px;
      animation: pop 0.2s ease-out;
    }

    .success {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--success);

      h2 {
        color: var(--text);
        font-size: 17px;
      }
    }

    .short {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 10px 10px 14px;
      border: 1px solid color-mix(in srgb, var(--primary) 30%, var(--border));
      border-radius: var(--radius-sm);
      background: var(--primary-soft);
    }

    .short-url {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      font-size: 15px;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .facts {
      display: grid;
      gap: 10px;
      margin: 0;

      div {
        display: grid;
        grid-template-columns: 72px minmax(0, 1fr);
        gap: 12px;
      }

      dt {
        color: var(--text-muted);
      }

      dd {
        margin: 0;
      }
    }

    .qr {
      display: flex;
      justify-content: center;
      padding: 8px 0;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }

    @keyframes pop {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }

    @media (max-width: 560px) {
      .result {
        padding: 18px 16px;
      }

      .short {
        flex-wrap: wrap;
      }

      .short-url {
        flex-basis: 100%;
      }

      .short app-copy-button,
      .short app-copy-button ::ng-deep .btn {
        width: 100%;
      }
    }
  `,
})
export class LinkResult {
  readonly link = input.required<Link>();
  readonly another = output<void>();

  protected readonly shortText = computed(() => displayUrl(this.link().short_url));
  protected readonly target = computed(() => displayUrl(this.link().target_url));
  protected readonly formatDate = formatDate;
}
