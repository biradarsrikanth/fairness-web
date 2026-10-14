import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Params, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../../api/api';
import { deleteUser, listUsers, resetUserPassword, unlockUser } from '../../../api/functions';
import { PageResponseUserAccountResponse, UserAccountResponse } from '../../../api/models';
import { AuthService, Role } from '../../../core/auth/auth';
import { describeError, handlesErrors } from '../../../core/http/api-error';
import { apiResource } from '../../../core/http/api-resource';
import { SearchField } from '../../../shared/components/search-field';
import { confirmAction } from '../../../shared/dialogs/confirm-dialog';
import { formatInstant } from '../../../shared/format';
import {
  PAGE_SIZES,
  listQueryParams,
  matSort,
  pagingParams,
  parseListState,
  sortChange,
} from '../../../shared/list/list-state';
import { localTimeZone } from '../../alerts/alert-format';
import { TemporaryPasswordData, TemporaryPasswordDialog } from './temporary-password-dialog';
import { ROLES, UserDialog, UserDialogData, UserDialogResult } from './user-dialog';
import { UserTeamsDialog } from './user-teams-dialog';

const USER_LIST = {
  sortable: ['email', 'fullName', 'role', 'lastLoginAt'],
  defaultSort: 'email,asc',
};

/** Whether a sign-in lock is still on. */
export function isLocked(user: UserAccountResponse, now = Date.now()): boolean {
  return !!user.lockedUntil && Date.parse(user.lockedUntil) > now;
}

/** Logins: who may sign in, with what role, and which teams managers see. Admins only. */
@Component({
  selector: 'app-users-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    SearchField,
  ],
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss',
})
export class UsersPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly auth = inject(AuthService);

  /** Query parameters */
  readonly q = input<string>();
  readonly role = input<string>();
  readonly enabled = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();
  readonly sort = input<string>();

  protected readonly query = computed(() => this.q()?.trim() || null);
  protected readonly roleFilter = computed(
    () => ROLES.find((role) => role.value === this.role())?.value ?? null,
  );
  protected readonly enabledFilter = computed(() =>
    this.enabled() === 'true' || this.enabled() === 'false' ? this.enabled()! : null,
  );
  protected readonly list = computed(() =>
    parseListState({ page: this.page(), size: this.size(), sort: this.sort() }, USER_LIST),
  );
  protected readonly matSort = computed(() => matSort(this.list()));

  protected readonly users = apiResource(listUsers, () => ({
    ...(this.query() !== null && { q: this.query()! }),
    ...(this.roleFilter() !== null && { role: this.roleFilter()! }),
    ...(this.enabledFilter() !== null && { enabled: this.enabledFilter() === 'true' }),
    ...pagingParams(this.list()),
  }));
  protected readonly data = linkedSignal<
    PageResponseUserAccountResponse | undefined,
    PageResponseUserAccountResponse | undefined
  >({
    source: () => (this.users.hasValue() ? this.users.value() : undefined),
    computation: (value, previous) => value ?? previous?.value,
  });
  protected readonly error = computed(() => {
    const error = this.users.error();
    return error ? describeError(error) : null;
  });

  protected readonly columns = ['fullName', 'role', 'access', 'status', 'lastLoginAt', 'actions'];
  protected readonly roles = ROLES;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly isLocked = isLocked;
  protected readonly myId = computed(() => this.auth.user()?.id ?? null);
  private readonly timeZone = localTimeZone();

  protected roleLabel(role: Role): string {
    return ROLES.find((r) => r.value === role)?.label ?? role;
  }

  protected when(instant: string | null | undefined): string {
    return instant ? formatInstant(instant, this.timeZone) : 'Never';
  }

  /** The search box emits once the admin pauses typing. */
  protected search(term: string | null): void {
    this.navigate({ q: term, page: null });
  }

  protected setFilter(key: 'role' | 'enabled', value: string): void {
    this.navigate({ [key]: value || null, page: null });
  }

  protected sorted(sort: Sort): void {
    this.navigate(sortChange(sort, USER_LIST));
  }

  protected paged(event: PageEvent): void {
    this.navigate(
      listQueryParams({ ...this.list(), page: event.pageIndex, size: event.pageSize }, USER_LIST),
    );
  }

  protected async edit(user?: UserAccountResponse): Promise<void> {
    const ref = this.dialog.open<UserDialog, UserDialogData, UserDialogResult>(UserDialog, {
      data: { user },
      autoFocus: 'first-tabbable',
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    if ('created' in result) {
      const { user: created, temporaryPassword } = result.created;
      this.showPassword(`Added ${created.fullName}`, created.email, temporaryPassword);
    } else {
      this.snackBar.open(`Saved ${result.updated.fullName}.`, 'OK', { duration: 5000 });
    }
    this.users.reload();
  }

  protected async editTeams(user: UserAccountResponse): Promise<void> {
    const ref = this.dialog.open(UserTeamsDialog, { data: user, autoFocus: 'first-tabbable' });
    const updated = (await firstValueFrom(ref.afterClosed())) as UserAccountResponse | undefined;
    if (!updated) return;
    this.snackBar.open(`${updated.fullName} sees ${updated.teams.length} team(s) now.`, 'OK', {
      duration: 5000,
    });
    this.users.reload();
  }

  protected async resetPassword(user: UserAccountResponse): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: `Reset ${user.fullName}'s password?`,
      message:
        'They get a one-time password to sign in with, are signed out everywhere, and any lock is lifted.',
      confirmLabel: 'Reset password',
    });
    if (!confirmed) return;
    try {
      const result = await this.api.invoke(resetUserPassword, { id: user.id }, handlesErrors());
      this.showPassword('New one-time password', user.email, result.temporaryPassword);
      this.users.reload();
    } catch (error) {
      this.snackBar.open(`Couldn't reset the password. ${describeError(error)}`, 'Dismiss');
    }
  }

  protected async unlock(user: UserAccountResponse): Promise<void> {
    try {
      await this.api.invoke(unlockUser, { id: user.id }, handlesErrors());
      this.snackBar.open(`${user.fullName} can sign in again.`, 'OK', { duration: 5000 });
      this.users.reload();
    } catch (error) {
      this.snackBar.open(`Couldn't unlock them. ${describeError(error)}`, 'Dismiss');
    }
  }

  protected async remove(user: UserAccountResponse): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: `Delete ${user.fullName}'s login?`,
      message:
        'They can no longer sign in. Their engineer record and history stay; the audit log keeps their ' +
        'actions under their email.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await this.api.invoke(deleteUser, { id: user.id }, handlesErrors());
      this.snackBar.open(`Deleted ${user.fullName}'s login.`, 'OK', { duration: 5000 });
      this.users.reload();
    } catch (error) {
      this.snackBar.open(`Couldn't delete the login. ${describeError(error)}`, 'Dismiss');
    }
  }

  private showPassword(heading: string, email: string, password: string): void {
    this.dialog.open<TemporaryPasswordDialog, TemporaryPasswordData>(TemporaryPasswordDialog, {
      data: { heading, email, password },
      disableClose: true,
      width: '460px',
    });
  }

  private navigate(params: Params): void {
    void this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge' });
  }
}
