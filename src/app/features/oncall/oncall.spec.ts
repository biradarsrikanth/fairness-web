import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PageTest, pageOf, pageTest, route, text } from '../../../testing/pages';
import { signIn } from '../../../testing/session';
import { OncallShiftResponse } from '../../api/models';
import { isCurrent, levelLabel, oncallRange, rangeTooLong, shiftLength } from './oncall-range';
import { OncallPage } from './oncall-page';

describe('on-call range', () => {
  it('defaults to the past week and the next four', () => {
    expect(oncallRange(undefined, undefined, new Date('2026-10-13T20:00:00Z'))).toEqual({
      start: '2026-10-06',
      end: '2026-11-10',
      fromUrl: false,
    });
    expect(oncallRange('2026-01-01', '2026-01-31').fromUrl).toBe(true);
  });

  it('knows the longest range the gateway lists', () => {
    // The gateway allows an end 366 days after the start
    expect(rangeTooLong({ start: '2026-01-01', end: '2027-01-02' })).toBe(false);
    expect(rangeTooLong({ start: '2026-01-01', end: '2027-01-03' })).toBe(true);
  });

  it('describes shifts', () => {
    const shift = { startsAt: '2026-10-12T00:00:00Z', endsAt: '2026-10-19T06:00:00Z' };
    expect(shiftLength(shift)).toBe('7 d 6 h');
    expect(isCurrent(shift, Date.parse('2026-10-13T00:00:00Z'))).toBe(true);
    expect(isCurrent(shift, Date.parse('2026-10-19T06:00:00Z'))).toBe(false);
    expect(levelLabel(1)).toBe('Primary');
    expect(levelLabel(2)).toBe('Level 2');
  });
});

describe('OncallPage', () => {
  let page: PageTest;
  const hour = 3_600_000;
  const current: OncallShiftResponse = {
    id: 1,
    engineerId: 3,
    engineerName: 'Asha Rao',
    team: 'SRE',
    escalationLevel: 1,
    startsAt: new Date(Date.now() - 24 * hour).toISOString(),
    endsAt: new Date(Date.now() + 24 * hour).toISOString(),
  };
  const backup = {
    ...current,
    id: 2,
    engineerId: 4,
    engineerName: 'Ravi Kumar',
    escalationLevel: 2,
  };
  const past = {
    ...current,
    id: 3,
    startsAt: new Date(Date.now() - 200 * hour).toISOString(),
    endsAt: new Date(Date.now() - 30 * hour).toISOString(),
  };

  beforeEach(async () => {
    page = await pageTest([route('oncall', OncallPage)]);
    await signIn('MANAGER');
  });

  afterEach(() => page.http.verify());

  function answerSideRequests(now = [backup, current]): void {
    const request = page.http.expectOne(
      (r) => r.url === '/api/v1/oncall' && r.params.get('size') === '100',
    );
    // From yesterday to tomorrow, so the gateway's time zone can't leave out this instant
    const today = new Date().toISOString().slice(0, 10);
    expect(request.request.params.get('start')! < today).toBe(true);
    expect(request.request.params.get('end')! > today).toBe(true);
    request.flush(pageOf(now));
    page.http.expectOne((r) => r.url === '/api/v1/engineers').flush(pageOf([]));
  }

  it("shows who's on call now and the shifts in the URL's dates", async () => {
    await page.harness.navigateByUrl('/oncall?start=2026-09-01&end=2026-09-30&engineerId=3');
    await page.render();
    const request = page.http.expectOne(
      (r) => r.url === '/api/v1/oncall' && r.params.get('start') === '2026-09-01',
    );
    expect(request.request.params.get('end')).toBe('2026-09-30');
    expect(request.request.params.get('engineerId')).toBe('3');
    request.flush(pageOf([past, current]));
    answerSideRequests();
    const element = await page.render();

    const now = Array.from(element.querySelectorAll('.now li')).map(text);
    expect(now[0]).toContain('Primary Asha Rao');
    expect(now[1]).toContain('Level 2 Ravi Kumar');
    expect(now[0]).not.toContain('SRE');
    const rows = element.querySelectorAll('tr[mat-row]');
    expect(text(rows[1])).toContain('SRE');
    expect(rows[1].classList).toContain('current');
    expect(text(rows[1])).toContain('Now');
    expect(text(rows[1])).toContain('2 d');
  });

  it('names the team of each person on call when there are several', async () => {
    await page.harness.navigateByUrl('/oncall');
    await page.render();
    page.http
      .expectOne((r) => r.url === '/api/v1/oncall' && r.params.get('size') !== '100')
      .flush(pageOf([]));
    answerSideRequests([
      backup,
      current,
      { ...current, id: 9, team: 'Payments', engineerName: 'Li' },
    ]);
    const element = await page.render();

    const now = Array.from(element.querySelectorAll('.now li')).map(text);
    expect(now[0]).toContain('Payments · Primary Li');
    expect(now[1]).toContain('SRE · Primary Asha Rao');
    expect(now[2]).toContain('SRE · Level 2 Ravi Kumar');
  });

  it('refuses ranges longer than the gateway lists, without asking it', async () => {
    await page.harness.navigateByUrl('/oncall?start=2025-01-01&end=2026-06-01');
    await page.render();
    answerSideRequests();
    const element = await page.render();
    expect(text(element.querySelector('.page-problem'))).toContain(
      'at most 366 days after the start',
    );
    page.http.expectNone((r) => r.url === '/api/v1/oncall');
  });

  it('puts a new range in the URL', async () => {
    await page.harness.navigateByUrl('/oncall');
    await page.render();
    page.http
      .expectOne((r) => r.url === '/api/v1/oncall' && r.params.get('size') !== '100')
      .flush(pageOf([]));
    answerSideRequests();
    await page.render();
    const component = page.harness.routeDebugElement!.componentInstance as {
      setRange(range: { start: string; end: string }): void;
    };
    component.setRange({ start: '2026-08-01', end: '2026-08-31' });
    await page.render();
    expect(TestBed.inject(Router).url).toBe('/oncall?start=2026-08-01&end=2026-08-31');
    page.http
      .expectOne((r) => r.url === '/api/v1/oncall' && r.params.get('start') === '2026-08-01')
      .flush(pageOf([]));
    page.http.match((r) => r.url === '/api/v1/oncall');
  });
});

describe('on-call engineer filter across several teams', () => {
  let page: PageTest;

  beforeEach(async () => {
    page = await pageTest([route('oncall', OncallPage)]);
    await signIn('ADMIN', {
      user: {
        teams: [
          { id: 1, name: 'SRE' },
          { id: 2, name: 'Platform' },
        ],
      },
    });
  });

  afterEach(() => page.http.verify());

  function answerShifts(): void {
    page.http.match((r) => r.url === '/api/v1/oncall').forEach((r) => r.flush(pageOf([])));
  }

  it('lists no engineers until a team is picked', async () => {
    await page.harness.navigateByUrl('/oncall');
    await page.render();
    answerShifts();
    await page.render();
    page.http.expectNone((r) => r.url.startsWith('/api/v1/engineers'));
  });

  it("shows a linked engineer's team, and lists only that team", async () => {
    await page.harness.navigateByUrl('/oncall?engineerId=4');
    await page.render();
    answerShifts();
    page.http
      .expectOne('/api/v1/engineers/4')
      .flush({ id: 4, name: 'Ravi Kumar', team: 'Platform', email: 'r@example.com', active: true });
    await page.render();
    const list = page.http.expectOne((r) => r.url === '/api/v1/engineers');
    expect(list.request.params.get('team')).toBe('Platform');
    list.flush(pageOf([]));
    await page.render();

    const component = page.harness.routeDebugElement!.componentInstance as {
      setTeam(team: string): void;
    };
    component.setTeam('SRE');
    await page.render();
    // A new team drops the engineer picked from the old one
    expect(TestBed.inject(Router).url).toBe('/oncall?team=SRE');
    answerShifts();
    page.http.expectOne((r) => r.url === '/api/v1/engineers').flush(pageOf([]));
  });
});
