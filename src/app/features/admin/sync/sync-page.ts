import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpContext } from '@angular/common/http';
import { Api } from '../../../api/api';
import { getSyncStatus, syncIncidents, syncOncalls } from '../../../api/functions';
import { KindStatus, SyncRunResponse } from '../../../api/models';
import { BACKGROUND, describeError, errorCode, handlesErrors } from '../../../core/http/api-error';
import { apiResource } from '../../../core/http/api-resource';
import { formatAgo, formatDuration, formatLocal } from '../../../shared/format';
import { KIND_LABELS, runOutcome } from './sync-format';
import { SyncRunsTable } from './sync-runs-table';
import { WebhookEventsTable } from './webhook-events-table';

/** While a sync runs somewhere, the status is checked this often. */
const POLL_MS = 5000;

/** Days of on-call shifts a manual sync can fetch; the scheduler keeps the last week current. */
export const BACKFILL_DAYS = [7, 30, 90, 365, 730];

/** PagerDuty sync: how each kind is doing, syncing now, and the recent runs and webhooks. */
@Component({
  selector: 'app-sync-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    SyncRunsTable,
    WebhookEventsTable,
  ],
  templateUrl: './sync-page.html',
  styleUrl: './sync-page.scss',
})
export class SyncPage {
  private readonly api = inject(Api);
  private readonly snackBar = inject(MatSnackBar);

  /** Polls quietly: no progress bar, no error snackbar */
  protected readonly status = apiResource(
    getSyncStatus,
    () => ({}),
    () => handlesErrors(new HttpContext().set(BACKGROUND, true)),
  );
  protected readonly running = computed(() => {
    const status = this.status.hasValue() ? this.status.value() : undefined;
    return !!status && (status.incidents.running || status.oncalls.running);
  });
  protected readonly error = computed(() => {
    const error = this.status.error();
    return error ? describeError(error) : null;
  });

  /** Which manual sync this page started and is waiting for */
  protected readonly starting = signal<'INCIDENTS' | 'ONCALLS' | null>(null);
  protected readonly days = signal(7);
  /** Bumped after a manual sync so the activity tables reload */
  protected readonly changes = signal(0);

  protected readonly backfillDays = BACKFILL_DAYS;
  protected readonly kindLabels = KIND_LABELS;
  protected readonly ago = formatAgo;
  protected readonly duration = formatDuration;
  protected readonly runOutcome = runOutcome;
  protected readonly when = formatLocal;

  constructor() {
    // Poll only while something runs (a scheduled sync, or one from another admin)
    let timer: ReturnType<typeof setInterval> | undefined;
    effect(() => {
      clearInterval(timer);
      timer = this.running() ? setInterval(() => this.status.reload(), POLL_MS) : undefined;
    });
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected kinds(): { key: 'incidents' | 'oncalls'; kind: SyncRunResponse['kind'] }[] {
    return [
      { key: 'incidents', kind: 'INCIDENTS' },
      { key: 'oncalls', kind: 'ONCALLS' },
    ];
  }

  protected kindStatus(key: 'incidents' | 'oncalls'): KindStatus | null {
    return this.status.hasValue() ? (this.status.value()?.[key] ?? null) : null;
  }

  protected interval(seconds: number | null | undefined): string {
    if (!seconds) return '';
    const minutes = Math.round(seconds / 60);
    return minutes < 60 ? `every ${minutes} minutes` : `every ${Math.round(minutes / 60)} hours`;
  }

  protected async sync(kind: 'INCIDENTS' | 'ONCALLS'): Promise<void> {
    this.starting.set(kind);
    // The status shows it running meanwhile
    setTimeout(() => this.status.reload(), 500);
    try {
      if (kind === 'INCIDENTS') {
        const result = await this.api.invoke(syncIncidents, {}, handlesErrors());
        const unattributed = result.unattributed
          ? ` ${result.unattributed} couldn't be matched to an engineer.`
          : '';
        const failed = result.failed ? ` ${result.failed} failed.` : '';
        this.snackBar.open(
          `Incidents synced: ${result.created} new, ${result.updated} updated.${unattributed}${failed}`,
          'OK',
          { duration: 8000 },
        );
      } else {
        const result = await this.api.invoke(syncOncalls, { days: this.days() }, handlesErrors());
        const skipped = result.skipped
          ? ` ${result.skipped} belonged to PagerDuty users who aren't engineers here.`
          : '';
        this.snackBar.open(
          `On-call synced: ${result.shiftsStored} shifts stored.${skipped}`,
          'OK',
          {
            duration: 8000,
          },
        );
      }
    } catch (error) {
      const code = errorCode(error);
      const message =
        code === 'SYNC_IN_PROGRESS'
          ? 'A sync of this kind is already running. Its result shows here when it finishes.'
          : code === 'PAGERDUTY_NOT_CONFIGURED'
            ? "PagerDuty isn't set up on this server, so there's nothing to sync."
            : `The sync failed. ${describeError(error)}`;
      this.snackBar.open(message, 'Dismiss');
    } finally {
      this.starting.set(null);
      this.status.reload();
      this.changes.update((count) => count + 1);
    }
  }

  protected run(status: KindStatus | null): SyncRunResponse | null {
    return status?.lastRun ?? null;
  }
}
