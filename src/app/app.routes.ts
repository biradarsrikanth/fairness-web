import { Route, Routes } from '@angular/router';
import { Role } from './core/auth/auth';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth-guards';
import { ADMINS, MANAGERS } from './core/layout/navigation';

const placeholder = () => import('./features/placeholder/placeholder').then((m) => m.Placeholder);

/** A page a later group builds; replace loadComponent when it lands. */
function upcoming(path: string, heading: string, note: string, roles?: readonly Role[]): Route {
  return {
    path,
    title: `${heading} · Fairness`,
    loadComponent: placeholder,
    data: { heading, note },
    canActivate: roles ? [roleGuard(...roles)] : [],
  };
}

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · Fairness',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'change-password',
    title: 'Change password · Fairness',
    canActivate: [authGuard],
    loadComponent: () => import('./features/auth/change-password').then((m) => m.ChangePassword),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () => import('./core/layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'analytics' },
      upcoming('analytics', 'Analytics', 'KPIs, trends and the load heatmap arrive in Group 9.'),
      upcoming('alerts', 'Alerts', 'The alert list and paging history arrive in Group 10.'),
      upcoming('oncall', 'On-call', 'On-call shifts arrive in Group 10.'),
      upcoming('engineers', 'Engineers', 'Engineer management arrives in Group 10.', MANAGERS),
      upcoming('teams', 'Teams', 'Team management arrives in Group 10.', MANAGERS),
      upcoming('admin/users', 'Users', 'User management arrives in Group 10.', ADMINS),
      upcoming(
        'admin/sync',
        'PagerDuty sync',
        'Sync status and manual syncs arrive in Group 10.',
        ADMINS,
      ),
      upcoming('admin/audit', 'Audit log', 'The audit log arrives in Group 10.', ADMINS),
    ],
  },
  { path: '**', redirectTo: '' },
];
