import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

interface RiskLook {
  readonly label: string;
  readonly icon: string;
  readonly tone: 'good' | 'warning' | 'critical' | 'unknown';
}

const LOOKS: Record<string, RiskLook> = {
  LOW: { label: 'Low', icon: 'check_circle', tone: 'good' },
  MEDIUM: { label: 'Medium', icon: 'error', tone: 'warning' },
  HIGH: { label: 'High', icon: 'warning', tone: 'critical' },
};

/** A burnout risk level: the status color always comes with an icon and the word. */
@Component({
  selector: 'app-risk-badge',
  imports: [MatIconModule],
  template: `
    <mat-icon aria-hidden="true">{{ look().icon }}</mat-icon>
    <span>{{ look().label }}<span class="visually-hidden"> burnout risk</span></span>
  `,
  host: { '[class]': '"badge " + look().tone' },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px 2px 4px;
      border-radius: 999px;
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface);
      white-space: nowrap;
    }
    mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
    :host(.good) {
      background: color-mix(in srgb, var(--status-good) 12%, transparent);
    }
    :host(.good) mat-icon {
      color: var(--status-good);
    }
    :host(.warning) {
      background: color-mix(in srgb, var(--status-warning) 18%, transparent);
    }
    :host(.warning) mat-icon {
      color: #a36d00;
    }
    :host(.critical) {
      background: color-mix(in srgb, var(--status-critical) 12%, transparent);
    }
    :host(.critical) mat-icon {
      color: var(--status-critical);
    }
    :host(.unknown) {
      background: var(--mat-sys-surface-container-high);
    }
  `,
})
export class RiskBadge {
  readonly risk = input.required<string>();

  protected readonly look = computed<RiskLook>(
    () => LOOKS[this.risk()] ?? { label: this.risk(), icon: 'help', tone: 'unknown' },
  );
}
