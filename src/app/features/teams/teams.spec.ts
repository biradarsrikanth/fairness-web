import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatInputHarness } from '@angular/material/input/testing';
import { PageTest, pageTest, route, text } from '../../../testing/pages';
import { settle, signIn } from '../../../testing/session';
import { provideApiConfiguration } from '../../api/api-configuration';
import { Role } from '../../core/auth/auth';
import { TeamDialog, isTimeZone, matchTimezones } from './team-dialog';
import { TeamsPage } from './teams-page';

const teams = [
  { id: 2, name: 'Platform', timezone: 'Europe/London' },
  { id: 1, name: 'SRE', timezone: 'Asia/Kolkata' },
];

describe('TeamsPage', () => {
  let page: PageTest;

  beforeEach(async () => {
    page = await pageTest([route('teams', TeamsPage)]);
  });

  afterEach(() => page.http.verify());

  async function open(role: Role): Promise<HTMLElement> {
    await signIn(role);
    await page.harness.navigateByUrl('/teams');
    page.http.expectOne('/api/v1/teams').flush(teams);
    return page.render();
  }

  it('lets an admin add and delete teams', async () => {
    const element = await open('ADMIN');
    expect(text(element.querySelector('.page-bar'))).toContain('Add team');
    const rows = Array.from(element.querySelectorAll('tbody tr')).map(text);
    expect(rows[0]).toContain('Platform');
    expect(rows[0]).toContain('Europe/London');
    expect(rows[0]).toContain('Delete');
  });

  it('lets a manager edit their teams but not add or delete any', async () => {
    const element = await open('MANAGER');
    expect(text(element.querySelector('.page-bar'))).not.toContain('Add team');
    const row = text(element.querySelector('tbody tr'));
    expect(row).toContain('Edit');
    expect(row).not.toContain('Delete');
    expect(element.querySelector('tbody tr a')!.getAttribute('href')).toBe(
      '/engineers?team=Platform',
    );
  });
});

describe('TeamDialog', () => {
  let http: HttpTestingController;
  const close = vi.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('finds timezones by any part of the name, current names included', () => {
    expect(matchTimezones('kolk')).toEqual(['Asia/Kolkata']);
    expect(matchTimezones('new york')).toEqual(['America/New_York']);
    expect(isTimeZone('Asia/Calcutta')).toBe(true);
    expect(isTimeZone('Mars/Olympus')).toBe(false);
  });

  it('only accepts a real timezone, then creates the team', async () => {
    const fixture = TestBed.createComponent(TeamDialog);
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const [name, timezone] = await loader.getAllHarnesses(MatInputHarness);
    await name.setValue('Data');
    await timezone.setValue('Mars/Olympus');
    const submit = fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement;
    submit.click();
    await fixture.whenStable();
    expect(text(fixture.nativeElement.querySelector('mat-error'))).toBe(
      'Pick a timezone from the list',
    );

    await timezone.setValue('Europe/Berlin');
    submit.click();
    await settle();
    const request = http.expectOne({ method: 'POST', url: '/api/v1/teams' });
    expect(request.request.body).toEqual({ name: 'Data', timezone: 'Europe/Berlin' });
    request.flush({ id: 3, name: 'Data', timezone: 'Europe/Berlin' });
    await settle();
    expect(close).toHaveBeenCalledWith({ id: 3, name: 'Data', timezone: 'Europe/Berlin' });
  });
});
