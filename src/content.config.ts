import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORY_IDS } from './lib/categories';

// One collection for every article. The folder an article lives in does not
// matter; its `category` field decides where it is listed and where its URL goes.
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(CATEGORY_IDS),
    // Alternative names, transliterations, and spellings. Wiki-links resolve
    // against these as well as the title, so [[Aryana]] finds "Ariana".
    aliases: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    // stub: a placeholder with a few facts. draft: written but not reviewed.
    // published: reviewed and sourced.
    status: z.enum(['stub', 'draft', 'published']).default('stub'),
    featured: z.boolean().default(false),
    lastReviewed: z.coerce.date().optional(),
    // Marks a "grand page": a jumping-off point for a large topic (an ethnic group, a historical
    // region) rather than a self-contained article. Hub pages get a small badge in the sidebar;
    // their body is expected to lean on `facts` and on wiki-linked subdivisions more than prose.
    hub: z.boolean().default(false),
    // A short infobox: population, languages, religion, confederacies, whatever fits the
    // subject. Rendered as a key/value list at the top of the sidebar, above "Status".
    facts: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
        }),
      )
      .default([]),
    // Optional hero figure shown above the article body (map, portrait, landscape).
    image: z
      .object({
        src: z.string(),
        alt: z.string(),
        caption: z.string().optional(),
        credit: z.string().optional(),
      })
      .optional(),
    sources: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().url().optional(),
        }),
      )
      .default([]),
  }),
});

export const collections = { articles };
