import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ChartStub, engineerReport } from '../../../testing/analytics';
import { settle, signIn } from '../../../testing/session';
import { provideApiConfiguration } from '../../api/api-configuration';
import { authInterceptor } from '../../core/auth/auth-interceptor';
import { Chart } from './charts/chart';
import { EngineerPage } from './engineer-page';

describe('EngineerPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'analytics/engineers/:engineerId', component: EngineerPage }],
          withComponentInputBinding(),
        ),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
      ],
    });
    TestBed.overrideComponent(EngineerPage, {
      remove: { imports: [Chart] },
      add: { imports: [ChartStub] },
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await signIn('MANAGER');
  });

  afterEach(() => http.verify());

  async function render(): Promise<HTMLElement> {
    await settle();
    harness.detectChanges();
    await settle();
    return harness.routeNativeElement!;
  }

  function text(element: Element): string {
    return element.textContent!.replace(/\s+/g, ' ');
  }

  it("loads the engineer's scores, then their alerts in the same window", async () => {
    await harness.navigateByUrl('/analytics/engineers/3?team=SRE&start=2026-09-14&end=2026-10-13');
    const scores = http.expectOne((r) => r.url === '/api/v1/scores/engineers/3');
    expect(scores.request.params.get('start')).toBe('2026-09-14');
    // The team doesn't narrow one engineer's scores
    expect(scores.request.params.has('team')).toBe(false);
    scores.flush(engineerReport());
    await render();

    const alerts = http.expectOne((r) => r.url === '/api/v1/alerts');
    expect(alerts.request.params.get('engineerId')).toBe('3');
    expect(alerts.request.params.get('end')).toBe('2026-10-13');
    alerts.flush({
      content: [
        {
          id: 9,
          title: 'Disk full on db-1',
          serviceName: 'postgres',
          severity: 'P2',
          status: 'resolved',
          triggeredAt: '2026-10-10T18:00:00Z',
        },
      ],
      page: 0,
      size: 10,
      totalElements: 14,
      totalPages: 2,
    });
    const page = await render();

    expect(text(page.querySelector('h1')!)).toBe('Asha Rao');
    expect(TestBed.inject(Title).getTitle()).toBe('Asha Rao · Fairness');
    expect(text(page.querySelector('.stats')!)).toContain('64');
    expect(text(page.querySelector('app-risk-badge')!)).toContain('High');
    // 50 × 0.7 = 35 points of exposure
    expect(text(page.querySelector('.parts')!)).toContain('35 / 50');
    const row = text(page.querySelector('tbody tr')!);
    expect(row).toContain('10 Oct 2026, 23:30');
    expect(row).toContain('Disk full on db-1');
    expect(text(page)).toContain('1 of 14 alerts');
  });

  it('keeps the filter on the way back to analytics', async () => {
    await harness.navigateByUrl('/analytics/engineers/3?team=SRE&granularity=week');
    http.expectOne((r) => r.url === '/api/v1/scores/engineers/3').flush(engineerReport());
    const page = await render();
    http
      .expectOne((r) => r.url === '/api/v1/alerts')
      .flush({
        content: [],
        page: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
      });
    const back = page.querySelector('a.back') as HTMLAnchorElement;
    expect(back.getAttribute('href')).toBe('/analytics?team=SRE&granularity=week');
  });

  it("says so when the engineer isn't the user's to see", async () => {
    await harness.navigateByUrl('/analytics/engineers/42');
    http
      .expectOne((r) => r.url === '/api/v1/scores/engineers/42')
      .flush({ code: 'FORBIDDEN', detail: 'No' }, { status: 403, statusText: 'Forbidden' });
    const page = await render();
    expect(text(page.querySelector('.problem')!)).toContain(
      "You don't have access to this engineer.",
    );
  });
});
