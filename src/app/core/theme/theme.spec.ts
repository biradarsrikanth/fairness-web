import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme';

describe('ThemeService', () => {
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    root.removeAttribute('data-mode');
  });

  afterEach(() => {
    localStorage.clear();
    root.removeAttribute('data-mode');
  });

  it('follows the system until the user picks a mode', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.choice()).toBe('system');
    expect(root.hasAttribute('data-mode')).toBe(false);
  });

  it('remembers a picked mode and marks the page', () => {
    const theme = TestBed.inject(ThemeService);
    theme.set('console');
    expect(theme.mode()).toBe('console');
    expect(root.getAttribute('data-mode')).toBe('console');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('console');
  });

  it('starts from the stored mode', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'paper');
    const theme = TestBed.inject(ThemeService);
    expect(theme.mode()).toBe('paper');
    expect(root.getAttribute('data-mode')).toBe('paper');
  });

  it('ignores a stored value it does not know', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(TestBed.inject(ThemeService).choice()).toBe('system');
  });

  it('toggles between the two modes', () => {
    const theme = TestBed.inject(ThemeService);
    theme.set('paper');
    theme.toggle();
    expect(theme.mode()).toBe('console');
    theme.toggle();
    expect(theme.mode()).toBe('paper');
  });

  it('goes back to the system setting and forgets the choice', () => {
    const theme = TestBed.inject(ThemeService);
    theme.set('console');
    theme.set('system');
    expect(root.hasAttribute('data-mode')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('follows a change made in another tab', () => {
    const theme = TestBed.inject(ThemeService);
    dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'console' }));
    expect(theme.mode()).toBe('console');
  });
});
