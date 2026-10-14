import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { signIn } from '../../../testing/session';
import { provideApiConfiguration } from '../../api/api-configuration';
import { Summary, SyncStatusResponse } from '../../api/models';
import { Role } from '../auth/auth';
import { authInterceptor } from '../auth/auth-interceptor';
import { telemetryInterceptor } from '../http/telemetry';
import { Shell } from './shell';

const SUMMARY_URL = (url: string) => url.startsWith('/api/v1/analytics/summary');
const SYNC_URL = '/api/v1/pagerduty/sync-status';

function summary(overrides: Partial<Summary> = {}): Summary {
  return {
    window: { start: '2026-09-15', end: '2026-10-14', timezone: 'UTC' },
    previousWindow: { start: '2026-08-16', end: '2026-09-14', timezone: 'UTC' },
    alerts: { value: 6538, previous: 375, changePct: 1643 },
    mttaMinutes: { value: 24 },
    mttrMinutes: { value: 4620 },
    afterHoursPct: { value: 22 },
    escalationRatePct: { value: 13 },
    scores: { available: false, reason: 'SEVERAL_TEAMS' },
    ...overrides,
  } as Summary;
}

describe('Shell', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, telemetryInterceptor])),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function render(
    role: Role,
    answer: Summary | null = summary(),
    oncalls: SyncStatusResponse['oncalls'] = { running: false },
  ) {
    await signIn(role);
    const fixture = TestBed.createComponent(Shell);
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne((req) => SUMMARY_URL(req.url));
    if (answer) request.flush(answer);
    else request.flush({}, { status: 503, statusText: 'Unavailable' });
    if (role === 'ADMIN') {
      http.expectOne(SYNC_URL).flush({
        scheduled: true,
        intervalSeconds: 900,
        incidents: {
          running: false,
          lastSuccess: {
            id: 1,
            kind: 'INCIDENTS',
            status: 'SUCCEEDED',
            trigger: 'SCHEDULED',
            startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
            // Half a minute of slack: the shell's clock was read a moment before this
            finishedAt: new Date(Date.now() - 4.5 * 60_000).toISOString(),
          },
        },
        oncalls,
      } satisfies SyncStatusResponse);
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  async function menuFor(role: Role): Promise<string[]> {
    const { element } = await render(role);
    return Array.from(element.querySelectorAll('nav .nav-label')).map((label) =>
      label.textContent!.trim(),
    );
  }

  it('shows an engineer the shared pages only', async () => {
    expect(await menuFor('ENGINEER')).toEqual(['Analytics', 'Alerts', 'On-call', 'My reports']);
  });

  it('adds engineers and teams for a manager', async () => {
    expect(await menuFor('MANAGER')).toEqual([
      'Analytics',
      'Alerts',
      'On-call',
      'My reports',
      'Engineers',
      'Teams',
    ]);
  });

  it('shows an admin everything, grouped', async () => {
    const { element } = await render('ADMIN');
    expect(
      Array.from(element.querySelectorAll('.nav-group')).map((g) => g.textContent!.trim()),
    ).toEqual(['Monitor', 'People', 'Admin']);
    expect(element.querySelectorAll('nav .nav-label').length).toBe(9);
  });

  it('names the signed-in user', async () => {
    const { element } = await render('MANAGER');
    expect(element.querySelector('.user-name')?.textContent).toBe('Test manager');
    expect(element.querySelector('.avatar')?.textContent).toBe('TM');
  });

  it('puts the last 30 days in the ticker', async () => {
    const { element } = await render('MANAGER');
    const ticks = Array.from(element.querySelectorAll('.tick')).map((t) =>
      t.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(ticks).toContain('Alerts 6,538');
    expect(ticks).toContain('After hours 22%');
    // No team picked, so no Gini
    expect(ticks.some((t) => t.startsWith('Gini'))).toBe(false);
  });

  it('flags a critical Gini in the ticker', async () => {
    const { element } = await render(
      'ENGINEER',
      summary({ scores: { available: true }, gini: { value: 0.81 }, fairnessLabel: 'CRITICAL' }),
    );
    const gini = Array.from(element.querySelectorAll('.tick')).find((t) =>
      t.textContent!.includes('Gini'),
    );
    expect(gini?.classList).toContain('crit');
    expect(gini?.textContent).toContain('0.81 critical');
  });

  it('asks for the PagerDuty sync status only for administrators', async () => {
    const { element } = await render('ADMIN');
    expect(element.querySelector('.statusbar')?.textContent).toContain('4 min ago · every 15 min');
  });

  it('warns when the latest PagerDuty sync failed', async () => {
    const { element } = await render('ADMIN', summary(), {
      running: false,
      lastRun: {
        id: 2,
        kind: 'ONCALLS',
        status: 'FAILED',
        trigger: 'SCHEDULED',
        startedAt: new Date().toISOString(),
      },
    });
    expect(element.querySelector('.sync.failing')?.textContent).toContain('PagerDuty sync failing');
    expect(element.querySelector('.statusbar')?.textContent).toContain(
      'failing, last success 4 min ago',
    );
  });

  it('reports a server that stops answering', async () => {
    const { element } = await render('MANAGER', null);
    expect(element.querySelector('.conn')?.textContent?.trim()).toBe('Server not answering');
    expect(element.querySelector('.ticker')).toBeNull();
  });

  it('opens the jump menu with Ctrl K, once', async () => {
    const { fixture } = await render('ENGINEER');
    const dialog = TestBed.inject(MatDialog);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    await fixture.whenStable();
    expect(dialog.openDialogs.length).toBe(1);
    dialog.closeAll();
  });
});
