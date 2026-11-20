import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { LinksApi } from '../../core/api/links.api';
import { DemoMode } from '../../core/mock/demo-mode';
import { Link, LinkQuery, LinkSort, LinkStatus } from '../../core/models/link.models';
import {
  displayUrl,
  formatDateTime,
  formatNumber,
  relativeTime,
} from '../../core/utils/format';
import { loader } from '../../core/utils/loader';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { CopyButton } from '../../shared/ui/copy-button';
import { Icon } from '../../shared/ui/icon';
import { Pagination } from '../../shared/ui/pagination';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ToastService } from '../../shared/ui/toast.service';
import { LinkEditDialog } from './link-edit-dialog';

const STATUSES: LinkStatus[] = ['active', 'expired', 'disabled'];
const PAGE_SIZES = [10, 25, 50];
export const SORT_OPTIONS: { value: LinkSort; label: string }[] = [
  { value: '-created_at', label: 'Newest first' },
  { value: 'created_at', label: 'Oldest first' },
  { value: '-clicks', label: 'Most clicks' },
  { value: 'clicks', label: 'Fewest clicks' },
  { value: 'title', label: 'Title A–Z' },
  { value: '-title', label: 'Title Z–A' },
  { value: 'expires_at', label: 'Expiring soonest' },
];
const SORTS = new Set<string>([...SORT_OPTIONS.map((o) => o.value), '-expires_at', 'code', '-code']);

/** Reads the list state from the URL, ignoring anything invalid. */
export function parseListQuery(params: Params): Required<LinkQuery> {
  const page = Number(params['page']);
  const size = Number(params['size']);
  const sort = String(params['sort'] ?? '');
  const status = String(params['status'] ?? '');
  return {
    search: String(params['q'] ?? '').trim(),
    status: STATUSES.includes(status as LinkStatus) ? (status as LinkStatus) : null,
    sort: SORTS.has(sort) ? (sort as LinkSort) : '-created_at',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    page_size: PAGE_SIZES.includes(size) ? size : 10,
  };
}

@Component({
  selector: 'app-links-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Icon,
    CopyButton,
    StatusBadge,
    Pagination,
    TooltipDirective,
    LinkEditDialog,
    ConfirmDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './links-page.html',
  styleUrl: './links-page.scss',
})
export class LinksPage {
  private readonly api = inject(LinksApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly demo = inject(DemoMode);

  protected readonly statuses = STATUSES;
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly pageSizes = PAGE_SIZES;

  protected readonly query = toSignal(this.route.queryParams.pipe(map(parseListQuery)), {
    requireSync: true,
  });
  protected readonly links = loader(
    () => ({ ...this.query(), reset: this.demo.resets() }),
    ({ reset: _, ...query }) => this.api.list(query),
  );
  protected readonly page = computed(() => this.links.value());
  protected readonly filtered = computed(() => !!this.query().search || !!this.query().status);

  protected readonly search = new FormControl(this.query().search ?? '', { nonNullable: true });

  protected readonly editing = signal<Link | null>(null);
  protected readonly deleting = signal<Link | null>(null);
  protected readonly busy = signal(false);

  protected readonly displayUrl = displayUrl;
  protected readonly relativeTime = relativeTime;
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatNumber = formatNumber;
  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.navigate({ q: q.trim() || null, page: null }));
  }

  protected setStatus(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.navigate({ status: value || null, page: null });
  }

  protected setSort(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.navigate({ sort: value === '-created_at' ? null : value, page: null });
  }

  /** Column header click: first click sorts the natural way, the second flips it. */
  protected sortBy(field: 'title' | 'clicks' | 'created_at'): void {
    const current = this.query().sort;
    const natural = field === 'title' ? field : `-${field}`;
    const next = current === natural ? (natural.startsWith('-') ? field : `-${field}`) : natural;
    this.navigate({ sort: next === '-created_at' ? null : next, page: null });
  }

  protected sortIcon(field: string): 'chevron-up' | 'chevron-down' | null {
    const sort = this.query().sort;
    if (sort === field) return 'chevron-up';
    if (sort === `-${field}`) return 'chevron-down';
    return null;
  }

  protected ariaSort(field: string): 'ascending' | 'descending' | 'none' {
    const icon = this.sortIcon(field);
    return icon === 'chevron-up' ? 'ascending' : icon === 'chevron-down' ? 'descending' : 'none';
  }

  protected setPage(page: number): void {
    this.navigate({ page: page > 1 ? page : null });
  }

  protected setPageSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    this.navigate({ size: size === 10 ? null : size, page: null });
  }

  protected clearFilters(): void {
    this.search.setValue('', { emitEvent: false });
    this.navigate({ q: null, status: null, page: null });
  }

  protected edit(link: Link): void {
    this.editing.set(link);
  }

  protected closeEdit(): void {
    this.editing.set(null);
  }

  protected onSaved(link: Link): void {
    this.editing.set(null);
    this.toast.success(`Saved changes to ${link.title ?? link.code}`);
    this.links.reload();
  }

  protected askDelete(link: Link): void {
    this.deleting.set(link);
  }

  protected cancelDelete(): void {
    this.deleting.set(null);
  }

  protected confirmDelete(): void {
    const link = this.deleting();
    if (!link) return;
    this.busy.set(true);
    this.api.delete(link.code).subscribe({
      next: () => {
        this.busy.set(false);
        this.deleting.set(null);
        this.toast.success(`Deleted ${displayUrl(link.short_url)}`);
        // step back when the last row of a page was removed
        const page = this.page();
        if (page && page.items.length === 1 && page.page > 1) {
          this.setPage(page.page - 1);
        } else {
          this.links.reload();
        }
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toast.error(apiErrorMessage(error));
      },
    });
  }

  protected deleteMessage(link: Link): string {
    const clicks = link.clicks === 1 ? '1 recorded click' : `${formatNumber(link.clicks)} recorded clicks`;
    return `${displayUrl(link.short_url)} will stop working and its ${clicks} will be removed. This can't be undone.`;
  }

  private navigate(params: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
