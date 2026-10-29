import { Injectable, Injector } from '@angular/core';
import { getSupabaseClient } from './supabase.client';
import { Profile } from './auth.service';
import { NetworkService, isNetworkError } from './network.service';
import { OfflineStorageService } from './offline-storage.service';
import { SyncService } from './sync.service';

export { Profile } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
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

  async createProfile(profile: Partial<Profile>): Promise<{ data?: Profile; error?: Error | null }> {
    const fullProfile = profile as Profile;

    // Always save to offline storage first
    await this.offlineStorage.saveProfile(fullProfile);

    // If online, try to sync to server
    if (this.networkService.isOnline()) {
      try {
        const { data, error } = await this.supabase
          .from('profiles')
          .insert(profile)
          .select()
          .single();

        if (!error && data) {
          await this.offlineStorage.saveProfile(data as Profile);
          return { data: data as Profile, error };
        }
      } catch (err) {
        // Continue with offline profile
      }
    }

    return { data: fullProfile, error: null };
  }

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<{ data?: Profile; error?: Error | null }> {
    // Get existing profile from offline storage
    const existingProfile = await this.offlineStorage.getProfile(userId);
    const updatedProfile = { ...existingProfile, ...updates } as Profile;

    // Always save to offline storage first
    await this.offlineStorage.saveProfile(updatedProfile);

    if (this.networkService.isOnline()) {
      const { data, error } = await this.pushProfileUpdate(userId, updates);
      if (!error) {
        return { data, error: null };
      }
      if (!isNetworkError(error)) {
        // The server rejected the change; restore the previous local copy.
        if (existingProfile) {
          await this.offlineStorage.saveProfile(existingProfile);
        }
        return { data: existingProfile || undefined, error: error instanceof Error ? error : new Error(error.message || 'Update failed') };
      }
    }

    // Offline or unreachable: keep the local change and sync it later.
    await this.getSyncService().queueForSync('profiles', 'update', updates);
    return { data: updatedProfile, error: null };
  }

  /** Sends a profile update to the server and caches the result. */
  async pushProfileUpdate(userId: string, updates: Partial<Profile>): Promise<{ data?: Profile; error?: any }> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) return { error };
      await this.offlineStorage.saveProfile(data as Profile);
      return { data: data as Profile };
    } catch (err) {
      return { error: err };
    }
  }

  async getProfile(userId: string): Promise<{ data?: Profile; error?: Error | null }> {
    // Try to get from server if online
    if (this.networkService.isOnline()) {
      try {
        const { data, error } = await this.supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!error && data) {
          await this.offlineStorage.saveProfile(data as Profile);
          return { data: data as Profile, error: null };
        }
      } catch (err) {
        // Fall through to offline storage
      }
    }

    // Fallback to offline storage
    const offlineData = await this.offlineStorage.getProfile(userId);
    if (offlineData) {
      return { data: offlineData, error: null };
    }

    return { data: undefined, error: new Error('Profile not found') };
  }
}

