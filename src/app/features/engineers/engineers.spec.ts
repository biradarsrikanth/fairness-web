import { HttpTestingController } from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { PageTest, pageOf, pageTest, route, text } from '../../../testing/pages';
import { settle, signIn } from '../../../testing/session';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideApiConfiguration } from '../../api/api-configuration';
import { EngineerResponse } from '../../api/models';
import { EngineerDialog } from './engineer-dialog';
import { EngineersPage } from './engineers-page';

const asha: EngineerResponse = {
  id: 3,
  name: 'Asha Rao',
  email: 'asha@example.com',
  team: 'SRE',
  pagerDutyUserId: 'PASHA',
  active: true,
};

describe('EngineersPage', () => {
  let page: PageTest;

  beforeEach(async () => {
    page = await pageTest([route('engineers', EngineersPage)]);
    await signIn('MANAGER');
  });

  afterEach(() => page.http.verify());

  async function open(url = '/engineers'): Promise<HTMLElement> {
    await page.harness.navigateByUrl(url);
    return page.render();
  }

  it('lists the engineers the URL filters for', async () => {
    await open('/engineers?active=false&sort=email,desc');
    const request = page.http.expectOne((r) => r.url === '/api/v1/engineers');
    expect(request.request.params.get('active')).toBe('false');
    expect(request.request.params.getAll('sort')).toEqual(['email,desc']);
    request.flush(pageOf([asha]));
    const element = await page.render();
    const row = text(element.querySelector('tr[mat-row]'));
    expect(row).toContain('Asha Rao');
    expect(row).toContain('PASHA');
    expect(element.querySelector('tr[mat-row] a')!.getAttribute('href')).toBe(
      '/analytics/engineers/3',
    );
  });

  it('searches names and emails, and says when nothing matches', async () => {
    const element = await open('/engineers?q=%20zed%20');
    const request = page.http.expectOne((r) => r.url === '/api/v1/engineers');
    expect(request.request.params.get('q')).toBe('zed');
    request.flush(pageOf([]));
    await page.render();
    expect(text(element.querySelector('.panel'))).toContain('No engineers match “zed”.');
    expect((element.querySelector('input[type=search]') as HTMLInputElement).value).toBe('zed');
  });

  it("shows the gateway's reason when an engineer can't be removed", async () => {
    await open();
    page.http.expectOne((r) => r.url === '/api/v1/engineers').flush(pageOf([asha]));
    await page.render();
    vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as never);
    const snackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');

    const component = page.harness.routeDebugElement!.componentInstance as {
      remove(engineer: EngineerResponse): Promise<void>;
    };
    const removing = component.remove(asha);
    await settle();
    page.http.expectOne({ method: 'DELETE', url: '/api/v1/engineers/3' }).flush(
      {
        code: 'CONFLICT',
        detail: 'Engineer 3 has alerts; set "active": false instead of deleting',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await removing;
    expect(snackBar).toHaveBeenCalledWith(
      'Engineer 3 has alerts; set "active": false instead of deleting',
      'Dismiss',
    );
  });

  it('takes an engineer off the rotation without losing anything else', async () => {
    await open();
    page.http.expectOne((r) => r.url === '/api/v1/engineers').flush(pageOf([asha]));
    await page.render();
    const component = page.harness.routeDebugElement!.componentInstance as {
      setActive(engineer: EngineerResponse, active: boolean): Promise<void>;
    };
    const saving = component.setActive(asha, false);
    await settle();
    const request = page.http.expectOne({ method: 'PUT', url: '/api/v1/engineers/3' });
    expect(request.request.body).toEqual({
      name: 'Asha Rao',
      email: 'asha@example.com',
      team: 'SRE',
      pagerDutyUserId: 'PASHA',
      active: false,
    });
    request.flush({ ...asha, active: false });
    await saving;
    // The list reloads
    await page.render();
    page.http
      .expectOne((r) => r.url === '/api/v1/engineers')
      .flush(pageOf([{ ...asha, active: false }]));
  });
});

describe('EngineerDialog', () => {
  let http: HttpTestingController;
  const close = vi.fn();

  function setup(engineer?: EngineerResponse) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
        { provide: MAT_DIALOG_DATA, useValue: { engineer } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EngineerDialog);
    return { fixture, loader: TestbedHarnessEnvironment.loader(fixture) };
  }

  afterEach(() => {
    http.verify();
    close.mockReset();
  });

  it('adds an engineer to one of the teams the gateway offers', async () => {
    const { fixture, loader } = setup();
    await settle();
    http.expectOne('/api/v1/teams').flush([
      { id: 1, name: 'SRE', timezone: 'Asia/Kolkata' },
      { id: 2, name: 'Platform', timezone: 'Asia/Kolkata' },
    ]);
    await fixture.whenStable();

    const [name, email, pagerDuty] = await loader.getAllHarnesses(MatInputHarness);
    await name.setValue('Kiran Das');
    await email.setValue('kiran@example.com');
    await pagerDuty.setValue('  ');
    const team = await loader.getHarness(MatSelectHarness);
    await team.open();
    await team.clickOptions({ text: 'Platform' });

    (fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await settle();
    const request = http.expectOne({ method: 'POST', url: '/api/v1/engineers' });
    expect(request.request.body).toEqual({
      name: 'Kiran Das',
      email: 'kiran@example.com',
      team: 'Platform',
      pagerDutyUserId: null,
      active: true,
    });
    request.flush({ ...asha, id: 9, name: 'Kiran Das' });
    await settle();
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
  });

  it("puts the gateway's field errors under the fields", async () => {
    const { fixture } = setup(asha);
    await settle();
    http.expectOne('/api/v1/teams').flush([{ id: 1, name: 'SRE', timezone: 'Asia/Kolkata' }]);
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await settle();
    http
      .expectOne({ method: 'PUT', url: '/api/v1/engineers/3' })
      .flush(
        { code: 'VALIDATION_FAILED', errors: [{ field: 'email', message: 'is already used' }] },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(text(fixture.nativeElement.querySelector('mat-error'))).toBe('Email is already used');
    expect(close).not.toHaveBeenCalled();
  });
});
