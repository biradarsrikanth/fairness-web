import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit, validate } from '@angular/forms/signals';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Api } from '../../api/api';
import { createTeam, updateTeam } from '../../api/functions';
import { TeamResponse } from '../../api/models';
import { handlesErrors } from '../../core/http/api-error';
import { firstError, serverErrors } from '../../shared/forms/server-errors';

export interface TeamDialogData {
  /** The team to edit; absent to add one */
  readonly team?: TeamResponse;
}

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Current names the browser's list may lack: ICU lists some zones under their old names (Asia/Calcutta for
 * Asia/Kolkata). The gateway accepts both.
 */
const CURRENT_NAMES = [
  'Asia/Kolkata',
  'Asia/Kathmandu',
  'Asia/Ho_Chi_Minh',
  'Asia/Yangon',
  'Europe/Kyiv',
  'America/Nuuk',
  'Pacific/Kanton',
];

/** Timezones to suggest: the browser's IANA list plus the current names it may lack. */
export const TIMEZONES: readonly string[] = [
  ...new Set([...Intl.supportedValuesOf('timeZone'), ...CURRENT_NAMES.filter(isTimeZone)]),
].sort();

/** Whether the browser knows the zone, under any of its names. */
export function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Timezones matching what's typed, anywhere in the name ("kolk" finds Asia/Kolkata). */
export function matchTimezones(query: string, limit = 50): string[] {
  const needle = query.trim().toLowerCase().replaceAll(' ', '_');
  return TIMEZONES.filter((zone) => zone.toLowerCase().includes(needle)).slice(0, limit);
}

/** Adds or edits a team. Closes with the saved team. */
@Component({
  selector: 'app-team-dialog',
  imports: [
    FormField,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ editing ? 'Edit ' + editing.name : 'Add a team' }}</h2>
    <form novalidate (submit)="save($event)">
      <mat-dialog-content>
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput autocomplete="off" [formField]="teamForm.name" />
          @if (editing) {
            <mat-hint>Links and filters that name the team use the new name from now on</mat-hint>
          }
          @if (firstError(teamForm.name); as message) {
            <mat-error>{{ message }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Timezone</mat-label>
          <input
            matInput
            autocomplete="off"
            [formField]="teamForm.timezone"
            [matAutocomplete]="zones"
          />
          <mat-autocomplete #zones="matAutocomplete">
            @for (zone of suggestions(); track zone) {
              <mat-option [value]="zone">{{ zone }}</mat-option>
            }
          </mat-autocomplete>
          <mat-hint>Where the team works: decides what counts as night and weekend</mat-hint>
          @if (firstError(teamForm.timezone); as message) {
            <mat-error>{{ message }}</mat-error>
          }
        </mat-form-field>

        @if (formError(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button matButton="filled" type="submit" [disabled]="teamForm().submitting()">
          {{ teamForm().submitting() ? 'Saving…' : editing ? 'Save' : 'Add team' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: '../../shared/dialogs/form-dialog.scss',
})
export class TeamDialog {
  private readonly api = inject(Api);
  private readonly ref = inject<MatDialogRef<TeamDialog, TeamResponse>>(MatDialogRef);
  protected readonly editing = inject<TeamDialogData>(MAT_DIALOG_DATA).team;

  protected readonly model = signal({
    name: this.editing?.name ?? '',
    timezone: this.editing?.timezone ?? DEFAULT_TIMEZONE,
  });
  protected readonly teamForm = form(this.model, (path) => {
    required(path.name, { message: 'Enter a name' });
    maxLength(path.name, 255, { message: 'Use at most 255 characters' });
    required(path.timezone, { message: 'Pick a timezone' });
    validate(path.timezone, ({ value }) =>
      value() && !isTimeZone(value())
        ? { kind: 'timezone', message: 'Pick a timezone from the list' }
        : undefined,
    );
  });

  protected readonly suggestions = computed(() => matchTimezones(this.model().timezone));
  protected readonly formError = computed(() => this.teamForm().errors()[0]?.message ?? null);
  protected readonly firstError = firstError;

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.teamForm, async (fields) => {
      const body = { name: this.model().name.trim(), timezone: this.model().timezone };
      try {
        const saved = this.editing
          ? await this.api.invoke(updateTeam, { id: this.editing.id, body }, handlesErrors())
          : await this.api.invoke(createTeam, { body }, handlesErrors());
        this.ref.close(saved);
        return undefined;
      } catch (error) {
        return serverErrors(fields, error, { labels: { name: 'Name', timezone: 'Timezone' } });
      }
    });
  }
}
