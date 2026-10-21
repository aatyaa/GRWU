import { describe, expect, it } from 'vitest';
import { gpsToUtc, leapSecondsAt, utcToGps } from '~/lib/time/gps';

// Reference values from astropy: Time(utc, scale='utc').gps, and Time(gps, format='gps').utc.
const REFERENCE: [string, number][] = [
  ['1980-01-06T00:00:00Z', 0],
  ['1985-06-30T23:59:59Z', 173059202],
  ['1985-07-01T00:00:00Z', 173059204],
  ['2015-09-14T09:50:45.400Z', 1126259462.4],
  ['2017-08-17T12:41:04.400Z', 1187008882.4],
  ['2019-04-12T05:30:44.200Z', 1239082262.2],
  ['2019-05-21T03:02:29.400Z', 1242442967.4],
  ['2024-01-01T00:00:00Z', 1388102418],
];

describe('GPS time', () => {
  it('matches astropy from UTC to GPS, across leap seconds', () => {
    for (const [utc, gps] of REFERENCE) expect(utcToGps(Date.parse(utc)), utc).toBeCloseTo(gps, 3);
  });

  it('matches astropy from GPS back to UTC', () => {
    const back: [number, string][] = [
      [1126259462.4, '2015-09-14T09:50:45.400Z'],
      [1187008882.43, '2017-08-17T12:41:04.430Z'],
      [0, '1980-01-06T00:00:00.000Z'],
      [1000000000, '2011-09-14T01:46:25.000Z'],
    ];
    for (const [gps, utc] of back)
      expect(new Date(gpsToUtc(gps)).toISOString(), String(gps)).toBe(utc);
  });

  it('counts 18 leap seconds since 2017', () => {
    expect(leapSecondsAt(Date.parse('2016-12-31T23:59:59Z'))).toBe(17);
    expect(leapSecondsAt(Date.parse('2026-10-21T00:00:00Z'))).toBe(18);
  });
});
