import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signIn } from '../../../testing/session';
import { provideApiConfiguration } from '../../api/api-configuration';
import { Role } from '../auth/auth';
import { authInterceptor } from '../auth/auth-interceptor';
import { Shell } from './shell';

describe('Shell', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function menuFor(role: Role): Promise<string[]> {
    await signIn(role);
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    return Array.from(element.querySelectorAll('nav [matListItemTitle]')).map((title) =>
      title.textContent!.trim(),
    );
  }

  it('shows an engineer the shared pages only', async () => {
    expect(await menuFor('ENGINEER')).toEqual(['Analytics', 'Alerts', 'On-call']);
  });

  it('adds engineers and teams for a manager', async () => {
    expect(await menuFor('MANAGER')).toEqual([
      'Analytics',
      'Alerts',
      'On-call',
      'Engineers',
      'Teams',
    ]);
  });

  it('shows an admin everything', async () => {
    expect(await menuFor('ADMIN')).toEqual([
      'Analytics',
      'Alerts',
      'On-call',
      'Engineers',
      'Teams',
      'Users',
      'PagerDuty sync',
      'Audit log',
    ]);
  });

  it('names the signed-in user', async () => {
    await signIn('MANAGER');
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.user-name')?.textContent).toBe(
      'Test manager',
    );
  });
});
