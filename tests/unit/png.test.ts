import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, greyPng } from '~/lib/figure/png';

describe('greyPng', () => {
  it('computes the standard CRC-32', () => {
    // The check value of CRC-32 (ISO-HDLC) for the ASCII string "123456789".
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('writes a valid greyscale PNG whose pixels decode back', () => {
    const w = 5;
    const h = 3;
    const pixels = Uint8Array.from({ length: w * h }, (_, i) => (i * 17) % 256);
    const png = greyPng(w, h, pixels);
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(png.buffer);
    expect(String.fromCharCode(...png.slice(12, 16))).toBe('IHDR');
    expect(view.getUint32(16)).toBe(w);
    expect(view.getUint32(20)).toBe(h);
    // Every chunk's CRC covers its type and data.
    let offset = 8;
    const types: string[] = [];
    let idat = new Uint8Array(0);
    while (offset < png.length) {
      const length = view.getUint32(offset);
      const type = String.fromCharCode(...png.slice(offset + 4, offset + 8));
      const crc = view.getUint32(offset + 8 + length);
      expect(crc).toBe(crc32(png.subarray(offset + 4, offset + 8 + length)));
      if (type === 'IDAT') idat = png.slice(offset + 8, offset + 8 + length);
      types.push(type);
      offset += 12 + length;
    }
    expect(types).toEqual(['IHDR', 'IDAT', 'IEND']);
    const raw = inflateSync(idat);
    for (let y = 0; y < h; y++) {
      expect(raw[y * (w + 1)]).toBe(0);
      expect(Array.from(raw.subarray(y * (w + 1) + 1, (y + 1) * (w + 1)))).toEqual(
        Array.from(pixels.subarray(y * w, (y + 1) * w)),
      );
    }
  });
});
