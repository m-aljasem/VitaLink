import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons, IonInput, IonItem, IonLabel,
  IonCheckbox, IonDatetime, IonIcon, IonText, IonModal, IonCard, IonCardContent, IonToggle, IonChip, ToastController, AlertController
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth.service';
import { ReminderService, Reminder } from '../../../core/reminder.service';
import { addIcons } from 'ionicons';
import { add, addCircle, trash, notifications, notificationsOutline, time, timeOutline, arrowBack } from 'ionicons/icons';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reminders',
  templateUrl: './reminders.page.html',
  styleUrls: ['./reminders.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons, IonInput, IonItem, IonLabel,
    IonCheckbox, IonDatetime, IonIcon, IonText, IonModal, IonCard, IonCardContent, IonToggle, IonChip, TranslateModule
  ],
})
export class RemindersPage implements OnInit {
  reminders: Reminder[] = [];
  showAddModal = false;
  newReminder: Partial<Reminder> = {
    title: '',
    local_time: undefined,
    days: [],
    enabled: true,
  };

  daysOfWeek = [
    { value: 'Mon', label: 'SETTINGS.MON' },
    { value: 'Tue', label: 'SETTINGS.TUE' },
    { value: 'Wed', label: 'SETTINGS.WED' },
    { value: 'Thu', label: 'SETTINGS.THU' },
    { value: 'Fri', label: 'SETTINGS.FRI' },
    { value: 'Sat', label: 'SETTINGS.SAT' },
    { value: 'Sun', label: 'SETTINGS.SUN' },
  ];

  constructor(
    private authService: AuthService,
    private reminderService: ReminderService,
    private toastController: ToastController,
    private alertController: AlertController,
    private translate: TranslateService,
    private router: Router
  ) {
    addIcons({ add, addCircle, trash, notifications, notificationsOutline, time, timeOutline, arrowBack });
  }

  goBack() {
    this.router.navigate(['/tabs/settings']);
  }

  async ngOnInit() {
    await this.reminderService.requestPermission();
    await this.loadReminders();
  }

  async loadReminders() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const { data } = await this.reminderService.getReminders(user.id);
    this.reminders = data || [];
  }

  toggleDay(day: string) {
    const days = this.newReminder.days || [];
    const index = days.indexOf(day);
    if (index > -1) {
      days.splice(index, 1);
    } else {
      days.push(day);
    }
    this.newReminder.days = days;
  }

  async saveReminder() {
    if (!this.newReminder.title || !this.newReminder.local_time || !this.newReminder.days?.length) {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.FILL_ALL_FIELDS'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) return;

    const { error } = await this.reminderService.createReminder({
      ...this.newReminder,
      user_id: user.id,
    } as Reminder);

    if (error) {
      const toast = await this.toastController.create({
        message: this.translate.instant('SETTINGS.CREATE_REMINDER_ERROR'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } else {
      this.showAddModal = false;
      this.newReminder = { title: '', local_time: undefined, days: [], enabled: true };
      await this.loadReminders();
    }
  }

  async deleteReminder(reminder: Reminder) {
    const alert = await this.alertController.create({
      header: this.translate.instant('SETTINGS.DELETE_REMINDER_TITLE'),
      message: this.translate.instant('SETTINGS.DELETE_REMINDER_MESSAGE'),
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('SETTINGS.DELETE'),
          role: 'destructive',
          handler: async () => {
            await this.reminderService.deleteReminder(reminder.id!);
            await this.loadReminders();
          },
        },
      ],
    });

    await alert.present();
  }

  async toggleReminder(reminder: Reminder) {
    await this.reminderService.updateReminder(reminder.id!, {
      enabled: !reminder.enabled,
    });
    await this.loadReminders();
  }
}

