import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  UNAUTHENTICATED,
  UNAUTHENTICATED_BODY,
  session,
  settle,
  signIn,
} from '../../../testing/session';
import { provideApiConfiguration } from '../../api/api-configuration';
import { authInterceptor } from './auth-interceptor';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;

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
    client = TestBed.inject(HttpClient);
  });

  afterEach(() => http.verify());

  function get(url = '/api/v1/teams'): Promise<unknown> {
    return firstValueFrom(client.get(url));
  }

  it('sends the access token to the API only', async () => {
    await signIn('ADMIN');

    const teams = get();
    const api = http.expectOne('/api/v1/teams');
    expect(api.request.headers.get('Authorization')).toBe('Bearer access-1');
    const elsewhere = get('https://example.com/data');
    const foreign = http.expectOne('https://example.com/data');
    expect(foreign.request.headers.has('Authorization')).toBe(false);
    api.flush([]);
    foreign.flush([]);
    await Promise.all([teams, elsewhere]);
  });

  it('renews a token about to expire before sending, once for every waiting request', async () => {
    await signIn('ADMIN', { expiresInMs: 10_000 });

    const first = get('/api/v1/teams');
    const second = get('/api/v1/engineers');
    await settle();
    // Both wait for the same refresh; nothing else has gone out yet
    http.expectOne('/api/v1/auth/refresh').flush(session('ADMIN', { token: 'access-2' }));
    await settle();

    for (const url of ['/api/v1/teams', '/api/v1/engineers']) {
      const request = http.expectOne(url);
      expect(request.request.headers.get('Authorization')).toBe('Bearer access-2');
      request.flush([]);
    }
    await Promise.all([first, second]);
  });

  it('retries once with a new token when the gateway rejects the token', async () => {
    await signIn('ADMIN');

    const teams = get();
    http.expectOne('/api/v1/teams').flush(UNAUTHENTICATED_BODY, UNAUTHENTICATED);
    await settle();
    http.expectOne('/api/v1/auth/refresh').flush(session('ADMIN', { token: 'access-2' }));
    await settle();

    const retry = http.expectOne('/api/v1/teams');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush([{ id: 1 }]);
    expect(await teams).toEqual([{ id: 1 }]);
  });

  it('retries with a token another request already renewed instead of refreshing again', async () => {
    await signIn('ADMIN');

    const first = get('/api/v1/teams');
    const second = get('/api/v1/engineers');
    http.expectOne('/api/v1/teams').flush(UNAUTHENTICATED_BODY, UNAUTHENTICATED);
    await settle();
    http.expectOne('/api/v1/auth/refresh').flush(session('ADMIN', { token: 'access-2' }));
    await settle();
    http.expectOne('/api/v1/teams').flush([]);

    // The second request left with the old token before the refresh
    http.expectOne('/api/v1/engineers').flush(UNAUTHENTICATED_BODY, UNAUTHENTICATED);
    await settle();
    http.expectNone('/api/v1/auth/refresh');
    const retry = http.expectOne('/api/v1/engineers');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush([]);
    await Promise.all([first, second]);
  });

  it('leaves other 401s alone', async () => {
    await signIn('ADMIN');

    const request = get();
    http
      .expectOne('/api/v1/teams')
      .flush({ code: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });

    await expect(request).rejects.toMatchObject({ status: 401 });
    http.expectNone('/api/v1/auth/refresh');
  });

  it('sends the user to sign in when the session cannot be renewed', async () => {
    await signIn('ADMIN');
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/alerts?page=2');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const teams = get();
    http.expectOne('/api/v1/teams').flush(UNAUTHENTICATED_BODY, UNAUTHENTICATED);
    await settle();
    http
      .expectOne('/api/v1/auth/refresh')
      .flush({ code: 'REFRESH_TOKEN_REUSED' }, { status: 401, statusText: 'Unauthorized' });

    await expect(teams).rejects.toMatchObject({ status: 401 });
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/alerts?page=2', reason: 'expired' },
    });
    http.expectNone('/api/v1/teams');
  });

  it('does nothing for anonymous requests', async () => {
    const teams = get();
    const request = http.expectOne('/api/v1/teams');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(UNAUTHENTICATED_BODY, UNAUTHENTICATED);

    await expect(teams).rejects.toMatchObject({ status: 401 });
    http.expectNone('/api/v1/auth/refresh');
  });
});
