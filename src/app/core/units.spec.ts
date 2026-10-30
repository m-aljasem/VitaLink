import { defaultUnitsForCountry, displayRange, fromDisplay, toDisplay } from './units';

describe('units', () => {
  const metric = { glucose_unit: 'mmol/L' as const, weight_unit: 'kg' as const };
  const us = { glucose_unit: 'mg/dL' as const, weight_unit: 'lb' as const };

  it('converts glucose between mg/dL and mmol/L', () => {
    expect(toDisplay('glucose', 126, metric)).toBe(7);
    expect(fromDisplay('glucose', 7, metric)).toBe(126);
    expect(toDisplay('glucose', 126, us)).toBe(126);
  });

  it('converts weight between kg and lb', () => {
    expect(toDisplay('weight', 80, us)).toBe(176.4);
    expect(fromDisplay('weight', 176.4, us)).toBeCloseTo(80, 1);
    expect(toDisplay('weight', 80, metric)).toBe(80);
  });

  it('leaves other metrics unchanged', () => {
    expect(toDisplay('hr', 72, us)).toBe(72);
    expect(fromDisplay('spo2', 97, metric)).toBe(97);
  });

  it('picks defaults by country', () => {
    expect(defaultUnitsForCountry('US')).toEqual({ glucose_unit: 'mg/dL', weight_unit: 'lb' });
    expect(defaultUnitsForCountry('gb')).toEqual({ glucose_unit: 'mmol/L', weight_unit: 'kg' });
    expect(defaultUnitsForCountry('SA')).toEqual({ glucose_unit: 'mg/dL', weight_unit: 'kg' });
    expect(defaultUnitsForCountry(null)).toEqual({ glucose_unit: 'mg/dL', weight_unit: 'kg' });
  });

  it('gives input ranges in display units', () => {
    expect(displayRange('glucose', metric)).toEqual({ min: 1.1, max: 33.3, step: 0.1 });
    expect(displayRange('glucose', us).step).toBe(1);
  });
});
