import { Injectable } from '@angular/core';
import { Profile } from './auth.service';
import { Observation } from './observation.service';
import { ProviderLink } from './sharing.service';
import { Reminder } from './reminder.service';

const DB_NAME = 'VitaLinkDB';
const DB_VERSION = 1;

interface DBStores {
  profiles: Profile;
  observations: Observation;
  providerLinks: ProviderLink;
  reminders: Reminder;
  syncQueue: SyncQueueItem;
}

export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
  retries: number;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineStorageService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    // If already initialized, return immediately
    if (this.db) {
      return Promise.resolve();
    }

    // If initialization is in progress, return the existing promise
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.initPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('observations')) {
          const obsStore = db.createObjectStore('observations', { keyPath: 'id', autoIncrement: true });
          obsStore.createIndex('user_id', 'user_id', { unique: false });
          obsStore.createIndex('metric', 'metric', { unique: false });
          obsStore.createIndex('ts', 'ts', { unique: false });
        }
        if (!db.objectStoreNames.contains('providerLinks')) {
          db.createObjectStore('providerLinks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('reminders')) {
          const remStore = db.createObjectStore('reminders', { keyPath: 'id' });
          remStore.createIndex('user_id', 'user_id', { unique: false });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  // Profile operations
  async saveProfile(profile: Profile): Promise<void> {
    return this.put('profiles', profile);
  }

  async getProfile(userId: string): Promise<Profile | null> {
    return this.get('profiles', userId);
  }

  // Observation operations
  async saveObservation(observation: Observation): Promise<void> {
    return this.put('observations', observation);
  }

  async getObservations(userId: string, metric?: string): Promise<Observation[]> {
    const store = this.getStore('observations', 'readonly');
    const index = store.index('user_id');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onsuccess = () => {
        let observations = request.result as Observation[];
        if (metric) {
          observations = observations.filter(obs => obs.metric === metric);
        }
        observations.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
        resolve(observations);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getLatestObservation(userId: string, metric: string): Promise<Observation | null> {
    const observations = await this.getObservations(userId, metric);
    return observations.length > 0 ? observations[0] : null;
  }

  // Provider links operations
  async saveProviderLink(link: ProviderLink): Promise<void> {
    return this.put('providerLinks', link);
  }

  async getProviderLinks(userId: string, isProvider: boolean): Promise<ProviderLink[]> {
    const store = this.getStore('providerLinks', 'readonly');
    const key = isProvider ? 'provider_id' : 'patient_id';
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const links = request.result as ProviderLink[];
        const filtered = links.filter(link => link[key] === userId);
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Reminders operations
  async saveReminder(reminder: Reminder): Promise<void> {
    return this.put('reminders', reminder);
  }

  async getReminders(userId: string): Promise<Reminder[]> {
    const store = this.getStore('reminders', 'readonly');
    const index = store.index('user_id');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onsuccess = () => resolve(request.result as Reminder[]);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteReminder(reminderId: string): Promise<void> {
    return this.delete('reminders', reminderId);
  }

  // Sync queue operations
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'retries'>): Promise<void> {
    const syncItem: SyncQueueItem = {
      ...item,
      id: `${item.table}-${item.type}-${Date.now()}-${Math.random()}`,
      retries: 0,
    };
    return this.put('syncQueue', syncItem);
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const store = this.getStore('syncQueue', 'readonly');
    const index = store.index('timestamp');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result as SyncQueueItem[]);
      request.onerror = () => reject(request.error);
    });
  }

  async removeFromSyncQueue(itemId: string): Promise<void> {
    return this.delete('syncQueue', itemId);
  }

  async incrementSyncRetry(itemId: string): Promise<void> {
    const item = await this.get<SyncQueueItem>('syncQueue', itemId);
    if (item) {
      item.retries += 1;
      await this.put('syncQueue', item);
    }
  }

  // Generic CRUD operations
  private async put<T>(storeName: keyof DBStores, data: T): Promise<void> {
    const store = this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async get<T>(storeName: keyof DBStores, key: string): Promise<T | null> {
    const store = this.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result as T || null);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: keyof DBStores, key: string): Promise<void> {
    const store = this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private getStore(storeName: keyof DBStores, mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    const transaction = this.db.transaction([storeName], mode);
    return transaction.objectStore(storeName);
  }

  async clearAll(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    const storeNames = Array.from(this.db.objectStoreNames);
    const transaction = this.db.transaction(storeNames, 'readwrite');
    
    return Promise.all(
      storeNames.map(name => {
        return new Promise<void>((resolve, reject) => {
          const request = transaction.objectStore(name).clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      })
    ).then(() => {});
  }
}

