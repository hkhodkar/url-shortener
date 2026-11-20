import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { LinksApi } from '../../core/api/links.api';
import { DemoMode } from '../../core/mock/demo-mode';
import { ThemeService } from '../../core/services/theme.service';
import {
  compactNumber,
  displayUrl,
  formatDay,
  formatNumber,
  percentChange,
  relativeTime,
} from '../../core/utils/format';
import { loader } from '../../core/utils/loader';
import { ChartDirective } from '../../shared/directives/chart.directive';
import { chartPalette } from '../../shared/directives/chart-theme';
import { CopyButton } from '../../shared/ui/copy-button';
import { Icon } from '../../shared/ui/icon';
import { StatusBadge } from '../../shared/ui/status-badge';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, Icon, ChartDirective, CopyButton, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly api = inject(LinksApi);
  private readonly theme = inject(ThemeService);
  private readonly demo = inject(DemoMode);

  protected readonly summary = loader(
    () => this.demo.resets(),
    () => this.api.summary(),
  );

  protected readonly weekChange = computed(() => {
    const s = this.summary.value();
    return s ? percentChange(s.clicks_last_7_days, s.clicks_previous_7_days) : null;
  });

  protected readonly avgPerLink = computed(() => {
    const s = this.summary.value();
    return s?.total_links ? Math.round(s.total_clicks / s.total_links) : 0;
  });

  protected readonly topMax = computed(() =>
    Math.max(1, ...(this.summary.value()?.top_links.map((l) => l.clicks) ?? [])),
  );

  protected readonly chart = computed<ChartConfiguration | null>(() => {
    const s = this.summary.value();
    this.theme.theme();
    if (!s) return null;
    const palette = chartPalette();
    const font = { family: 'Inter, system-ui, sans-serif', size: 12 };
    return {
      type: 'bar',
      data: {
        labels: s.timeline.map((p) => formatDay(p.date)),
        datasets: [
          {
            label: 'Clicks',
            data: s.timeline.map((p) => p.clicks),
            backgroundColor: palette.series[0],
            hoverBackgroundColor: palette.series[1],
            borderRadius: 4,
            maxBarThickness: 18,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { padding: 10 } },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: palette.muted, font, maxRotation: 0, autoSkipPadding: 18 },
          },
          y: {
            beginAtZero: true,
            grid: { color: palette.grid },
            border: { display: false },
            ticks: { color: palette.muted, font, precision: 0 },
          },
        },
      },
    };
  });

  protected readonly compactNumber = compactNumber;
  protected readonly formatNumber = formatNumber;
  protected readonly displayUrl = displayUrl;
  protected readonly relativeTime = relativeTime;
  protected readonly abs = Math.abs;
}
