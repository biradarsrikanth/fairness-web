import { Role } from '../auth/auth';

export interface NavItem {
  readonly label: string;
  /** Material Symbols name */
  readonly icon: string;
  readonly path: string;
  /** Who sees it; everyone signed in when absent. The route has the same roleGuard. */
  readonly roles?: readonly Role[];
}

export const MANAGERS: readonly Role[] = ['ADMIN', 'MANAGER'];
export const ADMINS: readonly Role[] = ['ADMIN'];

export const NAVIGATION: readonly NavItem[] = [
  { label: 'Analytics', icon: 'insights', path: '/analytics' },
  { label: 'Alerts', icon: 'notifications', path: '/alerts' },
  { label: 'On-call', icon: 'calendar_month', path: '/oncall' },
  { label: 'My reports', icon: 'description', path: '/reports' },
  { label: 'Engineers', icon: 'person', path: '/engineers', roles: MANAGERS },
  { label: 'Teams', icon: 'groups', path: '/teams', roles: MANAGERS },
  { label: 'Users', icon: 'manage_accounts', path: '/admin/users', roles: ADMINS },
  { label: 'PagerDuty sync', icon: 'sync', path: '/admin/sync', roles: ADMINS },
  { label: 'Audit log', icon: 'history', path: '/admin/audit', roles: ADMINS },
];
