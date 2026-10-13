/**
 * Chart colors. Charts sit on CHART_SURFACE (styles.scss sets the same value as --chart-surface), so the
 * 2px gaps between marks, drawn in the surface color, read as gaps.
 *
 * Checked with the dataviz validator (light mode, surface #fcfcfb): the severity ramp passes as an ordinal
 * ramp (one hue, light to dark, P1 darkest); single-series charts use categorical slot 1.
 */
export const CHART_SURFACE = '#fcfcfb';

export const INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
} as const;

/** Categorical slot 1, for every single-series chart. */
export const SERIES_1 = '#2a78d6';

/** Alert severity, P1 darkest; alerts without a severity in neutral gray. */
export const SEVERITY_COLORS = {
  p1: '#0d366b',
  p2: '#1c5cab',
  p3: '#2a78d6',
  p4: '#5598e7',
  p5: '#86b6ef',
  other: '#c3c2b7',
} as const;

/** Sequential blue for magnitude (the heatmap), near zero lightest. */
export const SEQUENTIAL = [
  '#cde2fb',
  '#9ec5f4',
  '#6da7ec',
  '#3987e5',
  '#256abf',
  '#184f95',
  '#0d366b',
];

/** A cell with nothing in it: neutral, so "none" doesn't read as "a little". */
export const EMPTY_CELL = '#f0efec';

export const FONT_FAMILY = 'Roboto, system-ui, sans-serif';
