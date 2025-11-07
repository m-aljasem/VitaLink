import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'ar' | 'fa' | 'ur' | 'zh' | 'ja';

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

  setLanguage(lang: SupportedLanguage): void {
    this.translate.use(lang);
    this.currentLanguage$.next(lang);
    this.updateDirection(lang);
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
}

