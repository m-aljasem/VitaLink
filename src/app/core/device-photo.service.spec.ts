import { DevicePhotoService, parseDeviceReading, parsePhotoProvider, PhotoReadingError } from './device-photo.service';

describe('device photo validation', () => {
  it('validates provider disclosure before showing consent', () => {
    const provider = { label: 'vision.example.com', consentToken: 'a'.repeat(64), maxImageBytes: 2_850_000 };
    expect(parsePhotoProvider(provider)).toEqual(provider as any);
    for (const invalid of [null, {}, { ...provider, label: '' }, { ...provider, label: 123 },
      { ...provider, consentToken: 'not-a-token' }, { ...provider, maxImageBytes: 0 },
      { ...provider, maxImageBytes: 3_000_000 }]) {
      expect(() => parsePhotoProvider(invalid)).toThrowError(PhotoReadingError);
    }
  });

  it('accepts BP with or without pulse', () => {
    for (const pulse of [null, 72]) {
      const reading = { metric: 'bp', systolic: 120, diastolic: 80, pulse };
      expect(parseDeviceReading(reading, 'bp')).toEqual(reading as any);
    }
  });

  it('rejects wrong metrics, strings, missing fields and invalid BP values', () => {
    for (const reading of [null, {},
      { metric: 'glucose', value: 120, unit: 'mg/dL' },
      { metric: 'bp', systolic: '120', diastolic: 80, pulse: null },
      { metric: 'bp', systolic: 120, diastolic: 80 },
      { metric: 'bp', systolic: 80, diastolic: 120, pulse: null },
      { metric: 'bp', systolic: 120.5, diastolic: 80, pulse: null },
      { metric: 'bp', systolic: 120, diastolic: 80, pulse: 300 },
      { metric: 'bp', systolic: Infinity, diastolic: 80, pulse: null },
    ]) expect(() => parseDeviceReading(reading, 'bp')).toThrowError(PhotoReadingError);
  });

  it('requires explicit glucose units and validates unrounded canonical limits', () => {
    for (const [value, unit] of [[105, 'mg/dL'], [5.8, 'mmol/L']] as const) {
      expect(parseDeviceReading({ metric: 'glucose', value, unit }, 'glucose'))
        .toEqual({ metric: 'glucose', value, unit });
    }
    for (const reading of [
      { metric: 'glucose', value: 105 },
      { metric: 'glucose', value: 105, unit: 'unknown' },
      { metric: 'glucose', value: 'HI', unit: 'mg/dL' },
      { metric: 'glucose', value: 1.1, unit: 'mmol/L' },
      { metric: 'glucose', value: 33.31, unit: 'mmol/L' },
      { metric: 'glucose', value: 601, unit: 'mg/dL' },
      { metric: 'glucose', value: NaN, unit: 'mg/dL' },
    ]) expect(() => parseDeviceReading(reading, 'glucose')).toThrowError(PhotoReadingError);
  });

  it('rejects unsupported, empty and oversized files before decoding', async () => {
    const service = new DevicePhotoService();
    for (const file of [
      new File(['test'], 'test.heic', { type: 'image/heic' }),
      new File([], 'empty.jpg', { type: 'image/jpeg' }),
      new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' }),
    ]) await expectAsync(service.prepare(file)).toBeRejectedWithError(PhotoReadingError);
  });

  it('re-encodes photos as bounded JPEGs', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1800;
    canvas.height = 900;
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
    const result = await new DevicePhotoService().prepare(new File([blob], 'test.png', { type: 'image/png' }));
    expect(result.startsWith('data:image/jpeg;base64,')).toBeTrue();
    const image = new Image();
    image.src = result;
    await image.decode();
    expect(image.naturalWidth).toBe(1600);
    expect(image.naturalHeight).toBe(800);
  });
});
