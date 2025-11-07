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
    await firstValueFrom(this.translate.use('en'));
  }
}
