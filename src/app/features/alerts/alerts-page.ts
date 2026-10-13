import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Params, Router, RouterLink } from '@angular/router';
import { listAlerts } from '../../api/functions';
import { PageResponseAlertResponse } from '../../api/models';
import { AuthService } from '../../core/auth/auth';
import { describeError } from '../../core/http/api-error';
import { apiResource } from '../../core/http/api-resource';
import { DateRangeField, DayRange } from '../../shared/components/date-range-field';
import { formatInstant, humanize } from '../../shared/format';
import {
  PAGE_SIZES,
  listQueryParams,
  matSort,
  pagingParams,
  parseListState,
  sortChange,
} from '../../shared/list/list-state';
import {
  ALERT_LIST,
  SEVERITIES,
  STATUSES,
  alertApiParams,
  hasFilters,
  parseAlertFilter,
} from './alert-filter';
import { elapsed, localTimeZone } from './alert-format';

/** Every alert the user may see, newest first, filtered and paged through the URL. */
@Component({
  selector: 'app-alerts-page',
  imports: [
    DateRangeField,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    RouterLink,
  ],
  templateUrl: './alerts-page.html',
})
export class AlertsPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  /** Query parameters */
  readonly team = input<string>();
  readonly severity = input<string>();
  readonly status = input<string>();
  readonly start = input<string>();
  readonly end = input<string>();
  readonly engineerId = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();
  readonly sort = input<string>();

  protected readonly filter = computed(() =>
    parseAlertFilter({
      team: this.team(),
      severity: this.severity(),
      status: this.status(),
      start: this.start(),
      end: this.end(),
      engineerId: this.engineerId(),
    }),
  );
  protected readonly list = computed(() =>
    parseListState({ page: this.page(), size: this.size(), sort: this.sort() }, ALERT_LIST),
  );
  protected readonly matSort = computed(() => matSort(this.list()));

  protected readonly alerts = apiResource(listAlerts, () => ({
    ...alertApiParams(this.filter()),
    ...pagingParams(this.list()),
  }));
  /** The last page loaded, kept (dimmed) while the next one loads. */
  protected readonly data = linkedSignal<
    PageResponseAlertResponse | undefined,
    PageResponseAlertResponse | undefined
  >({
    source: () => (this.alerts.hasValue() ? this.alerts.value() : undefined),
    computation: (value, previous) => value ?? previous?.value,
  });
  protected readonly error = computed(() => {
    const error = this.alerts.error();
    return error ? describeError(error) : null;
  });

  protected readonly teams = computed(() =>
    [...(this.auth.user()?.teams ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  );
  protected readonly columns = computed(() => [
    'triggeredAt',
    'title',
    'serviceName',
    'engineerName',
    ...(this.teams().length > 1 ? ['team'] : []),
    'severity',
    'status',
    'ack',
    'resolve',
  ]);
  /** The engineer filter's name, from the alerts it found. */
  protected readonly engineerName = computed(
    () => this.data()?.content.find((alert) => alert.engineerName)?.engineerName ?? null,
  );
  protected readonly filtered = computed(() => hasFilters(this.filter()));

  protected readonly severities = SEVERITIES;
  protected readonly statuses = STATUSES;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly elapsed = elapsed;
  protected readonly humanize = humanize;
  private readonly timeZone = localTimeZone();

  protected when(instant: string): string {
    return formatInstant(instant, this.timeZone);
  }

  /** '' is "any" in the selects; mat-select treats null as no selection. */
  protected setFilter(key: string, value: string | null): void {
    this.navigate({ [key]: value || null, page: null });
  }

  protected setDates(range: DayRange): void {
    this.navigate({ start: range.start, end: range.end, page: null });
  }

  protected clearFilters(): void {
    this.navigate({
      team: null,
      severity: null,
      status: null,
      start: null,
      end: null,
      engineerId: null,
      page: null,
    });
  }

  protected sorted(sort: Sort): void {
    this.navigate(sortChange(sort, ALERT_LIST));
  }

  protected paged(event: PageEvent): void {
    this.navigate(
      listQueryParams({ ...this.list(), page: event.pageIndex, size: event.pageSize }, ALERT_LIST),
    );
  }

  protected open(id: number): void {
    void this.router.navigate(['/alerts', id]);
  }

  private navigate(params: Params): void {
    void this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge' });
  }
}
