import { Injectable, Injector } from '@angular/core';
import { getSupabaseClient } from './supabase.client';
import { NetworkService } from './network.service';
import { OfflineStorageService } from './offline-storage.service';
import { SyncService } from './sync.service';

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
  private syncService?: SyncService;

  constructor(
    private networkService: NetworkService,
    private offlineStorage: OfflineStorageService,
    private injector: Injector
  ) {}

  private getSyncService(): SyncService {
    if (!this.syncService) {
      this.syncService = this.injector.get(SyncService);
    }
    return this.syncService;
  }

  async createObservation(observation: Partial<Observation>): Promise<{ data?: Observation; error?: any }> {
    // Generate temporary ID if not provided
    const tempId = observation.id || `temp-${Date.now()}-${Math.random()}`;
    const fullObservation: Observation = {
      ...observation,
      id: tempId,
      ts: observation.ts || new Date().toISOString(),
    } as Observation;

    // Always save to offline storage first
    await this.offlineStorage.saveObservation(fullObservation);

    // If online, try to sync to server
    if (this.networkService.isOnline()) {
      try {
        const { data, error } = await this.supabase
          .from('observations')
          .insert(observation)
          .select()
          .single();

        if (!error && data) {
          // Update offline storage with server ID
          await this.offlineStorage.saveObservation(data as Observation);
          return { data: data as Observation, error };
        } else {
          // Queue for sync if server request fails
          await this.getSyncService().queueForSync('observations', 'create', observation);
          return { data: fullObservation, error };
        }
      } catch (err) {
        // Queue for sync if network error
        await this.getSyncService().queueForSync('observations', 'create', observation);
        return { data: fullObservation, error: err };
      }
    } else {
      // Queue for sync when back online
      await this.getSyncService().queueForSync('observations', 'create', observation);
      return { data: fullObservation, error: null };
    }
  }

  async getObservationsByMetric(userId: string, metric: MetricType, limit = 100): Promise<{ data?: Observation[]; error?: any }> {
    // Try to get from server if online
    if (this.networkService.isOnline()) {
      try {
        const { data, error } = await this.supabase
          .from('observations')
          .select('*')
          .eq('user_id', userId)
          .eq('metric', metric)
          .order('ts', { ascending: false })
          .limit(limit);

        if (!error && data) {
          // Update offline storage with fresh data
          for (const obs of data) {
            await this.offlineStorage.saveObservation(obs as Observation);
          }
          return { data: data as Observation[], error };
        }
      } catch (err) {
        // Fall through to offline storage
      }
    }

    // Fallback to offline storage
    const offlineData = await this.offlineStorage.getObservations(userId, metric);
    return { data: offlineData.slice(0, limit), error: null };
  }

  async getAllObservations(userId: string, limit = 100): Promise<{ data?: Observation[]; error?: any }> {
    // Try to get from server if online
    if (this.networkService.isOnline()) {
      try {
        const { data, error } = await this.supabase
          .from('observations')
          .select('*')
          .eq('user_id', userId)
          .order('ts', { ascending: false })
          .limit(limit);

        if (!error && data) {
          // Update offline storage with fresh data
          for (const obs of data) {
            await this.offlineStorage.saveObservation(obs as Observation);
          }
          return { data: data as Observation[], error };
        }
      } catch (err) {
        // Fall through to offline storage
      }
    }

    // Fallback to offline storage
    const offlineData = await this.offlineStorage.getObservations(userId);
    return { data: offlineData.slice(0, limit), error: null };
  }

  async getLatestObservation(userId: string, metric: MetricType): Promise<{ data?: Observation; error?: any }> {
    // Try to get from server if online
    if (this.networkService.isOnline()) {
      try {
        const { data, error } = await this.supabase
          .from('observations')
          .select('*')
          .eq('user_id', userId)
          .eq('metric', metric)
          .order('ts', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          await this.offlineStorage.saveObservation(data as Observation);
          return { data: data as Observation, error };
        }
      } catch (err) {
        // Fall through to offline storage
      }
    }

    // Fallback to offline storage
    const offlineData = await this.offlineStorage.getLatestObservation(userId, metric);
    return { data: offlineData || undefined, error: null };
  }

  async getObservationsForChart(userId: string, metric: MetricType, days = 7): Promise<{ data?: Observation[]; error?: any }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Try to get from server if online
    if (this.networkService.isOnline()) {
      try {
        const { data, error } = await this.supabase
          .from('observations')
          .select('*')
          .eq('user_id', userId)
          .eq('metric', metric)
          .gte('ts', startDate.toISOString())
          .order('ts', { ascending: true });

        if (!error && data) {
          // Update offline storage
          for (const obs of data) {
            await this.offlineStorage.saveObservation(obs as Observation);
          }
          return { data: data as Observation[], error };
        }
      } catch (err) {
        // Fall through to offline storage
      }
    }

    // Fallback to offline storage and filter by date
    const offlineData = await this.offlineStorage.getObservations(userId, metric);
    const filtered = offlineData.filter(obs => new Date(obs.ts) >= startDate);
    filtered.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    return { data: filtered, error: null };
  }

  async deleteObservation(observationId: string): Promise<{ error?: any }> {
    // If online, try to delete from server
    if (this.networkService.isOnline()) {
      try {
        const { error } = await this.supabase
          .from('observations')
          .delete()
          .eq('id', observationId);

        if (!error) {
          // Also remove from offline storage
          try {
            await this.offlineStorage.delete('observations', observationId);
          } catch (err) {
            // Ignore if not found in offline storage
          }
          return { error: null };
        }
      } catch (err) {
        // Queue for sync
        await this.getSyncService().queueForSync('observations', 'delete', { id: observationId });
        return { error: err };
      }
    }

    // Queue for sync when back online
    await this.getSyncService().queueForSync('observations', 'delete', { id: observationId });
    return { error: null };
  }
}

