import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent, IonIcon, IonButton } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { 
  informationCircle, codeWorkingOutline, documentTextOutline, star, shieldCheckmarkOutline,
  pulse, shareSocialOutline, barChartOutline, notifications, downloadOutline, arrowBack
} from 'ionicons/icons';
import { Router } from '@angular/router';

@Component({
  selector: 'app-about',
  templateUrl: './about.page.html',
  styleUrls: ['./about.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent, IonIcon, IonButton, TranslateModule],
})
export class AboutPage {
  version = '1.0.0';
  
  features = [
    { icon: 'pulse', text: 'ABOUT.FEATURE_TRACK' },
    { icon: 'share-social-outline', text: 'ABOUT.FEATURE_SHARE' },
    { icon: 'bar-chart-outline', text: 'ABOUT.FEATURE_CHARTS' },
    { icon: 'notifications', text: 'ABOUT.FEATURE_REMINDERS' },
    { icon: 'download-outline', text: 'ABOUT.FEATURE_EXPORT' }
  ];

  constructor(private router: Router) {
    addIcons({ 
      informationCircle, 'code-working': codeWorkingOutline, 'document-text': documentTextOutline, star, 'shield-checkmark': shieldCheckmarkOutline,
      pulse, 'share-social-outline': shareSocialOutline, 'bar-chart-outline': barChartOutline, notifications, 'download-outline': downloadOutline,
      arrowBack
    });
  }

  goBack() {
    this.router.navigate(['/tabs/settings']);
  }
}

