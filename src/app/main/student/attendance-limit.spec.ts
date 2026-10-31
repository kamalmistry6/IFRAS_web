import { ATTENDANCE_LIMIT, isLow } from './attendance-limit';

describe('isLow', () => {
  it('is low only under the limit', () => {
    expect(ATTENDANCE_LIMIT).toBe(75);
    expect(isLow(74.9)).toBe(true);
    expect(isLow(0)).toBe(true);
    expect(isLow(75)).toBe(false);
    expect(isLow(100)).toBe(false);
  });

  it('is not low when there are no lectures yet', () => {
    expect(isLow(null)).toBe(false);
  });
});
