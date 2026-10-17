import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from './api.service';
import { AuthService, Role } from './auth.service';

/** Adds the bearer token to API calls; an expired session sends the user back to the login page. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token;
  const outgoing = token && req.url.startsWith(API_URL)
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(outgoing).pipe(
    catchError((e: unknown) => {
      const isLogin = req.url.endsWith('/logdata');
      if (e instanceof HttpErrorResponse && e.status === 401 && !isLogin) {
        auth.logout();
        router.navigate(['/login']);
      }
      return throwError(() => e);
    })
  );
};

/**
 * Route guard: `role` restricts a page to patients or to admins. Someone signed in with the other
 * role is sent to their own home page, anonymous visitors to the login page.
 */
export const roleGuard = (role: Role): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.role === role) return true;
  return router.createUrlTree([auth.home]);
};
