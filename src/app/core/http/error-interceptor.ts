import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { HANDLES_ERRORS, describeError, errorCode } from './api-error';

/**
 * Shows a snackbar for failed requests nobody else handles. Requests marked HANDLES_ERRORS (forms) show
 * their own; 401s belong to the session (the auth interceptor). A password that must be changed first
 * sends the user to that page.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && !req.context.get(HANDLES_ERRORS)) {
        if (errorCode(error) === 'PASSWORD_CHANGE_REQUIRED') {
          void router.navigateByUrl('/change-password');
        } else if (error.status !== 401) {
          snackBar.open(describeError(error), 'Dismiss', { duration: 8000 });
        }
      }
      return throwError(() => error);
    }),
  );
};
