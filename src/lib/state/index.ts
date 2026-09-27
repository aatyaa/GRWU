/**
 * State shared across islands and in-prose elements on a page. Modules are singletons, so
 * every island that imports these stores sees the same values.
 */
import { atom, map, type MapStore } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';

export const DEPTHS = ['intuition', 'math', 'code'] as const;
export type Depth = (typeof DEPTHS)[number];

export function parseDepth(value: unknown): Depth {
  return DEPTHS.includes(value as Depth) ? (value as Depth) : 'intuition';
}

/** How deep the reader wants articles opened by default. Remembered across visits. */
export const depth = persistentAtom<Depth>('grwu-depth', 'intuition', {
  encode: (value) => value,
  decode: parseDepth,
});

/** Concept currently pointed at (e.g. hovering a term in an equation), such as 'psd'. */
export const highlightedTerm = atom<string | null>(null);

/** True when the reader asked the OS for less motion. */
export const reducedMotion = atom(false);

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion.set(query.matches);
  query.addEventListener('change', (event) => reducedMotion.set(event.matches));
}

/** Parameters of one figure, shared by its sliders, equation and code panel. */
export function createParams<T extends Record<string, string | number | boolean>>(
  defaults: T,
): MapStore<T> {
  return map<T>({ ...defaults });
}
