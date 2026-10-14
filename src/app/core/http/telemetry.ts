import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';

/** How many recent requests the latency figure covers. */
const SAMPLE_SIZE = 20;

export type Connection = 'online' | 'degraded' | 'offline';

/**
 * How the API is answering, measured from the requests the app makes anyway: no health polling, so a
 * thousand open tabs add no load. The status bar shows it.
 */
@Service()
export class ApiTelemetry {
  private readonly samples = signal<readonly number[]>([]);
  /** Whether the most recent request failed; requests finishing in the same millisecond still order. */
  private readonly lastFailed = signal(false);
  private readonly browserOnline = signal(typeof navigator === 'undefined' || navigator.onLine);

  /** Median duration of the recent requests, in milliseconds; null before the first one. */
  readonly latencyMs = computed(() => {
    const sorted = [...this.samples()].sort((a, b) => a - b);
    return sorted.length === 0 ? null : Math.round(sorted[Math.floor(sorted.length / 2)]);
  });

  readonly connection = computed<Connection>(() => {
    if (!this.browserOnline()) return 'offline';
    // The latest request decides: one failure after many successes shows, and clears on the next success
    return this.lastFailed() ? 'degraded' : 'online';
  });

  constructor() {
    const online = () => this.browserOnline.set(true);
    const offline = () => this.browserOnline.set(false);
    addEventListener('online', online);
    addEventListener('offline', offline);
    inject(DestroyRef).onDestroy(() => {
      removeEventListener('online', online);
      removeEventListener('offline', offline);
    });
  }

  record(durationMs: number, ok: boolean): void {
    this.lastFailed.set(!ok);
    if (ok) this.samples.update((samples) => [...samples.slice(-(SAMPLE_SIZE - 1)), durationMs]);
  }
}

/**
 * Times each API request. Only server trouble counts as a failure: a 4xx is the gateway answering
 * (validation, permissions, an expired token), not the connection failing.
 */
export const telemetryInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/')) return next(req);
  const telemetry = inject(ApiTelemetry);
  const started = performance.now();
  return next(req).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) telemetry.record(performance.now() - started, true);
      },
      error: (error: unknown) => {
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        const serverTrouble = status === 0 || status >= 500;
        telemetry.record(performance.now() - started, !serverTrouble);
      },
    }),
  );
};
