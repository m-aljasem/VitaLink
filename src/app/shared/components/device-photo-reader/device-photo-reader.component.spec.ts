import { DevicePhotoReaderComponent } from './device-photo-reader.component';
import { DevicePhotoService, DeviceReading, PhotoReadingError } from '../../../core/device-photo.service';

describe('DevicePhotoReaderComponent', () => {
  let component: DevicePhotoReaderComponent;
  let photos: jasmine.SpyObj<DevicePhotoService>;
  const reading: DeviceReading = { metric: 'bp', systolic: 120, diastolic: 80, pulse: 72 };

  beforeEach(() => {
    photos = jasmine.createSpyObj('DevicePhotoService', ['prepare', 'extract', 'getProvider']);
    photos.getProvider.and.resolveTo({ label: 'vision.example.com', consentToken: 'a'.repeat(64), maxImageBytes: 2_850_000 });
    photos.prepare.and.resolveTo('data:image/jpeg;base64,test');
    photos.extract.and.resolveTo(reading);
    component = new DevicePhotoReaderComponent(photos);
    component.metric = 'bp';
    component.image = 'data:image/jpeg;base64,test';
    component.provider = { label: 'vision.example.com', consentToken: 'a'.repeat(64), maxImageBytes: 2_850_000 };
  });

  it('does not transmit photos without explicit consent', async () => {
    await component.analyze();
    expect(photos.extract).not.toHaveBeenCalled();
    component.consent = true;
    await component.analyze();
    expect(photos.extract).toHaveBeenCalledOnceWith(component.image!, 'bp', component.provider!);
  });

  it('emits a reading once without saving it', async () => {
    const emit = spyOn(component.reading, 'emit');
    const busy = spyOn(component.busyChange, 'emit');
    component.consent = true;
    await component.analyze();
    await component.analyze();
    expect(emit).toHaveBeenCalledOnceWith(reading);
    expect(photos.extract).toHaveBeenCalledTimes(1);
    expect(busy.calls.allArgs()).toEqual([[true], [false]]);
  });

  it('resets consent and invalidates parent review for another photo', async () => {
    const changed = spyOn(component.photoChange, 'emit');
    component.consent = true;
    component.analyzed = true;
    const target = { files: [new File(['test'], 'test.jpg', { type: 'image/jpeg' })], value: 'test' };
    await component.select({ target } as unknown as Event);
    expect(target.value).toBe('');
    expect(component.consent).toBeFalse();
    expect(component.analyzed).toBeFalse();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(photos.extract).not.toHaveBeenCalled();
  });

  it('ignores extraction results after leaving the page', async () => {
    let resolve!: (value: DeviceReading) => void;
    photos.extract.and.returnValue(new Promise(r => resolve = r));
    const emit = spyOn(component.reading, 'emit');
    component.consent = true;
    const pending = component.analyze();
    component.ngOnDestroy();
    resolve(reading);
    await pending;
    expect(emit).not.toHaveBeenCalled();
    expect(component.image).toBeNull();
  });

  it('does not transmit photos without a known provider', async () => {
    component.provider = null;
    component.consent = true;
    await component.analyze();
    expect(photos.extract).not.toHaveBeenCalled();
  });

  it('clears stale provider consent without retrying a photo when configuration changes', async () => {
    photos.extract.and.rejectWith(new PhotoReadingError('configuration_changed'));
    component.consent = true;
    await component.analyze();
    expect(component.provider).toBeNull();
    expect(component.image).toBeNull();
    expect(component.consent).toBeFalse();
    expect(component.errorKey).toBe('PHOTO_READING.ERROR_CONFIGURATION_CHANGED');
    await component.analyze();
    expect(photos.extract).toHaveBeenCalledTimes(1);
  });

  it('does not prepare or send a photo if provider discovery fails', async () => {
    photos.getProvider.and.rejectWith(new PhotoReadingError('unavailable'));
    const target = { files: [new File(['test'], 'test.jpg', { type: 'image/jpeg' })], value: '' };
    await component.select({ target } as unknown as Event);
    expect(component.provider).toBeNull();
    expect(component.image).toBeNull();
    expect(photos.prepare).not.toHaveBeenCalled();
    expect(photos.extract).not.toHaveBeenCalled();
  });

  it('shows actionable errors without emitting readings', async () => {
    photos.extract.and.rejectWith(new PhotoReadingError('unreadable'));
    const emit = spyOn(component.reading, 'emit');
    component.consent = true;
    await component.analyze();
    expect(component.errorKey).toBe('PHOTO_READING.ERROR_UNREADABLE');
    expect(component.busy).toBeFalse();
    expect(emit).not.toHaveBeenCalled();
  });
});
