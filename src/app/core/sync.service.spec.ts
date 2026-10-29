import { of } from 'rxjs';
import { SyncService } from './sync.service';
import { OfflineStorageService } from './offline-storage.service';
import { NETWORK_ERROR } from '../testing/fake-supabase';

describe('SyncService', () => {
  let storage: OfflineStorageService;
  let observationService: jasmine.SpyObj<any>;
  let sync: SyncService;

  beforeEach(async () => {
    storage = new OfflineStorageService();
    await storage.init();
    await storage.clearAll();

    const network = { isOnline: () => true, getOnlineStatus: () => of(false) };
    const auth = { getCurrentUser: () => ({ id: 'user-1' }) };
    observationService = jasmine.createSpyObj('ObservationService', ['insertObservation', 'deleteFromServer']);
    sync = new SyncService(network as any, storage, {} as any, observationService, auth as any);
    await (sync as any).initialize();
  });

  async function queueCreate(id: string) {
    await storage.saveObservation({ id, user_id: 'user-1', metric: 'hr', ts: new Date().toISOString() });
    await storage.addToSyncQueue({ table: 'observations', type: 'create', data: { id }, timestamp: Date.now() });
  }

  it('removes items once they reach the server', async () => {
    await queueCreate('a');
    observationService.insertObservation.and.resolveTo({ data: { id: 'a', user_id: 'user-1', metric: 'hr', ts: '' } });

    await sync.syncNow();

    expect(await storage.getSyncQueue()).toEqual([]);
  });

  it('keeps items for later when the server is unreachable', async () => {
    await queueCreate('a');
    observationService.insertObservation.and.resolveTo({ error: NETWORK_ERROR });

    await sync.syncNow();

    expect((await storage.getSyncQueue()).length).toBe(1);
    expect((await storage.getObservations('user-1')).length).toBe(1);
  });

  it('keeps items when the session has expired', async () => {
    await queueCreate('a');
    observationService.insertObservation.and.resolveTo({ error: { code: 'PGRST301', message: 'JWT expired' } });

    await sync.syncNow();

    expect((await storage.getSyncQueue()).length).toBe(1);
  });

  it('drops rejected creates and their local copy', async () => {
    await queueCreate('a');
    observationService.insertObservation.and.resolveTo({ error: { code: '23514', message: 'violates check constraint' } });

    await sync.syncNow();

    expect(await storage.getSyncQueue()).toEqual([]);
    expect(await storage.getObservations('user-1')).toEqual([]);
  });
});
