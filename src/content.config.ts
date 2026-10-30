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

const articleLoader = (base: string, ar = false) =>
  glob({
    pattern: ar ? '*/index.ar.mdx' : '*/index.mdx',
    base,
    generateId: ({ entry }) => entry.replace(/\/index(?:\.ar)?\.mdx$/, ''),
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
 * Arabic versions of articles (ADR 0012). Files live alongside their English
 * originals as `index.ar.mdx`; the slug is identical to the English slug.
 * The collection is empty until Phase 3 of the translation plan.
 */
const articleSchemaAr = articleSchema.extend({
  /** The `updated` date of the English article this was translated from. */
  translatedFrom: z.coerce.date(),
  translators: z.array(z.string()).min(1),
  translationReviewers: z.array(z.string()).default([]),
  translationStatus: z.enum(['draft', 'review', 'published']).default('draft'),
});

const articlesAr = defineCollection({
  loader: articleLoader('./src/content/articles', true),
  schema: articleSchemaAr,
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
    // Arabic fields (ADR 0012, plan § 3.8). All optional until Phase 1.
    arName: z.string().optional(),
    arDefinition: z.string().optional(),
    arStatus: z.enum(['approved', 'proposed', 'arabized', 'keep-en']).optional(),
    arSource: z.enum(['alecso-physics', 'cairo-academy', 'textbooks', 'popular']).optional(),
    arRejected: z.array(z.object({ word: z.string(), reason: z.string() })).default([]),
    arDerivatives: z
      .object({
        verb: z.string().optional(),
        adjective: z.string().optional(),
        plural: z.string().optional(),
      })
      .optional(),
    arNote: z.string().optional(),
  }),
});

export const collections = { articles, articlesAr, ringdown, glossary };
