import { describe, expect, it } from 'vitest';
import { powerOfTen, scientific } from '~/lib/format';

describe('scientific', () => {
  it('writes a mantissa and a superscript power of ten', () => {
    expect(scientific(8.04e-24)).toBe('8.0 × 10⁻²⁴');
    expect(scientific(-2500, 2)).toBe('-2.50 × 10³');
    expect(scientific(1e-23)).toBe('1.0 × 10⁻²³');
  });

  it('carries a rounded-up mantissa into the exponent', () => {
    expect(scientific(9.96e-24)).toBe('1.0 × 10⁻²³');
  });

  it('leaves zero and non-finite values alone', () => {
    expect(scientific(0)).toBe('0');
    expect(scientific(Number.NaN)).toBe('NaN');
  });
});

describe('powerOfTen', () => {
  it('labels decades', () => {
    expect(powerOfTen(1e-23)).toBe('10⁻²³');
    expect(powerOfTen(1000)).toBe('10³');
    expect(powerOfTen(1)).toBe('10⁰');
  });
});
