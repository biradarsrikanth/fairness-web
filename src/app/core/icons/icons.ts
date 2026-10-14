import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

/*
 * The app's own icons, drawn for Fairness on a 20-pixel grid with 1.5-pixel lines and square ends so they
 * sit well next to the monospace type. They ship in the bundle (no icon font to download) and draw in
 * currentColor. Use them as <mat-icon svgIcon="alerts" />.
 */
const SHAPES = {
  // Pages
  analytics:
    '<path d="M3 3v14h14"/><path d="M6 13l3-4 3 2 4-6"/><rect x="14.5" y="3.5" width="3" height="3"/>',
  alerts:
    '<path d="M6 15v-4a4 4 0 0 1 8 0v4"/><path d="M4 15h12v2H4z"/><path d="M10 2.5V4M4.2 5.2l1.1 1.1M15.8 5.2l-1.1 1.1"/>',
  oncall:
    '<rect x="4" y="2.5" width="12" height="15" rx="1"/><path d="M7 5.5h6v4H7z"/><path d="M7 13h1M10 13h1"/><path d="M7 15.5h6"/>',
  reports:
    '<path d="M5 2.5h7l3 3v12H5z"/><path d="M12 2.5v3h3"/><path d="M8 15v-2.5M10.5 15v-5M13 15v-3.5"/>',
  engineers:
    '<circle cx="10" cy="7" r="3"/><path d="M4 17.5a6 6 0 0 1 12 0"/><path d="M6.5 7.5a3.5 3.5 0 0 1 7 0"/><path d="M13.5 8v1.5H12"/>',
  teams:
    '<rect x="8" y="2.5" width="4" height="4"/><rect x="2.5" y="13" width="4" height="4"/><rect x="13.5" y="13" width="4" height="4"/><path d="M10 6.5v3M4.5 13v-3.5h11V13"/>',
  users:
    '<rect x="2.5" y="4.5" width="15" height="11" rx="1"/><circle cx="7" cy="9.5" r="1.8"/><path d="M4.5 13.5a2.5 2.5 0 0 1 5 0"/><path d="M11.5 8.5h3.5M11.5 11.5h2.5"/>',
  sync: '<path d="M15.5 7.5A6 6 0 0 0 4.6 6.5"/><path d="M4 3v4h4"/><path d="M4.5 12.5a6 6 0 0 0 10.9 1"/><path d="M16 17v-4h-4"/>',
  audit:
    '<path d="M6 2.5v15"/><rect x="4.5" y="4" width="3" height="3"/><rect x="4.5" y="8.5" width="3" height="3"/><rect x="4.5" y="13" width="3" height="3"/><path d="M10 5.5h6.5M10 10h6.5M10 14.5h4"/>',

  // Header and footer
  search: '<circle cx="8.5" cy="8.5" r="5"/><path d="M12.2 12.2l4.8 4.8"/>',
  bell: '<path d="M5 14V9a5 5 0 0 1 10 0v5l1.5 1.5h-13z"/><path d="M8.5 17.5h3"/>',
  help: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M8 8a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.6V12"/><path d="M10 14.5v.5"/>',
  link: '<path d="M8 12l4-4"/><path d="M9 5.5l1.5-1.5a3.5 3.5 0 0 1 5 5L14 10.5"/><path d="M11 14.5L9.5 16a3.5 3.5 0 0 1-5-5L6 9.5"/>',
  database:
    '<ellipse cx="10" cy="5" rx="6" ry="2.5"/><path d="M4 5v10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5"/><path d="M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5"/>',
  clock: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4.5l3 2"/>',
  keyboard:
    '<rect x="2.5" y="5.5" width="15" height="9" rx="1"/><path d="M5.5 8.5h1M9.5 8.5h1M13.5 8.5h1M6 11.5h8"/>',
  sun: '<circle cx="10" cy="10" r="3.2"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
  terminal:
    '<rect x="2.5" y="4" width="15" height="12" rx="1"/><path d="M6 8l2.5 2L6 12M10.5 12.5h3.5"/>',

  // Actions
  download: '<path d="M10 3v9M6 8.5l4 4 4-4"/><path d="M3.5 14.5v2h13v-2"/>',
  filter: '<path d="M3 4.5h14l-5.5 6.5v5l-3 1.5v-6.5z"/>',
  refresh: '<path d="M16 10a6 6 0 1 1-1.8-4.3"/><path d="M15.5 2.5v4h-4"/>',
  edit: '<path d="M13 3.5l3.5 3.5L7 16.5H3.5V13z"/><path d="M11 5.5l3.5 3.5"/>',
  delete:
    '<path d="M3.5 5.5h13"/><path d="M8 5.5v-2h4v2"/><path d="M5 5.5l.8 11h8.4l.8-11"/><path d="M8.5 8.5v5M11.5 8.5v5"/>',
  copy: '<rect x="7" y="7" width="9.5" height="9.5" rx="1"/><path d="M13 7V3.5H3.5V13H7"/>',
  key: '<circle cx="6.5" cy="13.5" r="3"/><path d="M8.6 11.4L16 4M13 7l2 2M14.5 5.5l1.5 1.5"/>',
  lock: '<rect x="4" y="9" width="12" height="8.5" rx="1"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>',
  unlock: '<rect x="4" y="9" width="12" height="8.5" rx="1"/><path d="M7 9V6.5a3 3 0 0 1 5.8-1"/>',
  logout: '<path d="M8 3.5H4v13h4"/><path d="M13 6.5l3.5 3.5-3.5 3.5M16.5 10H8"/>',
  external: '<path d="M11 3.5h5.5V9M16.5 3.5L9 11"/><path d="M14 12v4.5H3.5V6H8"/>',
  pdf: '<path d="M5 2.5h7l3 3v12H5z"/><path d="M12 2.5v3h3"/><path d="M7.5 10h5M7.5 12.5h5M7.5 15h3"/>',
  sheet:
    '<path d="M5 2.5h7l3 3v12H5z"/><path d="M12 2.5v3h3"/><path d="M7.5 9.5h5v5.5h-5zM10 9.5V15M7.5 12.25h5"/>',
  chart: '<path d="M3 16.5h14"/><path d="M5.5 16.5v-5M10 16.5v-10M14.5 16.5v-7"/>',
  table: '<rect x="3" y="4" width="14" height="12" rx="1"/><path d="M3 8h14M3 12h14M8 8v8"/>',

  // People
  user: '<circle cx="10" cy="7" r="3.2"/><path d="M4 17a6 6 0 0 1 12 0"/>',
  'person-add':
    '<circle cx="8" cy="7" r="3"/><path d="M2.5 17a5.5 5.5 0 0 1 11 0"/><path d="M15.5 6v5M13 8.5h5"/>',
  'person-off':
    '<circle cx="10" cy="7" r="3.2"/><path d="M4 17a6 6 0 0 1 12 0"/><path d="M3 3l14 14"/>',
  'group-add':
    '<circle cx="7" cy="8" r="2.5"/><path d="M2.5 16.5a4.5 4.5 0 0 1 9 0"/><path d="M11 5.6a2.5 2.5 0 1 1 1.5 4.6"/><path d="M13 12.5a4.5 4.5 0 0 1 3 2"/><path d="M16 2.5v4M14 4.5h4"/>',

  // Navigation
  menu: '<path d="M3 5.5h14M3 10h14M3 14.5h14"/>',
  close: '<path d="M5 5l10 10M15 5L5 15"/>',
  back: '<path d="M16.5 10h-13M8 5l-5 5 5 5"/>',
  'chevron-right': '<path d="M8 5l5 5-5 5"/>',
  'chevron-down': '<path d="M5 8l5 5 5-5"/>',
  'arrow-up': '<path d="M10 16.5v-13M5 8l5-5 5 5"/>',
  'arrow-down': '<path d="M10 3.5v13M5 12l5 5 5-5"/>',
  more: '<path d="M10 4.5v.5M10 9.75v.5M10 15v.5" stroke-width="2.5"/>',

  // Status
  check: '<path d="M4 10.5l4 4 8-9"/>',
  'check-circle': '<circle cx="10" cy="10" r="7"/><path d="M6.8 10.2l2.2 2.2 4.2-4.6"/>',
  info: '<circle cx="10" cy="10" r="7"/><path d="M10 9v5M10 6.5v.5"/>',
  error: '<circle cx="10" cy="10" r="7"/><path d="M10 6v5M10 13.5v.5"/>',
  warning: '<path d="M10 3l7.5 13.5h-15z"/><path d="M10 8v4M10 14v.5"/>',
  cancel: '<circle cx="10" cy="10" r="7"/><path d="M7.5 7.5l5 5M12.5 7.5l-5 5"/>',
} as const;

export type IconName = keyof typeof SHAPES;

export const ICON_NAMES = Object.keys(SHAPES) as IconName[];

/** The full SVG for one icon. */
export function iconSvg(name: IconName): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" ' +
    `stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${SHAPES[name]}</svg>`
  );
}

/** Adds every icon to Material's registry, once, when the app (or a test) starts. */
export function provideIcons(): EnvironmentProviders {
  return provideEnvironmentInitializer(registerIcons);
}

function registerIcons(): void {
  const registry = inject(MatIconRegistry);
  const sanitizer = inject(DomSanitizer);
  for (const name of ICON_NAMES) {
    // The markup is a constant in this file, never user input
    registry.addSvgIconLiteral(name, sanitizer.bypassSecurityTrustHtml(iconSvg(name)));
  }
}
