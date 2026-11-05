import { describe, expect, it } from 'vitest';
import { addDays, clockTime, longDay, shortDay, weekdayDay, weekdayShort, centralDate, centralParts, centralToInstant, daysUntil, inDays, isDue, plainDay, isOverdue, occurrences, occursOn, repeatKey } from './index.ts';

describe('Central dates across daylight saving', () => {
  it('fall back 2026-11-01: 01:30 happens twice, the day has 25 hours', () => {
    expect(centralParts(new Date('2026-11-01T06:30:00Z'))).toEqual({ date: '2026-11-01', time: '01:30' });
    expect(centralParts(new Date('2026-11-01T07:30:00Z'))).toEqual({ date: '2026-11-01', time: '01:30' });
    expect(centralDate(new Date('2026-11-02T05:59:00Z'))).toBe('2026-11-01');
    expect(centralDate(new Date('2026-11-02T06:00:00Z'))).toBe('2026-11-02');
    expect(centralToInstant('2026-11-01', '01:30').toISOString()).toBe('2026-11-01T06:30:00.000Z');
    expect(centralToInstant('2026-11-01', '08:00').toISOString()).toBe('2026-11-01T14:00:00.000Z');
  });
  it('spring forward 2027-03-14: 02:00-03:00 does not exist, the day has 23 hours', () => {
    expect(centralParts(new Date('2027-03-14T07:59:00Z'))).toEqual({ date: '2027-03-14', time: '01:59' });
    expect(centralParts(new Date('2027-03-14T08:00:00Z'))).toEqual({ date: '2027-03-14', time: '03:00' });
    expect(centralToInstant('2027-03-14', '02:30').toISOString()).toBe('2027-03-14T08:30:00.000Z');
    expect(centralDate(new Date('2027-03-15T04:59:00Z'))).toBe('2027-03-14');
    expect(centralDate(new Date('2027-03-15T05:00:00Z'))).toBe('2027-03-15');
  });
  it('a time just before midnight Central belongs to that Central date, not the UTC one', () => {
    expect(centralDate(new Date('2026-11-04T04:30:00Z'))).toBe('2026-11-03');
  });
});

describe('isDue: passed wall time and no run for that Central date', () => {
  it('is not due before the time, due after, not due again once run', () => {
    expect(isDue(new Date('2026-11-03T12:00:00Z'), '07:00', [])).toBe(false);
    expect(isDue(new Date('2026-11-03T13:15:00Z'), '07:00', [])).toBe(true);
    expect(isDue(new Date('2026-11-03T13:15:00Z'), '07:00', ['2026-11-03'])).toBe(false);
    expect(isDue(new Date('2026-11-03T13:15:00Z'), '07:00', ['2026-11-02'])).toBe(true);
  });
  it('fires once on the 25-hour day', () => {
    expect(isDue(new Date('2026-11-01T12:15:00Z'), '06:00', [])).toBe(true);
    expect(isDue(new Date('2026-11-01T12:15:00Z'), '06:00', ['2026-11-01'])).toBe(false);
  });
});

describe('due by Central date', () => {
  it('is late only after the due date has ended in Central time', () => {
    expect(isOverdue(new Date('2026-11-04T04:59:00Z'), '2026-11-03')).toBe(false);
    expect(isOverdue(new Date('2026-11-04T06:00:00Z'), '2026-11-03')).toBe(true);
    expect(daysUntil(new Date('2026-11-03T18:00:00Z'), '2026-11-05')).toBe(2);
    expect(daysUntil(new Date('2026-11-03T18:00:00Z'), '2026-11-02')).toBe(-1);
  });
});

describe('repeat rules', () => {
  it('daily, weekdays, weekly, every N days', () => {
    expect(occurrences({ kind: 'daily' }, '2026-11-01', '2026-11-03')).toHaveLength(3);
    expect(occurrences({ kind: 'weekdays' }, '2026-10-31', '2026-11-08')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
    expect(occurrences({ kind: 'weekly', days: [2, 4] }, '2026-11-01', '2026-11-08')).toEqual(['2026-11-03', '2026-11-05']);
    expect(occurrences({ kind: 'every', n: 3, start: '2026-11-01' }, '2026-10-30', '2026-11-10')).toEqual(['2026-11-01', '2026-11-04', '2026-11-07', '2026-11-10']);
    expect(occursOn({ kind: 'every', n: 0, start: '2026-11-01' }, '2026-11-01')).toBe(false);
  });
  it('steps by calendar day over daylight saving and builds the idempotent key', () => {
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
    expect(addDays('2027-03-13', 2)).toBe('2027-03-15');
    expect(repeatKey('abc', '2026-11-03')).toBe('rep-abc-2026-11-03');
  });
});

describe('plain dates', () => {
  it('names a day, with the year only when it is not this year', () => {
    expect(plainDay('2026-12-01', '2026-11-04')).toBe('Dec 1');
    expect(plainDay('2027-12-01', '2026-11-04')).toBe('Dec 1, 2027');
    expect(plainDay('2026-11-04T15:00:00.000Z', '2026-11-04')).toBe('Nov 4');
  });
  it('says time left in words, never 392d', () => {
    expect(inDays(0)).toBe('today');
    expect(inDays(1)).toBe('in 1 day');
    expect(inDays(392)).toBe('in 392 days');
  });
});

describe('on-screen formats in Central time', () => {
  it('reads the Central day, not the UTC day', () => {
    const lateEvening = Date.parse('2026-11-04T03:30:00Z'); // 21:30 on Nov 3 in Central
    expect(shortDay(lateEvening)).toBe('Nov 3');
    expect(longDay(lateEvening)).toBe('Tuesday, November 3');
    expect(clockTime(lateEvening)).toBe('9:30 pm');
  });
  it('follows daylight saving', () => {
    expect(clockTime(Date.parse('2026-07-01T17:05:00Z'))).toBe('12:05 pm');
    expect(clockTime(Date.parse('2026-12-01T17:05:00Z'))).toBe('11:05 am');
  });
  it('names the weekday of a Central date', () => {
    expect(weekdayShort('2026-11-03')).toBe('Tue');
    expect(weekdayDay('2026-11-03')).toBe('Tuesday, Nov 3');
  });
});
