import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BACKGROUND, handlesErrors } from './api-error';
import { errorInterceptor } from './error-interceptor';
import { LoadingService, loadingInterceptor } from './loading';

describe('errorInterceptor and loadingInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let snackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    snackBar = { open: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([loadingInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
  });

  afterEach(() => http.verify());

  async function fail(body: object | null, status: number, context?: HttpContext): Promise<void> {
    const request = firstValueFrom(client.get('/api/v1/teams', { context }));
    http.expectOne('/api/v1/teams').flush(body, { status, statusText: 'Error' });
    await expect(request).rejects.toMatchObject({ status });
  }

  it('reports a server error with its reference', async () => {
    await fail({ code: 'INTERNAL_ERROR', requestId: 'req-42' }, 500);
    expect(snackBar.open).toHaveBeenCalledWith(
      'Something went wrong on our side (reference req-42).',
      'Dismiss',
      { duration: 8000 },
    );
  });

  it("shows the gateway's detail for other errors", async () => {
    await fail({ code: 'CONFLICT', detail: 'Team SRE still has engineers' }, 409);
    expect(snackBar.open.mock.calls[0][0]).toBe('Team SRE still has engineers');
  });

  it('stays quiet for requests that show their own errors, and for 401s', async () => {
    await fail({ code: 'VALIDATION_FAILED' }, 400, handlesErrors());
    await fail({ code: 'UNAUTHENTICATED' }, 401);
    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('sends a user who must change their password to that page', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await fail({ code: 'PASSWORD_CHANGE_REQUIRED' }, 403);
    expect(navigate).toHaveBeenCalledWith('/change-password');
    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('counts requests in flight, except background ones', async () => {
    const loading = TestBed.inject(LoadingService);
    const visible = firstValueFrom(client.get('/api/v1/teams'));
    const background = firstValueFrom(
      client.get('/api/v1/auth/me', { context: new HttpContext().set(BACKGROUND, true) }),
    );
    expect(loading.active()).toBe(true);

    http.expectOne('/api/v1/teams').flush([]);
    await visible;
    expect(loading.active()).toBe(false);

    http.expectOne('/api/v1/auth/me').flush({});
    await background;
  });
});
