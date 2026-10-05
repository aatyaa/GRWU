/**
 * The ringdown track as the public site knows it (ADR 0007): the teaser written by
 * scripts/seal-ringdown.mjs next to the sealed articles. Node only (build time).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SealedArticle {
  slug: string;
  title: string;
  headline?: string;
  summary: string;
  order: number;
  minutes?: number;
  status: string;
  updated: string;
}

export function sealedArticles(): SealedArticle[] {
  const file = join(process.cwd(), 'public', 'ringdown-sealed', 'manifest.json');
  if (!existsSync(file)) return [];
  return (JSON.parse(readFileSync(file, 'utf8')) as SealedArticle[]).sort(
    (a, b) => a.order - b.order,
  );
}

/**
 * Serve the sealed shells instead of the private sources. Always the case without the private
 * repository; with it, RINGDOWN_SEALED=1 shows what the public site will serve.
 */
export const sealedMode = process.env.RINGDOWN_SEALED === '1';

/**
 * Access requests go to a form service that emails the owner, so no address appears on the
 * site. The public access key identifies the owner's form on Web3Forms (it is meant to be
 * public); PUBLIC_ACCESS_FORM_KEY overrides it, and an empty value hides the form.
 */
export const requestFormKey =
  process.env.PUBLIC_ACCESS_FORM_KEY ?? '4c6b917b-e03e-48e6-9c6f-b443802a7425';
