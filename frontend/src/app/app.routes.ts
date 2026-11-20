import { Routes } from '@angular/router';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    // short links of the demo build land here
    path: 'r/:code',
    title: 'Redirecting… · Snip',
    loadComponent: () => import('./features/redirect/redirect-page').then((m) => m.RedirectPage),
  },
  {
    path: '',
    component: Shell,
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Dashboard · Snip',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'new',
        title: 'Shorten a link · Snip',
        loadComponent: () => import('./features/shorten/shorten-page').then((m) => m.ShortenPage),
      },
      {
        path: 'links',
        title: 'Links · Snip',
        loadComponent: () => import('./features/links/links-page').then((m) => m.LinksPage),
      },
      {
        path: 'links/:code',
        title: 'Link stats · Snip',
        loadComponent: () =>
          import('./features/link-detail/link-detail-page').then((m) => m.LinkDetailPage),
      },
      {
        path: '**',
        title: 'Page not found · Snip',
        loadComponent: () =>
          import('./features/not-found/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
