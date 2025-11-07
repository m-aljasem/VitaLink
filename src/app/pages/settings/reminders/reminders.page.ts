import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons, IonInput, IonItem, IonLabel,
  IonList, IonCheckbox, IonDatetime, IonIcon, IonText, IonModal, ToastController, AlertController
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth.service';
import { ReminderService, Reminder } from '../../../core/reminder.service';
import { addIcons } from 'ionicons';
import { add, trash } from 'ionicons/icons';

@Component({
  selector: 'app-reminders',
  templateUrl: './reminders.page.html',
  styleUrls: ['./reminders.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons, IonInput, IonItem, IonLabel,
    IonList, IonCheckbox, IonDatetime, IonIcon, IonText, IonModal, TranslateModule
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
    private alertController: AlertController
  ) {
    addIcons({ add, trash });
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
        message: 'Please fill all fields',
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
        message: 'Failed to create reminder',
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
      header: 'Delete Reminder',
      message: 'Are you sure you want to delete this reminder?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
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

