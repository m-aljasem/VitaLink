import { Injectable } from '@angular/core';
import { getSupabaseClient } from './supabase.client';

export type MetricType = 'bp' | 'glucose' | 'spo2' | 'hr' | 'pain' | 'weight';

export interface Observation {
  id?: string;
  user_id: string;
  metric: MetricType;
  ts: string;
  systolic?: number;
  diastolic?: number;
  numeric_value?: number;
  unit?: string;
  tags?: string[];
  context?: any;
  created_at?: string;
}

export interface ObservationWithMetric extends Observation {
  metric: MetricType;
}

@Injectable({
  providedIn: 'root',
})
export class ObservationService {
  private supabase = getSupabaseClient();

  async createObservation(observation: Partial<Observation>): Promise<{ data?: Observation; error?: any }> {
    const { data, error } = await this.supabase
      .from('observations')
      .insert(observation)
      .select()
      .single();

    return { data: data as Observation, error };
  }

  async getObservationsByMetric(userId: string, metric: MetricType, limit = 100): Promise<{ data?: Observation[]; error?: any }> {
    const { data, error } = await this.supabase
      .from('observations')
      .select('*')
      .eq('user_id', userId)
      .eq('metric', metric)
      .order('ts', { ascending: false })
      .limit(limit);

    return { data: data as Observation[], error };
  }

  async getAllObservations(userId: string, limit = 100): Promise<{ data?: Observation[]; error?: any }> {
    const { data, error } = await this.supabase
      .from('observations')
      .select('*')
      .eq('user_id', userId)
      .order('ts', { ascending: false })
      .limit(limit);

    return { data: data as Observation[], error };
  }

  async getLatestObservation(userId: string, metric: MetricType): Promise<{ data?: Observation; error?: any }> {
    const { data, error } = await this.supabase
      .from('observations')
      .select('*')
      .eq('user_id', userId)
      .eq('metric', metric)
      .order('ts', { ascending: false })
      .limit(1)
      .maybeSingle();

    return { data: data as Observation, error };
  }

  async getObservationsForChart(userId: string, metric: MetricType, days = 7): Promise<{ data?: Observation[]; error?: any }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('observations')
      .select('*')
      .eq('user_id', userId)
      .eq('metric', metric)
      .gte('ts', startDate.toISOString())
      .order('ts', { ascending: true });

    return { data: data as Observation[], error };
  }

  async deleteObservation(observationId: string): Promise<{ error?: any }> {
    const { error } = await this.supabase
      .from('observations')
      .delete()
      .eq('id', observationId);

    return { error };
  }
}

