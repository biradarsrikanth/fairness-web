import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  GuardResult,
  MaybeAsync,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { signIn } from '../../../testing/session';
import { provideApiConfiguration } from '../../api/api-configuration';
import { authGuard, guestGuard, roleGuard } from './auth-guards';

// The guards on their own; app.routes.spec checks them wired into the real route table
describe('auth guards', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function run(guard: CanActivateFn, url: string): MaybeAsync<GuardResult> {
    const state = { url } as RouterStateSnapshot;
    return runInInjectionContext(TestBed.inject(EnvironmentInjector), () =>
      guard({} as ActivatedRouteSnapshot, state),
    );
  }

  function redirect(result: MaybeAsync<GuardResult>): string {
    expect(result).toBeInstanceOf(UrlTree);
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  }

  describe('authGuard', () => {
    it('sends a signed-out user to sign in with the page they asked for', () => {
      expect(redirect(run(authGuard, '/alerts/12?tab=history'))).toBe(
        '/login?returnUrl=%2Falerts%2F12%3Ftab%3Dhistory',
      );
    });

    it('lets a signed-in user through', async () => {
      await signIn('ENGINEER');
      expect(run(authGuard, '/analytics')).toBe(true);
    });

    it('holds a user who must change their password, except on that page', async () => {
      await signIn('MANAGER', { user: { mustChangePassword: true } });
      expect(redirect(run(authGuard, '/analytics'))).toBe('/change-password');
      expect(run(authGuard, '/change-password')).toBe(true);
    });
  });

  describe('guestGuard', () => {
    it('opens the sign-in page while signed out', () => {
      expect(run(guestGuard, '/login')).toBe(true);
    });

    it('sends a signed-in user to the app', async () => {
      await signIn('ADMIN');
      expect(redirect(run(guestGuard, '/login'))).toBe('/');
    });
  });

  describe('roleGuard', () => {
    it('lets in the roles it names', async () => {
      await signIn('MANAGER');
      expect(run(roleGuard('ADMIN', 'MANAGER'), '/engineers')).toBe(true);
    });

    it('sends anyone else to the start page', async () => {
      await signIn('ENGINEER');
      expect(redirect(run(roleGuard('ADMIN', 'MANAGER'), '/engineers'))).toBe('/');
    });
  });
});
