import { MetricType } from './observation.service';

/**
 * Clinical classification of a single reading, using general adult ranges.
 * Keep in sync with public.reading_severity() in supabase/schema.sql
 * (clinical.spec.ts checks both against the same table).
 */
export type Severity = 'normal' | 'borderline' | 'abnormal' | 'critical';
export type Direction = 'low' | 'high';

export interface Classification {
  severity: Severity;
  direction?: Direction;
}

export interface ReadingValues {
  metric: MetricType;
  systolic?: number | null;
  diastolic?: number | null;
  /** Canonical units: mg/dL for glucose, kg for weight. */
  numeric_value?: number | null;
  tags?: string[] | null;
}

export const FASTING_TAG = 'TAGS.GLUCOSE_FASTING';

const SEVERITY_RANK: Record<Severity, number> = { normal: 0, borderline: 1, abnormal: 2, critical: 3 };

/** Returns null when the metric isn't classified from a single reading (weight) or values are missing. */
export function classifyReading(reading: ReadingValues): Classification | null {
  const v = reading.numeric_value;
  switch (reading.metric) {
    case 'bp': {
      const s = reading.systolic, d = reading.diastolic;
      if (s == null || d == null) return null;
      if (s >= 180 || d >= 120) return { severity: 'critical', direction: 'high' };
      if (s < 70) return { severity: 'critical', direction: 'low' };
      if (s >= 140 || d >= 90) return { severity: 'abnormal', direction: 'high' };
      if (s < 80) return { severity: 'abnormal', direction: 'low' };
      if (s >= 120 || d >= 80) return { severity: 'borderline', direction: 'high' };
      if (s < 90 || d < 60) return { severity: 'borderline', direction: 'low' };
      return { severity: 'normal' };
    }
    case 'glucose': {
      if (v == null) return null;
      if (v < 54) return { severity: 'critical', direction: 'low' };
      if (v >= 300) return { severity: 'critical', direction: 'high' };
      if (v < 70) return { severity: 'abnormal', direction: 'low' };
      const fasting = (reading.tags || []).includes(FASTING_TAG);
      const [borderline, abnormal] = fasting ? [100, 126] : [140, 200];
      if (v >= abnormal) return { severity: 'abnormal', direction: 'high' };
      if (v >= borderline) return { severity: 'borderline', direction: 'high' };
      return { severity: 'normal' };
    }
    case 'spo2': {
      if (v == null) return null;
      if (v < 88) return { severity: 'critical', direction: 'low' };
      if (v < 92) return { severity: 'abnormal', direction: 'low' };
      if (v < 95) return { severity: 'borderline', direction: 'low' };
      return { severity: 'normal' };
    }
    case 'hr': {
      if (v == null) return null;
      if (v < 35) return { severity: 'critical', direction: 'low' };
      if (v >= 150) return { severity: 'critical', direction: 'high' };
      if (v < 40) return { severity: 'abnormal', direction: 'low' };
      if (v >= 120) return { severity: 'abnormal', direction: 'high' };
      if (v < 50) return { severity: 'borderline', direction: 'low' };
      if (v > 100) return { severity: 'borderline', direction: 'high' };
      return { severity: 'normal' };
    }
    case 'pain': {
      if (v == null) return null;
      if (v >= 7) return { severity: 'abnormal', direction: 'high' };
      if (v >= 4) return { severity: 'borderline', direction: 'high' };
      return { severity: 'normal' };
    }
    default:
      return null;
  }
}

/** True for readings that need attention (abnormal or critical). */
export function isOutOfRange(reading: ReadingValues): boolean {
  const c = classifyReading(reading);
  return !!c && SEVERITY_RANK[c.severity] >= SEVERITY_RANK.abnormal;
}

/** Translation key for a short label such as "High" or "Critically low". */
export function severityLabelKey(c: Classification): string {
  if (c.severity === 'normal') return 'CLINICAL.NORMAL';
  if (!c.direction) return `CLINICAL.${c.severity.toUpperCase()}`;
  return `CLINICAL.${c.severity.toUpperCase()}_${c.direction.toUpperCase()}`;
}

/** Translation key for "what to do" guidance, shown for abnormal and critical readings. */
export function severityAdviceKey(c: Classification): string | null {
  if (c.severity === 'critical') return 'CLINICAL.ADVICE_CRITICAL';
  if (c.severity === 'abnormal') return 'CLINICAL.ADVICE_ABNORMAL';
  return null;
}
