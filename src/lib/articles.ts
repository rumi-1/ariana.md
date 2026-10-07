import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES, type CategoryId } from './categories';
import { getWikiIndex, normalizeName } from './wiki-index.mjs';

export type Article = CollectionEntry<'articles'>;

// Sorted by title so every listing reads in a stable, predictable order.
export async function getAllArticles(): Promise<Article[]> {
  const entries = await getCollection('articles');
  return entries.sort((a, b) => a.data.title.localeCompare(b.data.title));
}

export async function getArticlesIn(category: CategoryId): Promise<Article[]> {
  return (await getAllArticles()).filter((a) => a.data.category === category);
}

export async function getCategoryCounts(): Promise<Record<CategoryId, number>> {
  const all = await getAllArticles();
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<CategoryId, number>;
  for (const a of all) counts[a.data.category]++;
  return counts;
}

// Every [[link]] target in an article body, resolved to the slug it points at.
function linkedSlugs(body: string | undefined): Set<string> {
  const index = getWikiIndex();
  const slugs = new Set<string>();
  const re = /\[\[([^[\]|]+?)(?:\|[^[\]]+?)?\]\]/g;
  for (const match of (body ?? '').matchAll(re)) {
    const hit = index.get(normalizeName(match[1]));
    if (hit) slugs.add(hit.slug);
  }
  return slugs;
}

// Articles that link to the given one, excluding itself.
export async function getBacklinks(slug: string): Promise<Article[]> {
  const all = await getAllArticles();
  return all.filter((a) => a.id !== slug && linkedSlugs(a.body).has(slug));
}
