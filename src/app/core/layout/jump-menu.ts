import { Component, computed, inject, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth';
import { IconName } from '../icons/icons';
import { ThemeService } from '../theme/theme';
import { navigationFor } from './navigation';

export interface JumpItem {
  readonly id: string;
  readonly label: string;
  readonly group: 'Pages' | 'Teams' | 'Actions';
  readonly icon: IconName;
  /** Extra words that should match, e.g. the team name on its alert link */
  readonly keywords?: string;
  readonly run: () => void;
}

/** Items whose label or keywords contain every word typed, in any order. */
export function matchJumpItems(items: readonly JumpItem[], query: string): JumpItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...items];
  return items.filter((item) => {
    const haystack = `${item.label} ${item.keywords ?? ''} ${item.group}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * Ctrl K: jump to a page or a team's figures, or switch the colour mode, from the keyboard. Everything is
 * in memory already, so typing makes no requests.
 */
@Component({
  selector: 'app-jump-menu',
  imports: [MatIconModule],
  template: `
    <div class="search">
      <mat-icon svgIcon="search" />
      <input
        #input
        type="text"
        role="combobox"
        aria-label="Jump to a page, team or action"
        aria-autocomplete="list"
        aria-controls="jump-list"
        aria-expanded="true"
        [attr.aria-activedescendant]="active()?.id ? 'jump-' + active()!.id : null"
        placeholder="Jump to a page, team or action"
        autocomplete="off"
        spellcheck="false"
        [value]="query()"
        (input)="search(input.value)"
        (keydown)="onKey($event)"
        cdkFocusInitial
      />
      <kbd>Esc</kbd>
    </div>
    <ul id="jump-list" role="listbox" aria-label="Results">
      @for (item of results(); track item.id; let i = $index) {
        @if (i === 0 || results()[i - 1].group !== item.group) {
          <li class="group" role="presentation">{{ item.group }}</li>
        }
        <li
          role="option"
          [id]="'jump-' + item.id"
          [attr.aria-selected]="i === index()"
          [class.on]="i === index()"
          tabindex="-1"
          (mousemove)="index.set(i)"
          (click)="choose(item)"
          (keydown.enter)="choose(item)"
        >
          <mat-icon [svgIcon]="item.icon" />
          <span>{{ item.label }}</span>
        </li>
      } @empty {
        <li class="none" role="presentation">Nothing matches “{{ query() }}”.</li>
      }
    </ul>
    <footer>
      <span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span>
    </footer>
  `,
  styleUrl: './jump-menu.scss',
})
export class JumpMenu {
  private readonly dialog = inject(MatDialogRef<JumpMenu>);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);

  protected readonly query = signal('');
  protected readonly index = signal(0);

  private readonly items = computed<JumpItem[]>(() => {
    const go = (url: string, queryParams?: Record<string, string>) => () =>
      void this.router.navigate([url], { queryParams });
    const pages = navigationFor((...roles) => this.auth.hasRole(...roles)).flatMap((group) =>
      group.items.map<JumpItem>((item) => ({
        id: `page${item.path.replaceAll('/', '-')}`,
        label: item.label,
        group: 'Pages',
        icon: item.icon,
        keywords: group.label,
        run: go(item.path),
      })),
    );
    const teams = [...(this.auth.user()?.teams ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap<JumpItem>((team) => [
        {
          id: `team-${team.id}-analytics`,
          label: `${team.name} · analytics`,
          group: 'Teams',
          icon: 'analytics',
          run: go('/analytics', { team: team.name }),
        },
        {
          id: `team-${team.id}-alerts`,
          label: `${team.name} · alerts`,
          group: 'Teams',
          icon: 'alerts',
          run: go('/alerts', { team: team.name }),
        },
      ]);
    const console = this.theme.mode() === 'console';
    const actions: JumpItem[] = [
      {
        id: 'mode',
        label: console ? 'Switch to Paper (light)' : 'Switch to Console (dark)',
        group: 'Actions',
        icon: console ? 'sun' : 'terminal',
        keywords: 'theme mode dark light colour color',
        run: () => this.theme.toggle(),
      },
      {
        id: 'password',
        label: 'Change password',
        group: 'Actions',
        icon: 'key',
        run: go('/change-password'),
      },
      {
        id: 'sign-out',
        label: 'Sign out',
        group: 'Actions',
        icon: 'logout',
        keywords: 'log out logout',
        run: () => void this.auth.logout(),
      },
    ];
    return [...pages, ...teams, ...actions];
  });

  /** Typing filters; with nothing typed the long team list waits for a word. */
  protected readonly results = computed(() => {
    const query = this.query();
    const matches = matchJumpItems(this.items(), query);
    return query.trim() ? matches.slice(0, 30) : matches.filter((item) => item.group !== 'Teams');
  });
  protected readonly active = computed(() => this.results()[this.index()] ?? null);

  protected search(value: string): void {
    this.query.set(value);
    this.index.set(0);
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault();
      this.index.update((i) => (i + 1) % count);
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault();
      this.index.update((i) => (i - 1 + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = this.active();
      if (item) this.choose(item);
    }
  }

  protected choose(item: JumpItem): void {
    this.dialog.close();
    item.run();
  }
}
