import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'vitalink-theme';

/** Applies the light/dark palette (Ionic's `ion-palette-dark` class) from the user's preference. */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private preference: ThemePreference = 'system';
  private media = window.matchMedia('(prefers-color-scheme: dark)');

  init(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        this.preference = saved;
      }
    } catch {
      // Storage unavailable; keep the default.
    }
    this.media.addEventListener('change', () => this.apply());
    this.apply();
  }

  getPreference(): ThemePreference {
    return this.preference;
  }

  setPreference(preference: ThemePreference): void {
    this.preference = preference;
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Not persisted; still applied for this session.
    }
    this.apply();
  }

  isDark(): boolean {
    return this.preference === 'dark' || (this.preference === 'system' && this.media.matches);
  }

  private apply(): void {
    const dark = this.isDark();
    document.documentElement.classList.toggle('ion-palette-dark', dark);
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', dark ? 'dark' : 'light');
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
    }
  }
}
