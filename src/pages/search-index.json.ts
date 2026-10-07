import type { APIRoute } from 'astro';
import { getAllArticles } from '../lib/articles';

// Strips the Markdown syntax that would otherwise show up in search text.
function plainText(md: string): string {
  return md
    .replace(/\[\[([^[\]|]+?)(?:\|([^[\]]+?))?\]\]/g, (_, target, label) => label ?? target)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const GET: APIRoute = async () => {
  const articles = await getAllArticles();
  const docs = articles.map((a) => ({
    id: a.id,
    title: a.data.title,
    aliases: a.data.aliases.join(' '),
    description: a.data.description,
    category: a.data.category,
    url: `/${a.data.category}/${a.id}/`,
    text: plainText(a.body ?? ''),
  }));
  return new Response(JSON.stringify(docs), {
    headers: { 'Content-Type': 'application/json' },
  });
};
