import { Injectable, Injector } from '@angular/core';
import { getSupabaseClient } from './supabase.client';
import { NetworkService, isNetworkError } from './network.service';
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

  /**
   * Saves locally first, then to the server. The ID is generated on the device so the
   * local copy and the server row are the same record whether or not we're online.
   * `queued` is true when the server couldn't be reached and the save will sync later.
   */
  async createObservation(observation: Partial<Observation>): Promise<{ data?: Observation; error?: any; queued?: boolean }> {
    const fullObservation: Observation = {
      ...observation,
      id: observation.id || crypto.randomUUID(),
      ts: observation.ts || new Date().toISOString(),
    } as Observation;

    await this.offlineStorage.saveObservation(fullObservation);

    if (this.networkService.isOnline()) {
      const { data, error } = await this.insertObservation(fullObservation);
      if (!error) {
        await this.offlineStorage.saveObservation(data!);
        return { data };
      }
      if (!isNetworkError(error)) {
        // The server rejected it; don't keep a local copy that will never sync.
        await this.offlineStorage.delete('observations', fullObservation.id!);
        return { error };
      }
    }

    await this.getSyncService().queueForSync('observations', 'create', fullObservation);
    return { data: fullObservation, queued: true };
  }

  /** Idempotent insert: retrying an observation that already reached the server is a no-op. */
  async insertObservation(observation: Observation): Promise<{ data?: Observation; error?: any }> {
    try {
      const { data, error } = await this.supabase
        .from('observations')
        .upsert(observation, { onConflict: 'id', ignoreDuplicates: true })
        .select()
        .maybeSingle();

      if (error) return { error };
      return { data: (data as Observation) || observation };
    } catch (err) {
      return { error: err };
    }
  }

  async getObservationsByMetric(userId: string, metric: MetricType, limit = 100): Promise<{ data?: Observation[]; error?: any }> {
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
          await this.cacheServerRows(userId, data as Observation[], metric, this.coveredSince(data as Observation[], limit));
          return { data: data as Observation[], error };
        }
      } catch (err) {
        // Fall through to offline storage
      }
    }

    const offlineData = await this.offlineStorage.getObservations(userId, metric);
    return { data: offlineData.slice(0, limit), error: null };
  }

  async getAllObservations(userId: string, limit = 100): Promise<{ data?: Observation[]; error?: any }> {
    if (this.networkService.isOnline()) {
      try {
        const { data, error } = await this.supabase
          .from('observations')
          .select('*')
          .eq('user_id', userId)
          .order('ts', { ascending: false })
          .limit(limit);

        if (!error && data) {
          await this.cacheServerRows(userId, data as Observation[], undefined, this.coveredSince(data as Observation[], limit));
          return { data: data as Observation[], error };
        }
      } catch (err) {
        // Fall through to offline storage
      }
    }

    const offlineData = await this.offlineStorage.getObservations(userId);
    return { data: offlineData.slice(0, limit), error: null };
  }

  async getLatestObservation(userId: string, metric: MetricType): Promise<{ data?: Observation; error?: any }> {
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

    const offlineData = await this.offlineStorage.getLatestObservation(userId, metric);
    return { data: offlineData || undefined, error: null };
  }

  /** Timestamp of the user's most recent reading among `metrics` (RLS limits providers to shared metrics). */
  async getLatestTimestamp(userId: string, metrics: MetricType[]): Promise<{ data?: string; error?: any }> {
    if (metrics.length === 0) return { data: undefined };

    if (this.networkService.isOnline()) {
      try {
        const { data, error } = await this.supabase
          .from('observations')
          .select('ts')
          .eq('user_id', userId)
          .in('metric', metrics)
          .order('ts', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error) return { data: data?.ts };
      } catch (err) {
        // Fall through to offline storage
      }
    }

    const offlineData = await this.offlineStorage.getObservations(userId);
    return { data: offlineData.find(obs => metrics.includes(obs.metric))?.ts };
  }

  /** All of the user's readings from the last `days` days, oldest first, in one request. */
  async getRecentObservations(userId: string, days = 7): Promise<{ data?: Observation[]; error?: any }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    if (this.networkService.isOnline()) {
      try {
        const { data, error } = await this.supabase
          .from('observations')
          .select('*')
          .eq('user_id', userId)
          .gte('ts', startDate.toISOString())
          .order('ts', { ascending: true });

        if (!error && data) {
          await this.cacheServerRows(userId, data as Observation[], undefined, startDate.toISOString());
          return { data: data as Observation[], error };
        }
      } catch (err) {
        // Fall through to offline storage
      }
    }

    const offlineData = await this.offlineStorage.getObservations(userId);
    const filtered = offlineData.filter(obs => new Date(obs.ts) >= startDate);
    filtered.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    return { data: filtered, error: null };
  }

  async getObservationsForChart(userId: string, metric: MetricType, days = 7): Promise<{ data?: Observation[]; error?: any }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

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
          await this.cacheServerRows(userId, data as Observation[], metric, startDate.toISOString());
          return { data: data as Observation[], error };
        }
      } catch (err) {
        // Fall through to offline storage
      }
    }

    const offlineData = await this.offlineStorage.getObservations(userId, metric);
    const filtered = offlineData.filter(obs => new Date(obs.ts) >= startDate);
    filtered.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    return { data: filtered, error: null };
  }

  async deleteObservation(observationId: string): Promise<{ error?: any }> {
    // Remove locally right away so the UI reflects the delete even when offline.
    try {
      await this.offlineStorage.delete('observations', observationId);
    } catch (err) {
      // Ignore if not found in offline storage
    }

    // If it never reached the server, dropping the queued create is enough.
    const queue = await this.offlineStorage.getSyncQueue();
    const pendingCreate = queue.find(
      item => item.table === 'observations' && item.type === 'create' && item.data?.id === observationId
    );
    if (pendingCreate) {
      await this.offlineStorage.removeFromSyncQueue(pendingCreate.id);
      return { error: null };
    }

    if (this.networkService.isOnline()) {
      const { error } = await this.deleteFromServer(observationId);
      if (!error) return { error: null };
      if (!isNetworkError(error)) return { error };
    }

    await this.getSyncService().queueForSync('observations', 'delete', { id: observationId });
    return { error: null };
  }

  async deleteFromServer(observationId: string): Promise<{ error?: any }> {
    try {
      const { error } = await this.supabase
        .from('observations')
        .delete()
        .eq('id', observationId);
      return { error };
    } catch (err) {
      return { error: err };
    }
  }

  /**
   * Oldest timestamp for which a `limit`ed, newest-first result is complete,
   * or undefined when the result holds every row.
   */
  private coveredSince(rows: Observation[], limit: number): string | undefined {
    return rows.length < limit ? undefined : rows[rows.length - 1].ts;
  }

  /**
   * Stores server rows locally and removes local rows in the same range that no longer
   * exist on the server (deleted on another device), keeping ones still waiting to sync.
   */
  private async cacheServerRows(userId: string, rows: Observation[], metric?: MetricType, since?: string): Promise<void> {
    try {
      await this.offlineStorage.saveObservations(rows);

      const serverIds = new Set(rows.map(row => row.id));
      const queue = await this.offlineStorage.getSyncQueue();
      const pendingIds = new Set(
        queue.filter(item => item.table === 'observations' && item.type === 'create').map(item => item.data?.id)
      );
      const sinceTime = since ? new Date(since).getTime() : -Infinity;

      const local = await this.offlineStorage.getObservations(userId, metric);
      const stale = local
        .filter(obs => new Date(obs.ts).getTime() >= sinceTime && !serverIds.has(obs.id) && !pendingIds.has(obs.id))
        .map(obs => obs.id!);
      await this.offlineStorage.deleteObservations(stale);
    } catch (err) {
      console.error('Failed to update offline observation cache:', err);
    }
  }
}
