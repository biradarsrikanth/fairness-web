import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  /** The confirming button, e.g. "Delete" */
  readonly confirmLabel: string;
  /** Styles the confirming button as a destructive action */
  readonly destructive?: boolean;
}

/** Asks before something that can't be undone. Cancel is the default (focused) action. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" [mat-dialog-close]="false" cdkFocusInitial>Cancel</button>
      <button
        matButton="filled"
        type="button"
        [class.destructive]="data.destructive"
        [mat-dialog-close]="true"
      >
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .destructive {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
}

/** Opens the confirm dialog; resolves true only when the user confirms. */
export async function confirmAction(dialog: MatDialog, options: ConfirmOptions): Promise<boolean> {
  const ref = dialog.open<ConfirmDialog, ConfirmOptions, boolean>(ConfirmDialog, {
    data: options,
    width: '420px',
    autoFocus: 'dialog',
  });
  return (await firstValueFrom(ref.afterClosed())) === true;
}
