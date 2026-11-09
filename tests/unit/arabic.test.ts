/**
 * Build-time checks for Arabic articles (ADR 0012, plan § 8).
 *
 * 1. Staleness: every index.ar.mdx must have translatedFrom ≥ the English
 *    article's `updated` date, so a stale translation fails the build.
 * 2. Rejected terms: no Arabic MDX may contain a word listed as rejected
 *    in glossary.json (e.g. "نظرية" for "theorem", "إجهاد" for "strain").
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import glossaryRaw from '~/content/glossary.json';

interface GlossaryEntry {
  id: string;
  arRejected?: { word: string; reason: string }[];
}
const glossary = glossaryRaw as unknown as GlossaryEntry[];

const ARTICLES = 'src/content/articles';

/** Extract an ISO-8601 date from a frontmatter string (first match wins). */
function extractDate(source: string, field: string): Date | null {
  const m = source.match(new RegExp(`^${field}:\\s*(\\S+)\\s*$`, 'm'));
  return m ? new Date(m[1]) : null;
}

/** Collect every Arabic article alongside its English counterpart. */
const pairs = readdirSync(ARTICLES).flatMap((slug) => {
  const arPath = `${ARTICLES}/${slug}/index.ar.mdx`;
  const enPath = `${ARTICLES}/${slug}/index.mdx`;
  if (!existsSync(arPath)) return [];
  const arSource = readFileSync(arPath, 'utf8');
  const enSource = readFileSync(enPath, 'utf8');
  return [{ slug, arSource, enSource }];
});

/** Rejected Arabic words collected from glossary entries. */
const rejectedWords: { word: string; reason: string; entryId: string }[] = glossary.flatMap(
  (entry) =>
    (entry.arRejected ?? []).map((r) => ({ word: r.word, reason: r.reason, entryId: entry.id })),
);

describe('arabic staleness', () => {
  if (pairs.length === 0) {
    it.skip('no Arabic articles yet', () => {});
    return;
  }

  it.each(pairs.map((p) => [p.slug, p] as const))(
    '%s: translatedFrom ≥ English updated',
    (_, { slug, arSource, enSource }) => {
      const translatedFrom = extractDate(arSource, 'translatedFrom');
      const enUpdated = extractDate(enSource, 'updated');

      expect(translatedFrom, `${slug}/index.ar.mdx missing translatedFrom`).not.toBeNull();
      expect(enUpdated, `${slug}/index.mdx missing updated`).not.toBeNull();

      if (translatedFrom && enUpdated) {
        expect(
          translatedFrom.getTime(),
          `${slug}: translatedFrom (${translatedFrom.toISOString()}) is earlier than English updated (${enUpdated.toISOString()}). The translation may be stale.`,
        ).toBeGreaterThanOrEqual(enUpdated.getTime());
      }
    },
  );
});

describe('arabic rejected terms', () => {
  if (pairs.length === 0 || rejectedWords.length === 0) {
    it.skip('no Arabic articles or no rejected terms defined yet', () => {});
    return;
  }

  it.each(pairs.map((p) => [p.slug, p] as const))(
    '%s: no rejected terms in Arabic prose',
    (_, { slug, arSource }) => {
      // Strip frontmatter and import lines before checking prose.
      const prose = arSource.replace(/^---[\s\S]*?---\n/, '').replace(/^import .+\n/gm, '');

      for (const { word, reason, entryId } of rejectedWords) {
        expect(
          prose.includes(word),
          `${slug}: found rejected term "${word}" (glossary entry "${entryId}": ${reason})`,
        ).toBe(false);
      }
    },
  );
});
