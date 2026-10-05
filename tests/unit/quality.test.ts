import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import glossary from '~/content/glossary.json';
import { proseOf, readability, syllables } from '~/lib/quality/readability';

const ARTICLES = 'src/content/articles';
const articles = readdirSync(ARTICLES).map((slug) => {
  const source = readFileSync(`${ARTICLES}/${slug}/index.mdx`, 'utf8');
  return { slug, source, beginner: /^level:\s*beginner\s*$/m.test(source) };
});

describe('readability', () => {
  it('counts syllables close to a dictionary', () => {
    const words: Record<string, number> = {
      black: 1,
      hole: 1,
      signal: 2,
      measure: 2,
      frequency: 3,
      gravity: 3,
      table: 2,
      simple: 2,
      notes: 1,
    };
    for (const [word, count] of Object.entries(words)) expect(syllables(word), word).toBe(count);
  });

  it('applies the Flesch–Kincaid formula', () => {
    // 6 words, 1 sentence, 6 syllables: 0.39·6 + 11.8·1 − 15.59.
    expect(readability('The cat sat on the mat.').grade).toBeCloseTo(0.39 * 6 + 11.8 - 15.59, 10);
  });

  it('reads only the prose of an article', () => {
    const prose = proseOf(
      '---\ntitle: x\n---\nimport A from "a";\n\nOne <Term id="mass">mass</Term> {n}.\n\n```py\ncode\n```\n',
    );
    expect(prose).toBe('One mass .');
  });

  // A first-year student reads at about grade 13; the foundations are written well below that.
  it.each(articles.map((a) => [a.slug, a] as const))('%s stays readable', (_, a) => {
    const { grade, words } = readability(proseOf(a.source));
    expect(words).toBeGreaterThan(300);
    expect(grade).toBeLessThanOrEqual(a.beginner ? 12 : 14);
  });
});

describe('glossary coverage', () => {
  const ids = new Set(glossary.map((t) => t.id));
  const used = (source: string) => [...source.matchAll(/<Term\s+id="([^"]+)"/g)].map((m) => m[1]);

  it.each(articles.map((a) => [a.slug, a] as const))('%s links only to defined terms', (_, a) => {
    for (const id of used(a.source)) expect(ids.has(id), `Term "${id}"`).toBe(true);
  });

  it('gives each beginner article at least three linked terms', () => {
    for (const a of articles.filter((x) => x.beginner)) {
      expect(new Set(used(a.source)).size, a.slug).toBeGreaterThanOrEqual(3);
    }
  });
});
