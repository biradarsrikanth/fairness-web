import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../api/api';
import { deleteTeam, listTeams } from '../../api/functions';
import { TeamResponse } from '../../api/models';
import { AuthService } from '../../core/auth/auth';
import { describeError, errorCode, handlesErrors } from '../../core/http/api-error';
import { apiResource } from '../../core/http/api-resource';
import { confirmAction } from '../../shared/dialogs/confirm-dialog';
import { TeamDialog, TeamDialogData } from './team-dialog';

/** Teams and their timezones. Admins add and remove teams; managers rename and move their own. */
@Component({
  selector: 'app-teams-page',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-bar">
        <div>
          <span class="eyebrow">People / <b>Teams</b></span>
          <h1>Teams</h1>
        </div>
        @if (isAdmin()) {
          <button matButton="filled" type="button" (click)="edit()">
            <mat-icon svgIcon="group-add" />
            Add team
          </button>
        }
      </div>

      @if (error()) {
        <div class="page-problem" role="alert">
          <mat-icon aria-hidden="true" svgIcon="error" />
          <span>Couldn't load teams. {{ error() }}</span>
          <button matButton type="button" (click)="teams.reload()">Try again</button>
        </div>
      }

      @if (sorted(); as teams) {
        <section class="panel">
          @if (teams.length === 0) {
            <p class="muted">No teams yet.</p>
          } @else {
            <table class="data-table" aria-label="Teams">
              <thead>
                <tr>
                  <th scope="col">Team</th>
                  <th scope="col">Timezone</th>
                  <th scope="col"><span class="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (team of teams; track team.id) {
                  <tr>
                    <th scope="row">{{ team.name }}</th>
                    <td>{{ team.timezone }}</td>
                    <td class="num actions">
                      <a
                        matButton
                        [routerLink]="['/engineers']"
                        [queryParams]="{ team: team.name }"
                      >
                        Engineers
                      </a>
                      <a
                        matButton
                        [routerLink]="['/analytics']"
                        [queryParams]="{ team: team.name }"
                      >
                        Analytics
                      </a>
                      <button matButton type="button" (click)="edit(team)">Edit</button>
                      @if (isAdmin()) {
                        <button matButton type="button" (click)="remove(team)">Delete</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
      } @else if (teams.isLoading()) {
        <p class="muted" role="status">Loading teams…</p>
      }
    </div>
  `,
  styles: `
    .actions {
      white-space: nowrap;
    }
  `,
})
export class TeamsPage {
  private readonly api = inject(Api);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly auth = inject(AuthService);

  protected readonly teams = apiResource(listTeams, () => ({}));
  protected readonly sorted = computed(() =>
    this.teams.hasValue()
      ? [...this.teams.value()!].sort((a, b) => a.name.localeCompare(b.name))
      : undefined,
  );
  protected readonly error = computed(() => {
    const error = this.teams.error();
    return error ? describeError(error) : null;
  });
  protected readonly isAdmin = computed(() => this.auth.hasRole('ADMIN'));

  protected async edit(team?: TeamResponse): Promise<void> {
    const ref = this.dialog.open<TeamDialog, TeamDialogData, TeamResponse>(TeamDialog, {
      data: { team },
      autoFocus: 'first-tabbable',
    });
    const saved = await firstValueFrom(ref.afterClosed());
    if (!saved) return;
    this.snackBar.open(team ? `Saved ${saved.name}.` : `Added ${saved.name}.`, 'OK', {
      duration: 5000,
    });
    this.teams.reload();
    // The team filters elsewhere come from the session's team list
    void this.auth.reloadUser();
  }

  protected async remove(team: TeamResponse): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: `Delete ${team.name}?`,
      message: 'Only a team without engineers can be deleted; move them to another team first.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await this.api.invoke(deleteTeam, { id: team.id }, handlesErrors());
      this.snackBar.open(`Deleted ${team.name}.`, 'OK', { duration: 5000 });
      this.teams.reload();
      void this.auth.reloadUser();
    } catch (error) {
      const message =
        errorCode(error) === 'CONFLICT'
          ? describeError(error)
          : `Couldn't delete it. ${describeError(error)}`;
      this.snackBar.open(message, 'Dismiss');
    }
  }
}
