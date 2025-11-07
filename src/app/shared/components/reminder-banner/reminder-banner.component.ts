import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonCard, IonCardContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { close, notifications } from 'ionicons/icons';
import { ReminderService, Reminder } from '../../../core/reminder.service';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-reminder-banner',
  templateUrl: './reminder-banner.component.html',
  styleUrls: ['./reminder-banner.component.scss'],
  standalone: true,
  imports: [CommonModule, IonCard, IonCardContent, IonButton, IonIcon, TranslateModule],
})
export class ReminderBannerComponent implements OnInit, OnDestroy {
  activeReminders: Reminder[] = [];
  checkInterval: any;

  constructor(
    private reminderService: ReminderService,
    private authService: AuthService
  ) {
    addIcons({ close, notifications });
  }

  async ngOnInit() {
    await this.checkReminders();
    // Check every minute for web reminders
    this.checkInterval = setInterval(() => {
      this.checkReminders();
    }, 60000);
  }

  ngOnDestroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  async checkReminders() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const reminders = await this.reminderService.checkWebReminders(user.id);
    this.activeReminders = reminders;
  }

  dismissReminder(reminder: Reminder) {
    const index = this.activeReminders.indexOf(reminder);
    if (index > -1) {
      this.activeReminders.splice(index, 1);
    }
  }
}

