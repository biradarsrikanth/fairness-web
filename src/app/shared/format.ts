/**
 * Formatting for figures and dates. Dates from the gateway are ISO days (YYYY-MM-DD) in the analytics timezone
 * and are shown as they are; instants are shown in the timezone the caller names (the team's).
 */

const LOCALE = 'en-GB';

const dayFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const dayMonthFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const monthFormat = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** An ISO day as a UTC midnight, so formatting never shifts it by the browser's offset. */
function utcDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** 1 Oct 2026 */
export function formatDay(day: string): string {
  return dayFormat.format(utcDay(day));
}

/** 1 Oct */
export function formatDayMonth(day: string): string {
  return dayMonthFormat.format(utcDay(day));
}

/** Oct 2026 */
export function formatMonth(day: string): string {
  return monthFormat.format(utcDay(day));
}

/** 1–30 Oct 2026, 28 Sep – 4 Oct 2026, 20 Dec 2025 – 3 Jan 2026 */
export function formatRange(start: string, end: string): string {
  if (start === end) return formatDay(start);
  const [startYear, startMonth] = start.split('-');
  const [endYear, endMonth] = end.split('-');
  if (startYear !== endYear) return `${formatDay(start)} – ${formatDay(end)}`;
  if (startMonth !== endMonth) return `${formatDayMonth(start)} – ${formatDay(end)}`;
  return `${Number(start.slice(8))}–${formatDay(end)}`;
}

/** 13 Oct 2026, 22:41 in the given timezone */
export function formatInstant(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(instant));
}

/** The browser's timezone: lists show times where the reader is. */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** An instant in the browser's timezone. */
export function formatLocal(instant: string): string {
  return formatInstant(instant, localTimeZone());
}

/** 850 ms, 12.4 s, 3 min 5 s; a dash for no value */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '–';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/** 45 s, 12 min, 1 h 5 min, 2 d 3 h; a dash for no value */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '–';
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const totalMinutes = Math.round(minutes);
  if (totalMinutes < 24 * 60) {
    const hours = Math.floor(totalMinutes / 60);
    const rest = totalMinutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  const totalHours = Math.round(minutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours === 0 ? `${days} d` : `${days} d ${hours} h`;
}

/** 35%, 2.5% (one decimal below 10); a dash for no value */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–';
  const rounded = Math.abs(value) < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded}%`;
}

/** 1,234 */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–';
  return Math.round(value).toLocaleString(LOCALE);
}

/** FAIR → Fair, ONCALL_ROTATION → Oncall rotation */
export function humanize(value: string): string {
  const words = value.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** just now, 4 min ago, 3 h ago, 2 d ago */
export function formatAgo(instant: string | number, now = Date.now()): string {
  const then = typeof instant === 'number' ? instant : Date.parse(instant);
  if (Number.isNaN(then)) return '–';
  const minutes = Math.max(0, Math.floor((now - then) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
