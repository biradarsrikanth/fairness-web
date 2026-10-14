import { Params } from '@angular/router';
import { ListAlerts$Params } from '../../api/fn/alerts/list-alerts';
import { isIsoDay } from '../analytics/analytics-filter';

export const SEVERITIES = ['P1', 'P2', 'P3', 'P4', 'P5'] as const;
export const STATUSES = ['triggered', 'acknowledged', 'resolved'] as const;

/** The alert list's filters, kept in the URL; null means "any". */
export interface AlertFilter {
  readonly team: string | null;
  readonly severity: string | null;
  readonly status: string | null;
  readonly start: string | null;
  readonly end: string | null;
  readonly engineerId: number | null;
  /** Free text: title, service, or a PagerDuty incident number */
  readonly q: string | null;
}

export const ALERT_LIST = {
  sortable: ['triggeredAt', 'resolvedAt', 'severity', 'status'],
  defaultSort: 'triggeredAt,desc',
} as const;

/** The filters from query parameters; values the gateway would refuse are dropped. */
export function parseAlertFilter(params: Params): AlertFilter {
  const text = (key: string) =>
    typeof params[key] === 'string' && params[key].trim() ? (params[key].trim() as string) : null;
  const severity = text('severity');
  const status = text('status');
  let start = isIsoDay(params['start']) ? params['start'] : null;
  let end = isIsoDay(params['end']) ? params['end'] : null;
  if (start !== null && end !== null && start > end) {
    start = null;
    end = null;
  }
  const engineerId = Number(params['engineerId']);
  return {
    team: text('team'),
    severity: severity && (SEVERITIES as readonly string[]).includes(severity) ? severity : null,
    status: status && (STATUSES as readonly string[]).includes(status) ? status : null,
    start,
    end,
    engineerId: Number.isInteger(engineerId) && engineerId > 0 ? engineerId : null,
    // The gateway takes at most 100 characters
    q: text('q')?.slice(0, 100) ?? null,
  };
}

/** Parameters for listAlerts, leaving out the empty filters. */
export function alertApiParams(
  filter: AlertFilter,
): Omit<ListAlerts$Params, 'page' | 'size' | 'sort'> {
  return {
    ...(filter.team !== null && { team: filter.team }),
    ...(filter.severity !== null && { severity: filter.severity }),
    ...(filter.status !== null && { status: filter.status }),
    ...(filter.start !== null && { start: filter.start }),
    ...(filter.end !== null && { end: filter.end }),
    ...(filter.engineerId !== null && { engineerId: filter.engineerId }),
    ...(filter.q !== null && { q: filter.q }),
  };
}

export function hasFilters(filter: AlertFilter): boolean {
  return Object.values(filter).some((value) => value !== null);
}
