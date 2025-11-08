import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Maps country codes (ISO 3166-1 alpha-2) to locale strings
 * This ensures dates are formatted according to the user's country conventions
 */
const COUNTRY_TO_LOCALE: { [key: string]: string } = {
  // English-speaking countries
  'US': 'en-US',
  'GB': 'en-GB',
  'CA': 'en-CA', // Note: Canada can be en-CA or fr-CA, defaulting to en-CA
  'AU': 'en-AU',
  'NZ': 'en-NZ',
  'IE': 'en-IE',
  'ZA': 'en-ZA',
  
  // Spanish-speaking countries
  'ES': 'es-ES',
  'MX': 'es-MX',
  'AR': 'es-AR',
  'CO': 'es-CO',
  'CL': 'es-CL',
  'PE': 'es-PE',
  'VE': 'es-VE',
  'EC': 'es-EC',
  'GT': 'es-GT',
  'CU': 'es-CU',
  'BO': 'es-BO',
  'DO': 'es-DO',
  'HN': 'es-HN',
  'PY': 'es-PY',
  'SV': 'es-SV',
  'NI': 'es-NI',
  'CR': 'es-CR',
  'PA': 'es-PA',
  'UY': 'es-UY',
  'PR': 'es-PR',
  
  // French-speaking countries
  'FR': 'fr-FR',
  'BE': 'fr-BE',
  'CH': 'fr-CH', // Note: Switzerland can be de-CH, fr-CH, or it-CH, defaulting to fr-CH
  'LU': 'fr-LU',
  'MC': 'fr-MC',
  
  // German-speaking countries
  'DE': 'de-DE',
  'AT': 'de-AT',
  
  // Arabic-speaking countries
  'SA': 'ar-SA',
  'AE': 'ar-AE',
  'EG': 'ar-EG',
  'IQ': 'ar-IQ',
  'JO': 'ar-JO',
  'KW': 'ar-KW',
  'LB': 'ar-LB',
  'LY': 'ar-LY',
  'MA': 'ar-MA',
  'OM': 'ar-OM',
  'QA': 'ar-QA',
  'SY': 'ar-SY',
  'TN': 'ar-TN',
  'YE': 'ar-YE',
  'DZ': 'ar-DZ',
  'BH': 'ar-BH',
  'SD': 'ar-SD',
  'PS': 'ar-PS',
  
  // Chinese-speaking countries
  'CN': 'zh-CN',
  'TW': 'zh-TW',
  'HK': 'zh-HK',
  'SG': 'zh-SG',
  'MO': 'zh-MO',
  
  // Japanese
  'JP': 'ja-JP',
  
  // Persian/Farsi
  'IR': 'fa-IR',
  'AF': 'fa-AF',
  
  // Urdu
  'PK': 'ur-PK',
  'IN': 'hi-IN', // Note: India has many languages, defaulting to Hindi
  
  // Other common countries
  'IT': 'it-IT',
  'PT': 'pt-PT',
  'BR': 'pt-BR',
  'RU': 'ru-RU',
  'NL': 'nl-NL',
  'PL': 'pl-PL',
  'TR': 'tr-TR',
  'KR': 'ko-KR',
  'VN': 'vi-VN',
  'TH': 'th-TH',
  'ID': 'id-ID',
  'MY': 'ms-MY',
  'PH': 'en-PH',
  'BD': 'bn-BD',
};

/**
 * Maps language codes to default locales (fallback when country is not available)
 */
const LANGUAGE_TO_LOCALE: { [key: string]: string } = {
  'en': 'en-US',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'ar': 'ar-SA',
  'fa': 'fa-IR',
  'ur': 'ur-PK',
  'zh': 'zh-CN',
  'ja': 'ja-JP',
};

@Injectable({
  providedIn: 'root',
})
export class DateFormatService {
  private cachedLocale: string | null = null;
  private cachedCountry: string | null = null;

  constructor(private authService: AuthService) {}

  /**
   * Get the locale based on user's country or language
   * Returns a locale string suitable for date formatting
   */
  async getLocale(): Promise<string> {
    try {
      const profile = await this.authService.getCurrentProfile();
      const country = profile?.country;
      
      // If country hasn't changed, return cached locale
      if (country === this.cachedCountry && this.cachedLocale) {
        return this.cachedLocale;
      }
      
      // Try to get locale from country
      if (country && COUNTRY_TO_LOCALE[country.toUpperCase()]) {
        this.cachedLocale = COUNTRY_TO_LOCALE[country.toUpperCase()];
        this.cachedCountry = country;
        return this.cachedLocale;
      }
      
      // Fallback to language-based locale
      const language = profile?.language || 'en';
      this.cachedLocale = LANGUAGE_TO_LOCALE[language] || 'en-US';
      this.cachedCountry = country ?? null;
      return this.cachedLocale;
    } catch (error) {
      // Fallback to default
      return 'en-US';
    }
  }

  /**
   * Format a date string according to the user's locale
   */
  async formatDate(dateString: string | null | undefined, options?: Intl.DateTimeFormatOptions): Promise<string> {
    if (!dateString) return '';
    
    const locale = await this.getLocale();
    const date = new Date(dateString);
    
    // Default options if not provided
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    
    return date.toLocaleDateString(locale, options || defaultOptions);
  }

  /**
   * Format a date and time according to the user's locale
   */
  async formatDateTime(dateString: string | null | undefined, options?: Intl.DateTimeFormatOptions): Promise<string> {
    if (!dateString) return '';
    
    const locale = await this.getLocale();
    const date = new Date(dateString);
    
    // Default options if not provided
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };
    
    return date.toLocaleString(locale, options || defaultOptions);
  }

  /**
   * Format a date in short format (e.g., "12/25/2024" or "25/12/2024")
   */
  async formatDateShort(dateString: string | null | undefined): Promise<string> {
    if (!dateString) return '';
    
    const locale = await this.getLocale();
    const date = new Date(dateString);
    
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  /**
   * Format a date in long format (e.g., "December 25, 2024" or "25 de diciembre de 2024")
   */
  async formatDateLong(dateString: string | null | undefined): Promise<string> {
    if (!dateString) return '';
    
    const locale = await this.getLocale();
    const date = new Date(dateString);
    
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Get locale synchronously (uses cached value or default)
   * Use this when you can't use async/await
   */
  getLocaleSync(): string {
    return this.cachedLocale || 'en-US';
  }

  /**
   * Format date synchronously (uses cached locale)
   * Use this when you can't use async/await
   */
  formatDateSync(dateString: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
    if (!dateString) return '';
    
    const locale = this.getLocaleSync();
    const date = new Date(dateString);
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    
    return date.toLocaleDateString(locale, options || defaultOptions);
  }

  /**
   * Format date and time synchronously (uses cached locale)
   * Use this when you can't use async/await
   */
  formatDateTimeSync(dateString: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
    if (!dateString) return '';
    
    const locale = this.getLocaleSync();
    const date = new Date(dateString);
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };
    
    return date.toLocaleString(locale, options || defaultOptions);
  }

  /**
   * Clear cached locale (call when user updates their profile)
   */
  clearCache(): void {
    this.cachedLocale = null;
    this.cachedCountry = null;
  }
}

