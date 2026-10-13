import { formatMinutes } from '../../shared/format';

/** Minutes from one instant to another, or null when either is missing. */
export function minutesBetween(
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  if (!from || !to) return null;
  return (Date.parse(to) - Date.parse(from)) / 60_000;
}

/** "4 min" after the alert fired; a dash while it hasn't happened. */
export function elapsed(from: string | null | undefined, to: string | null | undefined): string {
  return formatMinutes(minutesBetween(from, to));
}

/** The browser's timezone: lists show times where the reader is. */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
