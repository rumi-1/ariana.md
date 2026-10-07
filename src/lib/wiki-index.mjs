// Builds a lookup table from every name an article can be linked by
// (its title, its aliases, and its slug) to the article itself.
// Used by the remark plugin that turns [[wiki-links]] into real links.
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import matter from 'gray-matter';

export const ARTICLES_DIR = join(process.cwd(), 'src/content/articles');

// Case-insensitive, whitespace-collapsed, Unicode-normalised. Lets
// [[ Khorasan ]] and [[khorasan]] resolve to the same article.
export function normalizeName(name) {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

let cache = null;

export function getWikiIndex() {
  if (cache) return cache;
  cache = new Map();

  for (const file of readdirSync(ARTICLES_DIR)) {
    if (!file.endsWith('.md') || file.startsWith('_')) continue;
    const slug = basename(file, '.md');
    const { data } = matter(readFileSync(join(ARTICLES_DIR, file), 'utf8'));
    const target = { slug, title: data.title, category: data.category };

    const names = [slug, data.title, ...(data.aliases ?? [])];
    for (const name of names) {
      const key = normalizeName(String(name));
      // The first article to claim a name keeps it, so an alias can never
      // silently steal another article's title.
      if (!cache.has(key)) cache.set(key, target);
    }
  }
  return cache;
}

export function articleUrl({ category, slug }) {
  return `/${category}/${slug}/`;
}
