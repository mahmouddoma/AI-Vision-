import { Routes } from '@angular/router';

export const routes: Routes = [
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
