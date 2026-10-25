import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Window } from '../../api/models';
import { localTimeZone } from '../../shared/format';
import { provideDayFirstDates } from '../../shared/forms/day-first-dates';
import {
  AnalyticsFilter,
  Granularity,
  MAX_DAYS,
  PRESETS,
  TeamOption,
  addDays,
  daysBetween,
  fromLocalDate,
  matchingPreset,
  presetRange,
  toLocalDate,
  todayIn,
} from './analytics-filter';

/** The gateway draws at most this many daily points. */
const MAX_DAILY_DAYS = 400;
const CUSTOM = 'custom';
/** mat-select treats a null value as "nothing selected", so "all teams" needs a value of its own. */
const ALL_TEAMS = '*all*';

/**
 * Team, dates and granularity for the analytics pages. Every change is applied at once (the page puts it in
 * the URL); the dates shown are the window the page last loaded, so the defaults are visible too.
 */
@Component({
  selector: 'app-filter-bar',
  imports: [
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  providers: [provideDayFirstDates()],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.scss',
})
export class FilterBar {
  readonly filter = input.required<AnalyticsFilter>();
  /** The window of the data on the page; fills the date fields when the URL has no dates. */
  readonly window = input<Window | null>(null);
  readonly teams = input<readonly TeamOption[]>([]);
  readonly showGranularity = input(true);
  readonly changed = output<AnalyticsFilter>();

  protected readonly presets = PRESETS;
  protected readonly custom = CUSTOM;
  protected readonly allTeams = ALL_TEAMS;
  protected readonly maxDate = computed(() => toLocalDate(this.today()));
  protected readonly minDate = computed(() => toLocalDate(addDays(this.today(), -(MAX_DAYS - 1))));

  private readonly today = computed(() => todayIn(this.window()?.timezone ?? localTimeZone()));

  /** What the date fields show: the URL's range, else the loaded window. Edited until both ends are set. */
  protected readonly start = linkedSignal(
    () => this.filter().start ?? this.window()?.start ?? null,
  );
  protected readonly end = linkedSignal(() => this.filter().end ?? this.window()?.end ?? null);

  protected readonly startDate = computed(() => toDate(this.start()));
  protected readonly endDate = computed(() => toDate(this.end()));

  protected readonly preset = computed(() => {
    const start = this.start();
    const end = this.end();
    if (start === null || end === null) return CUSTOM;
    return String(matchingPreset(start, end, this.today())?.days ?? CUSTOM);
  });

  /** The team select only appears when there's a choice; the selected value must be one of the options. */
  protected readonly showTeam = computed(() => this.teams().length > 1);
  protected readonly team = computed(() => {
    const team = this.filter().team;
    return team !== null && this.teams().some((option) => option.value === team) ? team : ALL_TEAMS;
  });

  protected readonly dailyAllowed = computed(() => {
    const start = this.start();
    const end = this.end();
    return start === null || end === null || daysBetween(start, end) + 1 <= MAX_DAILY_DAYS;
  });

  protected selectTeam(team: string): void {
    this.apply({ team: team === ALL_TEAMS ? null : team });
  }

  protected selectPreset(value: string): void {
    if (value === CUSTOM) return;
    const range = presetRange(Number(value), this.today());
    this.start.set(range.start);
    this.end.set(range.end);
    this.applyRange(range.start, range.end);
  }

  protected startChanged(date: Date | null): void {
    this.start.set(date ? fromLocalDate(date) : null);
    // The picker clears the end when a new start is picked; wait for it
  }

  protected endChanged(date: Date | null): void {
    this.end.set(date ? fromLocalDate(date) : null);
    const start = this.start();
    const end = this.end();
    if (start !== null && end !== null && start <= end) this.applyRange(start, end);
  }

  protected selectGranularity(value: Granularity | 'auto'): void {
    this.apply({ granularity: value === 'auto' ? null : value });
  }

  private applyRange(start: string, end: string): void {
    const tooLongForDays = daysBetween(start, end) + 1 > MAX_DAILY_DAYS;
    this.apply({
      start,
      end,
      ...(tooLongForDays && this.filter().granularity === 'day' && { granularity: null }),
    });
  }

  private apply(change: Partial<AnalyticsFilter>): void {
    this.changed.emit({ ...this.filter(), ...change });
  }
}

function toDate(day: string | null): Date | null {
  return day === null ? null : toLocalDate(day);
}
