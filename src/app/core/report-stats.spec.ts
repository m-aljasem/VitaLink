import { computeMetricStats } from './report-stats';
import { Observation } from './observation.service';

function at(hour: number, extra: Partial<Observation>): Observation {
  const ts = new Date(2026, 9, 20, hour, 0).toISOString();
  return { user_id: 'u', metric: 'bp', ts, ...extra } as Observation;
}

describe('computeMetricStats', () => {
  const prefs = { glucose_unit: 'mmol/L' as const, weight_unit: 'kg' as const };

  it('summarizes blood pressure with morning and evening averages', () => {
    const stats = computeMetricStats('bp', [
      at(8, { systolic: 150, diastolic: 95 }),   // abnormal
      at(9, { systolic: 130, diastolic: 85 }),   // borderline
      at(20, { systolic: 115, diastolic: 75 }),  // normal
    ], prefs)!;

    expect(stats.count).toBe(3);
    expect(stats.average).toBe(131.7);
    expect(stats.min).toBe(115);
    expect(stats.max).toBe(150);
    expect(stats.diastolic).toEqual({ average: 85, min: 75, max: 95 });
    expect(stats.morning).toEqual({ systolic: 140, diastolic: 90, count: 2 });
    expect(stats.evening).toEqual({ systolic: 115, diastolic: 75, count: 1 });
    expect(stats.inRangeShare).toBeCloseTo(1 / 3, 5);
    expect(stats.outOfRangeCount).toBe(1);
  });

  it('reports glucose in the display unit and classifies in canonical units', () => {
    const stats = computeMetricStats('glucose', [
      at(8, { metric: 'glucose', numeric_value: 90 }),
      at(13, { metric: 'glucose', numeric_value: 250 }),
    ], prefs)!;
    expect(stats.min).toBe(5);
    expect(stats.max).toBe(13.9);
    expect(stats.outOfRangeCount).toBe(1);
  });

  it('does not classify weight and returns null without readings', () => {
    const stats = computeMetricStats('weight', [at(8, { metric: 'weight', numeric_value: 80 })], prefs)!;
    expect(stats.inRangeShare).toBeNull();
    expect(computeMetricStats('hr', [], prefs)).toBeNull();
  });
});
