import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Params, Router, RouterLink } from '@angular/router';
import { listEngineers, listOncallShifts } from '../../api/functions';
import { PageResponseOncallShiftResponse } from '../../api/models';
import { describeError } from '../../core/http/api-error';
import { apiResource } from '../../core/http/api-resource';
import { DateRangeField, DayRange } from '../../shared/components/date-range-field';
import { formatInstant } from '../../shared/format';
import {
  PAGE_SIZES,
  listQueryParams,
  matSort,
  pagingParams,
  parseListState,
  sortChange,
} from '../../shared/list/list-state';
import { todayIn } from '../analytics/analytics-filter';
import { localTimeZone } from '../alerts/alert-format';
import {
  MAX_RANGE_DAYS,
  isCurrent,
  levelLabel,
  oncallRange,
  rangeTooLong,
  shiftLength,
} from './oncall-range';

const SHIFT_LIST = { sortable: ['startsAt', 'endsAt'], defaultSort: 'startsAt,asc' };

/** On-call shifts synced from PagerDuty: who is on call now, and the shifts around a date range. */
@Component({
  selector: 'app-oncall-page',
  imports: [
    DateRangeField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    RouterLink,
  ],
  templateUrl: './oncall-page.html',
  styleUrl: './oncall-page.scss',
})
export class OncallPage {
  private readonly router = inject(Router);

  /** Query parameters */
  readonly start = input<string>();
  readonly end = input<string>();
  readonly engineerId = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();
  readonly sort = input<string>();

  protected readonly range = computed(() => oncallRange(this.start(), this.end()));
  protected readonly tooLong = computed(() => rangeTooLong(this.range()));
  protected readonly engineer = computed(() => {
    const id = Number(this.engineerId());
    return Number.isInteger(id) && id > 0 ? id : null;
  });
  protected readonly list = computed(() =>
    parseListState({ page: this.page(), size: this.size(), sort: this.sort() }, SHIFT_LIST),
  );
  protected readonly matSort = computed(() => matSort(this.list()));

  protected readonly shifts = apiResource(listOncallShifts, () => {
    if (this.tooLong()) return undefined;
    const { start, end } = this.range();
    const engineerId = this.engineer();
    return { start, end, ...(engineerId !== null && { engineerId }), ...pagingParams(this.list()) };
  });
  protected readonly data = linkedSignal<
    PageResponseOncallShiftResponse | undefined,
    PageResponseOncallShiftResponse | undefined
  >({
    source: () => (this.shifts.hasValue() ? this.shifts.value() : undefined),
    computation: (value, previous) => value ?? previous?.value,
  });
  protected readonly error = computed(() => {
    const error = this.shifts.error();
    return error ? describeError(error) : null;
  });

  /** Today's shifts, whatever the range, for "on call now" */
  private readonly today = apiResource(listOncallShifts, () => {
    const today = todayIn('UTC');
    const engineerId = this.engineer();
    return { start: today, end: today, ...(engineerId !== null && { engineerId }), size: 100 };
  });
  protected readonly now = computed(() =>
    this.today.hasValue()
      ? this.today
          .value()!
          .content.filter((shift) => isCurrent(shift))
          .sort((a, b) => a.escalationLevel - b.escalationLevel)
      : null,
  );

  /** For the engineer filter: the engineers the user may see */
  protected readonly engineers = apiResource(listEngineers, () => ({
    size: 100,
    sort: ['name,asc'],
  }));

  protected readonly columns = ['engineer', 'level', 'startsAt', 'endsAt', 'length'];
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly maxDays = MAX_RANGE_DAYS;
  protected readonly levelLabel = levelLabel;
  protected readonly isCurrent = isCurrent;
  protected readonly shiftLength = shiftLength;
  private readonly timeZone = localTimeZone();
  protected readonly timeZoneName = this.timeZone;

  protected when(instant: string): string {
    return formatInstant(instant, this.timeZone);
  }

  protected setRange(range: DayRange): void {
    this.navigate({ start: range.start, end: range.end, page: null });
  }

  protected setEngineer(id: string): void {
    this.navigate({ engineerId: id || null, page: null });
  }

  protected sorted(sort: Sort): void {
    this.navigate(sortChange(sort, SHIFT_LIST));
  }

  protected paged(event: PageEvent): void {
    this.navigate(
      listQueryParams({ ...this.list(), page: event.pageIndex, size: event.pageSize }, SHIFT_LIST),
    );
  }

  private navigate(params: Params): void {
    void this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge' });
  }
}
