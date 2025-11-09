import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonSelect, IonSelectOption, ToastController, AlertController, IonCard, IonCardContent,
  IonIcon, IonSpinner, IonButton
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import {
  person, notifications, language, swapHorizontal, download,
  informationCircle, logOutOutline, chevronForward, refreshOutline
} from 'ionicons/icons';
import { AuthService, Profile } from '../../core/auth.service';
import { ProfileService } from '../../core/profile.service';
import { I18nService, SupportedLanguage } from '../../core/i18n.service';
import { ReminderService } from '../../core/reminder.service';
import { PwaUpdateService } from '../../core/pwa-update.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    IonContent, IonSelect, IonSelectOption, IonCard, IonCardContent, IonIcon, 
    IonSpinner, IonButton, TranslateModule
  ],
})
export class SettingsPage implements OnInit {
  profile: Profile | null = null;
  currentLanguage = 'en';
  updateAvailable = false;
  checkingUpdate = false;
  updating = false;

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private i18nService: I18nService,
    private reminderService: ReminderService,
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController,
    private translate: TranslateService,
    private pwaUpdateService: PwaUpdateService
  ) {
    addIcons({
      person, notifications, language, swapHorizontal, download,
      informationCircle, 'log-out': logOutOutline, chevronForward, refreshOutline
    });
  }

  async ngOnInit() {
    this.profile = await this.authService.getCurrentProfile();
    this.currentLanguage = this.i18nService.getCurrentLanguage();
    
    // Check for PWA updates
    if (this.pwaUpdateService.isEnabled()) {
      this.updateAvailable = this.pwaUpdateService.hasUpdateAvailable();
    }
  }

  async changeLanguage(lang: string) {
    const supportedLang = this.isValidLanguage(lang) ? lang as SupportedLanguage : 'en';
    this.i18nService.setLanguage(supportedLang);
    this.currentLanguage = supportedLang;
    
    // Update profile
    if (this.profile) {
      const { error } = await this.profileService.updateProfile(this.profile.id, { language: lang });
      if (error) {
        const toast = await this.toastController.create({
          message: this.translate.instant('SETTINGS.UPDATE_LANGUAGE_ERROR'),
          duration: 2000,
          color: 'danger',
        });
        await toast.present();
      }
    }
  }


  async logout() {
    const alert = await this.alertController.create({
      header: this.translate.instant('SETTINGS.LOGOUT_TITLE'),
      message: this.translate.instant('SETTINGS.LOGOUT_MESSAGE'),
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('SETTINGS.LOGOUT'),
          role: 'destructive',
          handler: async () => {
            await this.authService.signOut();
            this.router.navigate(['/auth']);
          },
        },
      ],
    });

    await alert.present();
  }

  private isValidLanguage(lang: string): lang is SupportedLanguage {
    const validLanguages: SupportedLanguage[] = ['en', 'es', 'fr', 'de', 'ar', 'fa', 'ur', 'zh', 'ja'];
    return validLanguages.includes(lang as SupportedLanguage);
  }

  async checkForUpdate() {
    if (!this.pwaUpdateService.isEnabled()) {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.PWA_UPDATE_NOT_AVAILABLE'),
        duration: 2000,
        color: 'medium',
      });
      await toast.present();
      return;
    }

    this.checkingUpdate = true;
    
    try {
      const updateFound = await this.pwaUpdateService.checkForUpdates();
      
      if (updateFound) {
        this.updateAvailable = true;
        const toast = await this.toastController.create({
          message: this.translate.instant('SETTINGS.PWA_UPDATE_AVAILABLE'),
          duration: 3000,
          color: 'success',
        });
        await toast.present();
      } else {
        const toast = await this.toastController.create({
          message: this.translate.instant('SETTINGS.PWA_UPDATE_NOT_FOUND'),
          duration: 2000,
          color: 'medium',
        });
        await toast.present();
      }
    } catch (error) {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.PWA_UPDATE_CHECK_ERROR'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.checkingUpdate = false;
    }
  }

  async applyUpdate() {
    if (!this.pwaUpdateService.isEnabled() || !this.updateAvailable) {
      return;
    }

    const alert = await this.alertController.create({
      header: this.translate.instant('SETTINGS.PWA_UPDATE_TITLE'),
      message: this.translate.instant('SETTINGS.PWA_UPDATE_MESSAGE'),
      buttons: [
        {
          text: this.translate.instant('COMMON.CANCEL'),
          role: 'cancel'
        },
        {
          text: this.translate.instant('SETTINGS.PWA_UPDATE_CONFIRM'),
          handler: async () => {
            this.updating = true;
            try {
              await this.pwaUpdateService.activateUpdate();
              // Page will reload automatically
            } catch (error) {
              this.updating = false;
              const toast = await this.toastController.create({
                message: this.translate.instant('SETTINGS.PWA_UPDATE_ERROR'),
                duration: 2000,
                color: 'danger',
              });
              await toast.present();
            }
          }
        }
      ]
    });

    await alert.present();
  }
}

