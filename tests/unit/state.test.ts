import { describe, expect, it } from 'vitest';
import { detectGpu } from '~/lib/gpu/detect';
import { createParams, depth, highlightedTerm, parseDepth } from '~/lib/state';

describe('depth', () => {
  it('starts at the story and falls back to it for unknown values', () => {
    expect(depth.get()).toBe('story');
    expect(parseDepth('math')).toBe('math');
    expect(parseDepth('code')).toBe('story');
    expect(parseDepth(undefined)).toBe('story');
  });
});

describe('highlightedTerm', () => {
  it('is shared state that subscribers see', () => {
    const seen: (string | null)[] = [];
    const stop = highlightedTerm.subscribe((term) => seen.push(term));
    highlightedTerm.set('psd');
    highlightedTerm.set(null);
    stop();
    expect(seen).toEqual([null, 'psd', null]);
  });
});

describe('createParams', () => {
  it('gives every figure its own copy of the defaults', () => {
    const defaults = { segment: 4, average: 'mean' };
    const a = createParams(defaults);
    const b = createParams(defaults);
    a.setKey('segment', 8);
    expect(b.get().segment).toBe(4);
    expect(defaults.segment).toBe(4);
  });
});

describe('detectGpu', () => {
  it('reports no GPU outside a browser', async () => {
    expect(await detectGpu()).toBe('none');
  });
});
