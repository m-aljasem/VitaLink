import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ReminderBannerComponent } from './shared/components/reminder-banner/reminder-banner.component';
import { OfflineStorageService } from './core/offline-storage.service';
import { SyncService } from './core/sync.service';
import { OfflineIndicatorComponent } from './shared/components/offline-indicator/offline-indicator.component';
import { InstallPromptComponent } from './shared/components/install-prompt/install-prompt.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, ReminderBannerComponent, OfflineIndicatorComponent, InstallPromptComponent],
})
export class AppComponent implements OnInit {
  constructor(
    private translate: TranslateService,
    private offlineStorage: OfflineStorageService,
    private syncService: SyncService
  ) {}

  async ngOnInit() {
    // Ensure default language is set and translations are loaded
    this.translate.setDefaultLang('en');
    await firstValueFrom(this.translate.use('en'));

    // Initialize offline storage (SyncService will wait for this)
    try {
      await this.offlineStorage.init();
      console.log('Offline storage initialized');
    } catch (error) {
      console.error('Failed to initialize offline storage:', error);
    }
  }
}
