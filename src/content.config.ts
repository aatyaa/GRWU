import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** Curriculum tracks, in reading order. Mirrors the GW Open Data Workshop sequence. */
export const TRACKS = [
  'foundations',
  'orientation',
  'signals-and-data',
  'signal-processing',
  'detection',
  'inference',
  'frontiers',
  'capstone',
  'ringdown',
] as const;

const articleLoader = (base: string) =>
  glob({
    pattern: '*/index.mdx',
    base,
    generateId: ({ entry }) => entry.replace(/\/index\.mdx$/, ''),
  });

const articleSchema = z.object({
  title: z.string(),
  /** A word of the title set in italic amber, as in "The Shape of *Error*". */
  emphasis: z.string().optional(),
  /** The question the article opens with, shown as its headline. Defaults to the title. */
  headline: z.string().optional(),
  /** Mono line above the headline, e.g. "A story in five acts". */
  eyebrow: z.string().optional(),
  /** Mono line under the lead, e.g. "1801 — today · Gauss · Laplace · the interferometer". */
  byline: z.string().optional(),
  summary: z.string(),
  track: z.enum(TRACKS),
  /** Position inside its track. */
  order: z.number().int().nonnegative(),
  /** Drafts are hidden from production builds. */
  status: z.enum(['draft', 'review', 'published']).default('draft'),
  /** Matching GW Open Data Workshop tutorial, e.g. "3.2". */
  odw: z.string().optional(),
  /** Ids of articles a reader should finish first. */
  prerequisites: z.array(z.string()).default([]),
  objectives: z.array(z.string()).min(1),
  /** The reader the article is written for (ADR 0009). */
  level: z.enum(['beginner', 'core', 'advanced']).optional(),
  /** Article ids, or `ringdown/<slug>` chapters, this article prepares the reader for. */
  prepares: z.array(z.string()).default([]),
  /** Open-source work the article adapts (ADR 0009). */
  credits: z
    .array(
      z.object({
        project: z.string(),
        authors: z.string(),
        url: z.url(),
        license: z.string(),
      }),
    )
    .default([]),
  minutes: z.number().int().positive().optional(),
  updated: z.coerce.date(),
  /** Domain experts who reviewed the science. */
  reviewers: z.array(z.string()).default([]),
  sources: z.array(z.object({ title: z.string(), url: z.url() })).default([]),
});

const articles = defineCollection({
  loader: articleLoader('./src/content/articles'),
  schema: articleSchema,
});

/**
 * The access-gated ringdown track (ADR 0007). Its sources live in the private companion
 * repository, cloned at private/ and ignored by git; without it the collection is empty.
 */
const ringdown = defineCollection({
  loader: articleLoader('./private/track/articles'),
  schema: articleSchema,
});

/** Symbols and terms, defined once for every article (ADR 0009). */
const glossary = defineCollection({
  loader: file('./src/content/glossary.json'),
  schema: z.object({
    /** TeX, rendered with KaTeX. */
    symbol: z.string(),
    name: z.string(),
    definition: z.string(),
    /** Absent for concepts without a unit (a posterior, a mode's label). */
    unit: z.string().optional(),
  }),
});

export const collections = { articles, ringdown, glossary };
