import { Component, computed, inject, input, signal } from '@angular/core';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { describeError, errorCode, retryAfterSeconds } from '../../core/http/api-error';
import { firstError, serverErrors } from '../../shared/forms/server-errors';
import { safeReturnUrl } from './return-url';

@Component({
  selector: 'app-login',
  imports: [FormField, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './login.html',
  styleUrl: './auth-page.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Query parameters: where to go after signing in, and why the user is here. */
  readonly returnUrl = input<string>();
  readonly reason = input<string>();

  protected readonly model = signal({ email: '', password: '' });
  protected readonly loginForm = form(this.model, (path) => {
    required(path.email, { message: 'Enter your email' });
    email(path.email, { message: 'Enter a valid email address' });
    required(path.password, { message: 'Enter your password' });
  });

  protected readonly notice = computed(() =>
    this.reason() === 'expired' ? 'Your session has ended. Sign in again to continue.' : null,
  );
  protected readonly formError = computed(() => this.loginForm().errors()[0]?.message ?? null);
  protected readonly firstError = firstError;

  protected async signIn(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.loginForm, async (fields) => {
      try {
        const { email, password } = this.model();
        const user = await this.auth.login(email.trim(), password);
        await this.router.navigateByUrl(
          user.mustChangePassword ? '/change-password' : safeReturnUrl(this.returnUrl()),
        );
        return undefined;
      } catch (error) {
        return serverErrors(fields, error, { describe: describeSignInError });
      }
    });
  }
}

function describeSignInError(error: unknown): string {
  switch (errorCode(error)) {
    case 'INVALID_CREDENTIALS':
      return 'Wrong email or password.';
    case 'ACCOUNT_LOCKED':
      return `Too many failed attempts. Try again ${inAbout(retryAfterSeconds(error))}.`;
    case 'TOO_MANY_REQUESTS':
      return `Too many sign-in attempts from here. Try again ${inAbout(retryAfterSeconds(error))}.`;
    case 'ACCOUNT_DISABLED':
      return 'This account is disabled. Ask an administrator to enable it.';
    default:
      return describeError(error);
  }
}

function inAbout(seconds: number | null): string {
  if (seconds === null) return 'later';
  if (seconds < 60) return `in ${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}
