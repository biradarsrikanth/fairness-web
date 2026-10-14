import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import {
  FormField,
  email,
  form,
  hidden,
  maxLength,
  required,
  submit,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Api } from '../../../api/api';
import {
  createUser,
  getEngineer,
  listEngineers,
  listTeams,
  updateUser,
} from '../../../api/functions';
import { TemporaryPasswordResponse, UserAccountResponse } from '../../../api/models';
import { Role } from '../../../core/auth/auth';
import { handlesErrors } from '../../../core/http/api-error';
import { apiResource } from '../../../core/http/api-resource';
import { firstError, serverErrors } from '../../../shared/forms/server-errors';

export interface UserDialogData {
  /** The user to edit; absent to create one */
  readonly user?: UserAccountResponse;
}

/** Closes with the created user and their one-time password, or the updated user. */
export type UserDialogResult =
  { readonly created: TemporaryPasswordResponse } | { readonly updated: UserAccountResponse };

export const ROLES: readonly { value: Role; label: string; description: string }[] = [
  {
    value: 'ADMIN',
    label: 'Admin',
    description: 'Everything, including users and PagerDuty syncs',
  },
  { value: 'MANAGER', label: 'Manager', description: 'The teams they are given' },
  { value: 'ENGINEER', label: 'Engineer', description: 'Their own figures and their team' },
];

/**
 * Creates or edits a login. An engineer's login belongs to one engineer; a manager sees the teams they're
 * given (chosen here when creating, from the Teams action later).
 */
@Component({
  selector: 'app-user-dialog',
  imports: [
    FormField,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './user-dialog.html',
  styleUrl: '../../../shared/dialogs/form-dialog.scss',
})
export class UserDialog {
  private readonly api = inject(Api);
  private readonly ref = inject<MatDialogRef<UserDialog, UserDialogResult>>(MatDialogRef);
  protected readonly editing = inject<UserDialogData>(MAT_DIALOG_DATA).user;

  protected readonly teams = apiResource(listTeams, () => ({}));
  protected readonly teamNames = computed(() =>
    (this.teams.value() ?? []).map((team) => team.name).sort((a, b) => a.localeCompare(b)),
  );

  /** The engineer this login is linked to now, when editing one: it decides the team shown first. */
  private readonly linked = apiResource(getEngineer, () =>
    this.editing?.engineerId ? { id: this.editing.engineerId } : undefined,
  );
  /**
   * Engineers are picked within a team: a page holds at most 100 (the gateway's limit), and one team's
   * engineers always fit, however many the company has.
   */
  protected readonly engineerTeam = linkedSignal<string | null>(
    () => this.linked.value()?.team ?? null,
  );
  protected readonly engineers = apiResource(listEngineers, () => {
    const team = this.engineerTeam();
    return team ? { team, size: 100, sort: ['name,asc'] } : undefined;
  });

  protected readonly model = signal({
    email: this.editing?.email ?? '',
    fullName: this.editing?.fullName ?? '',
    role: (this.editing?.role ?? 'ENGINEER') as Role,
    engineerId: (this.editing?.engineerId ?? null) as number | null,
    teamIds: [] as number[],
    enabled: this.editing?.enabled ?? true,
  });
  protected readonly userForm = form(this.model, (path) => {
    required(path.email, { message: 'Enter an email address' });
    email(path.email, { message: 'Enter a valid email address' });
    required(path.fullName, { message: 'Enter a name' });
    maxLength(path.fullName, 255, { message: 'Use at most 255 characters' });
    required(path.engineerId, {
      message: 'Pick the engineer this login is for',
      when: ({ valueOf }) => valueOf(path.role) === 'ENGINEER',
    });
    hidden(path.engineerId, { when: ({ valueOf }) => valueOf(path.role) !== 'ENGINEER' });
    hidden(path.teamIds, { when: ({ valueOf }) => valueOf(path.role) !== 'MANAGER' });
  });

  protected readonly roles = ROLES;
  protected readonly formError = computed(() => this.userForm().errors()[0]?.message ?? null);
  protected readonly firstError = firstError;
  /** Changing these ends the user's sessions (the gateway's rule) */
  protected readonly endsSessions = computed(
    () =>
      this.editing !== undefined &&
      (this.model().role !== this.editing.role || (this.editing.enabled && !this.model().enabled)),
  );

  /** A different team: the engineer picked from the old one no longer applies. */
  protected pickTeam(team: string): void {
    this.engineerTeam.set(team);
    if (this.linked.value()?.team !== team) {
      this.model.update((model) => ({ ...model, engineerId: null }));
    }
  }

  /** When the full name is empty, picking an engineer fills it in. */
  protected pickEngineer(id: number | null): void {
    if (id === null || this.model().fullName.trim()) return;
    const engineer = this.engineers.value()?.content.find((e) => e.id === id);
    if (engineer) this.model.update((model) => ({ ...model, fullName: engineer.name }));
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.userForm, async (fields) => {
      const { email, fullName, role, engineerId, teamIds, enabled } = this.model();
      const common = {
        email: email.trim(),
        fullName: fullName.trim(),
        role,
        engineerId: role === 'ENGINEER' ? engineerId : null,
      };
      try {
        if (this.editing) {
          const updated = await this.api.invoke(
            updateUser,
            { id: this.editing.id, body: { ...common, enabled } },
            handlesErrors(),
          );
          this.ref.close({ updated });
        } else {
          const created = await this.api.invoke(
            createUser,
            { body: { ...common, teamIds: role === 'MANAGER' ? teamIds : null } },
            handlesErrors(),
          );
          this.ref.close({ created });
        }
        return undefined;
      } catch (error) {
        return serverErrors(fields, error, {
          labels: { email: 'Email', fullName: 'Name', engineerId: 'Engineer', teamIds: 'Teams' },
        });
      }
    });
  }
}
