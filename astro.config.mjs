// @ts-check
import { defineConfig } from 'astro/config';
import remarkWikilinks from './plugins/remark-wikilinks.mjs';

export default defineConfig({
  site: 'https://ariana.md',
  markdown: {
    remarkPlugins: [remarkWikilinks],
  },
});
