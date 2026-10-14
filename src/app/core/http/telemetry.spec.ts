import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiTelemetry, telemetryInterceptor } from './telemetry';

describe('ApiTelemetry', () => {
  let telemetry: ApiTelemetry;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([telemetryInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    telemetry = TestBed.inject(ApiTelemetry);
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('has no figures before the first request', () => {
    expect(telemetry.latencyMs()).toBeNull();
    expect(telemetry.connection()).toBe('online');
  });

  it('reports the median of recent successful requests', () => {
    [40, 10, 1000, 30, 20].forEach((ms) => telemetry.record(ms, true));
    expect(telemetry.latencyMs()).toBe(30);
  });

  it('keeps only the most recent samples', () => {
    for (let i = 0; i < 30; i++) telemetry.record(i < 10 ? 5000 : 50, true);
    expect(telemetry.latencyMs()).toBe(50);
  });

  it('is degraded after a failure until the next success', () => {
    telemetry.record(30, true);
    telemetry.record(30, false);
    expect(telemetry.connection()).toBe('degraded');
    telemetry.record(30, true);
    expect(telemetry.connection()).toBe('online');
  });

  it('counts server errors and network failures, not 4xx answers', () => {
    const http = TestBed.inject(HttpClient);
    const controller = TestBed.inject(HttpTestingController);

    http.get('/api/v1/teams').subscribe({ error: () => undefined });
    controller.expectOne('/api/v1/teams').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(telemetry.connection()).toBe('online');

    http.get('/api/v1/teams').subscribe({ error: () => undefined });
    controller.expectOne('/api/v1/teams').flush({}, { status: 502, statusText: 'Bad Gateway' });
    expect(telemetry.connection()).toBe('degraded');
  });

  it('leaves requests outside the API alone', () => {
    TestBed.inject(HttpClient).get('/assets/x.json').subscribe();
    TestBed.inject(HttpTestingController).expectOne('/assets/x.json').flush({});
    expect(telemetry.latencyMs()).toBeNull();
  });
});
