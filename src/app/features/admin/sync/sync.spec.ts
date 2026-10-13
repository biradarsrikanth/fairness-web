import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageTest, pageOf, pageTest, route, text } from '../../../../testing/pages';
import { settle, signIn } from '../../../../testing/session';
import { SyncRunResponse, SyncStatusResponse } from '../../../api/models';
import { SyncPage } from './sync-page';
import { ago, duration, runOutcome } from './sync-format';

const failedRun: SyncRunResponse = {
  id: 41,
  kind: 'INCIDENTS',
  trigger: 'SCHEDULED',
  status: 'FAILED',
  startedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: 1250,
  createdCount: null,
  updatedCount: null,
  error: 'PagerDuty answered 401',
};
const goodRun: SyncRunResponse = {
  ...failedRun,
  id: 40,
  status: 'SUCCEEDED',
  error: null,
  createdCount: 3,
  updatedCount: 1,
  startedAt: '2026-10-13T08:00:00Z',
};

function status(overrides: Partial<SyncStatusResponse> = {}): SyncStatusResponse {
  return {
    scheduled: true,
    intervalSeconds: 3000,
    incidents: { running: false, lastRun: failedRun, lastSuccess: goodRun },
    oncalls: { running: false, lastRun: null, lastSuccess: null },
    ...overrides,
  };
}

describe('sync formatting', () => {
  it('says how long ago and how long', () => {
    const now = Date.parse('2026-10-13T12:00:00Z');
    expect(ago('2026-10-13T11:59:30Z', now)).toBe('just now');
    expect(ago('2026-10-13T11:56:00Z', now)).toBe('4 minutes ago');
    expect(ago('2026-10-12T11:00:00Z', now)).toBe('1 day ago');
    expect(duration(850)).toBe('850 ms');
    expect(duration(12_400)).toBe('12.4 s');
    expect(duration(185_000)).toBe('3 min 5 s');
  });

  it('describes what a run changed', () => {
    expect(runOutcome(goodRun)).toBe('3 new, 1 updated');
    expect(runOutcome({ ...goodRun, createdCount: 0, updatedCount: 0 })).toBe('No changes');
    expect(runOutcome({ ...goodRun, kind: 'ONCALLS', createdCount: 1 })).toBe('1 shift stored');
  });
});

describe('SyncPage', () => {
  let page: PageTest;

  beforeEach(async () => {
    page = await pageTest([route('admin/sync', SyncPage)]);
    await signIn('ADMIN');
  });

  afterEach(() => page.http.verify());

  async function open(current = status()): Promise<HTMLElement> {
    await page.harness.navigateByUrl('/admin/sync');
    await page.render();
    page.http.expectOne('/api/v1/pagerduty/sync-status').flush(current);
    page.http
      .expectOne((r) => r.url === '/api/v1/pagerduty/sync-runs')
      .flush(pageOf([failedRun, goodRun]));
    page.http
      .expectOne((r) => r.url === '/api/v1/pagerduty/webhook-events')
      .flush(
        pageOf([
          {
            id: 7,
            pagerdutyEventId: 'EV1',
            eventType: 'incident.triggered',
            incidentId: 'Q1',
            status: 'FAILED',
            receivedAt: '2026-10-13T08:00:00Z',
            error: 'No engineer for PagerDuty user PX',
          },
        ]),
      );
    return page.render();
  }

  it('shows how each kind of sync is doing', async () => {
    const element = await open();
    expect(text(element.querySelector('.page-bar'))).toContain('Scheduled every 50 minutes');
    const [incidents, oncalls] = Array.from(element.querySelectorAll('.kind')).map(text);
    expect(incidents).toContain('Failed 4 minutes ago');
    expect(incidents).toContain('PagerDuty answered 401');
    expect(incidents).toContain('Last success');
    expect(oncalls).toContain('Never synced yet.');
    expect(text(element.querySelector('app-webhook-events-table'))).toContain('Replay');
  });

  it('explains that a sync is already running when the gateway says so', async () => {
    await open();
    const snackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    const component = page.harness.routeDebugElement!.componentInstance as {
      sync(kind: 'INCIDENTS' | 'ONCALLS'): Promise<void>;
    };
    const syncing = component.sync('ONCALLS');
    await settle();
    const request = page.http.expectOne((r) => r.url === '/api/v1/pagerduty/sync/oncalls');
    expect(request.request.method).toBe('POST');
    expect(request.request.params.get('days')).toBe('7');
    request.flush({ code: 'SYNC_IN_PROGRESS' }, { status: 409, statusText: 'Conflict' });
    await syncing;
    expect(snackBar).toHaveBeenCalledWith(
      'A sync of this kind is already running. Its result shows here when it finishes.',
      'Dismiss',
    );
    // The status and the runs reload
    await new Promise((resolve) => setTimeout(resolve, 600));
    await page.render();
    page.http.match('/api/v1/pagerduty/sync-status').forEach((r) => r.flush(status()));
    page.http.expectOne((r) => r.url === '/api/v1/pagerduty/sync-runs').flush(pageOf([]));
  });

  it('replays a failed webhook', async () => {
    await open();
    const snackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    const replay = Array.from(page.harness.routeNativeElement!.querySelectorAll('button')).find(
      (button) => text(button) === 'Replay',
    )!;
    replay.click();
    await settle();
    page.http
      .expectOne({ method: 'POST', url: '/api/v1/pagerduty/webhook-events/7/replay' })
      .flush({
        id: 7,
        pagerdutyEventId: 'EV1',
        eventType: 'incident.triggered',
        status: 'PROCESSED',
        receivedAt: '2026-10-13T08:00:00Z',
        payload: {},
      });
    await settle();
    expect(snackBar).toHaveBeenCalledWith('Replayed incident.triggered. Applied.', 'OK', {
      duration: 8000,
    });
    await page.render();
    page.http.expectOne((r) => r.url === '/api/v1/pagerduty/webhook-events').flush(pageOf([]));
  });
});
