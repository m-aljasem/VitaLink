import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { cameraOutline, imageOutline } from 'ionicons/icons';
import { DevicePhotoService, DeviceReading, PhotoMetric, PhotoProvider, PhotoReadingError } from '../../../core/device-photo.service';

@Component({
  selector: 'app-device-photo-reader',
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonIcon, IonSpinner, TranslateModule],
  templateUrl: './device-photo-reader.component.html',
  styleUrls: ['./device-photo-reader.component.scss'],
})
export class DevicePhotoReaderComponent implements OnDestroy {
  @Input({ required: true }) metric!: PhotoMetric;
  @Input() disabled = false;
  @Output() reading = new EventEmitter<DeviceReading>();
  @Output() busyChange = new EventEmitter<boolean>();
  @Output() photoChange = new EventEmitter<void>();
  image: string | null = null;
  provider: PhotoProvider | null = null;
  consent = false;
  busy = false;
  analyzed = false;
  errorKey = '';
  private request = 0;

  constructor(private photos: DevicePhotoService) {
    addIcons({ cameraOutline, imageOutline });
  }

  async select(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.busy || this.disabled) return;
    const request = ++this.request;
    this.photoChange.emit();
    this.errorKey = '';
    this.image = null;
    this.analyzed = false;
    this.consent = false;
    this.provider = null;
    this.setBusy(true);
    try {
      const provider = await this.photos.getProvider();
      if (request !== this.request) return;
      const image = await this.photos.prepare(file, provider.maxImageBytes);
      if (request === this.request) {
        this.provider = provider;
        this.image = image;
      }
    } catch (error) {
      if (request === this.request) this.showError(error);
    } finally {
      if (request === this.request) this.setBusy(false);
    }
  }

  async analyze() {
    if (!this.image || !this.provider || !this.consent || this.busy || this.disabled || this.analyzed) return;
    const request = ++this.request;
    this.errorKey = '';
    this.setBusy(true);
    try {
      const reading = await this.photos.extract(this.image, this.metric, this.provider);
      if (request === this.request) {
        this.analyzed = true;
        this.reading.emit(reading);
      }
    } catch (error) {
      if (request === this.request) this.showError(error);
    } finally {
      if (request === this.request) this.setBusy(false);
    }
  }

  clear() {
    if (this.busy || this.disabled) return;
    this.photoChange.emit();
    this.image = null;
    this.provider = null;
    this.consent = false;
    this.analyzed = false;
    this.errorKey = '';
  }

  ngOnDestroy() {
    // Ignore responses after navigating away; never retain photos in offline storage.
    this.request++;
    this.image = null;
    this.provider = null;
    this.consent = false;
  }

  private setBusy(busy: boolean) {
    this.busy = busy;
    this.busyChange.emit(busy);
  }

  private showError(error: unknown) {
    const code = error instanceof PhotoReadingError ? error.code : 'unavailable';
    if (code === 'configuration_changed') {
      this.image = null;
      this.provider = null;
      this.consent = false;
      this.photoChange.emit();
    }
    this.errorKey = `PHOTO_READING.ERROR_${code.toUpperCase()}`;
  }
}
