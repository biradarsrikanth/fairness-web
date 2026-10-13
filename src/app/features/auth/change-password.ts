import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  FormField,
  form,
  maxLength,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { firstError, serverErrors } from '../../shared/forms/server-errors';

// The gateway's limits: BCrypt reads at most 72 bytes
const MIN_LENGTH = 12;
const MAX_LENGTH = 72;

@Component({
  selector: 'app-change-password',
  imports: [FormField, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './change-password.html',
  styleUrl: './auth-page.scss',
})
export class ChangePassword {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly snackBar = inject(MatSnackBar);

  /** A new account or a reset password: the app stays closed until it's changed. */
  protected readonly required = this.auth.mustChangePassword;

  protected readonly model = signal({ currentPassword: '', newPassword: '', confirmPassword: '' });
  protected readonly passwordForm = form(this.model, (path) => {
    required(path.currentPassword, { message: 'Enter your current password' });
    required(path.newPassword, { message: 'Choose a new password' });
    minLength(path.newPassword, MIN_LENGTH, { message: `Use at least ${MIN_LENGTH} characters` });
    maxLength(path.newPassword, MAX_LENGTH, { message: `Use at most ${MAX_LENGTH} characters` });
    required(path.confirmPassword, { message: 'Repeat the new password' });
    validate(path.confirmPassword, ({ value, valueOf }) =>
      value() && value() !== valueOf(path.newPassword)
        ? { kind: 'mismatch', message: "Doesn't match the new password" }
        : undefined,
    );
  });

  protected readonly formError = computed(() => this.passwordForm().errors()[0]?.message ?? null);
  protected readonly firstError = firstError;
  protected readonly minLength = MIN_LENGTH;

  protected async change(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.passwordForm, async (fields) => {
      try {
        const { currentPassword, newPassword } = this.model();
        await this.auth.changePassword(currentPassword, newPassword);
        this.snackBar.open('Password changed. Other sessions were signed out.', 'OK', {
          duration: 5000,
        });
        await this.router.navigateByUrl('/');
        return undefined;
      } catch (error) {
        return serverErrors(fields, error, {
          labels: { currentPassword: 'Current password', newPassword: 'New password' },
        });
      }
    });
  }

  protected cancel(): void {
    this.location.back();
  }

  protected signOut(): void {
    void this.auth.logout();
  }
}
