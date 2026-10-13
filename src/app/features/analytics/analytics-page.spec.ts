import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ChartStub, snapshot } from '../../../testing/analytics';
import { settle, signIn } from '../../../testing/session';
import { provideApiConfiguration } from '../../api/api-configuration';
import { Role } from '../../core/auth/auth';
import { authInterceptor } from '../../core/auth/auth-interceptor';
import { AnalyticsPage } from './analytics-page';
import { Chart } from './charts/chart';
import { FilterBar } from './filter-bar';

describe('AnalyticsPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'analytics', component: AnalyticsPage }],
          withComponentInputBinding(),
        ),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
      ],
    });
    TestBed.overrideComponent(AnalyticsPage, {
      remove: { imports: [Chart] },
      add: { imports: [ChartStub] },
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  async function open(url: string, role: Role = 'MANAGER'): Promise<HTMLElement> {
    await signIn(role);
    await harness.navigateByUrl(url);
    return harness.routeNativeElement!;
  }

  function snapshotRequest() {
    return http.expectOne((request) => request.url === '/api/v1/analytics/snapshot');
  }

  async function render(): Promise<void> {
    await settle();
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  /** Lets a request start; whenStable() would wait for its answer. */
  async function tick(): Promise<void> {
    await settle();
    harness.detectChanges();
    await settle();
  }

  function text(element: Element): string {
    return element.textContent!.replace(/\s+/g, ' ');
  }

  it('loads the filter from the URL and shows the figures', async () => {
    const page = await open('/analytics?team=SRE&start=2026-09-14&end=2026-10-13&granularity=week');
    const request = snapshotRequest();
    expect(request.request.params.keys().sort()).toEqual(['end', 'granularity', 'start', 'team']);
    expect(request.request.params.get('team')).toBe('SRE');
    request.flush(snapshot());
    await render();

    expect(text(page)).toContain(`14 ${formatSep()} – 13 Oct 2026`);
    const tiles = Array.from(page.querySelectorAll('app-kpi-tiles li')).map((tile) => ({
      label: text(tile.querySelector('.label')!),
      value: text(tile.querySelector('.value')!),
      change: tile.querySelector('.change') ? text(tile.querySelector('.change')!) : null,
    }));
    expect(tiles[0]).toEqual({
      label: 'Alerts',
      value: '20',
      change: expect.stringContaining('+25%'),
    });
    expect(tiles.find((t) => t.label === 'Fairness (Gini)')?.value).toBe('0.31');
    expect(page.querySelectorAll('app-burnout-table tr[mat-row]').length).toBe(2);
    expect(text(page.querySelector('app-top-services')!)).toContain('payments-api');
  });

  it('leaves the defaults to the gateway', async () => {
    await open('/analytics');
    expect(snapshotRequest().request.params.keys()).toEqual([]);
  });

  it('ignores filter values it cannot use', async () => {
    await open('/analytics?start=2026-13-01&end=2026-10-01&granularity=hourly');
    expect(snapshotRequest().request.params.keys()).toEqual([]);
  });

  it('explains missing scores', async () => {
    const page = await open('/analytics');
    snapshotRequest().flush(
      snapshot({
        summary: {
          ...snapshot().summary,
          gini: null,
          fairnessLabel: null,
          highRiskEngineers: null,
          scores: { available: false, reason: 'SEVERAL_TEAMS' },
        },
        trend: {
          ...snapshot().trend,
          periods: [],
          scores: { available: false, reason: 'SEVERAL_TEAMS' },
        },
        loadShare: [],
        burnout: [],
      }),
    );
    await render();
    expect(text(page.querySelector('.notice')!)).toContain('Pick a team to see them');
    expect(text(page)).toContain('Pick one team to see scores');
  });

  it('shows an error with a way to try again', async () => {
    const page = await open('/analytics');
    snapshotRequest().flush(
      { code: 'INTERNAL_ERROR', detail: 'Boom', requestId: 'req-1' },
      { status: 500, statusText: 'Server Error' },
    );
    await render();
    const problem = page.querySelector('.problem')!;
    expect(text(problem)).toContain('reference req-1');
    (problem.querySelector('button') as HTMLButtonElement).click();
    await tick();
    snapshotRequest().flush(snapshot());
    await render();
    expect(page.querySelector('.problem')).toBeNull();
    expect(page.querySelector('app-kpi-tiles')).not.toBeNull();
  });

  it('puts a filter change in the URL and loads it, keeping the old figures until then', async () => {
    const page = await open('/analytics');
    snapshotRequest().flush(snapshot());
    await render();

    const filterBar = harness.fixture.debugElement.query(
      (element) => element.componentInstance instanceof FilterBar,
    );
    filterBar.componentInstance.changed.emit({
      team: 'SRE',
      start: '2026-09-01',
      end: '2026-09-30',
      granularity: 'day',
    });
    await tick();

    expect(TestBed.inject(Router).url).toBe(
      '/analytics?team=SRE&start=2026-09-01&end=2026-09-30&granularity=day',
    );
    const request = snapshotRequest();
    expect(request.request.params.get('granularity')).toBe('day');
    expect(page.querySelector('.content.stale')).not.toBeNull();
    request.flush(snapshot());
    await render();
    expect(page.querySelector('.content.stale')).toBeNull();
  });

  it("shows an engineer their own share instead of everyone's", async () => {
    const page = await open('/analytics', 'ENGINEER');
    snapshotRequest().flush(snapshot({ loadShare: [snapshot().loadShare[0]] }));
    await render();
    expect(text(page)).toContain('Your share of the load');
    expect(text(page)).toContain('60%');
    expect(text(page)).not.toContain("Each engineer's share");
  });
});

/** How this runtime's ICU abbreviates September in en-GB ("Sep" or "Sept"). */
function formatSep(): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(
    new Date('2026-09-01T00:00:00Z'),
  );
}
