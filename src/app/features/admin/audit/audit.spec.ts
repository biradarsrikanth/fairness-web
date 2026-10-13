import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PageTest, pageOf, pageTest, route, text } from '../../../../testing/pages';
import { signIn } from '../../../../testing/session';
import { AuditPage } from './audit-page';
import { actionLabel, detailPairs } from './audit-actions';

describe('audit log', () => {
  let page: PageTest;

  beforeEach(async () => {
    page = await pageTest([route('admin/audit', AuditPage)]);
    await signIn('ADMIN');
  });

  afterEach(() => page.http.verify());

  it('lists entries for the filters in the URL, in words', async () => {
    await page.harness.navigateByUrl(
      '/admin/audit?action=LOGIN_FAILED&start=2026-10-01&end=2026-10-13',
    );
    await page.render();
    const request = page.http.expectOne((r) => r.url === '/api/v1/audit');
    expect(request.request.params.get('action')).toBe('LOGIN_FAILED');
    expect(request.request.params.get('start')).toBe('2026-10-01');
    request.flush(
      pageOf([
        {
          id: 1,
          action: 'LOGIN_FAILED',
          actorEmail: 'meera@example.com',
          userId: 12,
          occurredAt: '2026-10-12T04:30:00Z',
          ip: '10.0.0.4',
          requestId: 'req-9',
          details: { reason: 'INVALID_CREDENTIALS', attempt: 2 },
        },
      ]),
    );
    const element = await page.render();
    const row = text(element.querySelector('tbody tr'));
    expect(row).toContain('Sign-in failed');
    expect(row).toContain('reason: INVALID_CREDENTIALS');
    expect(row).toContain('10.0.0.4');
    expect(element.querySelector('tbody td.warning')).not.toBeNull();

    // Selecting the user shows only their actions
    (element.querySelector('button.link') as HTMLButtonElement).click();
    await page.render();
    expect(TestBed.inject(Router).url).toContain('userId=12');
    page.http
      .expectOne((r) => r.url === '/api/v1/audit' && r.params.get('userId') === '12')
      .flush(pageOf([]));
  });

  it('words every action and flattens details', () => {
    expect(actionLabel('USER_TEAMS_CHANGED')).toBe("Changed a manager's teams");
    expect(detailPairs({ teams: [1, 2], kind: 'ONCALLS' })).toEqual([
      { key: 'teams', value: '[1,2]' },
      { key: 'kind', value: 'ONCALLS' },
    ]);
    expect(detailPairs(null)).toEqual([]);
  });
});
