import { Injectable } from '@angular/core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase.client';
import { BP_RANGES, CANONICAL_RANGES } from './units';

export type PhotoMetric = 'bp' | 'glucose';
export type DeviceReading =
  | { metric: 'bp'; systolic: number; diastolic: number; pulse: number | null }
  | { metric: 'glucose'; value: number; unit: 'mg/dL' | 'mmol/L' };

export interface PhotoProvider {

  label: string;
  consentToken: string;
  maxImageBytes: number;
}

export function parsePhotoProvider(value: unknown): PhotoProvider {
  if (!value || typeof value !== 'object') throw new PhotoReadingError('unavailable');
  const p = value as Record<string, unknown>;
  if (typeof p['label'] !== 'string' || !p['label'].trim() || p['label'].length > 160 ||
      Array.from(p['label']).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
      typeof p['consentToken'] !== 'string' || !/^[a-f0-9]{64}$/.test(p['consentToken']) ||
      typeof p['maxImageBytes'] !== 'number' || !Number.isSafeInteger(p['maxImageBytes']) ||
      p['maxImageBytes'] < 1024 || p['maxImageBytes'] > 2_850_000) {
    throw new PhotoReadingError('unavailable');
  }
  return { label: p['label'],
    consentToken: p['consentToken'], maxImageBytes: p['maxImageBytes'] };
}

export class PhotoReadingError extends Error {
  constructor(public readonly code: string) { super(code); }
}

/** Treat model responses as untrusted even after server-side validation. */
export function parseDeviceReading(value: unknown, metric: PhotoMetric): DeviceReading {
  if (!value || typeof value !== 'object') throw new PhotoReadingError('unreadable');
  const r = value as Record<string, unknown>;
  const inRange = (n: unknown, min: number, max: number): n is number =>
    typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (r['metric'] === metric && metric === 'bp') {
    const s = r['systolic'], d = r['diastolic'], p = r['pulse'];
    if (inRange(s, BP_RANGES.systolic.min, BP_RANGES.systolic.max) && Number.isInteger(s) &&
        inRange(d, BP_RANGES.diastolic.min, BP_RANGES.diastolic.max) && Number.isInteger(d) && s > d &&
        (p === null || (inRange(p, 30, 220) && Number.isInteger(p)))) {
      return { metric, systolic: s, diastolic: d, pulse: p as number | null };
    }
  }
  if (r['metric'] === metric && metric === 'glucose' &&
      (r['unit'] === 'mg/dL' || r['unit'] === 'mmol/L') && inRange(r['value'], 0.1, 600)) {
    const unit = r['unit'];
    const canonical = unit === 'mmol/L' ? r['value'] * 18.016 : r['value'];
    if (canonical >= CANONICAL_RANGES.glucose.min && canonical <= CANONICAL_RANGES.glucose.max) {
      return { metric, value: r['value'], unit };
    }
  }
  throw new PhotoReadingError('unreadable');
}

@Injectable({ providedIn: 'root' })
export class DevicePhotoService {
  async getProvider(): Promise<PhotoProvider> {
    const data = await this.invoke({ method: 'GET' });
    return parsePhotoProvider(data?.provider);
  }

  async extract(image: string, metric: PhotoMetric, provider: PhotoProvider): Promise<DeviceReading> {
    const data = await this.invoke({ body: { image, metric, consentToken: provider.consentToken } });
    return parseDeviceReading(data?.reading, metric);
  }

  private async invoke(options: { method?: 'GET'; body?: object }) {
    if (!navigator.onLine) throw new PhotoReadingError('offline');
    const { data, error } = await getSupabaseClient().functions.invoke('extract-device-reading', options);
    if (error) {
      let code = 'unavailable';
      if (error instanceof FunctionsHttpError) {
        try {
          const body = await error.context.json();
          if (['unreadable', 'invalid_image', 'unauthorized', 'rate_limited', 'configuration_changed'].includes(body?.error)) code = body.error;
        } catch { /* A gateway error may not have a JSON body. */ }
      }
      throw new PhotoReadingError(code);
    }
    return data;
  }

  /** Re-encode locally to bound upload size and strip EXIF/location metadata. */
  async prepare(file: File, maxImageBytes = 2_850_000): Promise<string> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new PhotoReadingError('invalid_image');
    }
    if (file.size > 20 * 1024 * 1024 || file.size === 0) throw new PhotoReadingError('invalid_image');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 60_000_000) {
        throw new PhotoReadingError('invalid_image');
      }
      const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const context = canvas.getContext('2d');
      if (!context) throw new PhotoReadingError('invalid_image');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.8, 0.7]) {
        const encoded = canvas.toDataURL('image/jpeg', quality);
        const base64 = encoded.slice('data:image/jpeg;base64,'.length);
        const bytes = base64.length / 4 * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
        if (encoded.startsWith('data:image/jpeg;base64,') && encoded.length <= 3_800_000 && bytes <= maxImageBytes) {
          return encoded;
        }
      }
      // Do not sacrifice digit/decimal legibility just to satisfy a provider's small payload limit.
      throw new PhotoReadingError('invalid_image');
    } catch {
      throw new PhotoReadingError('invalid_image');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
