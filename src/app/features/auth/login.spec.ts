import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { session, settle } from '../../../testing/session';
import { provideApiConfiguration } from '../../api/api-configuration';
import { authInterceptor } from '../../core/auth/auth-interceptor';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideApiConfiguration(''),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Login);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  function type(selector: string, value: string): void {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function signInWith(email: string, password: string): Promise<void> {
    type('input[type=email]', email);
    type('input[type=password]', password);
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
  }

  async function answer(body: object, status: number, headers: Record<string, string> = {}) {
    http.expectOne('/api/v1/auth/login').flush(body, { status, statusText: 'Error', headers });
    await settle();
    await fixture.whenStable();
  }

  function text(selector: string): string | undefined {
    return element.querySelector(selector)?.textContent?.trim();
  }

  it('checks the fields before asking the gateway', async () => {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(
      Array.from(element.querySelectorAll('mat-error')).map((e) => e.textContent?.trim()),
    ).toEqual(['Enter your email', 'Enter your password']);
    http.expectNone('/api/v1/auth/login');
  });

  it('says when the email or password is wrong', async () => {
    await signInWith('asha@example.com', 'wrong-password');
    await answer({ code: 'INVALID_CREDENTIALS', detail: 'Wrong email or password' }, 401);

    expect(text('.form-error')).toBe('Wrong email or password.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('says how long a locked account waits', async () => {
    await signInWith('asha@example.com', 'wrong-password');
    await answer({ code: 'ACCOUNT_LOCKED' }, 423, { 'Retry-After': '840' });

    expect(text('.form-error')).toBe('Too many failed attempts. Try again in 14 minutes.');
  });

  it("shows the gateway's field errors under their fields", async () => {
    await signInWith('asha@example.com', 'a-password-123');
    await answer(
      {
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'email', message: 'must be a well-formed email' }],
      },
      400,
    );

    expect(text('mat-error')).toBe('must be a well-formed email');
    expect(text('.form-error')).toBeUndefined();
  });

  it('goes back to where the user was going', async () => {
    fixture.componentRef.setInput('returnUrl', '/alerts?page=2');
    await signInWith(' asha@example.com ', 'a-password-123');
    const request = http.expectOne('/api/v1/auth/login');
    expect(request.request.body).toEqual({ email: 'asha@example.com', password: 'a-password-123' });
    request.flush(session('ENGINEER'));
    await settle();

    expect(navigate).toHaveBeenCalledWith('/alerts?page=2');
  });

  it('sends a user with a temporary password to change it first', async () => {
    fixture.componentRef.setInput('returnUrl', '/alerts');
    await signInWith('asha@example.com', 'Temporary-Pass-123');
    http
      .expectOne('/api/v1/auth/login')
      .flush(session('ENGINEER', { user: { mustChangePassword: true } }));
    await settle();

    expect(navigate).toHaveBeenCalledWith('/change-password');
  });

  it('explains an expired session', async () => {
    fixture.componentRef.setInput('reason', 'expired');
    await fixture.whenStable();
    expect(text('.notice')).toBe('Your session has ended. Sign in again to continue.');
  });
});
