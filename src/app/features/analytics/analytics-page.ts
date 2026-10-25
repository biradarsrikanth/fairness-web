import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import type { ECElementEvent } from 'echarts/core';
import { getAnalyticsSnapshot } from '../../api/functions';
import { AuthService } from '../../core/auth/auth';
import { describeError } from '../../core/http/api-error';
import { ThemeService } from '../../core/theme/theme';
import { apiResource, keepLast } from '../../core/http/api-resource';
import { formatPct, formatRange, humanize } from '../../shared/format';
import {
  AnalyticsFilter,
  linkParams,
  parseFilter,
  sameFilter,
  teamOptions,
  toApiParams,
  toQueryParams,
} from './analytics-filter';
import { BurnoutTable } from './burnout-table';
import { Chart } from './charts/chart';
import { ChartCard } from './charts/chart-card';
import {
  LOAD_SHARE_LIMIT,
  WEEKDAYS,
  alertsOverTimeOption,
  giniTrendOption,
  heatmapOption,
  loadShareHeight,
  loadShareOption,
  periodLabel,
  severitiesIn,
  trendPeriodLabel,
} from './charts/chart-options';
import { chartPalette } from './charts/palette';
import { ExportMenu } from '../reports/export-menu';
import { ReportRequest } from '../reports/report-downloads';
import { FilterBar } from './filter-bar';
import { KpiTiles } from './kpi-tiles';
import { scoresUnavailableReason } from './kpis';
import { TeamFairnessTable } from './team-fairness';
import { TopServices } from './top-services';

/**
 * The analytics page: KPIs, charts and tables for one filter, all from one snapshot request. The filter
 * lives in the URL, so a view can be bookmarked and shared, and the back button undoes a change.
 */
@Component({
  selector: 'app-analytics-page',
  imports: [
    BurnoutTable,
    Chart,
    ChartCard,
    ExportMenu,
    FilterBar,
    KpiTiles,
    MatButtonModule,
    MatIconModule,
    TeamFairnessTable,
    TopServices,
  ],
  templateUrl: './analytics-page.html',
  styleUrl: './analytics-page.scss',
})
export class AnalyticsPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  /** Charts redraw in the colours of the current mode */
  private readonly palette = computed(() => chartPalette(this.theme.mode()));

  /** Query parameters */
  readonly team = input<string>();
  readonly start = input<string>();
  readonly end = input<string>();
  readonly granularity = input<string>();

  protected readonly filter = computed(
    () =>
      parseFilter({
        team: this.team(),
        start: this.start(),
        end: this.end(),
        granularity: this.granularity(),
      }),
    { equal: sameFilter },
  );
  /** For links to an engineer: this filter, with the dates on screen so both pages cover the same days. */
  protected readonly engineerParams = computed(() => {
    const params = linkParams(this.filter());
    const window = this.data()?.summary.window;
    return window ? { ...params, start: window.start, end: window.end } : params;
  });
  protected readonly teams = computed(() =>
    teamOptions(this.auth.role(), this.auth.user()?.teams ?? []),
  );
  protected readonly isEngineer = computed(() => this.auth.role() === 'ENGINEER');

  protected readonly snapshot = apiResource(getAnalyticsSnapshot, () => toApiParams(this.filter()));

  /** The last loaded snapshot, kept on screen (dimmed) while the next one loads. */
  protected readonly data = keepLast(this.snapshot);
  protected readonly error = computed(() => {
    const error = this.snapshot.error();
    return error ? describeError(error) : null;
  });

  /** Exports cover exactly the days on screen */
  protected readonly reportRequest = computed<ReportRequest | null>(() => {
    const window = this.data()?.summary.window;
    return window
      ? { kind: 'analytics', team: this.filter().team, start: window.start, end: window.end }
      : null;
  });

  protected readonly windowText = computed(() => {
    const window = this.data()?.summary.window;
    return window ? formatRange(window.start, window.end) : null;
  });
  protected readonly scoresNotice = computed(() => {
    const scores = this.data()?.summary.scores;
    if (!scores || scores.available) return null;
    return scores.reason === 'SEVERAL_TEAMS'
      ? 'Fairness and burnout compare engineers within one team. Pick a team to see them.'
      : "The scoring service isn't answering, so fairness and burnout scores are missing. " +
          'Counts and charts are complete.';
  });
  protected readonly scoresReason = computed(() => {
    const scores = this.data()?.summary.scores;
    return scores ? scoresUnavailableReason(scores) : '';
  });

  protected readonly alertsChart = computed(() => {
    const data = this.data();
    return data ? alertsOverTimeOption(data.alertsOverTime, this.palette()) : null;
  });
  protected readonly severities = computed(() => {
    const data = this.data();
    return data ? severitiesIn(data.alertsOverTime) : [];
  });
  protected readonly giniChart = computed(() => {
    const trend = this.data()?.trend;
    return trend
      ? giniTrendOption(trend.periods, trend.granularity, trend.window.timezone, this.palette())
      : null;
  });
  protected readonly loadChart = computed(() => {
    const data = this.data();
    return data ? loadShareOption(data.loadShare, this.palette()) : null;
  });
  protected readonly loadHeight = computed(() =>
    loadShareHeight(this.data()?.loadShare.length ?? 0),
  );
  protected readonly heatmapChart = computed(() => {
    const data = this.data();
    return data ? heatmapOption(data.heatmap, this.palette()) : null;
  });
  /** Per-period values behind three of the tiles, for their trend lines. */
  protected readonly trends = computed(() => {
    const data = this.data();
    if (!data) return {};
    const periods = data.trend.scores.available ? data.trend.periods : [];
    return {
      alerts: data.alertsOverTime.points.map((point) => point.total),
      ...(periods.length > 1 && {
        gini: periods.map((period) => period.gini),
        'high-risk': periods.map((period) => period.highRiskCount),
      }),
    };
  });
  protected readonly loadSubheading = computed(() => {
    const count = this.data()?.loadShare.length ?? 0;
    return count > LOAD_SHARE_LIMIT + 1
      ? `The ${LOAD_SHARE_LIMIT} biggest shares of ${count} engineers; select a bar for details`
      : "Each engineer's share of the weighted load; select a bar for details";
  });
  /** The heatmap's cells by weekday, for its table view. */
  protected readonly heatmapRows = computed(() => {
    const cells = this.data()?.heatmap.cells ?? [];
    return WEEKDAYS.map((day, index) => ({
      day,
      counts: Array.from(
        { length: 24 },
        (_, hour) => cells.find((c) => c.dayOfWeek === index + 1 && c.hour === hour)?.count ?? 0,
      ),
    }));
  });
  protected readonly hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));

  protected readonly periodLabel = periodLabel;
  protected readonly trendPeriodLabel = trendPeriodLabel;
  protected readonly formatPct = formatPct;
  protected readonly humanize = humanize;

  protected apply(filter: AnalyticsFilter): void {
    void this.router.navigate([], {
      queryParams: toQueryParams(filter),
      queryParamsHandling: 'merge',
    });
  }

  protected openEngineer(event: ECElementEvent): void {
    const engineerId = (event.data as { engineerId?: number } | undefined)?.engineerId;
    if (engineerId !== undefined) {
      void this.router.navigate(['/analytics/engineers', engineerId], {
        queryParams: this.engineerParams(),
      });
    }
  }

  protected granularityText(granularity: string): string {
    return { day: 'per day', week: 'per week', month: 'per month' }[granularity] ?? '';
  }
}
