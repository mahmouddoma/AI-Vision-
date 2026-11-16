import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Overview · AI Vision',
    loadComponent: () => import('./features/overview/overview').then((m) => m.Overview),
  },
  {
    path: 'sites',
    title: 'Sites · AI Vision',
    data: { kind: 'sites' },
    loadComponent: () => import('./features/catalog/catalog').then((m) => m.Catalog),
  },
  {
    path: 'cameras',
    title: 'Cameras · AI Vision',
    data: { kind: 'cameras' },
    loadComponent: () => import('./features/catalog/catalog').then((m) => m.Catalog),
  },
  {
    path: 'cameras/:cameraId/zones',
    title: 'Zones · AI Vision',
    data: { kind: 'zones' },
    loadComponent: () => import('./features/catalog/catalog').then((m) => m.Catalog),
  },
  {
    path: 'live',
    title: 'Live monitoring · AI Vision',
    loadComponent: () => import('./features/live/live').then((m) => m.Live),
  },
  {
    path: 'live/:cameraId',
    title: 'Camera detail · AI Vision',
    loadComponent: () => import('./features/live/live').then((m) => m.Live),
  },
  {
    path: 'analytics',
    title: 'Analytics · AI Vision',
    loadComponent: () => import('./features/analytics/analytics').then((m) => m.Analytics),
  },
  {
    path: 'sessions',
    title: 'Sessions · AI Vision',
    loadComponent: () => import('./features/sessions/sessions').then((m) => m.Sessions),
  },
  {
    path: 'sessions/:id',
    title: 'Session report · AI Vision',
    loadComponent: () => import('./features/sessions/session-detail').then((m) => m.SessionDetail),
  },
  {
    path: '**',
    title: 'Page not found · AI Vision',
    loadComponent: () => import('./features/not-found').then((m) => m.NotFound),
  },
];
