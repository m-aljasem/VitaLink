import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel,
  IonSelect, IonSelectOption, ToastController, AlertController
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
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
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel,
    IonSelect, IonSelectOption, TranslateModule
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
    private alertController: AlertController
  ) {}

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
          message: 'Failed to update language',
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
        message: 'Export failed',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } else {
      const toast = await this.toastController.create({
        message: 'Export successful',
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
        message: 'Export failed',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } else {
      const toast = await this.toastController.create({
        message: 'Export successful',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    }
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Logout',
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

