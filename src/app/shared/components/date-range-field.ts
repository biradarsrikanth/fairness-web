import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { provideDayFirstDates } from '../forms/day-first-dates';

export interface DayRange {
  readonly start: string | null;
  readonly end: string | null;
}

function toDate(day: string | null): Date | null {
  if (day === null) return null;
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

function toDay(date: Date | null): string | null {
  if (date === null) return null;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * A from–to date filter (YYYY-MM-DD days). It reports a change once both ends are set, or when cleared.
 */
@Component({
  selector: 'app-date-range-field',
  imports: [
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  providers: [provideDayFirstDates()],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>{{ label() }}</mat-label>
      <mat-date-range-input [rangePicker]="picker">
        <input
          matStartDate
          placeholder="From"
          aria-label="From date"
          [value]="startDate()"
          (dateChange)="startChanged($event.value)"
        />
        <input
          matEndDate
          placeholder="To"
          aria-label="To date"
          [value]="endDate()"
          (dateChange)="endChanged($event.value)"
        />
      </mat-date-range-input>
      @if (start() || end()) {
        <button
          matIconButton
          matIconSuffix
          type="button"
          aria-label="Clear dates"
          (click)="clear()"
        >
          <mat-icon>close</mat-icon>
        </button>
      }
      <mat-datepicker-toggle matIconSuffix [for]="picker" />
      <mat-date-range-picker #picker />
    </mat-form-field>
  `,
  styles: `
    mat-form-field {
      width: 272px;
      max-width: 100%;
    }
  `,
})
export class DateRangeField {
  readonly range = input<DayRange>({ start: null, end: null });
  readonly label = input('Dates');
  readonly rangeChange = output<DayRange>();

  protected readonly start = linkedSignal(() => this.range().start);
  protected readonly end = linkedSignal(() => this.range().end);
  protected readonly startDate = computed(() => toDate(this.start()));
  protected readonly endDate = computed(() => toDate(this.end()));

  protected startChanged(date: Date | null): void {
    this.start.set(toDay(date));
  }

  protected endChanged(date: Date | null): void {
    this.end.set(toDay(date));
    const start = this.start();
    const end = this.end();
    if (start !== null && end !== null && start <= end) this.rangeChange.emit({ start, end });
  }

  protected clear(): void {
    this.start.set(null);
    this.end.set(null);
    this.rangeChange.emit({ start: null, end: null });
  }
}
