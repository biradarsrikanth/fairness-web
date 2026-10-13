import { SyncRunResponse } from '../../../api/models';
import { humanize } from '../../../shared/format';

/** "4 minutes ago", "2 hours ago", "3 days ago"; "just now" under a minute. */
export function ago(instant: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(instant)) / 1000));
  if (seconds < 60) return 'just now';
  const units: [number, string][] = [
    [86_400, 'day'],
    [3_600, 'hour'],
    [60, 'minute'],
  ];
  for (const [size, unit] of units) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size);
      return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}

/** 850 ms, 12.4 s, 3 min 5 s */
export function duration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '–';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/** What a run changed: "12 new, 3 updated" for incidents, "40 shifts stored" for on-call. */
export function runOutcome(run: SyncRunResponse): string {
  if (run.status === 'RUNNING') return 'Running…';
  if (run.kind === 'ONCALLS') {
    return run.createdCount === null || run.createdCount === undefined
      ? '–'
      : `${run.createdCount} shift${run.createdCount === 1 ? '' : 's'} stored`;
  }
  const parts = [
    run.createdCount ? `${run.createdCount} new` : null,
    run.updatedCount ? `${run.updatedCount} updated` : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(', ') : 'No changes';
}

export const KIND_LABELS: Record<SyncRunResponse['kind'], string> = {
  INCIDENTS: 'Incidents',
  ONCALLS: 'On-call shifts',
};

export function label(value: string): string {
  return humanize(value);
}
