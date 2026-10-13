import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Summary } from '../../api/models';
import { formatRange } from '../../shared/format';
import { kpiTiles } from './kpis';

/** The headline figures, each with its change from the previous period of the same length. */
@Component({
  selector: 'app-kpi-tiles',
  imports: [MatIconModule, MatTooltipModule],
  templateUrl: './kpi-tiles.html',
  styleUrl: './kpi-tiles.scss',
})
export class KpiTiles {
  readonly summary = input.required<Summary>();

  protected readonly tiles = computed(() => kpiTiles(this.summary()));
  protected readonly comparedWith = computed(() => {
    const previous = this.summary().previousWindow;
    return `vs ${formatRange(previous.start, previous.end)}`;
  });
}
