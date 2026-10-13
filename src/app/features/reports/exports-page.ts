import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { listReportExports } from '../../api/functions';
import { PageResponseReportExportResponse, ReportExportResponse } from '../../api/models';
import { describeError } from '../../core/http/api-error';
import { apiResource } from '../../core/http/api-resource';
import { formatInstant, formatRange } from '../../shared/format';
import { PAGE_SIZES, parseListState } from '../../shared/list/list-state';
import { localTimeZone } from '../alerts/alert-format';
import { ReportDownloads, ReportFormat, ReportRequest } from './report-downloads';

/** 512 KB, 1.2 MB */
export function fileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '–';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** What an export covered, in words. */
export function exportSubject(row: ReportExportResponse): string {
  if (row.type === 'ENGINEER') return row.engineerName ?? `Engineer ${row.engineerId ?? ''}`.trim();
  return row.team ?? 'All teams';
}

/** The request that makes the same report again, if what it covered still exists. */
export function repeatRequest(row: ReportExportResponse): ReportRequest | null {
  if (row.type === 'ENGINEER') {
    return row.engineerId
      ? { kind: 'engineer', engineerId: row.engineerId, start: row.start, end: row.end }
      : null;
  }
  return { kind: 'analytics', team: row.team ?? null, start: row.start, end: row.end };
}

const EXPORT_LIST = { sortable: ['createdAt'], defaultSort: 'createdAt,desc' };

/**
 * The reports the user downloaded, newest first. Files aren't kept: "Download again" makes the same report
 * from today's data.
 */
@Component({
  selector: 'app-exports-page',
  imports: [MatButtonModule, MatIconModule, MatPaginatorModule, MatTooltipModule, RouterLink],
  templateUrl: './exports-page.html',
})
export class ExportsPage {
  private readonly router = inject(Router);
  private readonly downloads = inject(ReportDownloads);
  private readonly snackBar = inject(MatSnackBar);

  /** Query parameters */
  readonly page = input<string>();
  readonly size = input<string>();

  protected readonly list = computed(() =>
    parseListState({ page: this.page(), size: this.size() }, EXPORT_LIST),
  );
  protected readonly exports = apiResource(listReportExports, () => ({
    page: this.list().page,
    size: this.list().size,
  }));
  protected readonly data = linkedSignal<
    PageResponseReportExportResponse | undefined,
    PageResponseReportExportResponse | undefined
  >({
    source: () => (this.exports.hasValue() ? this.exports.value() : undefined),
    computation: (value, previous) => value ?? previous?.value,
  });
  protected readonly error = computed(() => {
    const error = this.exports.error();
    return error ? describeError(error) : null;
  });
  protected readonly repeating = signal<number | null>(null);

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly fileSize = fileSize;
  protected readonly subject = exportSubject;
  protected readonly repeatRequest = repeatRequest;
  protected readonly formatRange = formatRange;
  private readonly timeZone = localTimeZone();

  protected when(instant: string): string {
    return formatInstant(instant, this.timeZone);
  }

  protected took(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return '–';
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
  }

  protected paged(event: PageEvent): void {
    void this.router.navigate([], {
      queryParams: {
        page: event.pageIndex || null,
        size: event.pageSize === 20 ? null : event.pageSize,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected async again(row: ReportExportResponse): Promise<void> {
    const request = repeatRequest(row);
    if (!request) return;
    this.repeating.set(row.id);
    try {
      const fileName = await this.downloads.download(
        request,
        row.format.toLowerCase() as ReportFormat,
      );
      this.snackBar.open(`Downloaded ${fileName}.`, 'OK', { duration: 5000 });
    } catch (error) {
      this.snackBar.open(`Couldn't make the report. ${describeError(error)}`, 'Dismiss');
    } finally {
      this.repeating.set(null);
      this.exports.reload();
    }
  }
}
