import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Api } from '../../../api/api';
import { listWebhookEvents, replayWebhookEvent } from '../../../api/functions';
import { ListWebhookEvents$Params } from '../../../api/fn/pager-duty-sync-activity/list-webhook-events';
import { WebhookEventResponse } from '../../../api/models';
import { describeError, handlesErrors } from '../../../core/http/api-error';
import { apiResource, keepLast } from '../../../core/http/api-resource';
import { formatLocal, humanize } from '../../../shared/format';
import { WebhookPayloadDialog } from './webhook-payload-dialog';

/** The gateway applies these again on request (PROCESSED and IGNORED ones are done). */
const REPLAYABLE: readonly WebhookEventResponse['status'][] = ['FAILED', 'RECEIVED'];

/** Webhooks PagerDuty sent, newest first, with replaying the ones that failed. */
@Component({
  selector: 'app-webhook-events-table',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  template: `
    <section class="panel" aria-labelledby="webhooks-heading">
      <div class="head">
        <h2 id="webhooks-heading">Webhooks received</h2>
        <div class="filters">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select [value]="status()" (selectionChange)="setStatus($event.value)">
              <mat-option value="">Any status</mat-option>
              <mat-option value="FAILED">Failed</mat-option>
              <mat-option value="PROCESSED">Processed</mat-option>
              <mat-option value="IGNORED">Ignored</mat-option>
              <mat-option value="RECEIVED">Received</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </div>
      @if (error()) {
        <p class="muted" role="alert">
          Couldn't load webhooks. {{ error() }}
          <button matButton type="button" (click)="events.reload()">Try again</button>
        </p>
      }
      @if (data(); as page) {
        @if (page.content.length === 0) {
          <p class="muted">No webhooks{{ status() ? ' match' : ' received yet' }}.</p>
        } @else {
          <div class="table-scroll">
            <table class="data-table" aria-label="Webhooks received">
              <thead>
                <tr>
                  <th scope="col">Received</th>
                  <th scope="col">Event</th>
                  <th scope="col">Incident</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span class="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (event of page.content; track event.id) {
                  <tr>
                    <td class="nowrap">{{ when(event.receivedAt) }}</td>
                    <td>{{ event.eventType }}</td>
                    <td>{{ event.incidentId ?? '–' }}</td>
                    <td [class.failed]="event.status === 'FAILED'">
                      {{ label(event.status) }}
                      @if (event.error) {
                        <span class="error-text" [matTooltip]="event.error"
                          >· {{ shorten(event.error) }}</span
                        >
                      }
                    </td>
                    <td class="num nowrap">
                      <button matButton type="button" (click)="show(event)">Payload</button>
                      @if (replayable(event)) {
                        <button
                          matButton
                          type="button"
                          [disabled]="replaying() === event.id"
                          (click)="replay(event)"
                        >
                          {{ replaying() === event.id ? 'Replaying…' : 'Replay' }}
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        <mat-paginator
          [length]="page.totalElements"
          [pageIndex]="page.page"
          [pageSize]="page.size"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="paged($event)"
          aria-label="Pages of webhooks"
        />
      }
    </section>
  `,
  styleUrl: './activity-table.scss',
})
export class WebhookEventsTable {
  private readonly api = inject(Api);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly status = signal('');
  private readonly page = signal({ index: 0, size: 10 });
  protected readonly replaying = signal<number | null>(null);

  protected readonly events = apiResource(listWebhookEvents, () => {
    const params: ListWebhookEvents$Params = { page: this.page().index, size: this.page().size };
    if (this.status()) params.status = this.status() as ListWebhookEvents$Params['status'];
    return params;
  });
  protected readonly data = keepLast(this.events);
  protected readonly error = computed(() => {
    const error = this.events.error();
    return error ? describeError(error) : null;
  });

  protected readonly label = humanize;
  protected readonly when = formatLocal;

  protected shorten(error: string): string {
    return error.length > 60 ? `${error.slice(0, 60)}…` : error;
  }

  protected replayable(event: WebhookEventResponse): boolean {
    return REPLAYABLE.includes(event.status);
  }

  protected setStatus(value: string): void {
    this.status.set(value);
    this.page.update((page) => ({ ...page, index: 0 }));
  }

  protected paged(event: PageEvent): void {
    this.page.set({ index: event.pageIndex, size: event.pageSize });
  }

  protected show(event: WebhookEventResponse): void {
    this.dialog.open(WebhookPayloadDialog, { data: event, width: '720px', maxWidth: '95vw' });
  }

  protected async replay(event: WebhookEventResponse): Promise<void> {
    this.replaying.set(event.id);
    try {
      const result = await this.api.invoke(replayWebhookEvent, { id: event.id }, handlesErrors());
      const outcome =
        result.status === 'PROCESSED'
          ? 'Applied.'
          : result.status === 'FAILED'
            ? `It failed again: ${result.error ?? 'no reason given'}.`
            : `It is ${humanize(result.status).toLowerCase()} now.`;
      this.snackBar.open(`Replayed ${event.eventType}. ${outcome}`, 'OK', { duration: 8000 });
      this.events.reload();
    } catch (error) {
      this.snackBar.open(`Couldn't replay it. ${describeError(error)}`, 'Dismiss');
    } finally {
      this.replaying.set(null);
    }
  }
}
