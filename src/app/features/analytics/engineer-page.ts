import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  numberAttribute,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { getEngineerScores, listAlerts } from '../../api/functions';
import { EngineerReport } from '../../api/models';
import { describeError, errorCode } from '../../core/http/api-error';
import { apiResource } from '../../core/http/api-resource';
import { RiskBadge } from '../../shared/components/risk-badge';
import {
  formatInstant,
  formatMinutes,
  formatPct,
  formatRange,
  humanize,
} from '../../shared/format';
import {
  AnalyticsFilter,
  parseFilter,
  toApiParams,
  toQueryParams,
  windowDays,
} from './analytics-filter';
import { burnoutBreakdown, burnoutConfidence } from './burnout-breakdown';
import { Chart } from './charts/chart';
import { ChartCard } from './charts/chart-card';
import { DAY_PARTS, timeOfDayOption } from './charts/chart-options';
import { chartPalette } from './charts/palette';
import { ThemeService } from '../../core/theme/theme';
import { ExportMenu } from '../reports/export-menu';
import { ReportRequest } from '../reports/report-downloads';
import { FilterBar } from './filter-bar';

const RECENT_ALERTS = 10;

/** One engineer over the page's dates: their burnout score and its parts, time of day, latest alerts. */
@Component({
  selector: 'app-engineer-page',
  imports: [
    Chart,
    ChartCard,
    ExportMenu,
    FilterBar,
    MatButtonModule,
    MatIconModule,
    RiskBadge,
    RouterLink,
  ],
  templateUrl: './engineer-page.html',
  styleUrl: './engineer-page.scss',
})
export class EngineerPage {
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly title = inject(Title);

  /** Route parameter */
  readonly engineerId = input.required({ transform: numberAttribute });
  /** Query parameters, shared with the analytics page */
  readonly team = input<string>();
  readonly start = input<string>();
  readonly end = input<string>();
  readonly granularity = input<string>();

  protected readonly filter = computed(() =>
    parseFilter({
      team: this.team(),
      start: this.start(),
      end: this.end(),
      granularity: this.granularity(),
    }),
  );

  protected readonly report = apiResource(getEngineerScores, () => {
    const engineerId = this.engineerId();
    if (!Number.isInteger(engineerId) || engineerId <= 0) return undefined;
    const { start, end } = toApiParams(this.filter());
    return { engineerId, ...(start && end && { start, end }) };
  });

  protected readonly data = linkedSignal<EngineerReport | undefined, EngineerReport | undefined>({
    source: () => (this.report.hasValue() ? this.report.value() : undefined),
    // Keep the last report while the dates change, but not another engineer's
    computation: (value, previous) =>
      value ??
      (previous?.value?.engineer.engineerId === this.engineerId() ? previous.value : undefined),
  });

  /** The days the report covers (the scorer's window is in timestamps), with their timezone. */
  protected readonly window = computed(() => {
    const data = this.data();
    return data ? { ...windowDays(data.window), timezone: data.window.timezone } : null;
  });

  /** The latest alerts in the report's window, once it's known. */
  protected readonly alerts = apiResource(listAlerts, () => {
    const data = this.data();
    const window = this.window();
    if (!data || !window) return undefined;
    return {
      engineerId: data.engineer.engineerId,
      start: window.start,
      end: window.end,
      page: 0,
      size: RECENT_ALERTS,
    };
  });

  protected readonly error = computed(() => {
    const error = this.report.error();
    if (!error) return null;
    if (errorCode(error) === 'FORBIDDEN') return "You don't have access to this engineer.";
    if (errorCode(error) === 'NOT_FOUND') return 'There is no such engineer.';
    return describeError(error);
  });
  protected readonly alertsError = computed(() => {
    const error = this.alerts.error();
    return error ? describeError(error) : null;
  });

  /** Exports cover exactly the days on screen */
  protected readonly reportRequest = computed<ReportRequest | null>(() => {
    const window = this.window();
    const data = this.data();
    return window && data
      ? {
          kind: 'engineer',
          engineerId: data.engineer.engineerId,
          start: window.start,
          end: window.end,
        }
      : null;
  });

  protected readonly windowText = computed(() => {
    const window = this.window();
    return window ? formatRange(window.start, window.end) : null;
  });
  protected readonly breakdown = computed(() => {
    const data = this.data();
    return data ? burnoutBreakdown(data.burnout) : [];
  });
  protected readonly confidence = computed(() =>
    burnoutConfidence(this.data()?.burnout.alertCount ?? 0),
  );
  protected readonly timeOfDayChart = computed(() => {
    const data = this.data();
    return data ? timeOfDayOption(data.timeOfDay, chartPalette(this.theme.mode())) : null;
  });
  protected readonly totalAlerts = computed(() => {
    const counts = this.data()?.timeOfDay;
    return counts ? DAY_PARTS.reduce((sum, part) => sum + counts[part.key], 0) : 0;
  });
  protected readonly backParams = computed(() => {
    const params = toQueryParams(this.filter());
    return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== null));
  });

  protected readonly dayParts = DAY_PARTS;
  protected readonly formatMinutes = formatMinutes;
  protected readonly formatPct = formatPct;
  protected readonly humanize = humanize;

  constructor() {
    effect(() => {
      const name = this.data()?.engineer.name;
      if (name) this.title.setTitle(`${name} · Fairness`);
    });
  }

  protected applyDates(filter: AnalyticsFilter): void {
    void this.router.navigate([], {
      queryParams: { start: filter.start, end: filter.end },
      queryParamsHandling: 'merge',
    });
  }

  protected when(instant: string): string {
    return formatInstant(instant, this.data()?.window.timezone ?? 'UTC');
  }
}
