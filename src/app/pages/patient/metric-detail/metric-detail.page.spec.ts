import { MetricDetailPage } from './metric-detail.page';
import { DEFAULT_UNITS, fromDisplay, toDisplay } from '../../../core/units';

describe('MetricDetailPage photo import', () => {
  let page: MetricDetailPage;
  let observations: any;
  let toast: any;
  let units: typeof DEFAULT_UNITS;

  beforeEach(() => {
    observations = {
      createObservation: jasmine.createSpy('createObservation').and.resolveTo({}),
      getObservationsByMetric: jasmine.createSpy('getObservationsByMetric').and.resolveTo({ data: [] }),
    };
    toast = { create: jasmine.createSpy('create').and.resolveTo({ present: async () => {} }) };
    units = { ...DEFAULT_UNITS };
    const format = {
      units,
      toDisplay: (metric: any, value: number) => toDisplay(metric, value, units),
      fromDisplay: (metric: any, value: number) => fromDisplay(metric, value, units),
      inputRange: () => ({ min: 1.1, max: 33.3, step: 0.1 }),
    };
    page = new MetricDetailPage(
      {} as any, {} as any, { getCurrentUser: () => ({ id: 'user-1' }) } as any,
      observations, toast, {} as any, {} as any, {} as any,
      { instant: (key: string) => key } as any, {} as any, format as any,
    );
  });

  it('fills BP and pulse without saving or confirming the reading', () => {
    page.metric = 'bp';
    page.applyPhotoReading({ metric: 'bp', systolic: 120, diastolic: 80, pulse: 70 });
    expect([page.systolic, page.diastolic, page.pulse]).toEqual([120, 80, 70]);
    expect(page.photoReviewRequired).toBeTrue();
    expect(page.photoReviewed).toBeFalse();
    expect(observations.createObservation).not.toHaveBeenCalled();
  });

  it('cannot save an unreviewed import or save while a photo is processing', async () => {
    page.metric = 'bp';
    page.applyPhotoReading({ metric: 'bp', systolic: 120, diastolic: 80, pulse: null });
    await page.save();
    expect(toast.create).toHaveBeenCalledWith(jasmine.objectContaining({ message: 'PHOTO_READING.REVIEW_REQUIRED' }));
    page.photoReviewed = true;
    page.photoBusy = true;
    await page.save();
    expect(observations.createObservation).not.toHaveBeenCalled();
  });

  it('preserves an original glucose value across display rounding until edited', async () => {
    page.metric = 'glucose';
    units.glucose_unit = 'mmol/L';
    page.applyPhotoReading({ metric: 'glucose', value: 105, unit: 'mg/dL' });
    expect(page.numericValue).toBe(5.8);
    page.photoReviewed = true;
    await page.save();
    expect(observations.createObservation).toHaveBeenCalledWith(jasmine.objectContaining({ numeric_value: 105, unit: 'mg/dL' }));
    expect(page.photoReviewRequired).toBeFalse();
    expect(page.pulse).toBeNull();
  });

  it('uses corrected glucose values and requires review again after editing', async () => {
    page.metric = 'glucose';
    units.glucose_unit = 'mmol/L';
    page.applyPhotoReading({ metric: 'glucose', value: 105, unit: 'mg/dL' });
    page.photoReviewed = true;
    page.numericValue = 5.9;
    page.photoValueChanged();
    expect(page.photoReviewed).toBeFalse();
    page.photoReviewed = true;
    await page.save();
    expect(observations.createObservation).toHaveBeenCalledWith(jasmine.objectContaining({ numeric_value: 106 }));
  });

  it('ignores mismatched readings and imports while editing', () => {
    page.metric = 'bp';
    page.applyPhotoReading({ metric: 'glucose', value: 105, unit: 'mg/dL' });
    expect(page.numericValue).toBeNull();
    page.editingRecord = { id: 'existing', user_id: 'user-1', metric: 'bp', ts: new Date().toISOString() };
    page.applyPhotoReading({ metric: 'bp', systolic: 120, diastolic: 80, pulse: 70 });
    expect(page.systolic).toBeNull();
  });

  it('clears confirmation and hides the photo component on Ionic page leave', () => {
    page.photoReviewed = true;
    page.photoBusy = true;
    page.ionViewWillLeave();
    expect(page.photoReaderActive).toBeFalse();
    expect(page.photoReviewed).toBeFalse();
    expect(page.photoBusy).toBeFalse();
    page.ionViewWillEnter();
    expect(page.photoReaderActive).toBeTrue();
  });
});
