import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { PageTest, pageOf, pageTest, route, text } from '../../../testing/pages';
import { signIn } from '../../../testing/session';
import { AlertResponse } from '../../api/models';
import { Role } from '../../core/auth/auth';
import { alertApiParams, parseAlertFilter } from './alert-filter';
import { AlertPage } from './alert-page';
import { AlertsPage } from './alerts-page';

const alert: AlertResponse = {
  id: 9,
  title: 'payments-api: error rate high',
  serviceName: 'payments-api',
  engineerId: 3,
  engineerName: 'Asha Rao',
  team: 'SRE',
  severity: 'P2',
  status: 'resolved',
  urgency: 'high',
  source: 'API_SYNC',
  incidentNumber: 812,
  pagerDutyIncidentId: 'Q1ABC',
  triggeredAt: '2026-10-10T18:00:00Z',
  acknowledgedAt: '2026-10-10T18:04:00Z',
  resolvedAt: '2026-10-10T19:30:00Z',
};

describe('alert filter', () => {
  it('keeps what the gateway accepts and drops the rest', () => {
    const filter = parseAlertFilter({
      severity: 'P9',
      status: 'resolved',
      start: '2026-10-01',
      end: '2026-09-01',
      engineerId: 'abc',
      team: 'SRE',
    });
    expect(filter).toEqual({
      team: 'SRE',
      severity: null,
      status: 'resolved',
      start: null,
      end: null,
      engineerId: null,
      q: null,
    });
    expect(alertApiParams(filter)).toEqual({ team: 'SRE', status: 'resolved' });
  });

  it('trims the search, caps it at the 100 characters the gateway takes, and sends it', () => {
    const filter = parseAlertFilter({ q: `  ${'x'.repeat(120)}  ` });
    expect(filter.q).toHaveLength(100);
    expect(alertApiParams(parseAlertFilter({ q: ' disk full ' }))).toEqual({ q: 'disk full' });
    expect(parseAlertFilter({ q: '   ' }).q).toBeNull();
  });
});

describe('AlertsPage', () => {
  let page: PageTest;

  beforeEach(async () => {
    page = await pageTest([route('alerts', AlertsPage), route('alerts/:id', AlertPage)]);
  });

  afterEach(() => page.http.verify());

  it('lists the alerts the URL asks for', async () => {
    await signIn('MANAGER');
    await page.harness.navigateByUrl('/alerts?severity=P2&engineerId=3&page=1&sort=severity,asc');
    const request = page.http.expectOne((r) => r.url === '/api/v1/alerts');
    expect(request.request.params.get('severity')).toBe('P2');
    expect(request.request.params.get('engineerId')).toBe('3');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.getAll('sort')).toEqual(['severity,asc']);
    request.flush(pageOf([alert], 21, 1));
    const element = await page.render();

    const row = text(element.querySelector('tr[mat-row]'));
    expect(row).toContain('payments-api: error rate high');
    expect(row).toContain('Asha Rao');
    expect(row).toContain('4 min');
    expect(row).toContain('1 h 30 min');
    // The engineer filter shows as a removable chip with their name
    expect(text(element.querySelector('mat-chip'))).toContain('Asha Rao');
  });

  it('puts a filter in the URL and starts again from the first page', async () => {
    await signIn('MANAGER');
    await page.harness.navigateByUrl('/alerts?page=3');
    page.http.expectOne((r) => r.url === '/api/v1/alerts').flush(pageOf([alert], 100, 3));
    await page.render();

    const component = page.harness.routeDebugElement!.componentInstance as {
      setFilter(key: string, value: string): void;
    };
    component.setFilter('status', 'triggered');
    await page.render();
    expect(TestBed.inject(Router).url).toBe('/alerts?status=triggered');
    page.http.expectOne((r) => r.url === '/api/v1/alerts').flush(pageOf([]));
    const element = await page.render();
    expect(text(element)).toContain('No alerts match these filters.');
  });

  it('shows an error with a way to try again', async () => {
    await signIn('MANAGER');
    await page.harness.navigateByUrl('/alerts');
    page.http
      .expectOne((r) => r.url === '/api/v1/alerts')
      .flush({ code: 'INTERNAL_ERROR', requestId: 'r-7' }, { status: 500, statusText: 'Error' });
    const element = await page.render();
    expect(text(element.querySelector('.page-problem'))).toContain('reference r-7');
    (element.querySelector('.page-problem button') as HTMLButtonElement).click();
    await page.render();
    page.http.expectOne((r) => r.url === '/api/v1/alerts').flush(pageOf([alert]));
    await page.render();
    expect(element.querySelector('.page-problem')).toBeNull();
  });
});

describe('AlertPage', () => {
  let page: PageTest;

  beforeEach(async () => {
    page = await pageTest([route('alerts', AlertsPage), route('alerts/:id', AlertPage)]);
  });

  afterEach(() => page.http.verify());

  async function open(role: Role): Promise<HTMLElement> {
    await signIn(role);
    await page.harness.navigateByUrl('/alerts/9');
    page.http.expectOne('/api/v1/alerts/9').flush(alert);
    page.http.expectOne('/api/v1/alerts/9/assignments').flush([
      {
        kind: 'PAGED',
        engineerId: 4,
        engineerName: 'Ravi Kumar',
        pagerDutyUserId: 'PU1',
        assignedAt: '2026-10-10T18:00:00Z',
        source: 'LOG',
      },
      {
        kind: 'ESCALATED',
        engineerId: null,
        engineerName: null,
        pagerDutyUserId: 'PXYZ',
        assignedAt: '2026-10-10T18:15:00Z',
        source: 'WEBHOOK',
      },
    ]);
    return page.render();
  }

  it('shows the alert and who was paged, in order', async () => {
    const element = await open('ENGINEER');
    expect(text(element.querySelector('h1'))).toBe('payments-api: error rate high');
    expect(text(element.querySelector('.facts'))).toContain('(4 min later)');
    const steps = Array.from(element.querySelectorAll('.timeline li')).map(text);
    expect(steps[0]).toContain('Paged Ravi Kumar');
    expect(steps[0]).toContain('PagerDuty log');
    expect(steps[1]).toContain('Escalated to PagerDuty user PXYZ');
    expect(steps[1]).toContain('15 min after it fired');
    // Only admins delete alerts
    expect(text(element)).not.toContain('Delete');
  });

  it('lets an admin delete it after confirming', async () => {
    const element = await open('ADMIN');
    vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as never);
    const button = Array.from(element.querySelectorAll('button')).find((b) =>
      text(b).includes('Delete'),
    )!;
    button.click();
    await page.render();
    const request = page.http.expectOne('/api/v1/alerts/9');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await page.render();
    expect(TestBed.inject(Router).url).toBe('/alerts');
    page.http.expectOne((r) => r.url === '/api/v1/alerts').flush(pageOf([]));
  });

  it('says so when the alert is not there', async () => {
    await signIn('MANAGER');
    await page.harness.navigateByUrl('/alerts/77');
    page.http
      .expectOne('/api/v1/alerts/77')
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    page.http.expectOne('/api/v1/alerts/77/assignments').flush([]);
    const element = await page.render();
    expect(text(element.querySelector('.page-problem'))).toContain('There is no such alert.');
  });
});
