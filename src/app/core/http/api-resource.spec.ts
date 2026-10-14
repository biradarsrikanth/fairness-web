import { HttpClient, HttpContext, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, map } from 'rxjs';
import { settle } from '../../../testing/session';
import { provideApiConfiguration } from '../../api/api-configuration';
import { StrictHttpResponse } from '../../api/strict-http-response';
import { HANDLES_ERRORS } from './api-error';
import { apiResource } from './api-resource';

interface Params {
  readonly id: number;
}

/** Shaped like a generated API function: GET {rootUrl}/api/v1/teams/{id}. */
function getTeam(
  http: HttpClient,
  rootUrl: string,
  params: Params,
  context?: HttpContext,
): Observable<StrictHttpResponse<{ name: string }>> {
  return http
    .get<{ name: string }>(`${rootUrl}/api/v1/teams/${params.id}`, { observe: 'response', context })
    .pipe(map((response) => response as StrictHttpResponse<{ name: string }>));
}

describe('apiResource', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideApiConfiguration('')],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function create(params: () => Params | undefined, context?: () => HttpContext) {
    return runInInjectionContext(TestBed.inject(Injector), () =>
      apiResource(getTeam, params, context),
    );
  }

  it('stays idle until it has params', () => {
    const id = signal<number | undefined>(undefined);
    const team = create(() => (id() === undefined ? undefined : { id: id()! }));
    TestBed.tick();
    http.expectNone(() => true);
    expect(team.status()).toBe('idle');
  });

  it('loads the response body, and keeps its errors from the global snackbar', async () => {
    const team = create(() => ({ id: 1 }));
    TestBed.tick();
    const request = http.expectOne('/api/v1/teams/1');
    expect(request.request.context.get(HANDLES_ERRORS)).toBe(true);
    request.flush({ name: 'SRE' });
    await settle();
    expect(team.value()).toEqual({ name: 'SRE' });
  });

  it('cancels the request still on its way when the params change', () => {
    const id = signal(1);
    create(() => ({ id: id() }));
    TestBed.tick();
    const first = http.expectOne('/api/v1/teams/1');

    id.set(2);
    TestBed.tick();
    expect(first.cancelled).toBe(true);
    http.expectOne('/api/v1/teams/2').flush({ name: 'Platform' });
  });

  it('shows a failure as the resource error', async () => {
    const team = create(() => ({ id: 9 }));
    TestBed.tick();
    http
      .expectOne('/api/v1/teams/9')
      .flush({ code: 'NOT_FOUND', detail: 'No team 9' }, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(team.status()).toBe('error');
  });

  it('uses the context it is given', () => {
    create(
      () => ({ id: 1 }),
      () => new HttpContext(),
    );
    TestBed.tick();
    const request = http.expectOne('/api/v1/teams/1');
    expect(request.request.context.get(HANDLES_ERRORS)).toBe(false);
    request.flush({ name: 'SRE' });
  });
});
