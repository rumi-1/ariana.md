// Remark plugin: turns [[Title]] and [[Title|shown text]] into links.
//
// A link to an existing article becomes a normal link with class "wikilink".
// A link to a missing article keeps its text, gets class "wikilink-missing",
// and is reported at build time so the gap can be filled.
import { visit } from 'unist-util-visit';
import { getWikiIndex, normalizeName, articleUrl } from '../src/lib/wiki-index.mjs';

const WIKILINK = /\[\[([^[\]|]+?)(?:\|([^[\]]+?))?\]\]/g;

export default function remarkWikilinks() {
  return (tree, file) => {
    const index = getWikiIndex();
    const source = file.path ? file.path.split('/').pop() : 'unknown';

    visit(tree, 'text', (node, idx, parent) => {
      if (!parent || idx === undefined || !node.value.includes('[[')) return;

      const parts = [];
      let last = 0;
      let match;
      WIKILINK.lastIndex = 0;

      while ((match = WIKILINK.exec(node.value)) !== null) {
        const [whole, target, label] = match;
        if (match.index > last) {
          parts.push({ type: 'text', value: node.value.slice(last, match.index) });
        }
        parts.push(linkFor(target.trim(), (label ?? target).trim(), index, source));
        last = match.index + whole.length;
      }

      if (parts.length === 0) return;
      if (last < node.value.length) {
        parts.push({ type: 'text', value: node.value.slice(last) });
      }
      parent.children.splice(idx, 1, ...parts);
      // Returning the index of the last inserted node lets visit() continue
      // past the new nodes instead of re-visiting them.
      return idx + parts.length;
    });
  };
}

function linkFor(target, text, index, source) {
  const hit = index.get(normalizeName(target));

  if (hit) {
    return {
      type: 'link',
      url: articleUrl(hit),
      title: null,
      data: { hProperties: { className: ['wikilink'] } },
      children: [{ type: 'text', value: text }],
    };
  }

  console.warn(`[wikilinks] ${source}: no article for [[${target}]]`);
  return {
    type: 'wikilinkMissing',
    data: {
      hName: 'span',
      hProperties: { className: ['wikilink', 'wikilink-missing'], title: 'No article yet' },
    },
    children: [{ type: 'text', value: text }],
  };
}
