import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideApiConfiguration } from './api/api-configuration';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth';
import { authInterceptor } from './core/auth/auth-interceptor';
import { errorInterceptor } from './core/http/error-interceptor';
import { loadingInterceptor } from './core/http/loading';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Query parameters and route data arrive as component inputs
    provideRouter(routes, withComponentInputBinding()),
    // Outermost first: the error snackbar sees a request only after the auth interceptor's retry
    provideHttpClient(withInterceptors([loadingInterceptor, errorInterceptor, authInterceptor])),
    // Same origin: the dev server (proxy.conf.json) and Nginx forward /api to the gateway
    provideApiConfiguration(''),
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
      // A reload keeps the user signed in while the refresh cookie is valid
      return inject(AuthService).restore();
    }),
  ],
};
