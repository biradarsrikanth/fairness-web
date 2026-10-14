import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { IconName } from '../../core/icons/icons';

interface RiskLook {
  readonly label: string;
  readonly icon: IconName;
  readonly tone: 'good' | 'warning' | 'critical' | 'unknown';
}

const LOOKS: Record<string, RiskLook> = {
  LOW: { label: 'Low', icon: 'check-circle', tone: 'good' },
  MEDIUM: { label: 'Medium', icon: 'error', tone: 'warning' },
  HIGH: { label: 'High', icon: 'warning', tone: 'critical' },
};

/** A burnout risk level: the status color always comes with an icon and the word. */
@Component({
  selector: 'app-risk-badge',
  imports: [MatIconModule],
  template: `
    <mat-icon aria-hidden="true" [svgIcon]="look().icon" />
    <span>{{ look().label }}<span class="visually-hidden"> burnout risk</span></span>
  `,
  host: { '[class]': '"badge " + look().tone' },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 7px 2px 5px;
      border-radius: var(--radius-xs);
      font-family: var(--font-mono);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--tone, var(--muted));
      background: var(--tone-bg, var(--surface-3));
      white-space: nowrap;
    }
    mat-icon {
      width: 14px;
      height: 14px;
    }
    :host(.good) {
      --tone: var(--ok);
      --tone-bg: var(--ok-bg);
    }
    :host(.warning) {
      --tone: var(--warn);
      --tone-bg: var(--warn-bg);
    }
    :host(.critical) {
      --tone: var(--crit-ink);
      --tone-bg: var(--crit-bg);
    }
  `,
})
export class RiskBadge {
  readonly risk = input.required<string>();

  protected readonly look = computed<RiskLook>(
    () => LOOKS[this.risk()] ?? { label: this.risk(), icon: 'help', tone: 'unknown' },
  );
}
