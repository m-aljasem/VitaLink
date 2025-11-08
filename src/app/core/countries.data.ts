/**
 * Countries data with ISO codes and flag emojis
 * Countries are sorted alphabetically by English name
 */
export interface Country {
  code: string; // ISO 3166-1 alpha-2 code
  flag: string; // Flag emoji
  nameKey: string; // Translation key for country name
}

export const COUNTRIES: Country[] = [
  { code: 'AF', flag: '🇦🇫', nameKey: 'COUNTRIES.AFGHANISTAN' },
  { code: 'AL', flag: '🇦🇱', nameKey: 'COUNTRIES.ALBANIA' },
  { code: 'DZ', flag: '🇩🇿', nameKey: 'COUNTRIES.ALGERIA' },
  { code: 'AR', flag: '🇦🇷', nameKey: 'COUNTRIES.ARGENTINA' },
  { code: 'AU', flag: '🇦🇺', nameKey: 'COUNTRIES.AUSTRALIA' },
  { code: 'AT', flag: '🇦🇹', nameKey: 'COUNTRIES.AUSTRIA' },
  { code: 'BD', flag: '🇧🇩', nameKey: 'COUNTRIES.BANGLADESH' },
  { code: 'BE', flag: '🇧🇪', nameKey: 'COUNTRIES.BELGIUM' },
  { code: 'BR', flag: '🇧🇷', nameKey: 'COUNTRIES.BRAZIL' },
  { code: 'BG', flag: '🇧🇬', nameKey: 'COUNTRIES.BULGARIA' },
  { code: 'CA', flag: '🇨🇦', nameKey: 'COUNTRIES.CANADA' },
  { code: 'CN', flag: '🇨🇳', nameKey: 'COUNTRIES.CHINA' },
  { code: 'CO', flag: '🇨🇴', nameKey: 'COUNTRIES.COLOMBIA' },
  { code: 'HR', flag: '🇭🇷', nameKey: 'COUNTRIES.CROATIA' },
  { code: 'CZ', flag: '🇨🇿', nameKey: 'COUNTRIES.CZECH_REPUBLIC' },
  { code: 'DK', flag: '🇩🇰', nameKey: 'COUNTRIES.DENMARK' },
  { code: 'EG', flag: '🇪🇬', nameKey: 'COUNTRIES.EGYPT' },
  { code: 'FI', flag: '🇫🇮', nameKey: 'COUNTRIES.FINLAND' },
  { code: 'FR', flag: '🇫🇷', nameKey: 'COUNTRIES.FRANCE' },
  { code: 'DE', flag: '🇩🇪', nameKey: 'COUNTRIES.GERMANY' },
  { code: 'GR', flag: '🇬🇷', nameKey: 'COUNTRIES.GREECE' },
  { code: 'HK', flag: '🇭🇰', nameKey: 'COUNTRIES.HONG_KONG' },
  { code: 'HU', flag: '🇭🇺', nameKey: 'COUNTRIES.HUNGARY' },
  { code: 'IN', flag: '🇮🇳', nameKey: 'COUNTRIES.INDIA' },
  { code: 'ID', flag: '🇮🇩', nameKey: 'COUNTRIES.INDONESIA' },
  { code: 'IR', flag: '🇮🇷', nameKey: 'COUNTRIES.IRAN' },
  { code: 'IQ', flag: '🇮🇶', nameKey: 'COUNTRIES.IRAQ' },
  { code: 'IE', flag: '🇮🇪', nameKey: 'COUNTRIES.IRELAND' },
  { code: 'IT', flag: '🇮🇹', nameKey: 'COUNTRIES.ITALY' },
  { code: 'JP', flag: '🇯🇵', nameKey: 'COUNTRIES.JAPAN' },
  { code: 'JO', flag: '🇯🇴', nameKey: 'COUNTRIES.JORDAN' },
  { code: 'KE', flag: '🇰🇪', nameKey: 'COUNTRIES.KENYA' },
  { code: 'KW', flag: '🇰🇼', nameKey: 'COUNTRIES.KUWAIT' },
  { code: 'LB', flag: '🇱🇧', nameKey: 'COUNTRIES.LEBANON' },
  { code: 'MY', flag: '🇲🇾', nameKey: 'COUNTRIES.MALAYSIA' },
  { code: 'MX', flag: '🇲🇽', nameKey: 'COUNTRIES.MEXICO' },
  { code: 'MA', flag: '🇲🇦', nameKey: 'COUNTRIES.MOROCCO' },
  { code: 'NL', flag: '🇳🇱', nameKey: 'COUNTRIES.NETHERLANDS' },
  { code: 'NZ', flag: '🇳🇿', nameKey: 'COUNTRIES.NEW_ZEALAND' },
  { code: 'NG', flag: '🇳🇬', nameKey: 'COUNTRIES.NIGERIA' },
  { code: 'NO', flag: '🇳🇴', nameKey: 'COUNTRIES.NORWAY' },
  { code: 'OM', flag: '🇴🇲', nameKey: 'COUNTRIES.OMAN' },
  { code: 'PK', flag: '🇵🇰', nameKey: 'COUNTRIES.PAKISTAN' },
  { code: 'PH', flag: '🇵🇭', nameKey: 'COUNTRIES.PHILIPPINES' },
  { code: 'PL', flag: '🇵🇱', nameKey: 'COUNTRIES.POLAND' },
  { code: 'PT', flag: '🇵🇹', nameKey: 'COUNTRIES.PORTUGAL' },
  { code: 'QA', flag: '🇶🇦', nameKey: 'COUNTRIES.QATAR' },
  { code: 'RO', flag: '🇷🇴', nameKey: 'COUNTRIES.ROMANIA' },
  { code: 'RU', flag: '🇷🇺', nameKey: 'COUNTRIES.RUSSIA' },
  { code: 'SA', flag: '🇸🇦', nameKey: 'COUNTRIES.SAUDI_ARABIA' },
  { code: 'SG', flag: '🇸🇬', nameKey: 'COUNTRIES.SINGAPORE' },
  { code: 'ZA', flag: '🇿🇦', nameKey: 'COUNTRIES.SOUTH_AFRICA' },
  { code: 'KR', flag: '🇰🇷', nameKey: 'COUNTRIES.SOUTH_KOREA' },
  { code: 'ES', flag: '🇪🇸', nameKey: 'COUNTRIES.SPAIN' },
  { code: 'SE', flag: '🇸🇪', nameKey: 'COUNTRIES.SWEDEN' },
  { code: 'CH', flag: '🇨🇭', nameKey: 'COUNTRIES.SWITZERLAND' },
  { code: 'TW', flag: '🇹🇼', nameKey: 'COUNTRIES.TAIWAN' },
  { code: 'TH', flag: '🇹🇭', nameKey: 'COUNTRIES.THAILAND' },
  { code: 'TR', flag: '🇹🇷', nameKey: 'COUNTRIES.TURKEY' },
  { code: 'AE', flag: '🇦🇪', nameKey: 'COUNTRIES.UAE' },
  { code: 'UA', flag: '🇺🇦', nameKey: 'COUNTRIES.UKRAINE' },
  { code: 'GB', flag: '🇬🇧', nameKey: 'COUNTRIES.UNITED_KINGDOM' },
  { code: 'US', flag: '🇺🇸', nameKey: 'COUNTRIES.UNITED_STATES' },
  { code: 'VN', flag: '🇻🇳', nameKey: 'COUNTRIES.VIETNAM' },
];

/**
 * Get country by code
 */
export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find(c => c.code === code);
}

/**
 * Get country by name (case-insensitive partial match)
 * Tries to match by common country name variations
 */
export function getCountryByName(name: string): Country | undefined {
  if (!name) return undefined;
  
  const lowerName = name.toLowerCase().trim();
  
  // First try exact code match
  const byCode = COUNTRIES.find(c => c.code.toLowerCase() === lowerName);
  if (byCode) return byCode;
  
  // Try matching common name variations
  const nameMap: { [key: string]: string } = {
    'united states': 'US',
    'usa': 'US',
    'united kingdom': 'GB',
    'uk': 'GB',
    'uae': 'AE',
    'united arab emirates': 'AE',
    'south korea': 'KR',
    'north korea': 'KP',
    'czech republic': 'CZ',
    'hong kong': 'HK',
    'new zealand': 'NZ',
    'south africa': 'ZA',
  };
  
  const mappedCode = nameMap[lowerName];
  if (mappedCode) {
    return COUNTRIES.find(c => c.code === mappedCode);
  }
  
  // Try partial match on country names (would need translations, so limited)
  return undefined;
}

