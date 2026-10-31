import { monthRange, toIsoDate } from './dates';

describe('toIsoDate', () => {
  it('writes the day in the local time zone, with two digits', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toIsoDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('monthRange', () => {
  it('is the first and last day of the month', () => {
    expect(monthRange(new Date(2026, 9, 15))).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange(new Date(2026, 3, 1))).toEqual({ from: '2026-04-01', to: '2026-04-30' });
  });

  it('knows how long February is, in a leap year and not', () => {
    expect(monthRange(new Date(2028, 1, 10)).to).toBe('2028-02-29');
    expect(monthRange(new Date(2027, 1, 10)).to).toBe('2027-02-28');
  });

  it('works at the end of the year', () => {
    expect(monthRange(new Date(2026, 11, 31))).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('uses today when no date is given', () => {
    const now = new Date();

    expect(monthRange().from).toBe(toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  });
});
