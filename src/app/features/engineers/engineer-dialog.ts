import { Component, computed, inject, signal } from '@angular/core';
import { FormField, email, form, maxLength, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Api } from '../../api/api';
import { createEngineer, listTeams, updateEngineer } from '../../api/functions';
import { EngineerResponse } from '../../api/models';
import { handlesErrors } from '../../core/http/api-error';
import { apiResource } from '../../core/http/api-resource';
import { firstError, serverErrors } from '../../shared/forms/server-errors';

export interface EngineerDialogData {
  /** The engineer to edit; absent to add one */
  readonly engineer?: EngineerResponse;
}

/** Adds or edits an engineer. Closes with the saved engineer. */
@Component({
  selector: 'app-engineer-dialog',
  imports: [
    FormField,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './engineer-dialog.html',
  styleUrl: '../../shared/dialogs/form-dialog.scss',
})
export class EngineerDialog {
  private readonly api = inject(Api);
  private readonly ref = inject<MatDialogRef<EngineerDialog, EngineerResponse>>(MatDialogRef);
  protected readonly editing = inject<EngineerDialogData>(MAT_DIALOG_DATA).engineer;

  /** The teams the user may put engineers in (the gateway lists only those) */
  protected readonly teams = apiResource(listTeams, () => ({}));

  protected readonly model = signal({
    name: this.editing?.name ?? '',
    email: this.editing?.email ?? '',
    team: this.editing?.team ?? '',
    pagerDutyUserId: this.editing?.pagerDutyUserId ?? '',
    active: this.editing?.active ?? true,
  });
  protected readonly engineerForm = form(this.model, (path) => {
    required(path.name, { message: 'Enter a name' });
    maxLength(path.name, 255, { message: 'Use at most 255 characters' });
    required(path.email, { message: 'Enter an email address' });
    email(path.email, { message: 'Enter a valid email address' });
    required(path.team, { message: 'Pick a team' });
    maxLength(path.pagerDutyUserId, 255, { message: 'Use at most 255 characters' });
  });

  protected readonly formError = computed(() => this.engineerForm().errors()[0]?.message ?? null);
  protected readonly firstError = firstError;

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.engineerForm, async (fields) => {
      const { name, email, team, pagerDutyUserId, active } = this.model();
      const body = {
        name: name.trim(),
        email: email.trim(),
        team,
        pagerDutyUserId: pagerDutyUserId.trim() || null,
        active,
      };
      try {
        const saved = this.editing
          ? await this.api.invoke(updateEngineer, { id: this.editing.id, body }, handlesErrors())
          : await this.api.invoke(createEngineer, { body }, handlesErrors());
        this.ref.close(saved);
        return undefined;
      } catch (error) {
        return serverErrors(fields, error, {
          labels: {
            name: 'Name',
            email: 'Email',
            team: 'Team',
            pagerDutyUserId: 'PagerDuty user ID',
          },
        });
      }
    });
  }
}
