import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, Role } from './auth';

// Guards only shape navigation; the gateway enforces every permission itself

/** Signed in, and the password needn't be changed first (or this is the page to change it). */
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.signedIn()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  if (auth.mustChangePassword() && !state.url.startsWith('/change-password')) {
    return router.createUrlTree(['/change-password']);
  }
  return true;
};

/** The sign-in page: someone already signed in goes to the app instead. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.signedIn() ? inject(Router).createUrlTree(['/']) : true;
};

/** One of these roles; anyone else goes to the start page. Use after authGuard. */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    return auth.hasRole(...roles) || inject(Router).createUrlTree(['/']);
  };
}
