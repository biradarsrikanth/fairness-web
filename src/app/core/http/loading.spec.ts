import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { BACKGROUND } from './api-error';
import { LoadingService, loadingInterceptor } from './loading';

describe('loading', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let loading: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([loadingInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    loading = TestBed.inject(LoadingService);
  });

  afterEach(() => http.verify());

  it('is active until every request the user waits for has finished', async () => {
    const first = firstValueFrom(client.get('/api/v1/teams'));
    const second = firstValueFrom(client.get('/api/v1/engineers'));
    expect(loading.active()).toBe(true);

    http.expectOne('/api/v1/teams').flush([]);
    await first;
    expect(loading.active()).toBe(true);

    http.expectOne('/api/v1/engineers').flush([]);
    await second;
    expect(loading.active()).toBe(false);
  });

  it('stops counting a request that failed', async () => {
    const request = firstValueFrom(client.get('/api/v1/teams'));
    http.expectOne('/api/v1/teams').flush(null, { status: 500, statusText: 'Server Error' });
    await expect(request).rejects.toBeDefined();
    expect(loading.active()).toBe(false);
  });

  it('stops counting a request that was cancelled', () => {
    const subscription = client.get('/api/v1/teams').subscribe();
    expect(loading.active()).toBe(true);
    subscription.unsubscribe();
    expect(loading.active()).toBe(false);
    expect(http.expectOne('/api/v1/teams').cancelled).toBe(true);
  });

  it('ignores background requests', () => {
    client.get('/api/v1/auth/me', { context: new HttpContext().set(BACKGROUND, true) }).subscribe();
    expect(loading.active()).toBe(false);
    http.expectOne('/api/v1/auth/me').flush({});
  });

  it('counts each tracked request once, however often it is stopped', () => {
    const stopFirst = loading.track();
    const stopSecond = loading.track();
    stopFirst();
    stopFirst();
    expect(loading.active()).toBe(true);
    stopSecond();
    expect(loading.active()).toBe(false);
  });
});
