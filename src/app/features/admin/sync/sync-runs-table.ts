import { Component, computed, input, linkedSignal, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { listSyncRuns } from '../../../api/functions';
import { ListSyncRuns$Params } from '../../../api/fn/pager-duty-sync-activity/list-sync-runs';
import { PageResponseSyncRunResponse } from '../../../api/models';
import { describeError } from '../../../core/http/api-error';
import { apiResource } from '../../../core/http/api-resource';
import { formatInstant } from '../../../shared/format';
import { localTimeZone } from '../../alerts/alert-format';
import { KIND_LABELS, duration, label, runOutcome } from './sync-format';

/** Every sync, newest first, scheduled and manual. */
@Component({
  selector: 'app-sync-runs-table',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  template: `
    <section class="panel" aria-labelledby="runs-heading">
      <div class="head">
        <h2 id="runs-heading">Sync runs</h2>
        <div class="filters">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Kind</mat-label>
            <mat-select [value]="kind()" (selectionChange)="setFilter(kind, $event.value)">
              <mat-option value="">Any kind</mat-option>
              <mat-option value="INCIDENTS">Incidents</mat-option>
              <mat-option value="ONCALLS">On-call shifts</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select [value]="status()" (selectionChange)="setFilter(status, $event.value)">
              <mat-option value="">Any status</mat-option>
              <mat-option value="SUCCEEDED">Succeeded</mat-option>
              <mat-option value="FAILED">Failed</mat-option>
              <mat-option value="RUNNING">Running</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </div>
      @if (error()) {
        <p class="muted" role="alert">
          Couldn't load sync runs. {{ error() }}
          <button matButton type="button" (click)="runs.reload()">Try again</button>
        </p>
      }
      @if (data(); as page) {
        @if (page.content.length === 0) {
          <p class="muted">No sync runs{{ kind() || status() ? ' match' : ' yet' }}.</p>
        } @else {
          <div class="table-scroll">
            <table class="data-table" aria-label="Sync runs">
              <thead>
                <tr>
                  <th scope="col">Started</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Trigger</th>
                  <th scope="col">Status</th>
                  <th scope="col">Result</th>
                  <th scope="col" class="num">Took</th>
                </tr>
              </thead>
              <tbody>
                @for (run of page.content; track run.id) {
                  <tr>
                    <td class="nowrap">{{ when(run.startedAt) }}</td>
                    <td>{{ kindLabels[run.kind] }}</td>
                    <td>{{ label(run.trigger) }}</td>
                    <td [class.failed]="run.status === 'FAILED'">{{ label(run.status) }}</td>
                    <td>
                      {{ runOutcome(run) }}
                      @if (run.error) {
                        <span class="error-text" [matTooltip]="run.error"
                          >· {{ shorten(run.error) }}</span
                        >
                      }
                    </td>
                    <td class="num">{{ duration(run.durationMs) }}</td>
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
          aria-label="Pages of sync runs"
        />
      }
    </section>
  `,
  styleUrl: './activity-table.scss',
})
export class SyncRunsTable {
  /** Changes when a manual sync finishes, to show its run */
  readonly changes = input(0);

  protected readonly kind = signal('');
  protected readonly status = signal('');
  private readonly page = signal({ index: 0, size: 10 });

  protected readonly runs = apiResource(listSyncRuns, () => {
    this.changes();
    const params: ListSyncRuns$Params = {
      page: this.page().index,
      size: this.page().size,
    };
    if (this.kind()) params.kind = this.kind() as ListSyncRuns$Params['kind'];
    if (this.status()) params.status = this.status() as ListSyncRuns$Params['status'];
    return params;
  });
  protected readonly data = linkedSignal<
    PageResponseSyncRunResponse | undefined,
    PageResponseSyncRunResponse | undefined
  >({
    source: () => (this.runs.hasValue() ? this.runs.value() : undefined),
    computation: (value, previous) => value ?? previous?.value,
  });
  protected readonly error = computed(() => {
    const error = this.runs.error();
    return error ? describeError(error) : null;
  });

  protected readonly kindLabels = KIND_LABELS;
  protected readonly label = label;
  protected readonly runOutcome = runOutcome;
  protected readonly duration = duration;
  private readonly timeZone = localTimeZone();

  protected when(instant: string): string {
    return formatInstant(instant, this.timeZone);
  }

  protected shorten(error: string): string {
    return error.length > 80 ? `${error.slice(0, 80)}…` : error;
  }

  protected setFilter(filter: typeof this.kind, value: string): void {
    filter.set(value);
    this.page.update((page) => ({ ...page, index: 0 }));
  }

  protected paged(event: PageEvent): void {
    this.page.set({ index: event.pageIndex, size: event.pageSize });
  }
}
