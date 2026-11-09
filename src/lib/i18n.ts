/** Supported interface languages (ADR 0012). */
export type Lang = 'en' | 'ar';

export const LANGS: readonly Lang[] = ['en', 'ar'] as const;
const RTL: readonly Lang[] = ['ar'] as const;

/** True if the language is right-to-left. */
export const isRtl = (lang: Lang): boolean => (RTL as string[]).includes(lang);

/** `"ltr"` or `"rtl"` for use in the `dir` HTML attribute. */
export const dirFor = (lang: Lang): 'ltr' | 'rtl' => (isRtl(lang) ? 'rtl' : 'ltr');

/**
 * Prepends the locale prefix for non-default locales.
 * English (the default) returns the path unchanged.
 * Arabic prepends "ar/".
 *
 * Use with `withBase()`:  withBase(localePath(lang, 'start/'))
 */
export const localePath = (lang: Lang, path = ''): string =>
  lang === 'en' ? path : `ar/${path.replace(/^\/+/, '')}`;

/**
 * Wraps a number, symbol or LTR token in a <bdi> element so its direction is
 * isolated from a surrounding RTL paragraph.  Call this on every format.ts
 * output embedded in Arabic prose (set:html only; not needed in English).
 *
 * Example:  `قياس ${bdi('1.02 × 10⁻²¹')} في وحدات الانفعال`
 */
export const bdi = (s: string): string => `<bdi>${s}</bdi>`;
