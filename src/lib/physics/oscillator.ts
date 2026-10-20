/**
 * The damped oscillator: a mass on a spring with friction, m x'' + c x' + k x = 0, and the
 * ring it makes. The same two numbers, a frequency and a damping time, describe a ringing
 * black hole. Checked against scipy's ODE solver (tests/fixtures/foundations.json).
 */

export interface Oscillator {
  mass: number;
  stiffness: number;
  /** Friction coefficient c. */
  damping: number;
}

export interface Ring {
  /** Frequency without friction, Hz. */
  naturalFrequency: number;
  /** Frequency it actually rings at, Hz. */
  frequency: number;
  /** Time for the amplitude to fall by e, s. */
  tau: number;
  /** Quality factor, π f τ: roughly how many cycles it rings for. */
  quality: number;
}

/** The ring of a lightly damped (underdamped) oscillator. */
export function ringOf({ mass, stiffness, damping }: Oscillator): Ring {
  const gamma = damping / (2 * mass);
  const w0 = Math.sqrt(stiffness / mass);
  if (!(gamma < w0)) throw new RangeError('the oscillator is not underdamped: it does not ring');
  const frequency = Math.sqrt(w0 * w0 - gamma * gamma) / (2 * Math.PI);
  const tau = gamma > 0 ? 1 / gamma : Infinity;
  return {
    naturalFrequency: w0 / (2 * Math.PI),
    frequency,
    tau,
    quality: qualityFactor(frequency, tau),
  };
}

export function qualityFactor(frequency: number, tau: number): number {
  return Math.PI * frequency * tau;
}

/** Position at time t of an underdamped oscillator released at x0 with velocity v0. */
export function displacement(o: Oscillator, x0: number, v0: number, t: number): number {
  const { frequency, tau } = ringOf(o);
  const gamma = 1 / tau;
  const wd = 2 * Math.PI * frequency;
  return (
    Math.exp(-gamma * t) * (x0 * Math.cos(wd * t) + ((v0 + gamma * x0) / wd) * Math.sin(wd * t))
  );
}

/** A damped sinusoid, A e^(−t/τ) cos(2π f t + φ): the shape of one ringdown tone. */
export function dampedSinusoid(
  t: number,
  {
    amplitude = 1,
    frequency,
    tau,
    phase = 0,
  }: { amplitude?: number; frequency: number; tau: number; phase?: number },
): number {
  return amplitude * Math.exp(-t / tau) * Math.cos(2 * Math.PI * frequency * t + phase);
}
