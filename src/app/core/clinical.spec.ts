import { classifyReading, isOutOfRange, severityLabelKey } from './clinical';
import { MetricType } from './observation.service';

describe('classifyReading', () => {
  // Same cases (and results) as public.reading_severity() in supabase/schema.sql.
  const cases: [MetricType, number | null, number | null, number | null, string[], string | null][] = [
    ['bp', 118, 76, null, [], 'normal'],
    ['bp', 125, 78, null, [], 'borderline'],
    ['bp', 145, 85, null, [], 'abnormal'],
    ['bp', 185, 95, null, [], 'critical'],
    ['bp', 85, 55, null, [], 'borderline'],
    ['bp', 75, 50, null, [], 'abnormal'],
    ['bp', 65, 40, null, [], 'critical'],
    ['glucose', null, null, 50, [], 'critical'],
    ['glucose', null, null, 65, [], 'abnormal'],
    ['glucose', null, null, 110, ['TAGS.GLUCOSE_FASTING'], 'borderline'],
    ['glucose', null, null, 130, ['TAGS.GLUCOSE_FASTING'], 'abnormal'],
    ['glucose', null, null, 130, [], 'normal'],
    ['glucose', null, null, 210, [], 'abnormal'],
    ['glucose', null, null, 320, [], 'critical'],
    ['spo2', null, null, 97, [], 'normal'],
    ['spo2', null, null, 93, [], 'borderline'],
    ['spo2', null, null, 90, [], 'abnormal'],
    ['spo2', null, null, 85, [], 'critical'],
    ['hr', null, null, 72, [], 'normal'],
    ['hr', null, null, 45, [], 'borderline'],
    ['hr', null, null, 38, [], 'abnormal'],
    ['hr', null, null, 30, [], 'critical'],
    ['hr', null, null, 110, [], 'borderline'],
    ['hr', null, null, 130, [], 'abnormal'],
    ['hr', null, null, 160, [], 'critical'],
    ['pain', null, null, 2, [], 'normal'],
    ['pain', null, null, 5, [], 'borderline'],
    ['pain', null, null, 8, [], 'abnormal'],
    ['weight', null, null, 80, [], null],
  ];

  for (const [metric, systolic, diastolic, numeric_value, tags, expected] of cases) {
    it(`${metric} ${systolic ?? ''}/${diastolic ?? ''} ${numeric_value ?? ''} ${tags.join(',')} → ${expected}`, () => {
      const result = classifyReading({ metric, systolic, diastolic, numeric_value, tags });
      expect(result?.severity ?? null).toBe(expected as any);
    });
  }

  it('reports direction and label keys', () => {
    const low = classifyReading({ metric: 'spo2', numeric_value: 85 })!;
    expect(low.direction).toBe('low');
    expect(severityLabelKey(low)).toBe('CLINICAL.CRITICAL_LOW');
    expect(severityLabelKey(classifyReading({ metric: 'hr', numeric_value: 72 })!)).toBe('CLINICAL.NORMAL');
  });

  it('flags only abnormal and critical readings as out of range', () => {
    expect(isOutOfRange({ metric: 'bp', systolic: 125, diastolic: 78 })).toBeFalse();
    expect(isOutOfRange({ metric: 'bp', systolic: 145, diastolic: 85 })).toBeTrue();
    expect(isOutOfRange({ metric: 'weight', numeric_value: 300 })).toBeFalse();
  });
});
