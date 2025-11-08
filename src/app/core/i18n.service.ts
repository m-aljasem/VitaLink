import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { firstValueFrom } from 'rxjs';

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'ar' | 'fa' | 'ur' | 'zh' | 'ja';

const LANGUAGE_STORAGE_KEY = 'vivialink-language';

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  private currentLanguage$ = new BehaviorSubject<SupportedLanguage>('en');
  private rtlLanguages: SupportedLanguage[] = ['ar', 'fa', 'ur'];

  constructor(private translate: TranslateService) {
    // Set default language - translations should already be loaded by AppComponent
    this.translate.setDefaultLang('en');
    // Just update direction, don't reload translations
    this.updateDirection('en');
  }

  /**
   * Initialize language from profile or localStorage
   * This should be called after translations are loaded
   * Priority: profile language > localStorage > default 'en'
   */
  async initializeLanguage(profileLanguage?: string): Promise<void> {
    let lang: SupportedLanguage = 'en';
    
    // First check profile language (source of truth for logged-in users)
    if (profileLanguage && this.isValidLanguage(profileLanguage)) {
      lang = profileLanguage as SupportedLanguage;
      // Save to localStorage for future quick access
      this.saveLanguageToStorage(lang);
    } 
    // Then check localStorage (for users not logged in or as fallback)
    else {
      const storedLang = this.getStoredLanguage();
      if (storedLang && this.isValidLanguage(storedLang)) {
        lang = storedLang;
      }
    }
    
    // Apply the language
    await firstValueFrom(this.translate.use(lang));
    this.currentLanguage$.next(lang);
    this.updateDirection(lang);
  }

  setLanguage(lang: SupportedLanguage): void {
    this.translate.use(lang);
    this.currentLanguage$.next(lang);
    this.updateDirection(lang);
    // Save to localStorage for persistence
    this.saveLanguageToStorage(lang);
  }

  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage$.value;
  }

  isRTL(): boolean {
    return this.rtlLanguages.includes(this.currentLanguage$.value);
  }

  private updateDirection(lang: SupportedLanguage): void {
    const isRTL = this.rtlLanguages.includes(lang);
    document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }

  getLanguageObservable() {
    return this.currentLanguage$.asObservable();
  }

  private getStoredLanguage(): SupportedLanguage | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return stored && this.isValidLanguage(stored) ? stored as SupportedLanguage : null;
    } catch {
      return null;
    }
  }

  private saveLanguageToStorage(lang: SupportedLanguage): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      } catch {
        // Ignore storage errors
      }
    }
  }

  private isValidLanguage(lang: string): boolean {
    const validLanguages: SupportedLanguage[] = ['en', 'es', 'fr', 'de', 'ar', 'fa', 'ur', 'zh', 'ja'];
    return validLanguages.includes(lang as SupportedLanguage);
  }
}

