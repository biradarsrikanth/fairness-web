import { Component, computed, input } from '@angular/core';

/** Points for a sparkline in a 100 × 24 box: x spread evenly, y scaled to the values' own range. */
export function sparkPoints(values: readonly number[]): [number, number][] {
  if (values.length < 2) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((value, i) => [
    Math.round((i / (values.length - 1)) * 1000) / 10,
    // 2px of room at the top and bottom so the stroke isn't clipped
    Math.round((22 - ((value - min) / span) * 20) * 10) / 10,
  ]);
}

/**
 * A small trend line under a figure. Decorative: the figure and its change say the same in words, so it's
 * hidden from screen readers. Draws nothing for fewer than two points.
 */
@Component({
  selector: 'app-sparkline',
  template: `
    @if (line()) {
      <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <polygon [attr.points]="'0,24 ' + line() + ' 100,24'" class="area" />
        <polyline [attr.points]="line()" class="line" />
        <rect
          [attr.x]="end()![0] - 1.5"
          [attr.y]="end()![1] - 2"
          width="3"
          height="4"
          class="end"
        />
      </svg>
    }
  `,
  styles: `
    :host {
      display: block;
      height: 22px;
      color: var(--acc);
    }
    :host(.bad) {
      color: var(--crit);
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .area {
      fill: currentColor;
      opacity: 0.1;
    }
    .line {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
    }
    .end {
      fill: currentColor;
    }
  `,
  host: { '[class.bad]': 'tone() === "bad"' },
})
export class Sparkline {
  readonly values = input.required<readonly number[]>();
  readonly tone = input<'good' | 'bad' | 'neutral'>('neutral');

  private readonly points = computed(() => sparkPoints(this.values()));
  protected readonly line = computed(() =>
    this.points()
      .map(([x, y]) => `${x},${y}`)
      .join(' '),
  );
  protected readonly end = computed(() => this.points().at(-1) ?? null);
}
