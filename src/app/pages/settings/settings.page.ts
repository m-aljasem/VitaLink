import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonSelect, IonSelectOption, ToastController, AlertController, IonCard, IonCardContent,
  IonIcon, IonButton
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import {
  person, notifications, language, swapHorizontal, download, documentText, code,
  informationCircle, logOutOutline, chevronForward, medical
} from 'ionicons/icons';
import { AuthService, Profile } from '../../core/auth.service';
import { ProfileService } from '../../core/profile.service';
import { I18nService } from '../../core/i18n.service';
import { ExportService } from '../../core/export.service';
import { ReminderService } from '../../core/reminder.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    IonContent, IonSelect, IonSelectOption, IonCard, IonCardContent, IonIcon, IonButton, TranslateModule
  ],
})
export class SettingsPage implements OnInit {
  profile: Profile | null = null;
  currentLanguage = 'en';

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private i18nService: I18nService,
    private exportService: ExportService,
    private reminderService: ReminderService,
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController,
    private translate: TranslateService
  ) {
    addIcons({
      person, notifications, language, swapHorizontal, download, documentText, code,
      informationCircle, 'log-out': logOutOutline, chevronForward, medical
    });
  }

  async ngOnInit() {
    this.profile = await this.authService.getCurrentProfile();
    this.currentLanguage = this.i18nService.getCurrentLanguage();
  }

  async changeLanguage(lang: string) {
    this.i18nService.setLanguage(lang as any);
    this.currentLanguage = lang;
    
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

  async exportCSV() {
    const { error } = await this.exportService.exportToCSV();
    if (error) {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.EXPORT_ERROR'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } else {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.EXPORT_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    }
  }

  async exportJSON() {
    const { error } = await this.exportService.exportToJSON();
    if (error) {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.EXPORT_ERROR'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } else {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.EXPORT_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    }
  }

  async exportFHIR() {
    const { error } = await this.exportService.exportToFHIR();
    if (error) {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.EXPORT_ERROR'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } else {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.EXPORT_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
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
}

