import { Capacitor } from '@capacitor/core';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let media: MediaQueryList;
  let previousPreference: string | null;
  let previouslyDark: boolean;
  let colorScheme: HTMLMetaElement;
  let previousScheme: string | null;
  let createdMeta: boolean;

  beforeEach(() => {
    previousPreference = localStorage.getItem('vitalink-theme');
    previouslyDark = document.documentElement.classList.contains('ion-palette-dark');
    localStorage.removeItem('vitalink-theme');
    media = {
      matches: true,
      addEventListener: jasmine.createSpy('addEventListener'),
    } as unknown as MediaQueryList;
    spyOn(window, 'matchMedia').and.returnValue(media);
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
    const existing = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    createdMeta = !existing;
    colorScheme = existing ?? document.createElement('meta');
    previousScheme = colorScheme.getAttribute('content');
    colorScheme.name = 'color-scheme';
    if (createdMeta) document.head.appendChild(colorScheme);
  });

  afterEach(() => {
    if (previousPreference === null) localStorage.removeItem('vitalink-theme');
    else localStorage.setItem('vitalink-theme', previousPreference);
    document.documentElement.classList.toggle('ion-palette-dark', previouslyDark);
    if (createdMeta) colorScheme.remove();
    else if (previousScheme === null) colorScheme.removeAttribute('content');
    else colorScheme.setAttribute('content', previousScheme);
  });

  it('defaults to light even when the device prefers dark mode', () => {
    const service = new ThemeService();
    service.init();

    expect(service.getPreference()).toBe('light');
    expect(service.isDark()).toBeFalse();
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBeFalse();
    expect(colorScheme.content).toBe('light');
  });

  it('restores an explicitly saved dark preference', () => {
    localStorage.setItem('vitalink-theme', 'dark');
    const service = new ThemeService();
    service.init();

    expect(service.getPreference()).toBe('dark');
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBeTrue();
    expect(colorScheme.content).toBe('dark');
  });

  it('allows switching to dark and back to light, persisting the choice', () => {
    const service = new ThemeService();
    service.init();
    service.setPreference('dark');

    expect(service.isDark()).toBeTrue();
    expect(localStorage.getItem('vitalink-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBeTrue();

    service.setPreference('light');

    expect(service.isDark()).toBeFalse();
    expect(localStorage.getItem('vitalink-theme')).toBe('light');
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBeFalse();
    expect(colorScheme.content).toBe('light');
  });

  it('follows the device theme only when system is selected', () => {
    const service = new ThemeService();
    service.init();
    service.setPreference('system');

    expect(service.isDark()).toBeTrue();
    expect(localStorage.getItem('vitalink-theme')).toBe('system');
  });

  it('keeps the light default when storage is unavailable', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('Storage unavailable');
    const service = new ThemeService();

    expect(() => service.init()).not.toThrow();
    expect(service.getPreference()).toBe('light');
    expect(service.isDark()).toBeFalse();
  });
});
