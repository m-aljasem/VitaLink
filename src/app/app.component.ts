import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ReminderBannerComponent } from './shared/components/reminder-banner/reminder-banner.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, ReminderBannerComponent],
})
export class AppComponent implements OnInit {
  constructor(private translate: TranslateService) {}

  async ngOnInit() {
    // Ensure default language is set and translations are loaded
    this.translate.setDefaultLang('en');
    
    // Check if loader is being used
    console.log('TranslateService default lang:', this.translate.defaultLang);
    console.log('TranslateService current lang:', this.translate.currentLang);
    
    // Try to get translations directly
    this.translate.get('APP_NAME').subscribe({
      next: (value) => {
        console.log('Direct translation test - APP_NAME:', value);
      },
      error: (err) => {
        console.error('Direct translation error:', err);
      }
    });
    
    try {
      const translations = await firstValueFrom(this.translate.use('en'));
      console.log('Translations loaded successfully:', Object.keys(translations).length, 'keys');
      console.log('Translation keys:', Object.keys(translations));
      console.log('Full translations object:', translations);
      
      // Try to get a translation after loading
      const appName = this.translate.instant('APP_NAME');
      console.log('Instant translation APP_NAME:', appName);
    } catch (err) {
      console.error('Failed to load translations:', err);
    }
  }
}
