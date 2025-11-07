import { Injectable } from '@angular/core';
import { getSupabaseClient } from './supabase.client';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

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
      await this.scheduleNotification(data as Reminder);
    }

    return { data: data as Reminder, error };
  }

  async deleteReminder(reminderId: string): Promise<{ error?: any }> {
    const { error } = await this.supabase
      .from('reminders')
      .delete()
      .eq('id', reminderId);

    return { error };
  }

  private async scheduleNotification(reminder: Reminder): Promise<void> {
    if (!reminder.enabled || !reminder.local_time) {
      return;
    }

    if (Capacitor.isNativePlatform()) {
      const [hours, minutes] = reminder.local_time.split(':').map(Number);
      const days = reminder.days || [];

      // Schedule for each day
      const notifications = days.map((day, index) => {
        const dayMap: { [key: string]: number } = {
          'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 0
        };

        return {
          title: reminder.title,
          body: 'Time to log your health data',
          id: parseInt(`${reminder.id?.replace(/-/g, '').substring(0, 8)}${index}`, 16) % 2147483647,
          schedule: {
            on: {
              day: dayMap[day],
              hour: hours,
              minute: minutes,
            },
            repeats: true,
          },
        };
      });

      await LocalNotifications.schedule({ notifications });
    } else {
      // Web fallback: store reminder for in-app banner display
      // This would be handled by a reminder banner service/component
      // For now, we just store it in the database
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

