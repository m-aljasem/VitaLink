import { MetricType } from './observation.service';

/**
 * Readings are always stored in canonical units (mg/dL, kg).
 * These helpers convert to and from the user's display units.
 */
export type GlucoseUnit = 'mg/dL' | 'mmol/L';
export type WeightUnit = 'kg' | 'lb';

export interface UnitPreferences {
  glucose_unit: GlucoseUnit;
  weight_unit: WeightUnit;
}

export const DEFAULT_UNITS: UnitPreferences = { glucose_unit: 'mg/dL', weight_unit: 'kg' };

const MGDL_PER_MMOL = 18.016;
const LB_PER_KG = 2.20462;

/** Countries where mmol/L is the usual glucose unit (ISO 3166-1 alpha-2). */
const MMOL_COUNTRIES = new Set([
  'GB', 'IE', 'CA', 'AU', 'NZ', 'ZA', 'NL', 'BE', 'DK', 'SE', 'NO', 'FI', 'CH', 'CZ', 'HU', 'HR',
  'BG', 'RO', 'RU', 'UA', 'CN', 'HK', 'SG', 'MY', 'KE', 'NG', 'IR', 'PL',
]);
/** Countries where pounds are the usual body-weight unit. */
const LB_COUNTRIES = new Set(['US']);

export function defaultUnitsForCountry(countryCode?: string | null): UnitPreferences {
  const code = (countryCode || '').toUpperCase();
  return {
    glucose_unit: MMOL_COUNTRIES.has(code) ? 'mmol/L' : 'mg/dL',
    weight_unit: LB_COUNTRIES.has(code) ? 'lb' : 'kg',
  };
}

/** Converts a canonical value to the user's display unit. */
export function toDisplay(metric: MetricType, value: number, prefs: UnitPreferences): number {
  if (metric === 'glucose' && prefs.glucose_unit === 'mmol/L') return round(value / MGDL_PER_MMOL, 1);
  if (metric === 'weight' && prefs.weight_unit === 'lb') return round(value * LB_PER_KG, 1);
  return value;
}

/** Converts a value entered in the user's display unit to the canonical unit. */
export function fromDisplay(metric: MetricType, value: number, prefs: UnitPreferences): number {
  if (metric === 'glucose' && prefs.glucose_unit === 'mmol/L') return Math.round(value * MGDL_PER_MMOL);
  if (metric === 'weight' && prefs.weight_unit === 'lb') return round(value / LB_PER_KG, 2);
  return value;
}

/** Plain-ASCII unit symbol in the user's display unit (for PDF reports and exports). */
export function unitSymbol(metric: MetricType, prefs: UnitPreferences): string {
  if (metric === 'glucose') return prefs.glucose_unit;
  if (metric === 'weight') return prefs.weight_unit;
  return canonicalUnit(metric);
}

/** Canonical unit stored with each reading. */
export function canonicalUnit(metric: MetricType): string {
  return { bp: 'mmHg', glucose: 'mg/dL', spo2: '%', hr: 'bpm', pain: '0-10', weight: 'kg' }[metric];
}

/** Valid input range in canonical units. */
export const CANONICAL_RANGES: Record<Exclude<MetricType, 'bp'>, { min: number; max: number }> = {
  glucose: { min: 20, max: 600 },
  spo2: { min: 50, max: 100 },
  hr: { min: 30, max: 220 },
  pain: { min: 0, max: 10 },
  weight: { min: 1, max: 500 },
};

export const BP_RANGES = { systolic: { min: 50, max: 250 }, diastolic: { min: 30, max: 150 } };

/** Valid input range in the user's display unit. */
export function displayRange(metric: Exclude<MetricType, 'bp'>, prefs: UnitPreferences): { min: number; max: number; step: number } {
  const r = CANONICAL_RANGES[metric];
  const min = toDisplay(metric, r.min, prefs);
  const max = toDisplay(metric, r.max, prefs);
  const step = (metric === 'glucose' && prefs.glucose_unit === 'mmol/L') || metric === 'weight' ? 0.1 : 1;
  return { min, max, step };
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
