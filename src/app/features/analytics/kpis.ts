import { Kpi, ScoresStatus, Summary } from '../../api/models';
import { formatCount, formatMinutes, formatPct, humanize } from '../../shared/format';

/** For every figure on the page, lower is better: fewer alerts, faster response, fairer load. */
export type Tone = 'good' | 'bad' | 'neutral';

export interface KpiChange {
  /** +12%, −3 pts, +0.04 */
  readonly text: string;
  readonly direction: 'up' | 'down' | 'flat';
  readonly tone: Tone;
}

export interface KpiTile {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** What the figure was in the previous period, e.g. "Previous period: 40" */
  readonly previous: string | null;
  readonly change: KpiChange | null;
  /** A line under the value: the fairness label, or why a score is missing */
  readonly note: string | null;
}

type Kind = 'count' | 'minutes' | 'pct' | 'gini';

function display(kind: Kind, value: number | null | undefined): string {
  switch (kind) {
    case 'count':
      return formatCount(value);
    case 'minutes':
      return formatMinutes(value);
    case 'pct':
      return formatPct(value);
    case 'gini':
      return value === null || value === undefined ? '–' : value.toFixed(2);
  }
}

function signed(value: number, text: string): string {
  if (value > 0) return `+${text}`;
  if (value < 0) return `−${text}`;
  return text;
}

/**
 * The change from the previous period. Counts and durations change by a percentage; percentages and the
 * Gini change by points, since "+50%" for 20% → 30% after hours reads as something else.
 */
export function kpiChange(kind: Kind, kpi: Kpi): KpiChange | null {
  const { value, previous } = kpi;
  if (value === null || value === undefined || previous === null || previous === undefined) {
    return null;
  }
  let delta: number;
  let text: string;
  if (kind === 'pct') {
    delta = Math.round((value - previous) * 10) / 10;
    text = `${Math.abs(delta)} pts`;
  } else if (kind === 'gini') {
    delta = Math.round((value - previous) * 100) / 100;
    text = Math.abs(delta).toFixed(2);
  } else if (kind === 'count' && previous === 0) {
    // No percentage from zero: show the difference
    delta = value;
    text = formatCount(Math.abs(delta));
  } else {
    if (kpi.changePct === null || kpi.changePct === undefined) return null;
    delta = Math.round(kpi.changePct);
    text = `${Math.abs(delta)}%`;
  }
  if (delta === 0) return { text: 'No change', direction: 'flat', tone: 'neutral' };
  return {
    text: signed(delta, text),
    direction: delta > 0 ? 'up' : 'down',
    tone: delta > 0 ? 'bad' : 'good',
  };
}

function tile(
  id: string,
  label: string,
  kind: Kind,
  kpi: Kpi,
  note: string | null = null,
): KpiTile {
  const hasPrevious = kpi.previous !== null && kpi.previous !== undefined;
  return {
    id,
    label,
    value: display(kind, kpi.value),
    previous: hasPrevious ? `Previous period: ${display(kind, kpi.previous)}` : null,
    change: kpiChange(kind, kpi),
    note,
  };
}

/** Why the scorer's figures are missing, in words. */
export function scoresUnavailableReason(scores: ScoresStatus): string {
  return scores.reason === 'SEVERAL_TEAMS'
    ? 'Pick one team to see scores'
    : 'Scores are unavailable right now';
}

function scoreTile(id: string, label: string, scores: ScoresStatus): KpiTile {
  return {
    id,
    label,
    value: '–',
    previous: null,
    change: null,
    note: scoresUnavailableReason(scores),
  };
}

/**
 * The tiles across the top of the page. The scorer's figures (Gini, high-risk engineers) show why they're
 * missing when they are; an engineer gets no high-risk count (peers' burnout is private).
 */
export function kpiTiles(summary: Summary): KpiTile[] {
  const tiles = [
    tile('alerts', 'Alerts', 'count', summary.alerts),
    tile('mtta', 'Time to acknowledge', 'minutes', summary.mttaMinutes, 'Average'),
    tile('mttr', 'Time to resolve', 'minutes', summary.mttrMinutes, 'Average'),
    tile('after-hours', 'After hours', 'pct', summary.afterHoursPct, '18:00–06:00 and weekends'),
    tile('escalations', 'Escalated', 'pct', summary.escalationRatePct, 'Of alerts'),
  ];
  if (summary.scores.available) {
    if (summary.gini) {
      const label = summary.fairnessLabel ? humanize(summary.fairnessLabel) : null;
      tiles.push(tile('gini', 'Fairness (Gini)', 'gini', summary.gini, label));
    }
    if (summary.highRiskEngineers) {
      tiles.push(
        tile('high-risk', 'High burnout risk', 'count', summary.highRiskEngineers, 'Engineers'),
      );
    }
  } else {
    tiles.push(scoreTile('gini', 'Fairness (Gini)', summary.scores));
  }
  return tiles;
}
