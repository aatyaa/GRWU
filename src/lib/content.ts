import { getCollection, type CollectionEntry } from 'astro:content';
import { TRACKS } from '../content.config';

export type Article = CollectionEntry<'articles'>;
/** An article of the access-gated ringdown track (ADR 0007). */
export type RingdownArticle = CollectionEntry<'ringdown'>;

export function isVisible(article: Article | RingdownArticle): boolean {
  return article.data.status !== 'draft' || import.meta.env.DEV || __SHOW_DRAFTS__;
}

/** Visible articles in curriculum order (track, then position in track). */
export async function getArticles(): Promise<Article[]> {
  const all = await getCollection('articles', isVisible);
  return all.sort(
    (a, b) =>
      TRACKS.indexOf(a.data.track) - TRACKS.indexOf(b.data.track) || a.data.order - b.data.order,
  );
}

/** The ringdown track in reading order; empty when the private repository is not cloned. */
export async function getRingdownArticles(): Promise<RingdownArticle[]> {
  const all = await getCollection('ringdown', isVisible);
  return all.sort((a, b) => a.data.order - b.data.order);
}
