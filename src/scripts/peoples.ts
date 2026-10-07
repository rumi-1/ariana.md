// The peoples atlas: a map of ethnolinguistic groups, a filterable legend, and a tabbed deep
// dive for the selected group. Ported from the Ariana Peoples handoff; theme and language use
// the site's shared chrome (site.ts) rather than a duplicate of their own.
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import countries50 from 'world-atlas/countries-50m.json';
import { BR, G, NORTH } from '../lib/peoples-data';

type Lang = 'en' | 'fa' | 'ps';
type Group = (typeof G)[number];

// Groups that already have a full stub article on the wiki, and the slug it lives at.
// Everything else in G is profiled only on this page for now.
const ARTICLE_SLUG: Record<string, string> = {
  pashtun: 'pashtuns',
  tajik: 'tajiks',
  hazara: 'hazaras',
  aimaq: 'aimaq',
  baloch: 'baloch',
  uzbek: 'uzbeks-afghanistan',
  turkmen: 'turkmen',
  nuristani: 'nuristanis',
  pashai: 'pashai',
};
// Only linked where the match is clean enough not to mislead (a dialect isn't its parent language).
const LANGUAGE_SLUG: Record<string, string> = { pashtun: 'pashto', tajik: 'dari' };

const W = 900;
const H = 675;
const TABS = ['Overview', 'Tribes & lineages', 'Origins', 'Language', 'Genetics', 'Culture'];
const byId: Record<string, Group> = Object.fromEntries(G.map((g) => [g.id, g]));

let lang: Lang = (document.documentElement.lang as Lang) || 'en';
let sel: string | null = readStored('ariana.people');
let br = 'All';
let q = '';
let tab = 0;
if (location.hash.length > 1 && byId[location.hash.slice(1)]) sel = location.hash.slice(1);
if (sel && !byId[sel]) sel = null;

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Blocked storage only means the selection is not remembered.
  }
}
function removeStored(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const name = (g: Group) => (lang === 'en' ? g.n : g.fa);

// Returns '' for a group-level match (name/language), the matched tribe/dialect string for a
// deeper match, or null for no match. Branch filtering is applied first.
function match(g: Group): string | null {
  if (br !== 'All' && g.br !== br) return null;
  if (!q) return '';
  const s = q.toLowerCase();
  if (g.n.toLowerCase().includes(s) || g.lang.toLowerCase().includes(s) || g.fa.includes(q)) return '';
  for (const [, members] of g.tr) for (const [t] of members) if (t.toLowerCase().includes(s)) return t;
  for (const d of g.dial) if (d.toLowerCase().includes(s)) return d;
  return null;
}

function renderBranches() {
  $('#branches').innerHTML = ['All', ...BR]
    .map((b) => `<span class="seg-opt ${b === br ? 'on' : ''}" data-b="${b}" role="radio" tabindex="0">${b}</span>`)
    .join('');
  document.querySelectorAll<HTMLElement>('#branches .seg-opt').forEach((o) => {
    const go = () => {
      br = o.dataset.b!;
      renderBranches();
      renderSide();
      paint();
    };
    o.addEventListener('click', go);
    o.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  });
}

function renderSide() {
  const g = sel ? byId[sel] : null;
  const summary = g
    ? `<div class="card summary">
        <span class="card-kicker" style="display:flex;align-items:center;gap:8px"><span class="sw" style="background:${g.col}"></span>${g.br} · ${g.sub}</span>
        <span class="card-title" style="font-size:30px">${name(g)}</span>
        <span class="card-meta">${g.pop} · ${g.lang}</span>
        <p>${g.ov[0]}</p>
        <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
          <button class="btn btn-primary" id="godive">Open deep dive ↓</button>
          <button class="btn btn-ghost" id="clear">All groups</button>
        </div>
      </div>`
    : '';
  const rows = BR.map((b) => {
    const gs = G.filter((x) => x.br === b);
    return (
      `<h6>${b}</h6>` +
      gs
        .map((x) => {
          const m = match(x);
          return `<button type="button" data-id="${x.id}" class="${x.id === sel ? 'sel' : ''} ${m === null ? 'dim' : ''}">
            <span class="sw" style="background:${x.col}"></span>
            <span>${name(x)}</span>
            <span class="p">${x.pop.replace('c. ', '')}</span>
            ${m ? `<span class="m">matches "${m}"</span>` : ''}
          </button>`;
        })
        .join('')
    );
  }).join('');
  $('#side').innerHTML = summary + `<div class="legend">${rows}</div>`;

  document.querySelectorAll<HTMLElement>('.legend button').forEach((b) => {
    const id = b.dataset.id!;
    b.addEventListener('click', () => pick(id));
    b.addEventListener('mouseenter', () => d3.select(`.eg[data-id="${id}"]`).classed('hov', true));
    b.addEventListener('mouseleave', () => d3.selectAll('.eg').classed('hov', false));
  });
  if (g) {
    $('#godive').addEventListener('click', () => window.scrollTo({ top: $('#dive').offsetTop - 12, behavior: 'smooth' }));
    $('#clear').addEventListener('click', () => pick(null));
  }
}

function tabBody(g: Group): string {
  if (tab === 0) {
    const photo = (g as any).photo as { src: string; alt: string; caption?: string; credit?: string } | undefined;
    const figure = photo
      ? `<figure style="margin-top:8px">
          <div class="plate"><img src="${photo.src}" alt="${photo.alt}" style="display:block;width:100%;height:auto" /></div>
          <figcaption>${[photo.caption, photo.credit].filter(Boolean).join(' — ')}</figcaption>
        </figure>`
      : `<figure style="margin-top:8px">
          <div class="plate"><div class="ph" style="height:300px">Plate — ${g.n}: landscape or community photograph (to be supplied)</div></div>
          <figcaption>Placeholder — credit and consent to be recorded when a real photograph is added.</figcaption>
        </figure>`;
    return `<div class="prose">${g.ov.map((p) => `<p>${p}</p>`).join('')}</div>${figure}`;
  }
  if (tab === 1) {
    return (
      `<div class="tribes">${g.tr
        .map(
          ([h, members]) =>
            `<div class="card"><span class="card-kicker">${h}</span><ul>${members
              .map(([t, r]) => `<li>${t}<span>${r}</span></li>`)
              .join('')}</ul></div>`,
        )
        .join('')}</div>` + (g.trNote ? `<p class="meta" style="font-size:13px;max-width:72ch">${g.trNote}</p>` : '')
    );
  }
  if (tab === 2) return `<div class="prose">${g.orig.map((p) => `<p>${p}</p>`).join('')}</div>`;
  if (tab === 3) {
    return `<div class="chain">${g.fam.map((f) => `<span>${f}</span>`).join('<i>›</i>')}</div>
      <div class="prose"><p>${g.langTxt}</p><h3>Dialects &amp; varieties</h3></div>
      <div class="taglist">${g.dial.map((d) => `<span class="tag tag-outline">${d}</span>`).join('')}</div>`;
  }
  if (tab === 4) {
    return `<div class="prose"><p>${g.gen}</p><h3>Reported Y-DNA haplogroups</h3></div>
      <div class="taglist">${g.hap.map((h) => `<span class="tag tag-outline" style="color:var(--color-accent-700);border-color:var(--color-accent);font-feature-settings:'tnum'">${h}</span>`).join('')}</div>
      <div class="caution">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12.5"/><circle cx="12" cy="16" r=".6" fill="currentColor"/></svg>
        <span>Genetic ancestry does not define ethnic identity. This summary reflects published population studies; samples are often small and individual results vary widely. See <a href="/genetics/genetic-history-of-afghanistan/">Genetic history of Afghanistan</a> for the limits of what this kind of study can show.</span>
      </div>`;
  }
  return `<div class="prose"><p>${g.cult}</p></div><div class="taglist">${g.ct.map((c) => `<span class="tag tag-outline">${c}</span>`).join('')}</div>`;
}

function relatedLinks(g: Group): string {
  const links: string[] = [];
  const langSlug = LANGUAGE_SLUG[g.id];
  if (langSlug) links.push(`<a href="/languages/${langSlug}/">${g.lang} language<span>read more →</span></a>`);
  links.push(`<a href="/search/?q=${encodeURIComponent(g.n)}">${g.n} across the wiki<span>search</span></a>`);
  links.push(`<a href="/genetics/genetic-history-of-afghanistan/">Ancestry studies, and their limits<span>genetics</span></a>`);
  return links.join('');
}

function renderDive() {
  const g = sel ? byId[sel] : null;
  const el = $('#dive');
  if (!g) {
    el.innerHTML = `<div class="sechead"><h2>Start with a people</h2><span class="meta">${G.length} entries</span></div>
      <div class="index">${G.filter((x) => match(x) !== null)
        .map(
          (x) =>
            `<button type="button" data-id="${x.id}"><span class="b">${x.br}</span><span class="t"><span class="sw" style="background:${x.col}"></span>${name(x)}</span><span class="d">${x.home}</span></button>`,
        )
        .join('')}</div>`;
    el.querySelectorAll<HTMLElement>('.index button').forEach((b) =>
      b.addEventListener('click', () => {
        pick(b.dataset.id!);
        window.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
      }),
    );
    return;
  }

  const slug = ARTICLE_SLUG[g.id];
  const entryLink = slug
    ? `<a class="btn btn-secondary" href="/peoples/${slug}/">Read the full entry</a>`
    : '';

  el.innerHTML = `
    <div class="sechead"><span class="meta">Deep dive</span><span class="meta">${slug ? `Also written up as a full entry` : 'Profiled only here so far'}</span></div>
    <div class="dive-head">
      <div><h6 style="color:var(--color-accent-700);margin:0;display:flex;align-items:center;gap:8px"><span class="sw" style="background:${g.col}"></span>${g.br} · ${g.sub}</h6><h2>${name(g)}</h2></div>
      <div style="display:flex;gap:8px">${entryLink}<a class="btn btn-ghost" href="#">Cite</a></div>
    </div>
    <div class="facts">
      <div><span class="k">Population (est.)</span><span class="v">${g.pop}</span></div>
      <div><span class="k">Homeland</span><span class="v">${g.home}</span></div>
      <div><span class="k">Language</span><span class="v">${g.lang}</span></div>
      <div><span class="k">Religion</span><span class="v">${g.rel}</span></div>
    </div>
    <div class="seg tabs" role="tablist">${TABS.map((t, i) => `<span class="seg-opt ${i === tab ? 'on' : ''}" role="tab" tabindex="0" data-t="${i}">${t}</span>`).join('')}</div>
    <div class="dive">
      <div>${tabBody(g)}</div>
      <aside class="diveside">
        <div><h6>Neighbouring peoples</h6><div class="nbs">${g.nb.map((id) => `<button type="button" data-id="${id}"><span class="sw" style="background:${byId[id].col}"></span>${name(byId[id])}</button>`).join('')}</div></div>
        <div class="rel"><h6>Related</h6>${relatedLinks(g)}</div>
        <div class="meta" style="line-height:1.6">Population figures are estimates; Afghanistan has had no full census since 1979. <a href="#">Report an error</a>.</div>
      </aside>
    </div>`;

  el.querySelectorAll<HTMLElement>('.tabs .seg-opt').forEach((o) => {
    const go = () => {
      tab = Number(o.dataset.t);
      renderDive();
    };
    o.addEventListener('click', go);
    o.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  });
  el.querySelectorAll<HTMLElement>('.nbs button').forEach((b) =>
    b.addEventListener('click', () => {
      pick(b.dataset.id!);
      window.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
    }),
  );
}

function pick(id: string | null) {
  if (id !== sel) tab = 0;
  sel = id;
  if (id) writeStored('ariana.people', id);
  else removeStored('ariana.people');
  history.replaceState(null, '', id ? `#${id}` : location.pathname + location.search);
  renderSide();
  renderDive();
  paint();
}

let mapReady = false;
function paint() {
  if (!mapReady) return;
  d3.select('#map svg').classed('picked', !!sel);
  d3.selectAll<SVGGElement, Group>('.eg').classed('sel', (d) => d.id === sel).classed('dim', (d) => match(d) === null);
  d3.selectAll<SVGTextElement, Group>('.glabel').classed('dim', (d) => match(d) === null);
  d3.selectAll('.eg.sel').raise();
}

$('#q').addEventListener('input', (e) => {
  q = (e.target as HTMLInputElement).value.trim();
  renderSide();
  renderDive();
  paint();
});

document.addEventListener('ariana:langchange', (e) => {
  lang = (e as CustomEvent<Lang>).detail;
  renderSide();
  renderDive();
  drawLabels();
});

renderBranches();
renderSide();
renderDive();

// The map

type Positioned = Group & { px: [number, number][][]; area: number; c: [number, number] };
let drawLabels = () => {};

(async () => {
  const box = $('#map');
  const tip = $('#tip');
  const topo = countries50 as any;
  const feats = topojson.feature(topo, topo.objects.countries).features as any[];
  const proj = d3
    .geoMercator()
    .fitExtent(
      [
        [0, 0],
        [W, H],
      ],
      { type: 'MultiPoint', coordinates: [[55.5, 24.2], [77, 42.8]] } as any,
    );
  const path = d3.geoPath(proj);
  const svg = d3.select<HTMLDivElement, unknown>(box).insert('svg', ':first-child')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid slice')
    .attr('role', 'img')
    .attr('aria-label', 'Map of ethnolinguistic groups between the Caspian and the Indus');
  const g = svg.append('g');
  const lg = svg.append('g');

  g.selectAll('path.country').data(feats).join('path').attr('class', 'country').attr('d', path as any);
  svg
    .append('defs')
    .append('clipPath')
    .attr('id', 'land')
    .append('path')
    .attr('d', path(topojson.merge(topo, topo.objects.countries.geometries)) as any);
  const eg = g.append('g').attr('clip-path', 'url(#land)');
  g.append('path')
    .attr('class', 'border')
    .attr('d', path(topojson.mesh(topo, topo.objects.countries, (a: any, b: any) => a !== b)) as any);

  const line = d3.line<[number, number]>().curve(d3.curveCatmullRomClosed.alpha(0.5));
  const positioned: Positioned[] = G.map((x) => {
    const px = x.rings.map((ring) => {
      const p = ring.map((q) => proj(q as [number, number])!);
      const c = d3.polygonCentroid(p as [number, number][]);
      const k = ring.length > 8 ? 1.07 : 1.14;
      return p.map(([a, b]) => [c[0] + (a - c[0]) * k, c[1] + (b - c[1]) * k]) as [number, number][];
    });
    const area = d3.sum(px, (r) => Math.abs(d3.polygonArea(r)));
    const c = d3.polygonCentroid(px[0]);
    return { ...x, px, area, c };
  });
  const byIdPositioned: Record<string, Positioned> = Object.fromEntries(positioned.map((x) => [x.id, x]));

  const show = (ev: MouseEvent, x: Positioned) => {
    const b = box.getBoundingClientRect();
    tip.innerHTML = `<b>${name(x)}</b>${x.br} · ${x.pop}`;
    tip.style.opacity = '1';
    tip.style.left = `${Math.min(ev.clientX - b.left + 14, b.width - 200)}px`;
    tip.style.top = `${ev.clientY - b.top + 14}px`;
  };

  eg.selectAll('g')
    .data([...positioned].sort((a, b) => b.area - a.area))
    .join('g')
    .attr('class', 'eg')
    .attr('data-id', (d) => d.id)
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', (d) => d.n)
    .on('mousemove', show)
    .on('mouseleave', () => (tip.style.opacity = '0'))
    .on('click', (_ev, d) => pick(sel === d.id ? null : d.id))
    .on('keydown', (ev: KeyboardEvent, d) => {
      if (ev.key === 'Enter') pick(d.id);
    })
    .selectAll('path')
    .data((d) => d.px)
    .join('path')
    .attr('d', (r) => line(r))
    .style('fill', function () {
      return (d3.select((this as SVGPathElement).parentNode as any).datum() as Positioned).col;
    });

  let t = d3.zoomIdentity;
  drawLabels = () => {
    lg.selectAll<SVGTextElement, Positioned>('text')
      .data(positioned, (d) => d.id)
      .join('text')
      .attr('class', (d) => 'glabel' + (d.area < 2500 ? ' sm' : ''))
      .style('display', (d) => (d.area * t.k * t.k < (NORTH.has(d.id) ? 9000 : 1500) && d.id !== sel ? 'none' : null))
      .text((d) => name(d).replace(' (Chitrali)', ''))
      .attr('x', (d) => t.apply(d.c)[0])
      .attr('y', (d) => t.apply(d.c)[1] + 4);
    paint();
  };

  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 6])
    .translateExtent([
      [0, 0],
      [W, H],
    ])
    .on('zoom', (ev) => {
      t = ev.transform;
      g.attr('transform', t.toString());
      drawLabels();
    });
  svg.call(zoom).on('dblclick.zoom', null);

  $('#zin').addEventListener('click', () => svg.transition().call(zoom.scaleBy, 1.6));
  $('#zout').addEventListener('click', () => svg.transition().call(zoom.scaleBy, 1 / 1.6));
  $('#zreset').addEventListener('click', () => svg.transition().call(zoom.transform, d3.zoomIdentity));

  mapReady = true;
  drawLabels();
})();
