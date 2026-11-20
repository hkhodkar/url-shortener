import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api/api-error';
import { LinksApi } from '../../core/api/links.api';
import { DemoMode } from '../../core/mock/demo-mode';
import { STATS_RANGES, StatsRange, Link } from '../../core/models/link.models';
import { ThemeService } from '../../core/services/theme.service';
import {
  countryFlag,
  countryName,
  displayUrl,
  formatDate,
  formatDateTime,
  formatNumber,
  relativeTime,
} from '../../core/utils/format';
import { loader } from '../../core/utils/loader';
import { ChartDirective } from '../../shared/directives/chart.directive';
import { chartPalette } from '../../shared/directives/chart-theme';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { BreakdownList } from '../../shared/ui/breakdown-list';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { CopyButton } from '../../shared/ui/copy-button';
import { Icon } from '../../shared/ui/icon';
import { QrCode } from '../../shared/ui/qr-code';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ToastService } from '../../shared/ui/toast.service';
import { LinkEditDialog } from '../links/link-edit-dialog';
import { doughnutChart, horizontalBarChart, timelineChart } from './stats-charts';

@Component({
  selector: 'app-link-detail-page',
  imports: [
    RouterLink,
    Icon,
    CopyButton,
    StatusBadge,
    QrCode,
    ChartDirective,
    BreakdownList,
    TooltipDirective,
    LinkEditDialog,
    ConfirmDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-detail-page.html',
  styleUrl: './link-detail-page.scss',
})
export class LinkDetailPage {
  /** Route parameter and ?range= query parameter. */
  readonly code = input.required<string>();
  readonly range = input<string>();

  private readonly api = inject(LinksApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly theme = inject(ThemeService);
  private readonly demo = inject(DemoMode);

  protected readonly ranges = STATS_RANGES;
  protected readonly days = computed<StatsRange>(() => {
    const value = Number(this.range());
    return (STATS_RANGES as readonly number[]).includes(value) ? (value as StatsRange) : 30;
  });

  protected readonly link = loader(
    () => ({ code: this.code(), reset: this.demo.resets() }),
    ({ code }) => this.api.get(code),
  );
  protected readonly stats = loader(
    () => ({ code: this.code(), days: this.days(), reset: this.demo.resets() }),
    ({ code, days }) => this.api.stats(code, days),
  );

  protected readonly editing = signal(false);
  protected readonly deleting = signal(false);
  protected readonly busy = signal(false);

  private readonly palette = computed(() => {
    this.theme.theme();
    return chartPalette();
  });
  protected readonly timeline = computed(() => {
    const stats = this.stats.value();
    return stats ? timelineChart(stats.timeline, this.palette()) : null;
  });
  protected readonly referrers = computed(() => {
    const stats = this.stats.value();
    return stats?.referrers.length ? horizontalBarChart(stats.referrers, this.palette()) : null;
  });
  protected readonly devices = computed(() => {
    const stats = this.stats.value();
    return stats?.devices.length ? doughnutChart(stats.devices, this.palette()) : null;
  });
  protected readonly browsers = computed(() => {
    const stats = this.stats.value();
    return stats?.browsers.length ? doughnutChart(stats.browsers, this.palette()) : null;
  });
  protected readonly countries = computed(() =>
    (this.stats.value()?.countries ?? []).map((item) => ({
      label: countryName(item.label),
      count: item.count,
      prefix: countryFlag(item.label),
    })),
  );
  protected readonly dailyAverage = computed(() => {
    const stats = this.stats.value();
    if (!stats) return '0';
    const average = stats.total_clicks / stats.range;
    return average >= 10 ? Math.round(average).toString() : average.toFixed(1);
  });
  protected readonly notFound = computed(
    () => !this.link.value() && this.link.state().error === 'Link not found',
  );

  protected readonly displayUrl = displayUrl;
  protected readonly formatDate = formatDate;
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatNumber = formatNumber;
  protected readonly relativeTime = relativeTime;

  protected setRange(days: StatsRange): void {
    void this.router.navigate([], {
      queryParams: { range: days === 30 ? null : days },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected toggleActive(link: Link): void {
    this.busy.set(true);
    this.api.update(link.code, { is_active: !link.is_active }).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.link.set(updated);
        this.toast.success(updated.is_active ? 'Link turned on' : 'Link turned off');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toast.error(apiErrorMessage(error));
      },
    });
  }

  protected openEdit(): void {
    this.editing.set(true);
  }

  protected closeEdit(): void {
    this.editing.set(false);
  }

  protected onSaved(link: Link): void {
    this.editing.set(false);
    this.link.set(link);
    this.toast.success('Changes saved');
  }

  protected askDelete(): void {
    this.deleting.set(true);
  }

  protected cancelDelete(): void {
    this.deleting.set(false);
  }

  protected deleteMessage(link: Link): string {
    return `${displayUrl(link.short_url)} will stop working and all of its click stats will be removed. This can't be undone.`;
  }

  protected confirmDelete(link: Link): void {
    this.busy.set(true);
    this.api.delete(link.code).subscribe({
      next: () => {
        this.busy.set(false);
        this.deleting.set(false);
        this.toast.success(`Deleted ${displayUrl(link.short_url)}`);
        void this.router.navigate(['/links']);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toast.error(apiErrorMessage(error));
      },
    });
  }
}
