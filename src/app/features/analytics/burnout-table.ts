import { Component, computed, input, signal } from '@angular/core';
import { MatSortModule, Sort, SortDirection } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Params, RouterLink } from '@angular/router';
import { BurnoutScore } from '../../api/models';
import { RiskBadge } from '../../shared/components/risk-badge';
import { formatMinutes, formatPct } from '../../shared/format';

type Column =
  | 'name'
  | 'team'
  | 'score'
  | 'risk'
  | 'alertCount'
  | 'nightPct'
  | 'weekendPct'
  | 'trendRatio'
  | 'medianAckMinutes';

const RISK_ORDER: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

function sortValue(row: BurnoutScore, column: Column): string | number {
  switch (column) {
    case 'name':
    case 'team':
      return row[column].toLowerCase();
    case 'risk':
      return RISK_ORDER[row.risk] ?? -1;
    case 'medianAckMinutes':
      return row.medianAckMinutes ?? -1;
    default:
      return row[column];
  }
}

/** Sorts a copy; ties keep the score order, highest first. */
export function sortBurnout(
  rows: readonly BurnoutScore[],
  column: Column,
  direction: SortDirection,
): BurnoutScore[] {
  const byScore = [...rows].sort((a, b) => b.score - a.score);
  if (direction === '') return byScore;
  const sign = direction === 'asc' ? 1 : -1;
  return byScore.sort((a, b) => {
    const x = sortValue(a, column);
    const y = sortValue(b, column);
    return x < y ? -sign : x > y ? sign : 0;
  });
}

/** Burnout per engineer, highest first; each name opens the engineer's page with the same filter. */
@Component({
  selector: 'app-burnout-table',
  imports: [MatSortModule, MatTableModule, RiskBadge, RouterLink],
  templateUrl: './burnout-table.html',
  styleUrl: './burnout-table.scss',
})
export class BurnoutTable {
  readonly rows = input.required<readonly BurnoutScore[]>();
  /** The page's filter, carried to the engineer page. */
  readonly queryParams = input<Params>({});

  protected readonly sort = signal<Sort>({ active: 'score', direction: 'desc' });
  protected readonly sorted = computed(() =>
    sortBurnout(this.rows(), this.sort().active as Column, this.sort().direction),
  );
  protected readonly columns = computed<Column[]>(() => {
    const severalTeams = new Set(this.rows().map((r) => r.team)).size > 1;
    return [
      'name',
      ...(severalTeams ? (['team'] as const) : []),
      'score',
      'risk',
      'alertCount',
      'nightPct',
      'weekendPct',
      'trendRatio',
      'medianAckMinutes',
    ];
  });

  protected readonly formatPct = formatPct;
  protected readonly formatMinutes = formatMinutes;

  protected trend(ratio: number): string {
    return `×${ratio.toFixed(1)}`;
  }
}
