import { ThemeMode } from '../../../core/theme/theme';

/**
 * Chart colours for each mode. A canvas can't read CSS variables, so these mirror styles/_tokens.scss.
 * Charts sit on `surface`, so the 1–2px gaps between marks, drawn in the surface colour, read as gaps.
 *
 * Severity: P1 in the critical red, so the worst alerts stand out; P2 to P5 step from the accent down to a
 * faint tint (one hue, most severe strongest). The heatmap is a single-hue sequential ramp, near zero
 * closest to the surface. The highlight (amber) marks the one value to look at, such as the engineer
 * carrying the most load.
 */
export interface ChartPalette {
  readonly surface: string;
  readonly ink: {
    readonly primary: string;
    readonly secondary: string;
    readonly muted: string;
    readonly grid: string;
    readonly axis: string;
  };
  readonly series1: string;
  readonly highlight: string;
  readonly severity: {
    readonly p1: string;
    readonly p2: string;
    readonly p3: string;
    readonly p4: string;
    readonly p5: string;
    readonly other: string;
  };
  readonly sequential: readonly string[];
  readonly emptyCell: string;
  readonly tooltip: {
    readonly background: string;
    readonly border: string;
    readonly shadow: string;
  };
  readonly hover: string;
}

export const FONT_FAMILY = "'Geist Variable', system-ui, sans-serif";
export const MONO_FAMILY = "'JetBrains Mono Variable', ui-monospace, monospace";

export const PAPER: ChartPalette = {
  surface: '#ffffff',
  ink: {
    primary: '#202427',
    secondary: '#5f6367',
    muted: '#74777a',
    grid: '#eceae4',
    axis: '#c9c6bd',
  },
  series1: '#0e7c6e',
  highlight: '#c27800',
  severity: {
    p1: '#c4342b',
    p2: '#0e7c6e',
    p3: '#4fa192',
    p4: '#8fc6bc',
    p5: '#c6e2dd',
    other: '#cfccc3',
  },
  sequential: ['#e3f1ee', '#bfe0d9', '#8fc9be', '#5cae9f', '#2f907f', '#0e7364', '#075247'],
  emptyCell: '#f1efe9',
  tooltip: {
    background: '#ffffff',
    border: '#e2e0d9',
    shadow: '0 8px 24px -8px rgba(20, 24, 22, 0.25)',
  },
  hover: 'rgba(14, 124, 110, 0.06)',
};

export const CONSOLE: ChartPalette = {
  surface: '#151817',
  ink: {
    primary: '#e7e7e3',
    secondary: '#b3b7b4',
    muted: '#8f9390',
    grid: '#222725',
    axis: '#3a3f3d',
  },
  series1: '#3fd9c1',
  highlight: '#f2b33d',
  severity: {
    p1: '#ff6b5e',
    p2: '#3fd9c1',
    p3: '#2c9a8a',
    p4: '#1f6b60',
    p5: '#184a43',
    other: '#3a3f3d',
  },
  sequential: ['#15302b', '#17463f', '#1d5f55', '#23796c', '#2b9886', '#35b9a3', '#3fd9c1'],
  emptyCell: '#1b1f1d',
  tooltip: {
    background: '#1a1e1c',
    border: '#2f3432',
    shadow: '0 12px 32px -8px rgba(0, 0, 0, 0.6)',
  },
  hover: 'rgba(63, 217, 193, 0.08)',
};

export function chartPalette(mode: ThemeMode): ChartPalette {
  return mode === 'console' ? CONSOLE : PAPER;
}

/** Paper's severity colours, for code that needs a fixed key list. */
export const SEVERITY_COLORS = PAPER.severity;
export const EMPTY_CELL = PAPER.emptyCell;
