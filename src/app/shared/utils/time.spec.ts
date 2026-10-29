import { formatTime, fromTimeParts, toTimeParts } from './time';

describe('formatTime', () => {
  it.each([
    ['09:00:00', '9:00 AM'],
    ['10:05', '10:05 AM'],
    ['11:00:00', '11:00 AM'],
    ['12:00:00', '12:00 PM'],
    ['13:00:00', '1:00 PM'],
    ['23:59:00', '11:59 PM'],
    ['00:00:00', '12:00 AM'],
    ['00:30:00', '12:30 AM'],
  ])('shows %s as %s', (input, expected) => {
    expect(formatTime(input)).toBe(expected);
  });

  it('leaves text it cannot read as it is', () => {
    expect(formatTime('soon')).toBe('soon');
  });
});

describe('time parts', () => {
  it.each([
    ['00:00', { hour: 12, minute: 0, period: 'AM' }],
    ['09:05', { hour: 9, minute: 5, period: 'AM' }],
    ['12:30', { hour: 12, minute: 30, period: 'PM' }],
    ['14:45', { hour: 2, minute: 45, period: 'PM' }],
    ['23:55', { hour: 11, minute: 55, period: 'PM' }],
  ])('splits %s', (time, parts) => {
    expect(toTimeParts(time)).toEqual(parts);
  });

  it('puts the parts back together as 24-hour text, for every hour', () => {
    for (let h = 0; h < 24; h++) {
      const time = `${String(h).padStart(2, '0')}:20`;
      expect(fromTimeParts(toTimeParts(time))).toBe(time);
    }
  });
});
