import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageTest, pageOf, pageTest, route, text } from '../../../testing/pages';
import { settle, signIn } from '../../../testing/session';
import { ReportExportResponse } from '../../api/models';
import { describeError } from '../../core/http/api-error';
import { ExportsPage, exportSubject, fileSize, repeatRequest } from './exports-page';
import { ReportDownloads, fileNameFrom, readableError } from './report-downloads';

const PDF_NAME = 'fairness-analytics-sre-2026-09-01-to-2026-09-30.pdf';

describe('report downloads', () => {
  let page: PageTest;

  beforeEach(async () => {
    page = await pageTest([route('reports', ExportsPage)]);
    await signIn('MANAGER');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    page.http.verify();
    vi.restoreAllMocks();
  });

  it('reads the file name the gateway gives', () => {
    expect(fileNameFrom(`attachment; filename="${PDF_NAME}"`)).toBe(PDF_NAME);
    expect(fileNameFrom(null)).toBeNull();
  });

  it('asks for the file the page shows and saves it under its name', async () => {
    const clicked = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const downloading = TestBed.inject(ReportDownloads).download(
      { kind: 'analytics', team: 'SRE', start: '2026-09-01', end: '2026-09-30' },
      'pdf',
    );
    await settle();
    const request = page.http.expectOne((r) => r.url === '/api/v1/reports/analytics');
    expect(request.request.params.get('format')).toBe('pdf');
    expect(request.request.params.get('team')).toBe('SRE');
    expect(request.request.params.get('end')).toBe('2026-09-30');
    expect(request.request.headers.get('Accept')).toBe('application/pdf');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['%PDF']), {
      headers: { 'Content-Disposition': `attachment; filename="${PDF_NAME}"` },
    });
    expect(await downloading).toBe(PDF_NAME);
    expect(clicked).toHaveBeenCalled();
  });

  it("turns a failed download's Blob body back into problem details", async () => {
    const problem = { code: 'VALIDATION_FAILED', detail: 'a report covers at most 366 days' };
    const error = new HttpErrorResponse({
      status: 400,
      error: new Blob([JSON.stringify(problem)], { type: 'application/problem+json' }),
    });
    expect(describeError(await readableError(error))).toBe('a report covers at most 366 days');
  });

  it("asks for one engineer's workbook", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const downloading = TestBed.inject(ReportDownloads).download(
      { kind: 'engineer', engineerId: 3, start: '2026-09-01', end: '2026-09-30' },
      'xlsx',
    );
    await settle();
    const request = page.http.expectOne((r) => r.url === '/api/v1/reports/engineers/3');
    expect(request.request.params.get('format')).toBe('xlsx');
    expect(request.request.params.has('team')).toBe(false);
    request.flush(new Blob(['PK']), {
      headers: { 'Content-Disposition': 'attachment; filename="asha.xlsx"' },
    });
    expect(await downloading).toBe('asha.xlsx');
  });

  describe('my reports', () => {
    const analytics: ReportExportResponse = {
      id: 2,
      type: 'ANALYTICS',
      format: 'PDF',
      team: null,
      start: '2026-09-01',
      end: '2026-09-30',
      status: 'SUCCEEDED',
      fileName: PDF_NAME,
      sizeBytes: 1_250_000,
      durationMs: 1840,
      createdAt: '2026-10-13T18:00:00Z',
    };
    const failed: ReportExportResponse = {
      ...analytics,
      id: 1,
      type: 'ENGINEER',
      format: 'XLSX',
      engineerId: 3,
      engineerName: 'Asha Rao',
      status: 'FAILED',
      error: 'ScoringServiceException: Scorer unavailable',
      sizeBytes: null,
    };

    it('describes each export', () => {
      expect(exportSubject(analytics)).toBe('All teams');
      expect(exportSubject(failed)).toBe('Asha Rao');
      expect(fileSize(1_250_000)).toBe('1.2 MB');
      expect(fileSize(2048)).toBe('2 KB');
      expect(repeatRequest(failed)).toEqual({
        kind: 'engineer',
        engineerId: 3,
        start: '2026-09-01',
        end: '2026-09-30',
      });
      // The engineer was deleted: nothing to make again
      expect(repeatRequest({ ...failed, engineerId: null })).toBeNull();
    });

    it('lists my reports and makes one again', async () => {
      await page.harness.navigateByUrl('/reports');
      await page.render();
      page.http
        .expectOne((r) => r.url === '/api/v1/reports/exports')
        .flush(pageOf([analytics, failed]));
      const element = await page.render();
      const rows = Array.from(element.querySelectorAll('tbody tr')).map(text);
      expect(rows[0]).toContain('Analytics · All teams');
      expect(rows[0]).toContain('Downloaded');
      expect(rows[0]).toContain('1.2 MB');
      expect(rows[1]).toContain('Engineer · Asha Rao');
      expect(rows[1]).toContain('Failed');

      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      const snackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
      (element.querySelector('tbody tr button') as HTMLButtonElement).click();
      await settle();
      const request = page.http.expectOne((r) => r.url === '/api/v1/reports/analytics');
      expect(request.request.params.get('format')).toBe('pdf');
      expect(request.request.params.has('team')).toBe(false);
      request.flush(new Blob(['%PDF']), {
        headers: { 'Content-Disposition': `attachment; filename="${PDF_NAME}"` },
      });
      await settle();
      expect(snackBar).toHaveBeenCalledWith(`Downloaded ${PDF_NAME}.`, 'OK', { duration: 5000 });
      await page.render();
      page.http
        .expectOne((r) => r.url === '/api/v1/reports/exports')
        .flush(pageOf([analytics, failed]));
    });
  });
});
