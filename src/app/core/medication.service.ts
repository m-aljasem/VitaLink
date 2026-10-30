import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Weekday } from '@capacitor/local-notifications';
import { getSupabaseClient } from './supabase.client';
import { ReminderService, WEEKDAYS, notificationId } from './reminder.service';

export interface Medication {
  id?: string;
  user_id: string;
  name: string;
  dose?: string | null;
  /** 'HH:MM' or 'HH:MM:SS' local times. */
  times: string[];
  /** Day names ('Mon'…'Sun'); empty or null means every day. */
  days?: string[] | null;
  active: boolean;
  created_at?: string;
}

export type DoseStatus = 'taken' | 'skipped';

export interface MedicationLog {
  id?: string;
  user_id: string;
  medication_id: string;
  scheduled_for: string;
  status: DoseStatus;
  logged_at?: string;
}

export interface Dose {
  medication: Medication;
  time: string; // 'HH:MM'
  scheduledFor: Date;
  status: DoseStatus | null;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ACTION_TYPE = 'MEDICATION_DOSE';

@Injectable({
  providedIn: 'root',
})
export class MedicationService {
  private supabase = getSupabaseClient();
  private actionsRegistered = false;

  constructor(
    private translate: TranslateService,
    private reminderService: ReminderService,
    private router: Router
  ) {}

  async getMedications(userId: string): Promise<{ data?: Medication[]; error?: any }> {
    const { data, error } = await this.supabase
      .from('medications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    return { data: (data as Medication[])?.map(m => ({ ...m, times: (m.times || []).map(shortTime) })), error };
  }

  async saveMedication(medication: Medication): Promise<{ data?: Medication; error?: any }> {
    const payload = {
      user_id: medication.user_id,
      name: medication.name.trim(),
      dose: medication.dose?.trim() || null,
      times: [...new Set(medication.times)].sort(),
      days: medication.days?.length ? medication.days : null,
      active: medication.active,
    };
    const query = medication.id
      ? this.supabase.from('medications').update(payload).eq('id', medication.id)
      : this.supabase.from('medications').insert(payload);
    const { data, error } = await query.select().single();
    if (!error) {
      // Android 13+ shows nothing until notification permission is granted.
      await this.reminderService.requestPermission();
      await this.syncNotifications(medication.user_id);
    }
    return { data: data as Medication, error };
  }

  async deleteMedication(medication: Medication): Promise<{ error?: any }> {
    const { error } = await this.supabase.from('medications').delete().eq('id', medication.id);
    if (!error) await this.syncNotifications(medication.user_id);
    return { error };
  }

  async getLogs(userId: string, since: Date): Promise<{ data?: MedicationLog[]; error?: any }> {
    const { data, error } = await this.supabase
      .from('medication_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_for', since.toISOString())
      .order('scheduled_for', { ascending: false });
    return { data: data as MedicationLog[], error };
  }

  /** Records a dose as taken or skipped (re-logging the same dose replaces its status). */
  async logDose(userId: string, medicationId: string, scheduledFor: Date, status: DoseStatus): Promise<{ error?: any }> {
    const { error } = await this.supabase
      .from('medication_logs')
      .upsert(
        { user_id: userId, medication_id: medicationId, scheduled_for: scheduledFor.toISOString(), status, logged_at: new Date().toISOString() },
        { onConflict: 'medication_id,scheduled_for' }
      );
    return { error };
  }

  /** Doses scheduled on `day`, sorted by time, with any logged status. */
  dosesForDay(medications: Medication[], logs: MedicationLog[], day = new Date()): Dose[] {
    const statusByKey = new Map(logs.map(l => [`${l.medication_id}|${new Date(l.scheduled_for).getTime()}`, l.status]));
    const doses: Dose[] = [];
    for (const medication of medications) {
      if (!medication.active || !isScheduledOn(medication, day)) continue;
      for (const time of medication.times) {
        const scheduledFor = atTime(day, time);
        doses.push({
          medication,
          time: shortTime(time),
          scheduledFor,
          status: statusByKey.get(`${medication.id}|${scheduledFor.getTime()}`) ?? null,
        });
      }
    }
    return doses.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
  }

  /** Share of doses due in the last `days` days (up to now) that were marked taken; null if none were due. */
  adherence(medications: Medication[], logs: MedicationLog[], days = 7, now = new Date()): number | null {
    let due = 0;
    let taken = 0;
    for (let i = 0; i < days; i++) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      for (const dose of this.dosesForDay(medications, logs, day)) {
        if (dose.scheduledFor > now) continue;
        due++;
        if (dose.status === 'taken') taken++;
      }
    }
    return due === 0 ? null : taken / due;
  }

  /** Registers the Taken/Skip notification buttons and handles taps on them (native only). */
  async initNotificationActions(getUserId: () => string | null): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.actionsRegistered) return;
    this.actionsRegistered = true;

    await LocalNotifications.registerActionTypes({
      types: [{
        id: ACTION_TYPE,
        actions: [
          { id: 'taken', title: this.translate.instant('MEDICATIONS.TAKEN') },
          { id: 'skipped', title: this.translate.instant('MEDICATIONS.SKIP'), destructive: true },
        ],
      }],
    });

    await LocalNotifications.addListener('localNotificationActionPerformed', async ({ actionId, notification }) => {
      const extra = notification.extra || {};
      if (extra.kind !== 'medication') return;
      const userId = getUserId();
      if ((actionId === 'taken' || actionId === 'skipped') && userId) {
        await this.logDose(userId, extra.medicationId, atTime(new Date(), extra.time), actionId);
      } else {
        this.router.navigate(['/tabs/settings/medications']);
      }
    });
  }

  /** Replaces this device's medication notifications with the user's active schedules. */
  async syncNotifications(userId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const { data: medications } = await this.getMedications(userId);
    await this.reminderService.cancelNotificationsOfKind('medication');
    if (!medications) return;

    const body = this.translate.instant('MEDICATIONS.NOTIFICATION_BODY');
    const notifications = medications
      .filter(m => m.active && m.id)
      .flatMap(medication => medication.times.flatMap(time => {
        const [hour, minute] = time.split(':').map(Number);
        const key = `${medication.id}@${shortTime(time)}`;
        const base = {
          title: medication.dose ? `${medication.name} · ${medication.dose}` : medication.name,
          body,
          actionTypeId: ACTION_TYPE,
          extra: { kind: 'medication', medicationId: medication.id, time: shortTime(time) },
        };
        const days = (medication.days || []).filter(d => d in WEEKDAYS);
        if (days.length === 0) {
          return [{ ...base, id: notificationId(key, 0), schedule: { on: { hour, minute }, repeats: true } }];
        }
        return days.map(day => ({
          ...base,
          id: notificationId(key, WEEKDAYS[day] as Weekday),
          schedule: { on: { weekday: WEEKDAYS[day], hour, minute }, repeats: true },
        }));
      }));

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  }
}

export function isScheduledOn(medication: Medication, day: Date): boolean {
  return !medication.days?.length || medication.days.includes(DAY_NAMES[day.getDay()]);
}

/** Local date `day` at 'HH:MM'. */
export function atTime(day: Date, time: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  const result = new Date(day);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function shortTime(time: string): string {
  return time.slice(0, 5);
}
