import { getCollection, type CollectionEntry } from 'astro:content';
import { TRACKS } from '../content.config';

export type Article = CollectionEntry<'articles'>;

export function isVisible(article: Article): boolean {
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
