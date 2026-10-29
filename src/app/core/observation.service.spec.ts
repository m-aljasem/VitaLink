import { TestBed } from '@angular/core/testing';
import { ObservationService, Observation } from './observation.service';
import { OfflineStorageService } from './offline-storage.service';
import { NetworkService } from './network.service';
import { SyncService } from './sync.service';
import { fakeQuery, fakeSupabase, NETWORK_ERROR } from '../testing/fake-supabase';

describe('ObservationService', () => {
  let service: ObservationService;
  let storage: OfflineStorageService;
  let network: NetworkService;
  let supabase: ReturnType<typeof fakeSupabase>;
  const userId = 'user-1';

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SyncService,
          useFactory: (offline: OfflineStorageService) => ({
            queueForSync: (table: string, type: any, data: any) =>
              offline.addToSyncQueue({ table, type, data, timestamp: Date.now() }),
          }),
          deps: [OfflineStorageService],
        },
      ],
    });
    service = TestBed.inject(ObservationService);
    storage = TestBed.inject(OfflineStorageService);
    network = TestBed.inject(NetworkService);
    spyOn(network, 'isOnline').and.returnValue(true);
    supabase = fakeSupabase();
    (service as any).supabase = supabase;

    await storage.init();
    await storage.clearAll();
  });

  function reading(overrides: Partial<Observation> = {}): Partial<Observation> {
    return { user_id: userId, metric: 'hr', numeric_value: 72, ts: '2026-10-01T08:00:00.000Z', ...overrides };
  }

  describe('createObservation', () => {
    it('uses one device-generated ID locally and on the server', async () => {
      supabase.from.and.callFake(() => fakeQuery({ data: null, error: null }));

      const { data, error, queued } = await service.createObservation(reading());

      expect(error).toBeUndefined();
      expect(queued).toBeUndefined();
      expect(data!.id).toMatch(/^[0-9a-f-]{36}$/);
      const local = await storage.getObservations(userId);
      expect(local.map(o => o.id)).toEqual([data!.id]);
    });

    it('keeps the reading and queues it when the server is unreachable', async () => {
      supabase.from.and.callFake(() => fakeQuery({ data: null, error: NETWORK_ERROR }));

      const { data, error, queued } = await service.createObservation(reading());

      expect(error).toBeUndefined();
      expect(queued).toBeTrue();
      expect((await storage.getObservations(userId)).length).toBe(1);
      const queue = await storage.getSyncQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].data.id).toBe(data!.id);
    });

    it('returns the error and keeps nothing locally when the server rejects it', async () => {
      supabase.from.and.callFake(() => fakeQuery({ data: null, error: { message: 'violates check constraint', code: '23514' } }));

      const { error, queued } = await service.createObservation(reading());

      expect(error).toBeTruthy();
      expect(queued).toBeUndefined();
      expect(await storage.getObservations(userId)).toEqual([]);
      expect(await storage.getSyncQueue()).toEqual([]);
    });

    it('queues without calling the server when offline', async () => {
      (network.isOnline as jasmine.Spy).and.returnValue(false);

      const { queued } = await service.createObservation(reading());

      expect(queued).toBeTrue();
      expect(supabase.from).not.toHaveBeenCalled();
      expect((await storage.getSyncQueue()).length).toBe(1);
    });
  });

  describe('deleteObservation', () => {
    it('drops the queued create instead of calling the server for unsynced readings', async () => {
      (network.isOnline as jasmine.Spy).and.returnValue(false);
      const { data } = await service.createObservation(reading());
      (network.isOnline as jasmine.Spy).and.returnValue(true);

      const { error } = await service.deleteObservation(data!.id!);

      expect(error).toBeNull();
      expect(supabase.from).not.toHaveBeenCalled();
      expect(await storage.getObservations(userId)).toEqual([]);
      expect(await storage.getSyncQueue()).toEqual([]);
    });

    it('removes the local copy immediately and queues the delete when offline', async () => {
      await storage.saveObservation(reading({ id: 'synced-1' }) as Observation);
      (network.isOnline as jasmine.Spy).and.returnValue(false);

      await service.deleteObservation('synced-1');

      expect(await storage.getObservations(userId)).toEqual([]);
      const queue = await storage.getSyncQueue();
      expect(queue.map(q => [q.type, q.data.id])).toEqual([['delete', 'synced-1']]);
    });
  });

  describe('local cache', () => {
    it('removes readings deleted on the server but keeps unsynced ones', async () => {
      await storage.saveObservation(reading({ id: 'kept' }) as Observation);
      await storage.saveObservation(reading({ id: 'deleted-elsewhere' }) as Observation);
      (network.isOnline as jasmine.Spy).and.returnValue(false);
      const { data: pending } = await service.createObservation(reading());
      (network.isOnline as jasmine.Spy).and.returnValue(true);

      supabase.from.and.callFake(() => fakeQuery({ data: [reading({ id: 'kept' })], error: null }));
      await service.getObservationsByMetric(userId, 'hr');

      const ids = (await storage.getObservations(userId)).map(o => o.id).sort();
      expect(ids).toEqual(['kept', pending!.id!].sort());
    });

    it('only reconciles the range a limited query covers', async () => {
      await storage.saveObservation(reading({ id: 'old', ts: '2020-01-01T00:00:00.000Z' }) as Observation);
      supabase.from.and.callFake(() => fakeQuery({ data: [reading({ id: 'new' })], error: null }));

      await service.getObservationsByMetric(userId, 'hr', 1);

      const ids = (await storage.getObservations(userId)).map(o => o.id).sort();
      expect(ids).toEqual(['new', 'old']);
    });
  });
});
