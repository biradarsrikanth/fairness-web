import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { describeError } from '../../core/http/api-error';
import { daysBetween } from '../analytics/analytics-filter';
import { MAX_REPORT_DAYS, ReportDownloads, ReportFormat, ReportRequest } from './report-downloads';

/**
 * "Export" with a PDF and an Excel version of what the page shows. Reports take a few seconds: the button
 * shows it's working, and the result (or why it failed) comes as a snackbar.
 */
@Component({
  selector: 'app-export-menu',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <span [matTooltip]="unavailable() ?? ''" [matTooltipDisabled]="!unavailable()">
      <button
        matButton="outlined"
        type="button"
        [matMenuTriggerFor]="formats"
        [disabled]="busy() !== null || !!unavailable()"
      >
        @if (busy()) {
          <mat-spinner diameter="18" aria-hidden="true" />
          Preparing…
        } @else {
          <mat-icon>download</mat-icon>
          Export
        }
      </button>
    </span>
    <mat-menu #formats="matMenu" xPosition="before">
      <button mat-menu-item type="button" (click)="download('pdf')">
        <mat-icon>picture_as_pdf</mat-icon>
        <span>PDF report</span>
      </button>
      <button mat-menu-item type="button" (click)="download('xlsx')">
        <mat-icon>table_view</mat-icon>
        <span>Excel workbook</span>
      </button>
    </mat-menu>
    <span class="visually-hidden" role="status">{{ busy() ? 'Preparing the report' : '' }}</span>
  `,
  styles: `
    mat-spinner {
      display: inline-block;
      margin-right: 8px;
      vertical-align: middle;
    }
  `,
})
export class ExportMenu {
  private readonly downloads = inject(ReportDownloads);
  private readonly snackBar = inject(MatSnackBar);

  /** What to export; null while the page has nothing loaded */
  readonly request = input<ReportRequest | null>(null);

  protected readonly busy = signal<ReportFormat | null>(null);
  /** Why there's nothing to export, for the tooltip */
  protected readonly unavailable = computed(() => {
    const request = this.request();
    if (!request) return 'Nothing loaded yet';
    if (
      request.start &&
      request.end &&
      daysBetween(request.start, request.end) + 1 > MAX_REPORT_DAYS
    ) {
      return `Reports cover at most ${MAX_REPORT_DAYS} days`;
    }
    return null;
  });

  protected async download(format: ReportFormat): Promise<void> {
    const request = this.request();
    if (!request) return;
    this.busy.set(format);
    try {
      const fileName = await this.downloads.download(request, format);
      this.snackBar.open(`Downloaded ${fileName}.`, 'OK', { duration: 5000 });
    } catch (error) {
      this.snackBar.open(`Couldn't make the report. ${describeError(error)}`, 'Dismiss');
    } finally {
      this.busy.set(null);
    }
  }
}
