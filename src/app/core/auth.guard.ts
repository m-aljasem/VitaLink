import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Guard that redirects authenticated users away from auth pages
 * If user is authenticated, redirect to home
 * If user is not authenticated, allow access to auth pages
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isAuthenticated = await authService.isAuthenticated();
  
  if (isAuthenticated) {
    // User is authenticated, redirect to home
    const profile = await authService.getCurrentProfile();
    if (!profile || !profile.role || !profile.first_name) {
      router.navigate(['/onboarding']);
    } else {
      router.navigate(['/tabs/home']);
    }
    return false;
  }

  // User is not authenticated, allow access to auth pages
  return true;
};

