/**
 * How hard prose is to read (ADR 0009): the Flesch–Kincaid grade level, computed from the
 * prose of an MDX article with its frontmatter, imports, components, code and mathematics
 * removed. Syllables are counted with the usual vowel-group heuristic, so the grade is an
 * estimate (within about a grade of dictionary counts), good for catching drift, not for
 * splitting hairs.
 */

/** The reader-facing prose of an MDX source. */
export function proseOf(mdx: string): string {
  return mdx
    .replace(/^---[\s\S]*?\n---\n/, '') // frontmatter
    .replace(/^(import|export) .*$/gm, '') // module lines
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/<MathLayer[\s\S]*?<\/MathLayer>/g, ' ') // the optional mathematical layer
    .replace(/<(Exercise|CheckYourself|Predict)\b[\s\S]*?(\/>|<\/\1>)/g, ' ') // interactive blocks
    .replace(/<[^>]+>/g, ' ') // remaining tags (their text content stays)
    .replace(/\{[^{}]*\}/g, ' ') // JSX expressions
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links: keep their text
    .replace(/[*_#>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  // A final -es, -ed or silent -e adds no syllable ("notes", "named", "hole"), except the
  // syllabic -le after a consonant ("table", "simple").
  const trimmed = /[^aeiouy]le$/.test(w)
    ? w.replace(/^y/, '')
    : w.replace(/(?:[^laeiouy]es|ed|[^aeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export interface Readability {
  words: number;
  sentences: number;
  syllables: number;
  /** Flesch–Kincaid grade level: 0.39 (words/sentence) + 11.8 (syllables/word) − 15.59. */
  grade: number;
}

export function readability(prose: string): Readability {
  const sentences = Math.max(1, (prose.match(/[.!?]+(\s|$)/g) ?? []).length);
  const words = prose.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  const syl = words.reduce((sum, w) => sum + syllables(w), 0);
  const n = Math.max(1, words.length);
  return {
    words: words.length,
    sentences,
    syllables: syl,
    grade: 0.39 * (n / sentences) + 11.8 * (syl / n) - 15.59,
  };
}
