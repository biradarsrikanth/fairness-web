import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Summary } from '../../api/models';
import { Sparkline } from '../../shared/components/sparkline';
import { formatRange } from '../../shared/format';
import { KpiTile, kpiTiles } from './kpis';

/** Gini labels from the scorer that need attention, and how strongly. */
const FLAGS: Record<string, 'crit' | 'warn'> = { CRITICAL: 'crit', UNEQUAL: 'warn' };

/** The headline figures, each with its change from the previous period of the same length. */
@Component({
  selector: 'app-kpi-tiles',
  imports: [MatIconModule, MatTooltipModule, Sparkline],
  templateUrl: './kpi-tiles.html',
  styleUrl: './kpi-tiles.scss',
})
export class KpiTiles {
  readonly summary = input.required<Summary>();
  /** Values per period for the tiles that have them (by tile id), drawn as a trend line. */
  readonly trends = input<Partial<Record<string, readonly number[]>>>({});

  protected readonly tiles = computed(() => kpiTiles(this.summary()));
  protected readonly previousRange = computed(() => {
    const previous = this.summary().previousWindow;
    return formatRange(previous.start, previous.end);
  });
  private readonly giniFlag = computed(() => {
    const label = this.summary().fairnessLabel;
    return label ? (FLAGS[label.toUpperCase()] ?? null) : null;
  });

  protected flag(tile: KpiTile): 'crit' | 'warn' | null {
    return tile.id === 'gini' ? this.giniFlag() : null;
  }
}
