import { addDays, daysBetween, isIsoDay, todayIn } from '../analytics/analytics-filter';

/** The gateway lists shifts up to this many days after the start date. */
export const MAX_RANGE_DAYS = 366;

export interface OncallRange {
  readonly start: string;
  readonly end: string;
  /** Whether the URL named the range (otherwise it's the default around today) */
  readonly fromUrl: boolean;
}

/** The shifts to show: the URL's range, or the past week and the next four. Dates are UTC days. */
export function oncallRange(start: unknown, end: unknown, now = new Date()): OncallRange {
  if (isIsoDay(start) && isIsoDay(end) && start <= end) return { start, end, fromUrl: true };
  const today = todayIn('UTC', now);
  return { start: addDays(today, -7), end: addDays(today, 28), fromUrl: false };
}

export function rangeTooLong(range: { start: string; end: string }): boolean {
  return daysBetween(range.start, range.end) > MAX_RANGE_DAYS;
}

/** "Primary" for level 1, else "Level 2" and so on. */
export function levelLabel(level: number): string {
  return level === 1 ? 'Primary' : `Level ${level}`;
}

/** Whether a shift covers the instant. */
export function isCurrent(shift: { startsAt: string; endsAt: string }, now = Date.now()): boolean {
  return Date.parse(shift.startsAt) <= now && now < Date.parse(shift.endsAt);
}

/** A shift's length: "7 d", "12 h", "2 d 6 h". */
export function shiftLength(shift: { startsAt: string; endsAt: string }): string {
  const hours = Math.round((Date.parse(shift.endsAt) - Date.parse(shift.startsAt)) / 3_600_000);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  if (days === 0) return `${rest} h`;
  return rest === 0 ? `${days} d` : `${days} d ${rest} h`;
}
