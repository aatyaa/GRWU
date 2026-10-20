import katex from 'katex';
import { describe, expect, it } from 'vitest';
import glossary from '~/content/glossary.json';
import { foundations, tracks } from '~/lib/tracks';

describe('glossary', () => {
  it('defines each term once', () => {
    const ids = glossary.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('gives every term a symbol KaTeX can render and a definition', () => {
    for (const term of glossary) {
      expect(() => katex.renderToString(term.symbol, { throwOnError: true })).not.toThrow();
      expect(term.definition.length).toBeGreaterThan(20);
      expect(term.definition).toMatch(/\.$/);
      if ('unit' in term) expect(term.unit).not.toMatch(/^\s*$|—/);
    }
  });

  it('quotes the solar mass in length and time units correctly', () => {
    // CODATA 2018 G and c; IAU 2015 nominal G M_sun.
    const GM = 1.3271244e20; // m^3 s^-2
    const c = 299_792_458;
    const text = glossary.find((t) => t.id === 'solar-mass')!.definition;
    expect(text).toContain(`${(GM / c ** 2 / 1000).toFixed(2)} km`);
    expect(text).toContain(`${((GM / c ** 3) * 1e6).toFixed(2)} μs`);
  });
});

describe('tracks', () => {
  it('lists each track once', () => {
    const ids = tracks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the foundations series open and five articles long', () => {
    expect(tracks.find((t) => t.id === 'foundations')?.gated).toBe(false);
    expect(foundations).toHaveLength(5);
    expect(new Set(foundations.map((a) => a.id)).size).toBe(5);
  });

  it('keeps every open track open', () => {
    for (const t of tracks.filter((t) => t.kind !== 'flagship')) expect(t.gated).toBe(false);
  });
});
