export type LinkStatus = 'active' | 'expired' | 'disabled';

export interface Link {
  id: number;
  code: string;
  short_url: string;
  target_url: string;
  title: string | null;
  is_custom: boolean;
  is_active: boolean;
  status: LinkStatus;
  expires_at: string | null;
  clicks: number;
  last_clicked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface LinkCreate {
  target_url: string;
  alias?: string | null;
  title?: string | null;
  expires_at?: string | null;
}

export interface LinkUpdate {
  target_url?: string;
  title?: string | null;
  expires_at?: string | null;
  is_active?: boolean;
}

export type LinkSort =
  | 'created_at'
  | '-created_at'
  | 'clicks'
  | '-clicks'
  | 'title'
  | '-title'
  | 'expires_at'
  | '-expires_at'
  | 'code'
  | '-code';

export interface LinkQuery {
  search?: string | null;
  status?: LinkStatus | null;
  sort?: LinkSort;
  page?: number;
  page_size?: number;
}

export interface AliasCheck {
  alias: string;
  available: boolean;
  reason: string | null;
}

export const STATS_RANGES = [7, 30, 90] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

export interface TimelinePoint {
  date: string;
  clicks: number;
  unique_visitors: number;
}

export interface BreakdownItem {
  label: string;
  count: number;
}

export interface LinkStats {
  code: string;
  range: number;
  start: string;
  end: string;
  total_clicks: number;
  unique_visitors: number;
  all_time_clicks: number;
  timeline: TimelinePoint[];
  referrers: BreakdownItem[];
  countries: BreakdownItem[];
  devices: BreakdownItem[];
  browsers: BreakdownItem[];
  operating_systems: BreakdownItem[];
}

export interface Summary {
  total_links: number;
  active_links: number;
  total_clicks: number;
  clicks_last_7_days: number;
  clicks_previous_7_days: number;
  timeline: TimelinePoint[];
  top_links: Link[];
  recent_links: Link[];
}

/** One recorded visit of a short link, the raw data behind the stats. */
export interface ClickEvent {
  link_id: number;
  clicked_at: string;
  visitor_id: string;
  referrer: string | null;
  country: string | null;
  device: string;
  browser: string;
  os: string;
}

export interface Meta {
  short_base_url: string;
  alias_min_length: number;
  alias_max_length: number;
  reserved_words: string[];
}
