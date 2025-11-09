import { Injectable, Injector } from '@angular/core';
import { getSupabaseClient } from './supabase.client';
import { Profile } from './auth.service';
import { NetworkService } from './network.service';
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

    // If online, try to sync to server
    if (this.networkService.isOnline()) {
      try {
        const { data, error } = await this.supabase
          .from('profiles')
          .update(updates)
          .eq('id', userId)
          .select()
          .single();

        if (!error && data) {
          await this.offlineStorage.saveProfile(data as Profile);
          return { data: data as Profile, error: null };
        } else {
          // Queue for sync
          await this.getSyncService().queueForSync('profiles', 'update', updates);
          const updateError = error instanceof Error ? error : new Error('Update failed');
          return { data: updatedProfile, error: updateError };
        }
      } catch (err) {
        // Queue for sync
        await this.getSyncService().queueForSync('profiles', 'update', updates);
        const error = err instanceof Error ? err : new Error('Unknown error');
        return { data: updatedProfile, error };
      }
    } else {
      // Queue for sync when back online
      await this.getSyncService().queueForSync('profiles', 'update', updates);
      return { data: updatedProfile, error: null };
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

