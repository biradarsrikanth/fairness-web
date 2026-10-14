import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { formatAgo, formatCount, formatMinutes, formatPct, formatRange } from '../../shared/format';
import { AuthService, Role } from '../auth/auth';
import { LoadingService } from '../http/loading';
import { ApiTelemetry } from '../http/telemetry';
import { ThemeService } from '../theme/theme';
import { JumpMenu } from './jump-menu';
import { navigationFor } from './navigation';
import { ShellStatus } from './shell-status';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  ENGINEER: 'Engineer',
};

export interface TickerItem {
  readonly label: string;
  readonly value: string;
  readonly tone?: 'crit' | 'warn' | 'acc';
}

/**
 * The signed-in app: a command bar with the jump menu, a ticker of the last 30 days, navigation for the
 * user's role, and a status bar that reports how the API is answering.
 */
@Component({
  selector: 'app-shell',
  imports: [
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSidenavModule,
    MatTooltipModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  providers: [ShellStatus],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly status = inject(ShellStatus);
  protected readonly telemetry = inject(ApiTelemetry);
  private readonly loading = inject(LoadingService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  protected readonly handset = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 959.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  // On a phone the menu slides over the page and closes after a choice
  protected readonly menuOpen = signal(false);

  private readonly navigating = toSignal(
    this.router.events.pipe(
      filter(
        (event) =>
          event instanceof NavigationStart ||
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError,
      ),
      map((event) => event instanceof NavigationStart),
    ),
    { initialValue: false },
  );
  protected readonly busy = computed(() => this.loading.active() || this.navigating());

  protected readonly groups = computed(() =>
    navigationFor((...roles) => this.auth.hasRole(...roles)),
  );
  protected readonly roleLabel = computed(() => {
    const role = this.auth.role();
    return role ? ROLE_LABELS[role] : '';
  });
  protected readonly initials = computed(() =>
    (this.auth.user()?.fullName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join(''),
  );
  protected readonly scope = computed(() => {
    if (this.auth.role() === 'ADMIN') return 'All teams';
    const teams = this.auth.user()?.teams ?? [];
    return teams.length === 1 ? teams[0].name : `${teams.length} teams`;
  });

  /** Ticks once a minute so "4 min ago" stays true without a request. */
  private readonly now = signal(Date.now());

  protected readonly ticker = computed<TickerItem[]>(() => {
    const summary = this.status.summary();
    if (!summary) return [];
    const items: TickerItem[] = [
      { label: 'Window', value: formatRange(summary.window.start, summary.window.end) },
      { label: 'Alerts', value: formatCount(summary.alerts.value), tone: 'acc' },
      { label: 'Time to ack', value: formatMinutes(summary.mttaMinutes.value) },
      { label: 'Time to resolve', value: formatMinutes(summary.mttrMinutes.value) },
      { label: 'After hours', value: formatPct(summary.afterHoursPct.value) },
      { label: 'Escalated', value: formatPct(summary.escalationRatePct.value) },
    ];
    const gini = summary.gini?.value;
    if (gini !== null && gini !== undefined) {
      const label = summary.fairnessLabel ? ` ${summary.fairnessLabel.toLowerCase()}` : '';
      items.push({
        label: 'Gini',
        value: `${gini.toFixed(2)}${label}`,
        tone: gini >= 0.6 ? 'crit' : undefined,
      });
    }
    const highRisk = summary.highRiskEngineers?.value;
    if (highRisk !== null && highRisk !== undefined) {
      items.push({
        label: 'Burnout risk',
        value: `${formatCount(highRisk)} engineers`,
        tone: highRisk > 0 ? 'warn' : undefined,
      });
    }
    return items;
  });

  protected readonly figuresAge = computed(() => {
    const at = this.status.updatedAt();
    return at === null ? null : formatAgo(at, this.now());
  });
  protected readonly syncAge = computed(() => {
    const at = this.status.lastSync();
    return at === null ? null : formatAgo(at, this.now());
  });
  /** Administrators only: when PagerDuty last synced, and how often it's scheduled to. */
  protected readonly syncText = computed(() => {
    const sync = this.status.sync();
    if (!sync) return null;
    if (this.status.syncOff()) {
      return this.syncAge() ? `off, last synced ${this.syncAge()}` : 'off on this server';
    }
    const age = this.status.syncFailing()
      ? `failing, last success ${this.syncAge() ?? 'never'}`
      : (this.syncAge() ?? 'never synced');
    const every =
      sync.scheduled && sync.intervalSeconds ? Math.round(sync.intervalSeconds / 60) : null;
    return every ? `${age} · every ${every} min` : age;
  });
  protected readonly connectionText = computed(() => {
    switch (this.telemetry.connection()) {
      case 'online':
        return 'Connected';
      case 'degraded':
        return 'Server not answering';
      case 'offline':
        return 'Offline';
    }
  });
  protected readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  protected readonly shortcut =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
      ? '⌘K'
      : 'Ctrl K';

  constructor() {
    const clock = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(clock));
  }

  protected navigated(): void {
    if (this.handset()) this.menuOpen.set(false);
  }

  protected openJump(): void {
    if (this.dialog.getDialogById('jump-menu')) return;
    this.dialog.open(JumpMenu, {
      id: 'jump-menu',
      width: '560px',
      maxWidth: 'calc(100vw - 32px)',
      position: { top: '12vh' },
      ariaLabel: 'Jump to',
      panelClass: 'jump-panel',
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openJump();
    }
  }

  protected signOut(): void {
    void this.auth.logout();
  }
}
