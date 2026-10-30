import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from './auth.service';
import { MetricType, Observation } from './observation.service';
import { Classification, ReadingValues, classifyReading, severityAdviceKey, severityLabelKey } from './clinical';
import { DEFAULT_UNITS, UnitPreferences, displayRange, fromDisplay, toDisplay } from './units';

/** Formats readings for display in the signed-in user's units, with clinical classification. */
@Injectable({
  providedIn: 'root',
})
export class MetricFormatService {
  private prefs: UnitPreferences = DEFAULT_UNITS;

  constructor(
    private authService: AuthService,
    private translate: TranslateService
  ) {
    this.authService.getProfileObservable().subscribe(profile => {
      this.prefs = {
        glucose_unit: profile?.glucose_unit || DEFAULT_UNITS.glucose_unit,
        weight_unit: profile?.weight_unit || DEFAULT_UNITS.weight_unit,
      };
    });
  }

  get units(): UnitPreferences {
    return this.prefs;
  }

  /** Display number without unit, e.g. "120/80" or "7.0". */
  formatNumber(obs: Pick<Observation, 'metric' | 'systolic' | 'diastolic' | 'numeric_value'>): string {
    if (obs.metric === 'bp') {
      return `${obs.systolic ?? '–'}/${obs.diastolic ?? '–'}`;
    }
    if (obs.numeric_value == null) return '–';
    const value = this.toDisplay(obs.metric, Number(obs.numeric_value));
    const decimals = this.decimals(obs.metric);
    return decimals > 0 ? value.toFixed(decimals) : String(value);
  }

  /** Display value with unit, e.g. "120/80 mmHg". */
  formatValue(obs: Pick<Observation, 'metric' | 'systolic' | 'diastolic' | 'numeric_value'>): string {
    const unit = this.unitLabel(obs.metric);
    return unit ? `${this.formatNumber(obs)} ${unit}` : this.formatNumber(obs);
  }

  /** Translated label of the display unit for a metric. */
  unitLabel(metric: MetricType): string {
    const keys: Record<MetricType, string> = {
      bp: 'METRICS.MMHG',
      glucose: this.prefs.glucose_unit === 'mmol/L' ? 'METRICS.MMOLL' : 'METRICS.MGDL',
      spo2: 'METRICS.PERCENT',
      hr: 'METRICS.BPM',
      pain: 'METRICS.SCALE_1_10',
      weight: this.prefs.weight_unit === 'lb' ? 'METRICS.LB' : 'METRICS.KG',
    };
    return this.translate.instant(keys[metric]);
  }

  toDisplay(metric: MetricType, canonical: number): number {
    return toDisplay(metric, canonical, this.prefs);
  }

  fromDisplay(metric: MetricType, displayed: number): number {
    return fromDisplay(metric, displayed, this.prefs);
  }

  inputRange(metric: Exclude<MetricType, 'bp'>): { min: number; max: number; step: number } {
    return displayRange(metric, this.prefs);
  }

  classify(obs: ReadingValues | null | undefined): Classification | null {
    return obs ? classifyReading(obs) : null;
  }

  severityLabel(c: Classification | null): string {
    return c ? this.translate.instant(severityLabelKey(c)) : '';
  }

  severityAdvice(c: Classification | null): string {
    const key = c ? severityAdviceKey(c) : null;
    return key ? this.translate.instant(key) : '';
  }

  private decimals(metric: MetricType): number {
    if (metric === 'glucose' && this.prefs.glucose_unit === 'mmol/L') return 1;
    return 0;
  }
}
