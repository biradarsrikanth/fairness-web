import { Params } from '@angular/router';
import { TeamRef } from '../../api/models';
import { Role } from '../../core/auth/auth';

export type Granularity = 'day' | 'week' | 'month';

export const GRANULARITIES: readonly Granularity[] = ['day', 'week', 'month'];

/**
 * What the analytics pages show, as kept in the URL (?team=&start=&end=&granularity=). Null means the
 * gateway's default: every team the user may see, the last 30 days, a granularity chosen from the window.
 */
export interface AnalyticsFilter {
  readonly team: string | null;
  readonly start: string | null;
  readonly end: string | null;
  readonly granularity: Granularity | null;
}

export const DEFAULT_FILTER: AnalyticsFilter = {
  team: null,
  start: null,
  end: null,
  granularity: null,
};

/** The gateway refuses longer windows. */
export const MAX_DAYS = 3650;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day in YYYY-MM-DD form (rejects 2026-02-30). */
export function isIsoDay(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * The filter from query parameters. Hand-edited or stale links can't break the page: unknown values fall
 * back to the defaults, and a range needs both ends in order.
 */
export function parseFilter(params: Params): AnalyticsFilter {
  const team =
    typeof params['team'] === 'string' && params['team'].trim() ? params['team'].trim() : null;
  const granularity = GRANULARITIES.find((g) => g === params['granularity']) ?? null;
  let start = isIsoDay(params['start']) ? params['start'] : null;
  let end = isIsoDay(params['end']) ? params['end'] : null;
  if (start === null || end === null || start > end || daysBetween(start, end) + 1 > MAX_DAYS) {
    start = null;
    end = null;
  }
  return { team, start, end, granularity };
}

/** Query parameters for the router; nulls remove a parameter from the URL. */
export function toQueryParams(filter: AnalyticsFilter): Params {
  return {
    team: filter.team,
    start: filter.start,
    end: filter.end,
    granularity: filter.granularity,
  };
}

/** Parameters for the gateway's analytics operations, leaving out the defaults. */
export function toApiParams(filter: AnalyticsFilter): {
  team?: string;
  start?: string;
  end?: string;
  granularity?: Granularity;
} {
  return {
    ...(filter.team !== null && { team: filter.team }),
    ...(filter.start !== null && { start: filter.start }),
    ...(filter.end !== null && { end: filter.end }),
    ...(filter.granularity !== null && { granularity: filter.granularity }),
  };
}

export function sameFilter(a: AnalyticsFilter, b: AnalyticsFilter): boolean {
  return (
    a.team === b.team && a.start === b.start && a.end === b.end && a.granularity === b.granularity
  );
}

export interface Preset {
  readonly label: string;
  readonly days: number;
}

/** Ranges ending today; 30 days is the gateway's default window. */
export const PRESETS: readonly Preset[] = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 12 months', days: 365 },
];

/** Today's date in a timezone, as YYYY-MM-DD. */
export function todayIn(timeZone: string, now = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/** The day an instant falls on in a timezone, as YYYY-MM-DD. */
export function dayIn(instant: string, timeZone: string): string {
  return todayIn(timeZone, new Date(instant));
}

/**
 * The scorer's window (timestamps; the end exclusive) as the days it covers in its timezone, like the
 * gateway's analytics windows.
 */
export function windowDays(window: { start: string; end: string; timezone: string }): {
  start: string;
  end: string;
} {
  return {
    start: dayIn(window.start, window.timezone),
    end: todayIn(window.timezone, new Date(Date.parse(window.end) - 1)),
  };
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  return Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000,
  );
}

/** The last {@code days} days up to and including today. */
export function presetRange(days: number, today: string): { start: string; end: string } {
  return { start: addDays(today, -(days - 1)), end: today };
}

/** Which preset a window is, if it ends today. */
export function matchingPreset(start: string, end: string, today: string): Preset | null {
  if (end !== today) return null;
  return PRESETS.find((preset) => presetRange(preset.days, today).start === start) ?? null;
}

/** A local Date (what the datepicker uses) as YYYY-MM-DD, and back. */
export function fromLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function toLocalDate(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

export interface TeamOption {
  /** null: every team the user may see */
  readonly value: string | null;
  readonly label: string;
}

/**
 * The team choices for a user. Admins and managers of several teams may look across them (without scores
 * for a manager: the scorer compares one team at a time); everyone else sees their one team.
 */
export function teamOptions(role: Role | null, teams: readonly TeamRef[]): TeamOption[] {
  const named = [...teams]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((team) => ({ value: team.name, label: team.name }));
  if (role === 'ADMIN') return [{ value: null, label: 'All teams' }, ...named];
  if (role === 'MANAGER' && named.length > 1) {
    return [{ value: null, label: 'All my teams' }, ...named];
  }
  return named.length === 1 ? [{ value: null, label: named[0].label }] : named;
}
