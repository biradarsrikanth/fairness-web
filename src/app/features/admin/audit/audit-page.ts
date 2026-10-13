import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { Params, Router } from '@angular/router';
import { listAuditEntries } from '../../../api/functions';
import { ListAuditEntries$Params } from '../../../api/fn/audit/list-audit-entries';
import { PageResponseAuditEntryResponse } from '../../../api/models';
import { describeError } from '../../../core/http/api-error';
import { apiResource } from '../../../core/http/api-resource';
import { DateRangeField, DayRange } from '../../../shared/components/date-range-field';
import { formatInstant } from '../../../shared/format';
import {
  PAGE_SIZES,
  listQueryParams,
  pagingParams,
  parseListState,
} from '../../../shared/list/list-state';
import { isIsoDay } from '../../analytics/analytics-filter';
import { localTimeZone } from '../../alerts/alert-format';
import { AUDIT_ACTIONS, AuditAction, actionLabel, detailPairs, isWarning } from './audit-actions';

const AUDIT_LIST = { sortable: ['occurredAt'], defaultSort: 'occurredAt,desc' };

/** Who did what, newest first: sign-ins, user changes and manual PagerDuty operations. Admins only. */
@Component({
  selector: 'app-audit-page',
  imports: [
    DateRangeField,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatPaginatorModule,
    MatSelectModule,
  ],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.scss',
})
export class AuditPage {
  private readonly router = inject(Router);

  /** Query parameters */
  readonly action = input<string>();
  readonly userId = input<string>();
  readonly start = input<string>();
  readonly end = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();

  protected readonly actionFilter = computed(
    () => AUDIT_ACTIONS.find((a) => a.value === this.action())?.value ?? null,
  );
  protected readonly userFilter = computed(() => {
    const id = Number(this.userId());
    return Number.isInteger(id) && id > 0 ? id : null;
  });
  protected readonly dates = computed<DayRange>(() => {
    const start = this.start();
    const end = this.end();
    return isIsoDay(start) && isIsoDay(end) && start <= end
      ? { start, end }
      : { start: null, end: null };
  });
  protected readonly list = computed(() =>
    parseListState({ page: this.page(), size: this.size() }, AUDIT_LIST),
  );

  protected readonly entries = apiResource(listAuditEntries, () => {
    const params: ListAuditEntries$Params = pagingParams(this.list());
    const action = this.actionFilter();
    const userId = this.userFilter();
    const { start, end } = this.dates();
    if (action) params.action = action;
    if (userId !== null) params.userId = userId;
    if (start && end) Object.assign(params, { start, end });
    return params;
  });
  protected readonly data = linkedSignal<
    PageResponseAuditEntryResponse | undefined,
    PageResponseAuditEntryResponse | undefined
  >({
    source: () => (this.entries.hasValue() ? this.entries.value() : undefined),
    computation: (value, previous) => value ?? previous?.value,
  });
  protected readonly error = computed(() => {
    const error = this.entries.error();
    return error ? describeError(error) : null;
  });
  protected readonly filtered = computed(
    () => this.actionFilter() !== null || this.userFilter() !== null || this.dates().start !== null,
  );
  /** The user filter's email, from the entries it found. */
  protected readonly userEmail = computed(
    () => this.data()?.content.find((entry) => entry.actorEmail)?.actorEmail ?? null,
  );

  protected readonly actions = AUDIT_ACTIONS;
  protected readonly groups = [...new Set(AUDIT_ACTIONS.map((a) => a.group))];
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly actionLabel = actionLabel;
  protected readonly isWarning = isWarning;
  protected readonly detailPairs = detailPairs;
  private readonly timeZone = localTimeZone();

  protected when(instant: string): string {
    return formatInstant(instant, this.timeZone);
  }

  protected actionsIn(group: string) {
    return this.actions.filter((a) => a.group === group);
  }

  protected setAction(value: AuditAction | ''): void {
    this.navigate({ action: value || null, page: null });
  }

  protected setDates(range: DayRange): void {
    this.navigate({ start: range.start, end: range.end, page: null });
  }

  protected filterUser(userId: number | null | undefined): void {
    this.navigate({ userId: userId ?? null, page: null });
  }

  protected clearFilters(): void {
    this.navigate({ action: null, userId: null, start: null, end: null, page: null });
  }

  protected paged(event: PageEvent): void {
    this.navigate(
      listQueryParams({ ...this.list(), page: event.pageIndex, size: event.pageSize }, AUDIT_LIST),
    );
  }

  private navigate(params: Params): void {
    void this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge' });
  }
}
