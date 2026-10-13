import { AuditEntryResponse } from '../../../api/models';

export type AuditAction = AuditEntryResponse['action'];

/** Every audited action, in words, grouped as the filter lists them. */
export const AUDIT_ACTIONS: readonly { value: AuditAction; label: string; group: string }[] = [
  { value: 'LOGIN_SUCCEEDED', label: 'Signed in', group: 'Sign-in' },
  { value: 'LOGIN_FAILED', label: 'Sign-in failed', group: 'Sign-in' },
  { value: 'ACCOUNT_LOCKED', label: 'Account locked', group: 'Sign-in' },
  { value: 'LOGOUT', label: 'Signed out', group: 'Sign-in' },
  { value: 'PASSWORD_CHANGED', label: 'Changed their password', group: 'Sign-in' },
  {
    value: 'REFRESH_TOKEN_REUSED',
    label: 'Reused session token (possible theft)',
    group: 'Sign-in',
  },
  { value: 'USER_CREATED', label: 'Created a user', group: 'Users' },
  { value: 'USER_UPDATED', label: 'Changed a user', group: 'Users' },
  { value: 'USER_TEAMS_CHANGED', label: "Changed a manager's teams", group: 'Users' },
  { value: 'USER_PASSWORD_RESET', label: "Reset a user's password", group: 'Users' },
  { value: 'USER_UNLOCKED', label: 'Unlocked a user', group: 'Users' },
  { value: 'USER_DELETED', label: 'Deleted a user', group: 'Users' },
  { value: 'SYNC_TRIGGERED', label: 'Started a PagerDuty sync', group: 'PagerDuty' },
  { value: 'INCIDENT_RESOLVED', label: 'Resolved a PagerDuty incident', group: 'PagerDuty' },
  { value: 'WEBHOOK_REPLAYED', label: 'Replayed a webhook', group: 'PagerDuty' },
];

export function actionLabel(action: AuditAction): string {
  return AUDIT_ACTIONS.find((a) => a.value === action)?.label ?? action;
}

/** Actions a security review looks at first. */
export function isWarning(action: AuditAction): boolean {
  return (
    action === 'LOGIN_FAILED' || action === 'ACCOUNT_LOCKED' || action === 'REFRESH_TOKEN_REUSED'
  );
}

/** The details as "key: value" pairs, nested values as JSON. */
export function detailPairs(
  details: AuditEntryResponse['details'],
): { key: string; value: string }[] {
  if (!details) return [];
  return Object.entries(details).map(([key, value]) => ({
    key,
    value: typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value),
  }));
}
