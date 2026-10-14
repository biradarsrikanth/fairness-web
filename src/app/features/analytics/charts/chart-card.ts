import { Component, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * A chart with its title and a table view of the same figures, for screen readers, exact values and
 * printing. Content: an element marked [chart] and one marked [table].
 */
@Component({
  selector: 'app-chart-card',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <section class="card" [attr.aria-labelledby]="headingId">
      <header>
        <div>
          @if (label()) {
            <span class="eyebrow bracket">{{ label() }}</span>
          }
          <h2 [id]="headingId">{{ heading() }}</h2>
          @if (subheading()) {
            <p>{{ subheading() }}</p>
          }
        </div>
        @if (!empty()) {
          <button
            matButton
            type="button"
            class="toggle"
            [attr.aria-pressed]="showTable()"
            (click)="showTable.set(!showTable())"
          >
            <mat-icon [svgIcon]="showTable() ? 'chart' : 'table'" />
            {{ showTable() ? 'Chart' : 'Table' }}
          </button>
        }
      </header>
      @if (empty()) {
        <p class="empty">{{ emptyText() }}</p>
      } @else if (showTable()) {
        <div class="table-view"><ng-content select="[table]" /></div>
      } @else {
        <ng-content select="[chart]" />
      }
    </section>
  `,
  styleUrl: './chart-card.scss',
})
export class ChartCard {
  private static nextId = 0;

  readonly heading = input.required<string>();
  /** A short monospace label above the title, e.g. "Severity / day" */
  readonly label = input<string | null>(null);
  readonly subheading = input<string | null>(null);
  readonly empty = input(false);
  readonly emptyText = input('Nothing to show for this period.');

  protected readonly showTable = signal(false);
  protected readonly headingId = `chart-card-${ChartCard.nextId++}`;
}
