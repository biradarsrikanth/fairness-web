import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Params, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../api/api';
import { deleteEngineer, listEngineers, updateEngineer } from '../../api/functions';
import { EngineerResponse } from '../../api/models';
import { AuthService } from '../../core/auth/auth';
import { describeError, errorCode, handlesErrors } from '../../core/http/api-error';
import { apiResource, keepLast } from '../../core/http/api-resource';
import { SearchField } from '../../shared/components/search-field';
import { confirmAction } from '../../shared/dialogs/confirm-dialog';
import {
  PAGE_SIZES,
  matSort,
  pagingParams,
  parseListState,
  pageChange,
  sortChange,
} from '../../shared/list/list-state';
import { EngineerDialog, EngineerDialogData } from './engineer-dialog';

const ENGINEER_LIST = { sortable: ['name', 'email'], defaultSort: 'name,asc' };

/** The engineers a manager looks after (an admin: everyone), with adding, editing and removing them. */
@Component({
  selector: 'app-engineers-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    RouterLink,
    SearchField,
  ],
  templateUrl: './engineers-page.html',
})
export class EngineersPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly auth = inject(AuthService);

  /** Query parameters */
  readonly team = input<string>();
  readonly active = input<string>();
  readonly q = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();
  readonly sort = input<string>();

  protected readonly teamFilter = computed(() => this.team()?.trim() || null);
  /** 'true' / 'false', or null for everyone */
  protected readonly activeFilter = computed(() =>
    this.active() === 'true' || this.active() === 'false' ? this.active()! : null,
  );
  /** Name or email; the gateway takes at most 100 characters */
  protected readonly query = computed(() => this.q()?.trim().slice(0, 100) || null);
  protected readonly list = computed(() =>
    parseListState({ page: this.page(), size: this.size(), sort: this.sort() }, ENGINEER_LIST),
  );
  protected readonly matSort = computed(() => matSort(this.list()));

  protected readonly engineers = apiResource(listEngineers, () => ({
    ...(this.teamFilter() !== null && { team: this.teamFilter()! }),
    ...(this.activeFilter() !== null && { active: this.activeFilter() === 'true' }),
    ...(this.query() !== null && { q: this.query()! }),
    ...pagingParams(this.list()),
  }));
  protected readonly data = keepLast(this.engineers);
  protected readonly error = computed(() => {
    const error = this.engineers.error();
    return error ? describeError(error) : null;
  });

  protected readonly teams = computed(() =>
    [...(this.auth.user()?.teams ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  );
  protected readonly columns = computed(() => [
    'name',
    'email',
    ...(this.teams().length > 1 ? ['team'] : []),
    'pagerDutyUserId',
    'active',
    'actions',
  ]);
  protected readonly pageSizes = PAGE_SIZES;

  protected setFilter(key: 'team' | 'active' | 'q', value: string | null): void {
    this.navigate({ [key]: value || null, page: null });
  }

  protected sorted(sort: Sort): void {
    this.navigate(sortChange(sort, ENGINEER_LIST));
  }

  protected paged(event: PageEvent): void {
    this.navigate(pageChange(this.list(), event, ENGINEER_LIST));
  }

  protected async edit(engineer?: EngineerResponse): Promise<void> {
    const ref = this.dialog.open<EngineerDialog, EngineerDialogData, EngineerResponse>(
      EngineerDialog,
      { data: { engineer }, autoFocus: 'first-tabbable' },
    );
    const saved = await firstValueFrom(ref.afterClosed());
    if (!saved) return;
    this.snackBar.open(engineer ? `Saved ${saved.name}.` : `Added ${saved.name}.`, 'OK', {
      duration: 5000,
    });
    this.engineers.reload();
  }

  protected async remove(engineer: EngineerResponse): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: `Remove ${engineer.name}?`,
      message:
        'Only an engineer without alerts or a login can be removed. Someone who has left keeps their ' +
        'history: mark them inactive instead.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await this.api.invoke(deleteEngineer, { id: engineer.id }, handlesErrors());
      this.snackBar.open(`Removed ${engineer.name}.`, 'OK', { duration: 5000 });
      this.engineers.reload();
    } catch (error) {
      const message =
        errorCode(error) === 'CONFLICT'
          ? describeError(error)
          : `Couldn't remove them. ${describeError(error)}`;
      this.snackBar.open(message, 'Dismiss');
    }
  }

  /** Takes someone off the rotation (or back on) while keeping their history. */
  protected async setActive(engineer: EngineerResponse, active: boolean): Promise<void> {
    try {
      await this.api.invoke(
        updateEngineer,
        {
          id: engineer.id,
          body: {
            name: engineer.name,
            email: engineer.email,
            team: engineer.team,
            pagerDutyUserId: engineer.pagerDutyUserId ?? null,
            active,
          },
        },
        handlesErrors(),
      );
      this.snackBar.open(`${engineer.name} is ${active ? 'active' : 'inactive'} now.`, 'OK', {
        duration: 5000,
      });
      this.engineers.reload();
    } catch (error) {
      this.snackBar.open(`Couldn't change ${engineer.name}. ${describeError(error)}`, 'Dismiss');
    }
  }

  private navigate(params: Params): void {
    void this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge' });
  }
}
