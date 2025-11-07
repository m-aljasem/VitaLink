import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { 
  IonContent, IonButton, IonInput, IonItem, IonLabel,
  IonSpinner, IonIcon, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { language } from 'ionicons/icons';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { I18nService, SupportedLanguage } from '../../core/i18n.service';

interface LanguageOption {
  code: SupportedLanguage;
  name: string;
}

@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonButton, IonInput, IonItem, IonLabel,
    IonSpinner, IonIcon, TranslateModule
  ],
})
export class AuthPage implements OnInit {
  email = '';
  loading = false;
  currentLanguage = 'en' as SupportedLanguage;
  
  languages: LanguageOption[] = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'ar', name: 'العربية' },
    { code: 'fa', name: 'فارسی' },
    { code: 'ur', name: 'اردو' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController,
    private i18nService: I18nService
  ) {
    addIcons({ language });
  }

  ngOnInit() {
    this.currentLanguage = this.i18nService.getCurrentLanguage();
  }

  changeLanguage(lang: SupportedLanguage) {
    this.i18nService.setLanguage(lang);
    this.currentLanguage = lang;
  }

  async requestCode() {
    // Improved email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.email || !emailRegex.test(this.email.trim())) {
      const toast = await this.toastController.create({
        message: 'Please enter a valid email address',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
      return;
    }

    this.loading = true;
    const { error } = await this.authService.requestOTP(this.email);
    this.loading = false;

    if (error) {
      const toast = await this.toastController.create({
        message: error.message || 'Failed to send code',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } else {
      this.router.navigate(['/auth/verify'], { state: { email: this.email } });
    }
  }
}

