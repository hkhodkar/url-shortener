import { ChartConfiguration } from 'chart.js';
import { BreakdownItem, TimelinePoint } from '../../core/models/link.models';
import { formatDay } from '../../core/utils/format';
import { ChartPalette, withAlpha } from '../../shared/directives/chart-theme';

const FONT = { family: 'Inter, system-ui, sans-serif', size: 12 };

export function timelineChart(points: TimelinePoint[], palette: ChartPalette): ChartConfiguration {
  const [clicks, visitors] = palette.series;
  return {
    type: 'line',
    data: {
      labels: points.map((p) => formatDay(p.date)),
      datasets: [
        {
          label: 'Clicks',
          data: points.map((p) => p.clicks),
          borderColor: clicks,
          backgroundColor: withAlpha(clicks, 0.12),
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: points.length > 31 ? 0 : 2.5,
          pointHoverRadius: 4,
        },
        {
          label: 'Unique visitors',
          data: points.map((p) => p.unique_visitors),
          borderColor: visitors,
          backgroundColor: visitors,
          borderDash: [5, 4],
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { color: palette.muted, font: FONT, boxWidth: 12, boxHeight: 12, useBorderRadius: true, borderRadius: 3 },
        },
        tooltip: { padding: 10, titleFont: FONT, bodyFont: FONT },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: palette.muted, font: FONT, maxRotation: 0, autoSkipPadding: 16 },
        },
        y: {
          beginAtZero: true,
          grid: { color: palette.grid },
          border: { display: false },
          ticks: { color: palette.muted, font: FONT, precision: 0 },
        },
      },
    },
  };
}

export function horizontalBarChart(items: BreakdownItem[], palette: ChartPalette): ChartConfiguration {
  return {
    type: 'bar',
    data: {
      labels: items.map((i) => i.label),
      datasets: [
        {
          label: 'Clicks',
          data: items.map((i) => i.count),
          backgroundColor: palette.series[0],
          borderRadius: 4,
          barThickness: 14,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { padding: 10 } },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: palette.grid },
          border: { display: false },
          ticks: { color: palette.muted, font: FONT, precision: 0 },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: palette.text, font: FONT },
        },
      },
    },
  };
}

export function doughnutChart(items: BreakdownItem[], palette: ChartPalette): ChartConfiguration {
  return {
    type: 'doughnut',
    data: {
      labels: items.map((i) => i.label.charAt(0).toUpperCase() + i.label.slice(1)),
      datasets: [
        {
          data: items.map((i) => i.count),
          backgroundColor: items.map((_, n) => palette.series[n % palette.series.length]),
          borderColor: palette.surface,
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: palette.muted, font: FONT, boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 14 },
        },
        tooltip: { padding: 10 },
      },
    },
  } as ChartConfiguration;
}
