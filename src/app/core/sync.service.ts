import { Injectable } from '@angular/core';
import { NetworkService, isNetworkError } from './network.service';
import { OfflineStorageService, SyncQueueItem } from './offline-storage.service';
import { ProfileService } from './profile.service';
import { ObservationService } from './observation.service';
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
    // Wait for the session to be restored; queued items belong to the signed-in user.
    if (!this.authService.getCurrentUser()) {
      return;
    }

    this.isSyncing = true;
    try {
      const queue = await this.offlineStorage.getSyncQueue();
      
      for (const item of queue) {
        try {
          await this.processSyncItem(item);
          await this.offlineStorage.removeFromSyncQueue(item.id);
        } catch (error) {
          if (this.isRetryable(error)) {
            // Server unreachable or session expired: keep the item (and everything after it) for the next run.
            break;
          }
          // The server rejected it; retrying won't help.
          console.error(`Sync rejected for item ${item.id}, dropping it:`, error);
          await this.offlineStorage.removeFromSyncQueue(item.id);
          if (item.table === 'observations' && item.type === 'create' && item.data?.id) {
            await this.offlineStorage.delete('observations', item.data.id);
          }
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
          const { error } = await this.profileService.pushProfileUpdate(user.id, item.data);
          if (error) throw error;
        }
        break;

      case 'observations':
        if (item.type === 'create') {
          const { data, error } = await this.observationService.insertObservation(item.data);
          if (error) throw error;
          await this.offlineStorage.saveObservation(data!);
        } else if (item.type === 'update' && item.data.id) {
          const { data, error } = await this.observationService.updateOnServer(item.data.id, item.data.changes);
          if (error) throw error;
          await this.offlineStorage.saveObservation(data!);
        } else if (item.type === 'delete' && item.data.id) {
          const { error } = await this.observationService.deleteFromServer(item.data.id);
          if (error) throw error;
        }
        break;
    }
  }

  private isRetryable(error: any): boolean {
    const code = `${error?.code ?? ''}`;
    return isNetworkError(error)
      || code === 'PGRST301' // JWT expired; the client refreshes it before the next run
      || /jwt/i.test(error?.message ?? '')
      || code.startsWith('08') // Postgres connection errors
      || code.startsWith('57'); // Postgres operator intervention (e.g. shutdown)
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

