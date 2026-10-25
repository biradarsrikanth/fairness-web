import { Location } from '@angular/common';
import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../api/api';
import { deleteAlert, getAlert, listAlertAssignments } from '../../api/functions';
import { AlertAssignment } from '../../api/models';
import { AuthService } from '../../core/auth/auth';
import { describeError, errorCode, handlesErrors } from '../../core/http/api-error';
import { apiResource } from '../../core/http/api-resource';
import { confirmAction } from '../../shared/dialogs/confirm-dialog';
import { formatLocal, humanize } from '../../shared/format';
import { elapsed, severityClass, statusClass } from './alert-format';

const KIND_LABELS: Record<string, string> = {
  PAGED: 'Paged',
  ESCALATED: 'Escalated to',
  REASSIGNED: 'Reassigned to',
};

const SOURCE_LABELS: Record<string, string> = {
  LOG: 'PagerDuty log',
  WEBHOOK: 'Webhook (provisional)',
  BACKFILL: 'Imported',
  MANUAL: 'Entered here',
};

/** One alert: what fired, who was paged and when, and how long it took to handle. */
@Component({
  selector: 'app-alert-page',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './alert-page.html',
  styleUrl: './alert-page.scss',
})
export class AlertPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly auth = inject(AuthService);

  /** Route parameter */
  readonly id = input.required({ transform: numberAttribute });

  private readonly validId = computed(() => {
    const id = this.id();
    return Number.isInteger(id) && id > 0 ? id : undefined;
  });
  protected readonly alert = apiResource(getAlert, () => {
    const id = this.validId();
    return id === undefined ? undefined : { id };
  });
  protected readonly history = apiResource(listAlertAssignments, () => {
    const id = this.validId();
    return id === undefined ? undefined : { id };
  });

  protected readonly error = computed(() => {
    if (this.validId() === undefined) return 'There is no such alert.';
    const error = this.alert.error();
    if (!error) return null;
    if (errorCode(error) === 'NOT_FOUND') return 'There is no such alert.';
    if (errorCode(error) === 'FORBIDDEN') return "You don't have access to this alert.";
    return describeError(error);
  });
  protected readonly canDelete = computed(() => this.auth.hasRole('ADMIN'));
  protected readonly deleting = signal(false);

  protected readonly elapsed = elapsed;
  protected readonly humanize = humanize;
  protected readonly severityClass = severityClass;
  protected readonly statusClass = statusClass;
  protected when(instant: string | null | undefined): string {
    return instant ? formatLocal(instant) : '–';
  }

  protected kind(step: AlertAssignment): string {
    return KIND_LABELS[step.kind] ?? humanize(step.kind);
  }

  protected source(step: AlertAssignment): string {
    return SOURCE_LABELS[step.source] ?? humanize(step.source);
  }

  protected back(): void {
    // Back to the list as it was (filters, page), or to the list when opened from a link
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
    } else {
      void this.router.navigateByUrl('/alerts');
    }
  }

  protected async remove(): Promise<void> {
    const alert = this.alert.hasValue() ? this.alert.value() : undefined;
    if (!alert) return;
    const confirmed = await confirmAction(this.dialog, {
      title: 'Delete this alert?',
      message:
        'It disappears from every list, chart and score. A PagerDuty sync brings it back if the ' +
        'incident still exists there.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    this.deleting.set(true);
    try {
      await this.api.invoke(deleteAlert, { id: alert.id }, handlesErrors());
      this.snackBar.open('Alert deleted.', 'OK', { duration: 5000 });
      await this.router.navigateByUrl('/alerts');
    } catch (error) {
      this.snackBar.open(`Couldn't delete the alert. ${describeError(error)}`, 'Dismiss');
    } finally {
      this.deleting.set(false);
    }
  }
}
