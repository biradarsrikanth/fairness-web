import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { Params, Router } from '@angular/router';
import { listAuditEntries } from '../../../api/functions';
import { ListAuditEntries$Params } from '../../../api/fn/audit/list-audit-entries';
import { describeError } from '../../../core/http/api-error';
import { apiResource, keepLast } from '../../../core/http/api-resource';
import { DateRangeField, DayRange } from '../../../shared/components/date-range-field';
import { formatLocal } from '../../../shared/format';
import {
  PAGE_SIZES,
  pageChange,
  pagingParams,
  parseListState,
} from '../../../shared/list/list-state';
import { isIsoDay } from '../../analytics/analytics-filter';
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
  protected readonly data = keepLast(this.entries);
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
  protected readonly when = formatLocal;

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
    this.navigate(pageChange(this.list(), event, AUDIT_LIST));
  }

  private navigate(params: Params): void {
    void this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge' });
  }
}
