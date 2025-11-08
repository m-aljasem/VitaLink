import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ReminderBannerComponent } from './shared/components/reminder-banner/reminder-banner.component';
import { OfflineStorageService } from './core/offline-storage.service';
import { SyncService } from './core/sync.service';
import { OfflineIndicatorComponent } from './shared/components/offline-indicator/offline-indicator.component';
import { InstallPromptComponent } from './shared/components/install-prompt/install-prompt.component';
import { I18nService } from './core/i18n.service';
import { AuthService } from './core/auth.service';
import { DateFormatService } from './core/date-format.service';
import { PwaInstallService } from './core/pwa-install.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, ReminderBannerComponent, OfflineIndicatorComponent, InstallPromptComponent],
})
export class AppComponent implements OnInit {
  constructor(
    private translate: TranslateService,
    private offlineStorage: OfflineStorageService,
    private syncService: SyncService,
    private i18nService: I18nService,
    private authService: AuthService,
    private dateFormatService: DateFormatService,
    private pwaInstallService: PwaInstallService // Initialize early to capture beforeinstallprompt event
  ) {}

  async ngOnInit() {
    // Ensure default language is set and translations are loaded
    this.translate.setDefaultLang('en');
    await firstValueFrom(this.translate.use('en'));

    // Wait for auth initialization to complete
    await this.authService.waitForInitialization();
    
    // Get profile language if user is authenticated
    let profileLanguage: string | undefined;
    try {
      const profile = await this.authService.getCurrentProfile();
      profileLanguage = profile?.language;
    } catch (error) {
      // Ignore errors, will fall back to localStorage or default
    }

    // Initialize language from saved preference (localStorage or profile)
    await this.i18nService.initializeLanguage(profileLanguage);
    
    // Initialize date format service to cache locale based on user's country
    await this.dateFormatService.getLocale();

    // Initialize offline storage (SyncService will wait for this)
    try {
      await this.offlineStorage.init();
      console.log('Offline storage initialized');
    } catch (error) {
      console.error('Failed to initialize offline storage:', error);
    }
  }
}
