import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { session, settle, signIn } from '../../../testing/session';
import { provideApiConfiguration } from '../../api/api-configuration';
import { AuthService } from './auth';
import { authInterceptor } from './auth-interceptor';

describe('AuthService', () => {
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => http.verify());

  it('keeps the user and token from signing in', async () => {
    expect(auth.signedIn()).toBe(false);

    const loggedIn = auth.login('manager@example.com', 'a-password-123');
    const request = http.expectOne('/api/v1/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'manager@example.com',
      password: 'a-password-123',
    });
    // Session requests never carry a token
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(session('MANAGER'));
    await loggedIn;

    expect(auth.signedIn()).toBe(true);
    expect(auth.role()).toBe('MANAGER');
    expect(auth.accessToken()).toBe('access-1');
    expect(auth.hasRole('ADMIN', 'MANAGER')).toBe(true);
    expect(auth.hasRole('ADMIN')).toBe(false);
  });

  it('rejects a failed sign-in with the gateway error and stays signed out', async () => {
    const loggedIn = auth.login('x@example.com', 'wrong-password');
    http
      .expectOne('/api/v1/auth/login')
      .flush({ code: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });

    await expect(loggedIn).rejects.toMatchObject({ status: 401 });
    expect(auth.signedIn()).toBe(false);
  });

  it('shares one refresh between concurrent callers', async () => {
    await signIn('ADMIN');

    const first = auth.refresh();
    const second = auth.refresh();
    await settle();
    http.expectOne('/api/v1/auth/refresh').flush(session('ADMIN', { token: 'access-2' }));

    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(auth.accessToken()).toBe('access-2');
  });

  it('ends the session when the refresh cookie is no longer valid', async () => {
    await signIn('ADMIN');

    const refreshed = auth.refresh();
    await settle();
    http
      .expectOne('/api/v1/auth/refresh')
      .flush({ code: 'REFRESH_TOKEN_INVALID' }, { status: 401, statusText: 'Unauthorized' });

    expect(await refreshed).toBe(false);
    expect(auth.signedIn()).toBe(false);
  });

  it('keeps the session when the gateway is unreachable during a refresh', async () => {
    await signIn('ADMIN');

    const refreshed = auth.refresh();
    await settle();
    http.expectOne('/api/v1/auth/refresh').error(new ProgressEvent('error'));

    await expect(refreshed).rejects.toMatchObject({ status: 0 });
    expect(auth.signedIn()).toBe(true);
  });

  it('restores the session of an earlier visit from the refresh cookie', async () => {
    const restored = auth.restore();
    await settle();
    http.expectOne('/api/v1/auth/refresh').flush(session('ENGINEER'));
    await restored;

    expect(auth.role()).toBe('ENGINEER');
  });

  it('starts signed out when there is no earlier session', async () => {
    const restored = auth.restore();
    await settle();
    http
      .expectOne('/api/v1/auth/refresh')
      .flush({ code: 'REFRESH_TOKEN_INVALID' }, { status: 401, statusText: 'Unauthorized' });
    await restored;

    expect(auth.signedIn()).toBe(false);
  });

  it('signs out on the gateway and goes to the sign-in page', async () => {
    await signIn('ADMIN');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const loggedOut = auth.logout();
    http.expectOne('/api/v1/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await loggedOut;

    expect(auth.signedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('replaces the session after a password change', async () => {
    await signIn('ENGINEER', { user: { mustChangePassword: true } });
    expect(auth.mustChangePassword()).toBe(true);

    const changed = auth.changePassword('old-password-123', 'new-password-456');
    const request = http.expectOne('/api/v1/auth/change-password');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush(session('ENGINEER', { token: 'access-2' }));
    await changed;

    expect(auth.mustChangePassword()).toBe(false);
    expect(auth.accessToken()).toBe('access-2');
  });
});
