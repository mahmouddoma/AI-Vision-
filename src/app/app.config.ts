import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { TitleStrategy, provideRouter, withInMemoryScrolling } from '@angular/router';
import { LocalizedTitle } from './core/localized-title';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { Auth, authorizationInterceptor } from './core/auth';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authorizationInterceptor])),
    provideAppInitializer(() => inject(Auth).initialize()),
    { provide: TitleStrategy, useClass: LocalizedTitle },
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
  ],
};
