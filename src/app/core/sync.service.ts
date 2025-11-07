import { Injectable } from '@angular/core';
import { NetworkService } from './network.service';
import { OfflineStorageService, SyncQueueItem } from './offline-storage.service';
import { ProfileService } from './profile.service';
import { ObservationService } from './observation.service';
import { SharingService } from './sharing.service';
import { ReminderService } from './reminder.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class SyncService {
  private isSyncing = false;
  private syncInterval: any;
  private isInitialized = false;

  constructor(
    private networkService: NetworkService,
    private offlineStorage: OfflineStorageService,
    private profileService: ProfileService,
    private observationService: ObservationService,
    private sharingService: SharingService,
    private reminderService: ReminderService,
    private authService: AuthService
  ) {
    // Initialize and start periodic sync when online
    this.initialize().then(() => {
      this.networkService.getOnlineStatus().subscribe(isOnline => {
        if (isOnline && this.isInitialized) {
          this.startPeriodicSync();
          this.syncNow();
        } else {
          this.stopPeriodicSync();
        }
      });
    });
  }

  private async initialize(): Promise<void> {
    try {
      // Wait for offline storage to be initialized
      await this.offlineStorage.init();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize sync service:', error);
      // Retry after a short delay
      setTimeout(() => this.initialize(), 1000);
    }
  }

  async syncNow(): Promise<void> {
    if (this.isSyncing || !this.networkService.isOnline() || !this.isInitialized) {
      return;
    }

    this.isSyncing = true;
    try {
      const queue = await this.offlineStorage.getSyncQueue();
      
      for (const item of queue) {
        // Skip items that have been retried too many times
        if (item.retries > 5) {
          await this.offlineStorage.removeFromSyncQueue(item.id);
          continue;
        }

        try {
          await this.processSyncItem(item);
          await this.offlineStorage.removeFromSyncQueue(item.id);
        } catch (error) {
          console.error(`Sync failed for item ${item.id}:`, error);
          await this.offlineStorage.incrementSyncRetry(item.id);
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    switch (item.table) {
      case 'profiles':
        if (item.type === 'update') {
          // Direct update to server without queuing again
          const { data, error } = await this.profileService['supabase']
            .from('profiles')
            .update(item.data)
            .eq('id', user.id)
            .select()
            .single();
          
          if (!error && data) {
            await this.offlineStorage.saveProfile(data as any);
          } else {
            throw error || new Error('Profile update failed');
          }
        }
        break;

      case 'observations':
        if (item.type === 'create') {
          // Direct insert to server without queuing again
          const { data, error } = await this.observationService['supabase']
            .from('observations')
            .insert(item.data)
            .select()
            .single();
          
          if (!error && data) {
            await this.offlineStorage.saveObservation(data as any);
          } else {
            throw error || new Error('Observation create failed');
          }
        } else if (item.type === 'delete') {
          if (item.data.id) {
            const { error } = await this.observationService['supabase']
              .from('observations')
              .delete()
              .eq('id', item.data.id);
            
            if (error) {
              throw error;
            }
            
            try {
              await this.offlineStorage.delete('observations', item.data.id);
            } catch (err) {
              // Ignore if not found in offline storage
            }
          }
        }
        break;

      case 'provider_links':
        if (item.type === 'update') {
          await this.sharingService.updateSharing(item.data.id, item.data);
        }
        break;

      case 'reminders':
        if (item.type === 'create') {
          await this.reminderService.createReminder(item.data);
        } else if (item.type === 'update') {
          await this.reminderService.updateReminder(item.data.id, item.data);
        } else if (item.type === 'delete') {
          await this.reminderService.deleteReminder(item.data.id);
        }
        break;
    }
  }

  private startPeriodicSync(): void {
    this.stopPeriodicSync();
    // Sync every 30 seconds when online
    this.syncInterval = setInterval(() => {
      if (this.networkService.isOnline()) {
        this.syncNow();
      }
    }, 30000);
  }

  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async queueForSync(table: string, type: 'create' | 'update' | 'delete', data: any): Promise<void> {
    // Wait for initialization if not ready
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    await this.offlineStorage.addToSyncQueue({
      type,
      table,
      data,
      timestamp: Date.now(),
    });
    
    // Try to sync immediately if online
    if (this.networkService.isOnline() && this.isInitialized) {
      this.syncNow();
    }
  }
}

