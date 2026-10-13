import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { errorCode } from '../http/api-error';
import { AuthService, SESSION_REQUEST } from './auth';

/**
 * Sends the access token with every API request. A token about to expire is renewed first; requests made
 * meanwhile wait for that one refresh. A request the gateway answers with 401 UNAUTHENTICATED (expired or
 * rejected token) is retried once with a new token; if there is none, the session is over.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SESSION_REQUEST) || !isApiRequest(req.url)) return next(req);
  const auth = inject(AuthService);
  if (!auth.signedIn()) return next(req);

  if (auth.tokenExpiresSoon()) return refreshThenSend(auth, req, next);

  const sentWith = auth.accessToken();
  return send(auth, req, next).pipe(
    catchError((error: unknown) => {
      if (!isTokenRejected(error)) return throwError(() => error);
      // Another request may have renewed the token while this one was out
      const current = auth.accessToken();
      if (current !== null && current !== sentWith && !auth.tokenExpiresSoon()) {
        return send(auth, req, next);
      }
      return refreshThenSend(auth, req, next);
    }),
  );
};

function send(auth: AuthService, req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const token = auth.accessToken();
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
}

function refreshThenSend(
  auth: AuthService,
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  return from(auth.refresh()).pipe(
    switchMap((renewed) => {
      if (renewed) return send(auth, req, next);
      void auth.expire();
      return throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            statusText: 'Unauthorized',
            url: req.urlWithParams,
            error: { code: 'UNAUTHENTICATED', detail: 'Your session has ended; sign in again.' },
          }),
      );
    }),
  );
}

function isTokenRejected(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 401 &&
    errorCode(error) === 'UNAUTHENTICATED'
  );
}

// Same origin: the dev server and Nginx proxy /api to the gateway
function isApiRequest(url: string): boolean {
  return url.startsWith('/api/');
}
