import { Weekday } from '@capacitor/local-notifications';
import { ReminderService } from './reminder.service';

describe('ReminderService', () => {
  const translate = { instant: (key: string) => key };
  let service: ReminderService;

  beforeEach(() => {
    service = new ReminderService(translate as any);
  });

  it('gives each reminder and weekday a stable, distinct notification ID', () => {
    const id = (reminderId: string, weekday: Weekday) => (service as any).notificationId(reminderId, weekday);
    const reminderId = '3f1c2b9e-8d7a-4c3b-9a1e-2f4d5c6b7a8e';

    expect(id(reminderId, Weekday.Monday)).toBe(id(reminderId, Weekday.Monday));
    const ids = [1, 2, 3, 4, 5, 6, 7].map(day => id(reminderId, day));
    expect(new Set(ids).size).toBe(7);
    expect(id('another-reminder', Weekday.Monday)).not.toBe(id(reminderId, Weekday.Monday));
    for (const n of ids) {
      expect(Number.isInteger(n)).toBeTrue();
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(2 ** 31);
    }
  });
});
