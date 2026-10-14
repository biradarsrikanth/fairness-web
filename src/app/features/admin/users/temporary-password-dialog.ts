import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface TemporaryPasswordData {
  readonly heading: string;
  readonly email: string;
  readonly password: string;
}

/** Shows a one-time password once, to pass on to the user; they choose their own at first sign-in. */
@Component({
  selector: 'app-temporary-password-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.heading }}</h2>
    <mat-dialog-content>
      <p>
        Give this one-time password to <strong>{{ data.email }}</strong
        >. It's shown only now; they choose their own when they first sign in.
      </p>
      <div class="secret">
        <code>{{ data.password }}</code>
        <button matButton type="button" (click)="copy()">
          <mat-icon [svgIcon]="copied() ? 'check' : 'copy'" />
          {{ copied() ? 'Copied' : 'Copy' }}
        </button>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="filled" type="button" mat-dialog-close>Done</button>
    </mat-dialog-actions>
  `,
  styles: `
    .secret {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container-high);
    }
    code {
      flex: 1;
      font-size: 16px;
      user-select: all;
      word-break: break-all;
    }
  `,
})
export class TemporaryPasswordDialog {
  protected readonly data = inject<TemporaryPasswordData>(MAT_DIALOG_DATA);
  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.data.password);
      this.copied.set(true);
    } catch {
      // No clipboard access (an insecure page or a refused permission): the text is selectable
    }
  }
}
