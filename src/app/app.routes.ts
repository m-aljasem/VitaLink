import { Routes } from '@angular/router';
import { sessionGuard } from './core/session.guard';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./pages/auth/auth.page').then((m) => m.AuthPage),
    canActivate: [authGuard],
  },
  {
    path: 'auth/verify',
    loadComponent: () => import('./pages/auth/verify.page').then((m) => m.VerifyPage),
    canActivate: [authGuard],
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./pages/onboarding/onboarding.page').then((m) => m.OnboardingPage),
    canActivate: [sessionGuard],
  },
  {
    path: 'tour',
    loadComponent: () => import('./pages/tour/tour.page').then((m) => m.TourPage),
    canActivate: [sessionGuard],
  },
  {
    path: 'tabs',
    loadComponent: () => import('./pages/tabs/tabs.page').then((m) => m.TabsPage),
    canActivate: [sessionGuard],
    children: [
      {
        path: 'home',
        loadComponent: () => import('./pages/patient/home/patient-home.page').then((m) => m.PatientHomePage),
      },
      {
        path: 'provider-home',
        loadComponent: () => import('./pages/provider/home/provider-home.page').then((m) => m.ProviderHomePage),
      },
      {
        path: 'connect',
        loadComponent: () => import('./pages/patient/connect/patient-connect.page').then((m) => m.PatientConnectPage),
      },
      {
        path: 'provider-connect',
        loadComponent: () => import('./pages/provider/connect/provider-connect.page').then((m) => m.ProviderConnectPage),
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'provider/patient/:id',
    loadComponent: () => import('./pages/provider/patient-detail/provider-patient-detail.page').then((m) => m.ProviderPatientDetailPage),
    canActivate: [sessionGuard],
  },
  {
    path: 'tabs/settings/profile',
    loadComponent: () => import('./pages/settings/profile/profile.page').then((m) => m.ProfilePage),
    canActivate: [sessionGuard],
  },
  {
    path: 'tabs/settings/reminders',
    loadComponent: () => import('./pages/settings/reminders/reminders.page').then((m) => m.RemindersPage),
    canActivate: [sessionGuard],
  },
  {
    path: 'tabs/settings/about',
    loadComponent: () => import('./pages/settings/about/about.page').then((m) => m.AboutPage),
    canActivate: [sessionGuard],
  },
  {
    path: 'tabs/settings/mode-switch',
    loadComponent: () => import('./pages/settings/mode-switch/mode-switch.page').then((m) => m.ModeSwitchPage),
    canActivate: [sessionGuard],
  },
  {
    path: 'metric/:type',
    loadComponent: () => import('./pages/patient/metric-detail/metric-detail.page').then((m) => m.MetricDetailPage),
    canActivate: [sessionGuard],
  },
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full',
  },
];
