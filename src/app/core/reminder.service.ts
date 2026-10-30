import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { getSupabaseClient } from './supabase.client';
import { LocalNotifications, Weekday } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * Stable positive 32-bit notification ID for a key and slot (0–9), so the same
 * notification can be found and cancelled later.
 */
export function notificationId(key: string, slot: number): number {
  let hash = 0;
  for (const char of key) {
    hash = (hash * 31 + char.charCodeAt(0)) % 200_000_000;
  }
  return hash * 10 + slot;
}

export const WEEKDAYS: { [key: string]: Weekday } = {
  Sun: Weekday.Sunday,
  Mon: Weekday.Monday,
  Tue: Weekday.Tuesday,
  Wed: Weekday.Wednesday,
  Thu: Weekday.Thursday,
  Fri: Weekday.Friday,
  Sat: Weekday.Saturday,
};

export interface Reminder {
  id?: string;
  user_id: string;
  title: string;
  schedule_cron?: string;
  local_time?: string;
  days?: string[];
  enabled: boolean;
  created_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ReminderService {
  private supabase = getSupabaseClient();

  constructor(private translate: TranslateService) {}

  async requestPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      const { display } = await LocalNotifications.requestPermissions();
      return display === 'granted';
    }
    return false;
  }

  async createReminder(reminder: Partial<Reminder>): Promise<{ data?: Reminder; error?: any }> {
    const { data, error } = await this.supabase
      .from('reminders')
      .insert(reminder)
      .select()
      .single();

    if (!error && data && Capacitor.isNativePlatform()) {
      await this.scheduleNotification(data as Reminder);
    }

    return { data: data as Reminder, error };
  }

  async getReminders(userId: string): Promise<{ data?: Reminder[]; error?: any }> {
    const { data, error } = await this.supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return { data: data as Reminder[], error };
  }

  async updateReminder(reminderId: string, updates: Partial<Reminder>): Promise<{ data?: Reminder; error?: any }> {
    const { data, error } = await this.supabase
      .from('reminders')
      .update(updates)
      .eq('id', reminderId)
      .select()
      .single();

    if (!error && data && Capacitor.isNativePlatform()) {
      await this.cancelNotifications(reminderId);
      await this.scheduleNotification(data as Reminder);
    }

    return { data: data as Reminder, error };
  }

  async deleteReminder(reminderId: string): Promise<{ error?: any }> {
    const { error } = await this.supabase
      .from('reminders')
      .delete()
      .eq('id', reminderId);

    if (!error) {
      await this.cancelNotifications(reminderId);
    }

    return { error };
  }

  /** Replaces all scheduled notifications on this device with the user's enabled reminders. */
  async syncNotifications(userId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const { data: reminders, error } = await this.getReminders(userId);
    if (error || !reminders) return;

    await this.cancelNotificationsOfKind('reminder');
    for (const reminder of reminders) {
      await this.scheduleNotification(reminder);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: notifications.map(n => ({ id: n.id })) });
    }
  }

  /**
   * Cancels pending notifications created for one feature ('reminder' or 'medication').
   * Notifications without a kind predate tagging and count as reminders.
   */
  async cancelNotificationsOfKind(kind: 'reminder' | 'medication'): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const { notifications } = await LocalNotifications.getPending();
    const matching = notifications.filter(n => (n.extra?.kind ?? 'reminder') === kind);
    if (matching.length > 0) {
      await LocalNotifications.cancel({ notifications: matching.map(n => ({ id: n.id })) });
    }
  }

  private async cancelNotifications(reminderId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const notifications = Object.values(WEEKDAYS).map(weekday => ({
      id: this.notificationId(reminderId, weekday),
    }));
    await LocalNotifications.cancel({ notifications });
  }

  /** Stable per reminder and weekday, so the notification can be cancelled later. */
  private notificationId(reminderId: string, weekday: Weekday): number {
    return notificationId(reminderId, weekday);
  }

  private async scheduleNotification(reminder: Reminder): Promise<void> {
    if (!reminder.enabled || !reminder.local_time) {
      return;
    }

    if (!reminder.id || !Capacitor.isNativePlatform()) {
      // Web reminders are shown as in-app banners via checkWebReminders().
      return;
    }

    const [hours, minutes] = reminder.local_time.split(':').map(Number);
    const body = this.translate.instant('SETTINGS.REMINDER_NOTIFICATION_BODY');

    const notifications = (reminder.days || [])
      .filter(day => day in WEEKDAYS)
      .map(day => ({
        title: reminder.title,
        body,
        id: this.notificationId(reminder.id!, WEEKDAYS[day]),
        extra: { kind: 'reminder' },
        schedule: {
          on: {
            weekday: WEEKDAYS[day],
            hour: hours,
            minute: minutes,
          },
          repeats: true,
        },
      }));

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  }

  // Web fallback: check if any reminders should be shown now
  async checkWebReminders(userId: string): Promise<Reminder[]> {
    if (Capacitor.isNativePlatform()) {
      return [];
    }

    const { data: reminders } = await this.getReminders(userId);
    if (!reminders) return [];

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];

    return reminders.filter(reminder => {
      if (!reminder.enabled || !reminder.local_time || !reminder.days) return false;
      
      const [reminderHour, reminderMinute] = reminder.local_time.split(':').map(Number);
      const [currentHour, currentMinute] = currentTime.split(':').map(Number);
      
      const reminderTime = reminderHour * 60 + reminderMinute;
      const nowTime = currentHour * 60 + currentMinute;
      
      // Show reminder if time matches (within 1 minute) and day matches
      return Math.abs(reminderTime - nowTime) <= 1 && reminder.days.includes(currentDay);
    });
  }
}

