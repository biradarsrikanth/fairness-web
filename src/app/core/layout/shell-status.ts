import { DOCUMENT } from '@angular/common';
import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { Api } from '../../api/api';
import { getAnalyticsSummary, getSyncStatus } from '../../api/functions';
import { Summary, SyncStatusResponse } from '../../api/models';
import { AuthService } from '../auth/auth';
import { BACKGROUND, handlesErrors } from '../http/api-error';

/**
 * How often the header figures refresh while the tab is visible. The summary costs the scorer real work
 * (fairness and burnout for every engineer in scope), and new alerts arrive with the 15-minute PagerDuty
 * sync, so refreshing more often would add load without showing anything new.
 */
export const REFRESH_MS = 15 * 60_000;
/** Up to this much extra delay, so tabs opened together don't refresh together. */
const JITTER_MS = 30_000;

/**
 * The figures in the header ticker and the status bar: the last 30 days for everything the user may see,
 * and, for administrators, when PagerDuty last synced. One request each, shared by every page, refreshed
 * every 15 minutes only while the tab is visible. Provided by the shell, so it starts on sign-in and stops
 * (with its data) on sign-out.
 */
@Service({ autoProvided: false })
export class ShellStatus {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  private readonly summaryValue = signal<Summary | null>(null);
  private readonly syncValue = signal<SyncStatusResponse | null>(null);
  private readonly checkedAt = signal<number | null>(null);

  readonly summary = this.summaryValue.asReadonly();
  readonly sync = this.syncValue.asReadonly();
  /** When the figures were last fetched; null before the first answer. */
  readonly updatedAt = this.checkedAt.asReadonly();

  /** The most recent successful PagerDuty sync of either kind, as an ISO timestamp. */
  readonly lastSync = computed(() => {
    const sync = this.syncValue();
    if (!sync) return null;
    const times = [sync.incidents.lastSuccess, sync.oncalls.lastSuccess]
      .map((run) => run?.finishedAt ?? run?.startedAt)
      .filter((time): time is string => typeof time === 'string');
    return times.sort().at(-1) ?? null;
  });

  /** Whether the latest run of either kind failed: a sync that stopped working, whatever succeeded before. */
  readonly syncFailing = computed(() => {
    const sync = this.syncValue();
    return (
      !!sync && [sync.incidents, sync.oncalls].some((kind) => kind.lastRun?.status === 'FAILED')
    );
  });

  private timer: ReturnType<typeof setTimeout> | null = null;
  private loading = false;

  constructor() {
    const onVisible = () => {
      if (this.document.visibilityState !== 'visible') return;
      const checked = this.checkedAt();
      if (checked === null || Date.now() - checked >= REFRESH_MS) void this.refresh();
    };
    this.document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onVisible);
      this.cancel();
    });
    void this.refresh();
  }

  /** Fetches the figures now; skipped while the tab is hidden or a fetch is already running. */
  async refresh(): Promise<void> {
    if (this.loading || this.document.visibilityState === 'hidden') return;
    this.loading = true;
    this.cancel();
    const context = () => handlesErrors().set(BACKGROUND, true);
    try {
      const [summary, sync] = await Promise.allSettled([
        this.api.invoke(getAnalyticsSummary, {}, context()),
        this.auth.hasRole('ADMIN')
          ? this.api.invoke(getSyncStatus, {}, context())
          : Promise.resolve(null),
      ]);
      // A failed fetch keeps the previous figures; the status bar shows the connection trouble
      if (summary.status === 'fulfilled') this.summaryValue.set(summary.value);
      if (sync.status === 'fulfilled') this.syncValue.set(sync.value);
      if (summary.status === 'fulfilled') this.checkedAt.set(Date.now());
    } finally {
      this.loading = false;
      this.schedule();
    }
  }

  private schedule(): void {
    this.cancel();
    this.timer = setTimeout(() => void this.refresh(), REFRESH_MS + Math.random() * JITTER_MS);
  }

  private cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
