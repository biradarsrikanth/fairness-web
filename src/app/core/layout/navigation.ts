import { Role } from '../auth/auth';
import { IconName } from '../icons/icons';

export interface NavItem {
  readonly label: string;
  readonly icon: IconName;
  readonly path: string;
  /** Who sees it; everyone signed in when absent. The route has the same roleGuard. */
  readonly roles?: readonly Role[];
}

export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const MANAGERS: readonly Role[] = ['ADMIN', 'MANAGER'];
export const ADMINS: readonly Role[] = ['ADMIN'];

export const NAVIGATION_GROUPS: readonly NavGroup[] = [
  {
    label: 'Monitor',
    items: [
      { label: 'Analytics', icon: 'analytics', path: '/analytics' },
      { label: 'Alerts', icon: 'alerts', path: '/alerts' },
      { label: 'On-call', icon: 'oncall', path: '/oncall' },
      { label: 'My reports', icon: 'reports', path: '/reports' },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Engineers', icon: 'engineers', path: '/engineers', roles: MANAGERS },
      { label: 'Teams', icon: 'teams', path: '/teams', roles: MANAGERS },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Users', icon: 'users', path: '/admin/users', roles: ADMINS },
      { label: 'PagerDuty sync', icon: 'sync', path: '/admin/sync', roles: ADMINS },
      { label: 'Audit log', icon: 'audit', path: '/admin/audit', roles: ADMINS },
    ],
  },
];

export const NAVIGATION: readonly NavItem[] = NAVIGATION_GROUPS.flatMap((group) => group.items);

/** The groups and items one role sees; groups with nothing left are dropped. */
export function navigationFor(hasRole: (...roles: Role[]) => boolean): NavGroup[] {
  return NAVIGATION_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => !item.roles || hasRole(...item.roles)),
  })).filter((group) => group.items.length > 0);
}
