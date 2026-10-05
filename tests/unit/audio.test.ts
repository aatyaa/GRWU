import { describe, expect, it } from 'vitest';
import { prepareBuffer } from '~/lib/audio/play';

describe('prepareBuffer', () => {
  it('upsamples twofold by linear interpolation and peaks at 0.8', () => {
    const out = prepareBuffer([0, 1, -2]);
    expect(out).toHaveLength(6);
    const expected = [0, 0.2, 0.4, -0.2, -0.8, -0.8];
    expected.forEach((value, i) => expect(out[i]).toBeCloseTo(value, 6));
  });

  it('keeps silence silent', () => {
    expect(Array.from(prepareBuffer(new Float32Array(4)))).toEqual(Array(8).fill(0));
  });
});
