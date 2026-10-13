import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { getWebhookEvent } from '../../../api/functions';
import { WebhookEventResponse } from '../../../api/models';
import { describeError } from '../../../core/http/api-error';
import { apiResource } from '../../../core/http/api-resource';

/** The body PagerDuty sent with a webhook, as received. */
@Component({
  selector: 'app-webhook-payload-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ event.eventType }}</h2>
    <mat-dialog-content>
      <p class="muted">PagerDuty event {{ event.pagerdutyEventId }}</p>
      @if (detail.hasValue()) {
        <pre>{{ payload() }}</pre>
      } @else if (detail.error()) {
        <p role="alert">Couldn't load the payload. {{ error() }}</p>
      } @else {
        <p class="muted" role="status">Loading…</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    pre {
      max-height: 60vh;
      overflow: auto;
      margin: 0;
      padding: 12px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container);
      font-size: 12px;
    }
  `,
})
export class WebhookPayloadDialog {
  protected readonly event = inject<WebhookEventResponse>(MAT_DIALOG_DATA);
  protected readonly detail = apiResource(getWebhookEvent, () => ({ id: this.event.id }));
  protected readonly payload = computed(() =>
    this.detail.hasValue() ? JSON.stringify(this.detail.value()!.payload, null, 2) : '',
  );
  protected readonly error = computed(() => {
    const error = this.detail.error();
    return error ? describeError(error) : null;
  });
}
