import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth-guards';
import { ADMINS, MANAGERS } from './core/layout/navigation';

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
      {
        path: 'analytics',
        title: 'Analytics · Fairness',
        loadComponent: () =>
          import('./features/analytics/analytics-page').then((m) => m.AnalyticsPage),
      },
      {
        // The gateway decides who may see whom: managers their teams, engineers themselves
        path: 'analytics/engineers/:engineerId',
        title: 'Engineer · Fairness',
        loadComponent: () =>
          import('./features/analytics/engineer-page').then((m) => m.EngineerPage),
      },
      {
        path: 'alerts',
        title: 'Alerts · Fairness',
        loadComponent: () => import('./features/alerts/alerts-page').then((m) => m.AlertsPage),
      },
      {
        path: 'alerts/:id',
        title: 'Alert · Fairness',
        loadComponent: () => import('./features/alerts/alert-page').then((m) => m.AlertPage),
      },
      {
        path: 'oncall',
        title: 'On-call · Fairness',
        loadComponent: () => import('./features/oncall/oncall-page').then((m) => m.OncallPage),
      },
      {
        path: 'engineers',
        title: 'Engineers · Fairness',
        canActivate: [roleGuard(...MANAGERS)],
        loadComponent: () =>
          import('./features/engineers/engineers-page').then((m) => m.EngineersPage),
      },
      {
        path: 'teams',
        title: 'Teams · Fairness',
        canActivate: [roleGuard(...MANAGERS)],
        loadComponent: () => import('./features/teams/teams-page').then((m) => m.TeamsPage),
      },
      {
        path: 'admin/users',
        title: 'Users · Fairness',
        canActivate: [roleGuard(...ADMINS)],
        loadComponent: () => import('./features/admin/users/users-page').then((m) => m.UsersPage),
      },
      {
        path: 'admin/sync',
        title: 'PagerDuty sync · Fairness',
        canActivate: [roleGuard(...ADMINS)],
        loadComponent: () => import('./features/admin/sync/sync-page').then((m) => m.SyncPage),
      },
      {
        path: 'admin/audit',
        title: 'Audit log · Fairness',
        canActivate: [roleGuard(...ADMINS)],
        loadComponent: () => import('./features/admin/audit/audit-page').then((m) => m.AuditPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
