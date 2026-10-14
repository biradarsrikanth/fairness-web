import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { PageTest, pageOf, pageTest, route, text } from '../../../../testing/pages';
import { settle, signIn } from '../../../../testing/session';
import { provideApiConfiguration } from '../../../api/api-configuration';
import { UserAccountResponse } from '../../../api/models';
import { TemporaryPasswordDialog } from './temporary-password-dialog';
import { UserDialog } from './user-dialog';
import { UserTeamsDialog } from './user-teams-dialog';
import { UsersPage, isLocked } from './users-page';

const manager: UserAccountResponse = {
  id: 12,
  email: 'meera@example.com',
  fullName: 'Meera Iyer',
  role: 'MANAGER',
  enabled: true,
  mustChangePassword: false,
  teams: [{ id: 1, name: 'SRE' }],
  lastLoginAt: '2026-10-12T04:30:00Z',
  lockedUntil: null,
};

describe('UsersPage', () => {
  let page: PageTest;

  beforeEach(async () => {
    page = await pageTest([route('admin/users', UsersPage)]);
    await signIn('ADMIN');
  });

  afterEach(() => page.http.verify());

  async function open(url = '/admin/users', users = [manager]): Promise<HTMLElement> {
    await page.harness.navigateByUrl(url);
    await page.render();
    page.http.expectOne((r) => r.url === '/api/v1/users').flush(pageOf(users));
    return page.render();
  }

  it('lists users with what they see and whether they can sign in', async () => {
    const locked = {
      ...manager,
      id: 13,
      fullName: 'Ravi Kumar',
      role: 'ENGINEER' as const,
      engineerId: 4,
      engineerName: 'Ravi Kumar',
      teams: [],
      lockedUntil: new Date(Date.now() + 600_000).toISOString(),
    };
    const element = await open('/admin/users', [manager, locked]);
    const rows = Array.from(element.querySelectorAll('tr[mat-row]')).map(text);
    expect(rows[0]).toContain('Meera Iyer');
    expect(rows[0]).toContain('SRE');
    expect(rows[0]).toContain('Active');
    expect(rows[1]).toContain('Locked until');
  });

  it('searches once the admin pauses typing', async () => {
    await open();
    vi.useFakeTimers();
    try {
      const input = page.harness.routeNativeElement!.querySelector(
        'input[type=search]',
      ) as HTMLInputElement;
      input.value = 'mee';
      input.dispatchEvent(new Event('input'));
      input.value = 'meera';
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(300);
    } finally {
      vi.useRealTimers();
    }
    await page.render();
    expect(TestBed.inject(Router).url).toBe('/admin/users?q=meera');
    const request = page.http.expectOne((r) => r.url === '/api/v1/users');
    expect(request.request.params.get('q')).toBe('meera');
    request.flush(pageOf([manager]));
  });

  it('resets a password and shows the one-time password once', async () => {
    await open();
    const dialog = TestBed.inject(MatDialog);
    const opened = vi
      .spyOn(dialog, 'open')
      .mockReturnValueOnce({ afterClosed: () => of(true) } as never)
      .mockReturnValueOnce({} as never);
    const component = page.harness.routeDebugElement!.componentInstance as {
      resetPassword(user: UserAccountResponse): Promise<void>;
    };
    const resetting = component.resetPassword(manager);
    await settle();
    page.http
      .expectOne({ method: 'POST', url: '/api/v1/users/12/reset-password' })
      .flush({ temporaryPassword: 'Tmp-Secret-123', user: manager });
    await resetting;
    expect(opened).toHaveBeenLastCalledWith(
      TemporaryPasswordDialog,
      expect.objectContaining({
        data: {
          heading: 'New one-time password',
          email: 'meera@example.com',
          password: 'Tmp-Secret-123',
        },
        disableClose: true,
      }),
    );
    await page.render();
    page.http.expectOne((r) => r.url === '/api/v1/users').flush(pageOf([manager]));
  });
});

describe('user dialogs', () => {
  let http: HttpTestingController;
  const close = vi.fn();

  function setup<T>(component: Type<T>, data: unknown) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(component);
    return { fixture, loader: TestbedHarnessEnvironment.loader(fixture) };
  }

  function answerEngineers(team = 'SRE'): void {
    const request = http.expectOne((r) => r.url === '/api/v1/engineers');
    expect(request.request.params.get('team')).toBe(team);
    request.flush(
      pageOf([{ id: 4, name: 'Ravi Kumar', team: 'SRE', email: 'ravi@example.com', active: true }]),
    );
  }

  function answerLists(): void {
    http.expectOne('/api/v1/teams').flush([
      { id: 1, name: 'SRE', timezone: 'Asia/Kolkata' },
      { id: 2, name: 'Platform', timezone: 'Asia/Kolkata' },
    ]);
  }

  afterEach(() => {
    http.verify();
    close.mockReset();
  });

  it("creates an engineer's login for one engineer, named after them", async () => {
    const { fixture, loader } = setup(UserDialog, {});
    await settle();
    answerLists();
    await fixture.whenStable();

    const submit = fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement;
    submit.click();
    await fixture.whenStable();
    expect(text(fixture.nativeElement)).toContain('Pick the engineer this login is for');

    // No engineers are fetched until a team is picked
    http.expectNone((r) => r.url === '/api/v1/engineers');
    const [, team] = await loader.getAllHarnesses(MatSelectHarness);
    await team.open();
    // Picking a team starts the engineer request, which the harness waits on: answer it meanwhile
    const picked = team.clickOptions({ text: 'SRE' });
    await vi.waitFor(() => answerEngineers('SRE'));
    await picked;
    await fixture.whenStable();
    const [, , engineer] = await loader.getAllHarnesses(MatSelectHarness);
    await engineer.open();
    await engineer.clickOptions({ text: /Ravi Kumar/ });
    const [name, email] = await loader.getAllHarnesses(MatInputHarness);
    expect(await name.getValue()).toBe('Ravi Kumar');
    await email.setValue('ravi@example.com');
    submit.click();
    await settle();
    const request = http.expectOne({ method: 'POST', url: '/api/v1/users' });
    expect(request.request.body).toEqual({
      email: 'ravi@example.com',
      fullName: 'Ravi Kumar',
      role: 'ENGINEER',
      engineerId: 4,
      teamIds: null,
    });
    request.flush({ temporaryPassword: 'Tmp-1', user: { ...manager, role: 'ENGINEER' } });
    await settle();
    expect(close).toHaveBeenCalledWith({
      created: expect.objectContaining({ temporaryPassword: 'Tmp-1' }),
    });
  });

  it("opens an engineer's login on their team, with them picked", async () => {
    const { fixture, loader } = setup(UserDialog, {
      user: { ...manager, role: 'ENGINEER', engineerId: 4 },
    });
    await settle();
    answerLists();
    http
      .expectOne('/api/v1/engineers/4')
      .flush({ id: 4, name: 'Ravi Kumar', team: 'SRE', email: 'ravi@example.com', active: true });
    // The team comes from that answer; its engineers are asked for once it lands
    await vi.waitFor(() => answerEngineers('SRE'));
    await fixture.whenStable();
    const [, team, engineer] = await loader.getAllHarnesses(MatSelectHarness);
    expect(await team.getValueText()).toBe('SRE');
    expect(await engineer.getValueText()).toContain('Ravi Kumar');
  });

  it('gives a new manager teams and no engineer', async () => {
    const { fixture, loader } = setup(UserDialog, {});
    await settle();
    answerLists();
    await fixture.whenStable();

    const role = (await loader.getAllHarnesses(MatSelectHarness))[0];
    await role.open();
    await role.clickOptions({ text: 'Manager' });
    const selects = await loader.getAllHarnesses(MatSelectHarness);
    expect(selects).toHaveLength(2);
    await selects[1].open();
    await selects[1].clickOptions({ text: 'Platform' });
    const [name, email] = await loader.getAllHarnesses(MatInputHarness);
    await name.setValue('Neha Gupta');
    await email.setValue('neha@example.com');
    (fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await settle();
    const request = http.expectOne({ method: 'POST', url: '/api/v1/users' });
    expect(request.request.body).toEqual({
      email: 'neha@example.com',
      fullName: 'Neha Gupta',
      role: 'MANAGER',
      engineerId: null,
      teamIds: [2],
    });
    request.flush({ temporaryPassword: 'Tmp-2', user: manager });
    await settle();
  });

  it("replaces a manager's teams", async () => {
    const { fixture } = setup(UserTeamsDialog, manager);
    await settle();
    http.expectOne('/api/v1/teams').flush([
      { id: 1, name: 'SRE', timezone: 'Asia/Kolkata' },
      { id: 2, name: 'Platform', timezone: 'Asia/Kolkata' },
    ]);
    await fixture.whenStable();
    const boxes = fixture.nativeElement.querySelectorAll(
      'input[type=checkbox]',
    ) as NodeListOf<HTMLInputElement>;
    // Sorted by name: Platform, SRE (already checked)
    expect(Array.from(boxes).map((b) => b.checked)).toEqual([false, true]);
    boxes[0].click();
    boxes[1].click();
    await fixture.whenStable();
    const save = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => text(b) === 'Save')!;
    save.click();
    await settle();
    const request = http.expectOne({ method: 'PUT', url: '/api/v1/users/12/teams' });
    expect(request.request.body).toEqual({ teamIds: [2] });
    request.flush({ ...manager, teams: [{ id: 2, name: 'Platform' }] });
    await settle();
    expect(close).toHaveBeenCalled();
  });

  it('tells a lock that has run out from one still on', () => {
    expect(
      isLocked(
        { ...manager, lockedUntil: '2026-10-13T10:00:00Z' },
        Date.parse('2026-10-13T09:00:00Z'),
      ),
    ).toBe(true);
    expect(
      isLocked(
        { ...manager, lockedUntil: '2026-10-13T10:00:00Z' },
        Date.parse('2026-10-13T11:00:00Z'),
      ),
    ).toBe(false);
  });
});
