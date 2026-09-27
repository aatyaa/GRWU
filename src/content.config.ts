import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** Curriculum tracks, in reading order. Mirrors the GW Open Data Workshop sequence. */
export const TRACKS = [
  'orientation',
  'signals-and-data',
  'signal-processing',
  'detection',
  'inference',
  'frontiers',
  'capstone',
] as const;

const articles = defineCollection({
  loader: glob({
    pattern: '*/index.mdx',
    base: './src/content/articles',
    generateId: ({ entry }) => entry.replace(/\/index\.mdx$/, ''),
  }),
  schema: z.object({
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
    minutes: z.number().int().positive().optional(),
    updated: z.coerce.date(),
    /** Domain experts who reviewed the science. */
    reviewers: z.array(z.string()).default([]),
    sources: z.array(z.object({ title: z.string(), url: z.url() })).default([]),
  }),
});

export const collections = { articles };
