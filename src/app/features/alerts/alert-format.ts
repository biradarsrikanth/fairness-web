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

/** The tag style for a severity: P1 in solid red, P2 in solid accent, the rest soft. */
export function severityClass(severity: string): string {
  switch (severity.toUpperCase()) {
    case 'P1':
      return 'crit';
    case 'P2':
      return 'solid';
    default:
      return '';
  }
}

/** The status dot's colour: open alerts red, acknowledged amber, resolved green. */
export function statusClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'triggered':
      return 'crit';
    case 'acknowledged':
      return 'warn';
    case 'resolved':
      return 'ok';
    default:
      return '';
  }
}
