import { MetricType, Observation } from './observation.service';
import { classifyReading } from './clinical';
import { UnitPreferences, toDisplay } from './units';

/** Summary of one metric's readings over a period, in the user's display units. */
export interface MetricStats {
  metric: MetricType;
  count: number;
  /** For BP these are systolic values; see `diastolic` for the rest. */
  average: number;
  min: number;
  max: number;
  diastolic?: { average: number; min: number; max: number };
  /** Share of classified readings in the normal range (null for unclassified metrics like weight). */
  inRangeShare: number | null;
  /** Readings that were abnormal or critical. */
  outOfRangeCount: number;
  /** BP only: averages of readings taken before noon and from 6 pm. */
  morning?: { systolic: number; diastolic: number; count: number };
  evening?: { systolic: number; diastolic: number; count: number };
  first: string;
  last: string;
}

export function computeMetricStats(metric: MetricType, observations: Observation[], prefs: UnitPreferences): MetricStats | null {
  const readings = observations.filter(o =>
    metric === 'bp' ? o.systolic != null && o.diastolic != null : o.numeric_value != null
  );
  if (readings.length === 0) return null;

  const primary = readings.map(o =>
    metric === 'bp' ? Number(o.systolic) : toDisplay(metric, Number(o.numeric_value), prefs)
  );
  const classifications = readings.map(o => classifyReading(o)).filter(c => c !== null);
  const sortedTs = readings.map(o => o.ts).sort();

  const stats: MetricStats = {
    metric,
    count: readings.length,
    ...summarize(primary),
    inRangeShare: classifications.length > 0
      ? classifications.filter(c => c!.severity === 'normal').length / classifications.length
      : null,
    outOfRangeCount: classifications.filter(c => c!.severity === 'abnormal' || c!.severity === 'critical').length,
    first: sortedTs[0],
    last: sortedTs[sortedTs.length - 1],
  };

  if (metric === 'bp') {
    stats.diastolic = summarize(readings.map(o => Number(o.diastolic)));
    stats.morning = bpAverage(readings.filter(o => new Date(o.ts).getHours() < 12));
    stats.evening = bpAverage(readings.filter(o => new Date(o.ts).getHours() >= 18));
  }
  return stats;
}

function summarize(values: number[]): { average: number; min: number; max: number } {
  return {
    average: round1(values.reduce((a, b) => a + b, 0) / values.length),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function bpAverage(readings: Observation[]): { systolic: number; diastolic: number; count: number } | undefined {
  if (readings.length === 0) return undefined;
  return {
    systolic: round1(readings.reduce((a, o) => a + Number(o.systolic), 0) / readings.length),
    diastolic: round1(readings.reduce((a, o) => a + Number(o.diastolic), 0) / readings.length),
    count: readings.length,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
