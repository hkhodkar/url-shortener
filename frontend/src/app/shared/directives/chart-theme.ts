/** Chart colors, read from the CSS variables of the current theme. */
export interface ChartPalette {
  series: string[];
  text: string;
  muted: string;
  grid: string;
  surface: string;
}

export function chartPalette(): ChartPalette {
  if (typeof document === 'undefined') {
    return { series: ['#4f46e5'], text: '#161b2e', muted: '#626b82', grid: '#edf0f5', surface: '#fff' };
  }
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => style.getPropertyValue(name).trim();
  return {
    series: [1, 2, 3, 4, 5, 6].map((n) => read(`--chart-${n}`)),
    text: read('--text'),
    muted: read('--text-muted'),
    grid: read('--chart-grid'),
    surface: read('--surface'),
  };
}

/** Same color with an alpha channel, for area fills. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
