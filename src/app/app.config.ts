import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideApiConfiguration } from './api/api-configuration';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth';
import { authInterceptor } from './core/auth/auth-interceptor';
import { provideIcons } from './core/icons/icons';
import { ThemeService } from './core/theme/theme';
import { errorInterceptor } from './core/http/error-interceptor';
import { loadingInterceptor } from './core/http/loading';
import { telemetryInterceptor } from './core/http/telemetry';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Query parameters and route data arrive as component inputs
    provideRouter(routes, withComponentInputBinding()),
    // Outermost first: the error snackbar sees a request only after the auth interceptor's retry; telemetry,
    // innermost, times each attempt on the wire
    provideHttpClient(
      withInterceptors([
        loadingInterceptor,
        errorInterceptor,
        authInterceptor,
        telemetryInterceptor,
      ]),
    ),
    // Same origin: the dev server (proxy.conf.json) and Nginx forward /api to the gateway
    provideApiConfiguration(''),
    provideIcons(),
    provideAppInitializer(() => {
      // Applies the colour mode and starts following the system setting
      inject(ThemeService);
      // A reload keeps the user signed in while the refresh cookie is valid
      return inject(AuthService).restore();
    }),
  ],
};
