import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { signIn } from '../testing/session';
import { provideApiConfiguration } from './api/api-configuration';
import { routes } from './app.routes';
import { Role } from './core/auth/auth';
import { authInterceptor } from './core/auth/auth-interceptor';
import { NAVIGATION } from './core/layout/navigation';

// The real route table: who gets where, and whether the menu offers only what the routes allow.
// First visits load the lazy pages (ECharts included) while other spec files run alongside, which can take
// several seconds, hence the longer timeout.
describe('routes', { timeout: 30_000 }, () => {
  let harness: RouterTestingHarness;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
      ],
    });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    // Pages load their data on arrival; that's their own specs' business
    http.match((request) => request.method === 'GET' && request.url.startsWith('/api/v1/'));
    http.verify();
  });

  it('sends a signed-out user to sign in, remembering where they were going', async () => {
    await harness.navigateByUrl('/alerts?page=2');
    expect(router.url).toBe('/login?returnUrl=%2Falerts%3Fpage%3D2');
  });

  it('opens analytics at the root', async () => {
    await signIn('ENGINEER');
    await harness.navigateByUrl('/');
    expect(router.url).toBe('/analytics');
  });

  it('keeps a signed-in user away from the sign-in page', async () => {
    await signIn('MANAGER');
    await harness.navigateByUrl('/login');
    expect(router.url).toBe('/analytics');
  });

  it('holds a user who must change their password on that page', async () => {
    await signIn('ENGINEER', { user: { mustChangePassword: true } });
    await harness.navigateByUrl('/alerts');
    expect(router.url).toBe('/change-password');
  });

  for (const role of ['ADMIN', 'MANAGER', 'ENGINEER'] as Role[]) {
    it(`lets a ${role} open exactly the pages their menu shows`, async () => {
      await signIn(role);
      for (const item of NAVIGATION) {
        await harness.navigateByUrl(item.path);
        const allowed = !item.roles || item.roles.includes(role);
        expect(router.url, item.path).toBe(allowed ? item.path : '/analytics');
      }
    });
  }
});
