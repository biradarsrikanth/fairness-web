import { DOCUMENT } from '@angular/common';
import { DestroyRef, Service, computed, inject, signal } from '@angular/core';

/** Paper: light pages framed by dark bars. Console: dark throughout. */
export type ThemeMode = 'paper' | 'console';
/** What the user picked; "system" follows the operating system's light or dark setting. */
export type ThemeChoice = ThemeMode | 'system';

/** public/theme-boot.js reads the same key before the app starts, so the first paint has the right mode. */
export const THEME_STORAGE_KEY = 'fairness-web:mode';

function isMode(value: unknown): value is ThemeMode {
  return value === 'paper' || value === 'console';
}

/**
 * The colour mode. The choice is kept in this browser only (localStorage), follows the operating system
 * until the user picks one, and is shared by every open tab.
 */
@Service()
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly media =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

  private readonly chosen = signal<ThemeChoice>(readChoice());
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly choice = this.chosen.asReadonly();
  readonly mode = computed<ThemeMode>(() => {
    const choice = this.chosen();
    return choice === 'system' ? (this.systemDark() ? 'console' : 'paper') : choice;
  });

  constructor() {
    const onSystemChange = (event: MediaQueryListEvent) => this.systemDark.set(event.matches);
    this.media?.addEventListener('change', onSystemChange);

    // Another tab changed the mode
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      this.apply(isMode(event.newValue) ? event.newValue : 'system');
    };
    addEventListener('storage', onStorage);

    inject(DestroyRef).onDestroy(() => {
      this.media?.removeEventListener('change', onSystemChange);
      removeEventListener('storage', onStorage);
    });
    this.apply(this.chosen());
  }

  /** Switches between Paper and Console, and remembers the choice. */
  toggle(): void {
    this.set(this.mode() === 'console' ? 'paper' : 'console');
  }

  set(choice: ThemeChoice): void {
    this.apply(choice);
    try {
      if (choice === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
      // Storage blocked (private window, site data off): the choice lasts for this page only
    }
  }

  private apply(choice: ThemeChoice): void {
    this.chosen.set(choice);
    if (choice === 'system') this.root.removeAttribute('data-mode');
    else this.root.setAttribute('data-mode', choice);
  }
}

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isMode(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}
