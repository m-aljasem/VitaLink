import { MedicationService, Medication, MedicationLog, atTime } from './medication.service';

describe('MedicationService schedule logic', () => {
  let service: MedicationService;
  beforeEach(() => {
    service = new MedicationService({ instant: (k: string) => k } as any, {} as any, {} as any);
  });
  const monday = new Date(2026, 9, 26, 12, 0); // Mon 26 Oct 2026, noon local

  const daily: Medication = { id: 'm1', user_id: 'u', name: 'Metformin', times: ['20:00', '08:00'], active: true };
  const weekdays: Medication = { id: 'm2', user_id: 'u', name: 'Vitamin D', times: ['09:00'], days: ['Tue'], active: true };
  const stopped: Medication = { id: 'm3', user_id: 'u', name: 'Old', times: ['10:00'], active: false };

  it("lists today's doses in time order, skipping inactive and other-day medications", () => {
    const doses = service.dosesForDay([daily, weekdays, stopped], [], monday);
    expect(doses.map(d => `${d.medication.id} ${d.time}`)).toEqual(['m1 08:00', 'm1 20:00']);
  });

  it('attaches logged statuses to doses', () => {
    const logs: MedicationLog[] = [
      { user_id: 'u', medication_id: 'm1', scheduled_for: atTime(monday, '08:00').toISOString(), status: 'taken' },
    ];
    const doses = service.dosesForDay([daily], logs, monday);
    expect(doses.map(d => d.status)).toEqual(['taken', null]);
  });

  it('computes adherence over doses already due', () => {
    // Monday noon: only the 08:00 dose is due today; 6 previous days × 2 doses.
    const logs: MedicationLog[] = [
      { user_id: 'u', medication_id: 'm1', scheduled_for: atTime(monday, '08:00').toISOString(), status: 'taken' },
    ];
    expect(service.adherence([daily], logs, 7, monday)).toBeCloseTo(1 / 13, 5);
    expect(service.adherence([], [], 7, monday)).toBeNull();
  });
});
