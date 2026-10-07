# ariana.md

A wiki about Afghanistan, Khorasan, and the surrounding regions: their geography, history, peoples, languages, genetics, culture, and notable figures. Inspired by [taiwan-md](https://github.com/frank890417/taiwan-md).

## Getting started

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev       # local dev server
npm run build     # static site in dist/
npm run preview   # serve the built site
```

## Writing an article

Each article is a Markdown file in `src/content/articles/`. The filename becomes the URL slug, so `khorasan.md` lives at `/geography/khorasan/`.

```markdown
---
title: "Khorasan"
description: "One-sentence summary shown in listings and search."
category: geography        # geography | history | peoples | languages | genetics | culture | figures
aliases: ["Khurasan"]      # other names; wiki-links resolve against these too
tags: ["region"]
status: stub               # stub | draft | published
featured: false
lastReviewed: 2026-10-06   # optional
sources:
  - label: "Encyclopaedia Iranica"
    url: "https://www.iranicaonline.org/"
---

Body text starts here. Do not repeat the title as a heading; the page supplies it.

## First section

Link to other articles with [[Title]], or [[Title|different text]].
```

### Images

- **Hero figure:** add an `image` block to the frontmatter. It appears above the article body, with a caption and credit.

  ```yaml
  image:
    src: "/placeholders/map-khorasan.svg"
    alt: "Map of Khorasan"
    caption: "Khorasan and its major cities"
    credit: "Source and licence"
  ```

- **Inline:** use standard Markdown, `![alt](/path/to/file.jpg)`, followed by an italic caption line.
- Files live in `public/`. The current `public/placeholders/*.svg` are stand-ins to be replaced with sourced, licensed images.

Categories are defined in `src/lib/categories.ts`. The schema is in `src/content.config.ts`.

### Wiki-links

- `[[Khorasan]]` links to the article whose title, alias, or slug matches (case-insensitive).
- A link to an article that does not exist yet renders as red dashed text and prints a warning at build time. These warnings are a to-do list of missing articles.

### Backlinks

Each article's sidebar lists the articles that link to it under "Linked from".

## Project layout

```
astro.config.mjs            Astro config; registers the wiki-link plugin
plugins/remark-wikilinks.mjs  Turns [[links]] into anchors at build time
src/content/articles/       All articles (Markdown)
src/content.config.ts       Article schema
src/lib/categories.ts       Subject categories
src/lib/wiki-index.mjs      Name → article lookup, shared by links and backlinks
src/lib/articles.ts         Queries: by category, counts, backlinks
src/pages/                  Home, category hubs, articles, search, about
src/pages/search-index.json.ts  Build-time search index for MiniSearch
```

## Status

This is an early foundation. Several articles are stubs, and every claim should be checked against its listed sources before it is relied on. Not yet built: translations (Dari, Pashto, and others), right-to-left layout for those scripts, and a review workflow for moving articles from draft to published.
