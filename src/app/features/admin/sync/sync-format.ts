import { SyncRunResponse } from '../../../api/models';

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
