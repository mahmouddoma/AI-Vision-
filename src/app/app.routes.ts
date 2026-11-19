import { Routes } from '@angular/router';
import { accessGuard } from './core/auth';

const featureRoutes: Routes = [
  {
    path: 'auth',
    title: 'Account access',
    loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'auth/callback',
    title: 'Account access',
    loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'setup',
    title: 'Setup',
    loadComponent: () => import('./features/setup/setup').then((m) => m.Setup),
  },
  {
    path: 'system-health',
    title: 'System health',
    loadComponent: () => import('./features/system/system-status').then((m) => m.SystemHealth),
  },
  ...(['sites', 'cameras', 'zones'] as const).map((kind) => ({
    path: `${kind}/:id`,
    title: 'Resource detail',
    data: { kind },
    loadComponent: () => import('./features/catalog/resource-detail').then((m) => m.ResourceDetail),
  })),
  {
    path: 'live/zones/:id',
    title: 'Live zone',
    data: { kind: 'zones' },
    loadComponent: () => import('./features/catalog/resource-detail').then((m) => m.ResourceDetail),
  },
  {
    path: 'analytics/zones/:id',
    title: 'Zone analytics',
    data: { kind: 'zones' },
    loadComponent: () => import('./features/catalog/resource-detail').then((m) => m.ResourceDetail),
  },
  {
    path: 'floors',
    title: 'Floors',
    loadComponent: () => import('./features/floors/floors').then((m) => m.Floors),
  },
  {
    path: 'sites/:siteId/floors',
    title: 'Floors',
    loadComponent: () => import('./features/floors/floors').then((m) => m.Floors),
  },
  {
    path: 'floors/:id/editor',
    title: 'Polygon editor',
    loadComponent: () => import('./features/floors/floor-editor').then((m) => m.FloorEditor),
  },
  {
    path: 'floors/:id/heatmap',
    title: 'Floor heatmap',
    data: { heatmap: true },
    loadComponent: () => import('./features/floors/floor-editor').then((m) => m.FloorEditor),
  },
  {
    path: 'alerts',
    title: 'Alerts',
    loadComponent: () => import('./features/alerts/alerts').then((m) => m.Alerts),
  },
  {
    path: 'alerts/:id',
    title: 'Alert investigation',
    loadComponent: () => import('./features/alerts/alerts').then((m) => m.Alerts),
  },
  {
    path: 'alert-rules',
    title: 'Alert rules',
    loadComponent: () => import('./features/alerts/rules').then((m) => m.Rules),
  },
  {
    path: 'alert-rules/new',
    title: 'Add rule',
    loadComponent: () => import('./features/alerts/rule-editor').then((m) => m.RuleEditor),
  },
  {
    path: 'alert-rules/:id/edit',
    title: 'Edit rule',
    loadComponent: () => import('./features/alerts/rule-editor').then((m) => m.RuleEditor),
  },
  ...(['flow', 'congestion', 'distribution', 'quality', 'insights'] as const).map((section) => ({
    path: `analytics/${section}`,
    title: `analytics.${section}`,
    data: { section },
    loadComponent: () =>
      import('./features/analytics/smart-analytics').then((m) => m.SmartAnalytics),
  })),
  ...(['rankings', 'traffic', 'occupancy', 'dwell', 'wrong-way', 'staff'] as const).map((tab) => ({
    path: `analytics/${tab}`,
    title: 'Analytics',
    data: { tab },
    loadComponent: () => import('./features/analytics/analytics').then((m) => m.Analytics),
  })),
  {
    path: '',
    title: 'Overview',
    loadComponent: () => import('./features/overview/overview').then((m) => m.Overview),
  },
  {
    path: 'sites',
    title: 'Sites',
    data: { kind: 'sites' },
    loadComponent: () => import('./features/catalog/catalog').then((m) => m.Catalog),
  },
  {
    path: 'cameras',
    title: 'Cameras',
    data: { kind: 'cameras' },
    loadComponent: () => import('./features/catalog/catalog').then((m) => m.Catalog),
  },
  {
    path: 'cameras/:cameraId/zones',
    title: 'Zones',
    data: { kind: 'zones' },
    loadComponent: () => import('./features/catalog/catalog').then((m) => m.Catalog),
  },
  {
    path: 'live',
    title: 'Live monitoring',
    loadComponent: () => import('./features/live/live').then((m) => m.Live),
  },
  {
    path: 'live/:cameraId',
    title: 'Camera detail',
    loadComponent: () => import('./features/live/live').then((m) => m.Live),
  },
  {
    path: 'analytics',
    title: 'Analytics',
    loadComponent: () => import('./features/analytics/analytics').then((m) => m.Analytics),
  },
  {
    path: 'sessions',
    title: 'Sessions',
    loadComponent: () => import('./features/sessions/sessions').then((m) => m.Sessions),
  },
  {
    path: 'sessions/:id',
    title: 'Session report',
    loadComponent: () => import('./features/sessions/session-detail').then((m) => m.SessionDetail),
  },
  {
    path: '**',
    title: 'Page not found',
    loadComponent: () => import('./features/not-found').then((m) => m.NotFound),
  },
];

export const routes: Routes = featureRoutes.map((route) => {
  if (route.path?.startsWith('auth') || route.path === '**') return route;
  const path = route.path ?? '';
  const smart = ['flow', 'congestion', 'distribution', 'quality', 'insights'].some(
    (section) => path === `analytics/${section}`,
  );
  const administrator =
    path === '' ||
    path === 'setup' ||
    path === 'system-health' ||
    path.startsWith('live') ||
    path.startsWith('cameras') ||
    path.startsWith('zones') ||
    (path.startsWith('sites') && !path.endsWith('/floors')) ||
    path.startsWith('sessions') ||
    (path.startsWith('analytics') && !smart);
  return { ...route, data: { ...route.data, administrator }, canActivate: [accessGuard] };
});
