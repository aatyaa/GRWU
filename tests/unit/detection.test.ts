import { describe, expect, it } from 'vitest';
import { detection, falseAlarm, i0e, noisePdf, signalPdf } from '~/lib/stats/detection';

// Reference values from scipy 1.x: scipy.special.i0e and scipy.stats.rice (b = ρ₀).
describe('detection statistics', () => {
  it('matches scipy.special.i0e on both sides of the switch to the asymptotic series', () => {
    const ref: [number, number][] = [
      [0, 1.0],
      [0.5, 0.64503527044915],
      [1, 0.46575960759364043],
      [5, 0.18354081260932834],
      [14.9, 0.10425387282429126],
      [15, 0.1038995314488227],
      [15.1, 0.1035487812057697],
      [40, 0.06327827987523532],
      [300, 0.02304255841508546],
    ];
    for (const [x, v] of ref) expect(i0e(x), `i0e(${x})`).toBeCloseTo(v, 12);
  });

  it('matches scipy.stats.rice', () => {
    const ref: [number, number, number, number][] = [
      // t, ρ₀, sf, pdf
      [4, 0, 0.00033546262790251635, 0.0013418505116100474],
      [5, 6, 0.8625148362300327, 0.22182629587588182],
      [8, 8, 0.5249830266911788, 0.39972842705885897],
      [8, 10, 0.9801042096420504, 0.04836698077172853],
      [6, 12, 0.9999999993104766, 4.303815949220832e-9],
      [3, 2, 0.21436208816264934, 0.3032485276951251],
    ];
    for (const [t, rho0, sf, pdf] of ref) {
      expect(signalPdf(t, rho0) / pdf, `pdf(${t}; ${rho0})`).toBeCloseTo(1, 10);
      expect(detection(t, rho0), `sf(${t}; ${rho0})`).toBeCloseTo(sf, 9);
    }
  });

  it('reduces to the Rayleigh law in noise alone', () => {
    for (const t of [0.5, 2, 4, 8]) {
      expect(signalPdf(t, 0)).toBeCloseTo(noisePdf(t), 14);
      expect(detection(t, 0)).toBeCloseTo(falseAlarm(t), 10);
    }
  });
});
