import { HttpErrorResponse } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Api } from '../../api/api';
import {
  downloadAnalyticsReport$Pdf,
  downloadAnalyticsReport$VndOpenxmlformatsOfficedocumentSpreadsheetmlSheet as downloadAnalyticsReport$Xlsx,
  downloadEngineerReport$Pdf,
  downloadEngineerReport$VndOpenxmlformatsOfficedocumentSpreadsheetmlSheet as downloadEngineerReport$Xlsx,
} from '../../api/functions';
import { StrictHttpResponse } from '../../api/strict-http-response';
import { handlesErrors } from '../../core/http/api-error';

export type ReportFormat = 'pdf' | 'xlsx';

/** The gateway's default REPORT_MAX_WINDOW_DAYS; it says so itself if it's set lower. */
export const MAX_REPORT_DAYS = 366;

/** What a report covers: the analytics page for a team (or all), or one engineer, over inclusive days. */
export type ReportRequest =
  | {
      readonly kind: 'analytics';
      readonly team?: string | null;
      readonly start?: string | null;
      readonly end?: string | null;
    }
  | {
      readonly kind: 'engineer';
      readonly engineerId: number;
      readonly start?: string | null;
      readonly end?: string | null;
    };

/** The file name from a Content-Disposition header (filename="..."), if there is one. */
export function fileNameFrom(header: string | null): string | null {
  const match = header ? /filename="([^"]+)"/.exec(header) : null;
  return match ? match[1] : null;
}

/** Hands a file to the browser to save. */
export function saveFile(content: Blob, fileName: string): void {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before the URL goes
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * A failed file download carries its problem details as a Blob (the request asked for one); this turns it
 * back into the JSON the rest of the app reads.
 */
export async function readableError(error: unknown): Promise<unknown> {
  if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) return error;
  let body: unknown = null;
  try {
    body = JSON.parse(await error.error.text());
  } catch {
    // Not JSON (e.g. a proxy's HTML page): describeError falls back on the status
  }
  return new HttpErrorResponse({
    error: body,
    headers: error.headers,
    status: error.status,
    statusText: error.statusText,
    url: error.url ?? undefined,
  });
}

/** Downloads reports from the gateway and saves them. */
@Service()
export class ReportDownloads {
  private readonly api = inject(Api);

  /** Builds the report on the gateway and saves it; resolves with the file's name. */
  async download(request: ReportRequest, format: ReportFormat): Promise<string> {
    const dates = {
      ...(request.start && { start: request.start }),
      ...(request.end && { end: request.end }),
      format,
    };
    let response: StrictHttpResponse<Blob>;
    try {
      if (request.kind === 'analytics') {
        const params = { ...dates, ...(request.team && { team: request.team }) };
        response = await this.api.invoke$Response(
          format === 'pdf' ? downloadAnalyticsReport$Pdf : downloadAnalyticsReport$Xlsx,
          params,
          handlesErrors(),
        );
      } else {
        const params = { ...dates, engineerId: request.engineerId };
        response = await this.api.invoke$Response(
          format === 'pdf' ? downloadEngineerReport$Pdf : downloadEngineerReport$Xlsx,
          params,
          handlesErrors(),
        );
      }
    } catch (error) {
      throw await readableError(error);
    }
    const fileName =
      fileNameFrom(response.headers.get('Content-Disposition')) ?? `fairness-report.${format}`;
    saveFile(response.body, fileName);
    return fileName;
  }
}
