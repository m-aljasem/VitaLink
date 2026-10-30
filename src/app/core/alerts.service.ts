import { Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Observable, Subject } from 'rxjs';
import { getSupabaseClient } from './supabase.client';
import { MetricType } from './observation.service';
import { Severity } from './clinical';

/** Created by the database when a linked patient logs an out-of-range reading. */
export interface ReadingAlert {
  id: string;
  recipient_id: string;
  patient_id: string;
  observation_id: string | null;
  metric: MetricType;
  severity: Severity;
  created_at: string;
  read_at: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AlertsService {
  private supabase = getSupabaseClient();
  private channel: RealtimeChannel | null = null;
  private incoming$ = new Subject<ReadingAlert>();

  async getAlerts(recipientId: string, limit = 50): Promise<{ data?: ReadingAlert[]; error?: any }> {
    const { data, error } = await this.supabase
      .from('alerts')
      .select('*')
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data: data as ReadingAlert[], error };
  }

  async markRead(alertIds: string[]): Promise<{ error?: any }> {
    if (alertIds.length === 0) return {};
    const { error } = await this.supabase
      .from('alerts')
      .update({ read_at: new Date().toISOString() })
      .in('id', alertIds);
    return { error };
  }

  /** New alerts for the recipient as they are created (Realtime). */
  watch(recipientId: string): Observable<ReadingAlert> {
    if (!this.channel) {
      this.channel = this.supabase
        .channel(`alerts-${recipientId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'alerts', filter: `recipient_id=eq.${recipientId}` },
          payload => this.incoming$.next(payload.new as ReadingAlert)
        )
        .subscribe();
    }
    return this.incoming$.asObservable();
  }

  async stopWatching(): Promise<void> {
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
