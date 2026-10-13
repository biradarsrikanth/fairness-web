import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Api } from '../../../api/api';
import { listTeams, setUserTeams } from '../../../api/functions';
import { UserAccountResponse } from '../../../api/models';
import { describeError, handlesErrors } from '../../../core/http/api-error';
import { apiResource } from '../../../core/http/api-resource';

/** Which teams a manager sees. Closes with the updated user. */
@Component({
  selector: 'app-user-teams-dialog',
  imports: [MatButtonModule, MatCheckboxModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Teams {{ user.fullName }} manages</h2>
    <mat-dialog-content>
      <p class="hint">They see these teams' engineers, alerts and figures, and nothing else.</p>
      @if (teams.hasValue()) {
        <div class="choices" role="group" aria-label="Teams">
          @for (team of sortedTeams(); track team.id) {
            <mat-checkbox
              [checked]="selected().has(team.id)"
              (change)="toggle(team.id, $event.checked)"
            >
              {{ team.name }}
            </mat-checkbox>
          }
        </div>
      } @else if (teams.error()) {
        <p class="form-error" role="alert">Couldn't load the teams.</p>
      } @else {
        <p class="hint" role="status">Loading teams…</p>
      }
      @if (error(); as message) {
        <p class="form-error" role="alert">{{ message }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>Cancel</button>
      <button matButton="filled" type="button" [disabled]="saving()" (click)="save()">
        {{ saving() ? 'Saving…' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: '../../../shared/dialogs/form-dialog.scss',
  styles: `
    .choices {
      display: flex;
      flex-direction: column;
    }
  `,
})
export class UserTeamsDialog {
  private readonly api = inject(Api);
  private readonly ref = inject<MatDialogRef<UserTeamsDialog, UserAccountResponse>>(MatDialogRef);
  protected readonly user = inject<UserAccountResponse>(MAT_DIALOG_DATA);

  protected readonly teams = apiResource(listTeams, () => ({}));
  protected readonly sortedTeams = computed(() =>
    [...(this.teams.value() ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  );
  protected readonly selected = signal(new Set(this.user.teams.map((team) => team.id)));
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected toggle(id: number, checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const updated = await this.api.invoke(
        setUserTeams,
        { id: this.user.id, body: { teamIds: [...this.selected()] } },
        handlesErrors(),
      );
      this.ref.close(updated);
    } catch (error) {
      this.error.set(describeError(error));
    } finally {
      this.saving.set(false);
    }
  }
}
