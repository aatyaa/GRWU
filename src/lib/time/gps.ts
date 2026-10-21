/**
 * GPS time, the clock every gravitational-wave archive is indexed by: seconds since
 * 1980-01-06 00:00:00 UTC, counting the leap seconds UTC has inserted since. Checked against
 * astropy's Time(..., scale='utc').gps in tests/unit/gps.test.ts.
 */

const EPOCH = Date.UTC(1980, 0, 6);

/** The UTC days that began one second later than GPS: a leap second was inserted before each. */
const LEAPS = [
  '1981-07-01',
  '1982-07-01',
  '1983-07-01',
  '1985-07-01',
  '1988-01-01',
  '1990-01-01',
  '1991-01-01',
  '1992-07-01',
  '1993-07-01',
  '1994-07-01',
  '1996-01-01',
  '1997-07-01',
  '1999-01-01',
  '2006-01-01',
  '2009-01-01',
  '2012-07-01',
  '2015-07-01',
  '2017-01-01',
].map((day) => Date.parse(`${day}T00:00:00Z`));

/** How many seconds GPS is ahead of UTC at a UTC instant (milliseconds since 1970). */
export function leapSecondsAt(utcMs: number): number {
  return LEAPS.filter((at) => utcMs >= at).length;
}

/** GPS seconds for a UTC instant given in milliseconds since 1970. */
export function utcToGps(utcMs: number): number {
  return (utcMs - EPOCH) / 1000 + leapSecondsAt(utcMs);
}

/** The UTC instant (milliseconds since 1970) of a GPS time. */
export function gpsToUtc(gps: number): number {
  const guess = EPOCH + gps * 1000;
  // GPS runs ahead of UTC, so the leap count at the guess can be one too many near a leap.
  let utc = guess - leapSecondsAt(guess) * 1000;
  if (utcToGps(utc) > gps + 1e-9) utc -= 1000;
  return utc;
}
