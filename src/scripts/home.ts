// Homepage behaviour: subject tags, era tabs, the side panel, the regions table, and the d3 atlas.
// Logic follows the Ariana Home v3 handoff (map section rewritten against its later revision,
// which draws the Achaemenid satrapies instead of the earlier ellipse overlay). Seed data lives
// in lib/home-data.ts.
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import countries110 from 'world-atlas/countries-110m.json';
import { COUNT, ERAS, I18N, LABELS, NAMES, PILLARS, REG, REGIONS, S } from '../lib/home-data';

type Lang = 'en' | 'fa' | 'ps';
type Overlay = 'regions' | 'countries';
type Satrapy = (typeof REG)[number] & { px: [number, number][]; c: [number, number]; area: number; col: string };

const W = 900;
const H = 600;
const ERA_KEY = 'ariana.era';
const OVERLAY_KEY = 'ariana.overlay';

// Subject tags link to a category hub where one exists. Art has no hub yet, so it searches.
const PILLAR_LINKS = ['/history/', '/search/?q=art', '/culture/', '/languages/', '/genetics/'];

let lang: Lang = 'en';
let era = Number(readStored(ERA_KEY) ?? 2);
if (!Number.isInteger(era) || era < 0 || era >= ERAS.length) era = 2;
let selected: string | null = null;
let selRegion: string | null = null;
let overlay: Overlay = (readStored(OVERLAY_KEY) as Overlay) || 'regions';
let zoomT = d3.zoomIdentity;
let regions: Satrapy[] = [];

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
    // Blocked storage only means the choice is not remembered.
  }
}

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const dict = () => (lang === 'en' ? null : (I18N as Record<string, any>)[lang]);
const countryName = (name: string) => dict()?.countries?.[name] ?? name;
const ui = (key: string, fallback: string) => dict()?.[key] ?? fallback;

// Subject tags

function renderPillars() {
  const d = dict();
  $('#pillars').innerHTML = PILLARS.map(([name, count], i) => {
    const label = d ? d.pillars[i] : name;
    return `<a class="tag tag-outline" href="${PILLAR_LINKS[i]}">${label} · ${count}</a>`;
  }).join('');
}

// Era tabs

function renderEras() {
  $('#eras').innerHTML = ERAS.map(
    (e, i) =>
      `<span class="seg-opt ${i === era ? 'on' : ''}" role="tab" tabindex="0" aria-selected="${i === era}" data-i="${i}"><span class="d">${e.date}</span><span class="n">${e.name}</span></span>`,
  ).join('');
  document.querySelectorAll<HTMLElement>('#eras .seg-opt').forEach((o) => {
    const go = () => {
      era = Number(o.dataset.i);
      selected = null;
      writeStored(ERA_KEY, String(era));
      update();
    };
    o.addEventListener('click', go);
    o.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        go();
      }
    });
  });
}

// Side panel and column notes

function regionCard(): string {
  const r = regions.find((x) => x.n === selRegion);
  if (!r) return '';
  const name = lang === 'en' ? r.n : r.fa;
  return `<div class="card sitecard">
      <span class="card-kicker"><span class="swatch" style="background:${r.col}"></span>Historical region · c. 330 BCE</span>
      <span class="card-title" style="font-size:22px">${name}</span>
      <span class="card-body" style="font-size:14px;text-align:start">${r.d}</span>
      <span class="card-meta">Today: ${r.m}</span>
      <a class="btn btn-ghost" href="/search/?q=${encodeURIComponent(r.n)}">Read about ${r.n} →</a>
    </div>`;
}

function renderPanel() {
  const e = ERAS[era];
  const site = selected;
  const card = site
    ? `<div class="card sitecard">
        <span class="card-kicker">Site ${NAMES.indexOf(site) + 1} · ${S[site][2]}</span>
        <span class="card-title" style="font-size:22px">${site}</span>
        <span class="card-meta">${S[site][1].toFixed(2)}° N, ${S[site][0].toFixed(2)}° E · ${ERAS.filter((x) => x.sites.includes(site)).length} eras</span>
        <a class="btn btn-ghost" href="/search/?q=${encodeURIComponent(site)}">Read about ${site} →</a>
      </div>`
    : '';
  const siteRows = e.sites
    .map(
      (n) => `<button type="button" class="${n === site ? 'sel' : ''}" data-n="${n}">
        <span class="i">${NAMES.indexOf(n) + 1}</span>
        <span>${n}</span>
        <span class="t">${countryName(S[n][2])}</span>
      </button>`,
    )
    .join('');
  $('#panel').innerHTML = `
    <div><h2>${e.name}</h2><div class="date">${e.date}</div></div>
    <p>${e.blurb}</p>
    ${regionCard()}
    ${card}
    <div class="sitelist">
      <h6 style="color:var(--color-neutral-600);margin:6px 0 4px">${ui('sites', 'Sites')}</h6>
      ${siteRows}
    </div>
    <button type="button" class="btn btn-primary" style="margin-top:auto" id="openEra">${ui('open', 'Open this era')}</button>`;

  document.querySelectorAll<HTMLElement>('.sitelist button').forEach((b) => {
    const n = b.dataset.n!;
    b.addEventListener('click', () => pick(n));
    b.addEventListener('mouseenter', () => marker(n)?.style('stroke-width', '3'));
    b.addEventListener('mouseleave', () => marker(n)?.style('stroke-width', null));
  });
  $('#openEra').addEventListener('click', () => {
    window.location.href = `/search/?q=${encodeURIComponent(e.name)}`;
  });

  $('#cols').innerHTML = e.cols
    .map(
      ([k, t, d]) =>
        `<div><span class="card-kicker">${k}</span><span class="t">${t}</span><span class="d">${d}</span></div>`,
    )
    .join('');
  $('#slug').textContent = `atlas/${e.slug}.md`;
}

// Regions table (bottom of the page). Hovering a row highlights the matching satrapies on the map.

function renderRegions() {
  $('#regions').innerHTML = REGIONS.map(
    ([name, today, langs, count], i) =>
      `<tr data-i="${i}"><td class="rname">${name}</td><td class="hide-m">${today}</td><td class="hide-m" style="color:var(--color-neutral-700)">${langs}</td><td class="num">${count}</td></tr>`,
  ).join('');
  document.querySelectorAll<HTMLTableRowElement>('#regions tr').forEach((row) => {
    const idx = Number(row.dataset.i);
    row.addEventListener('mouseenter', () => highlightRegions(REGIONS[idx][4], row));
    row.addEventListener('mouseleave', () => highlightRegions([], null));
    row.addEventListener('click', () => scrollToAtlas());
  });
}

function highlightRegions(names: string[], row: HTMLTableRowElement | null) {
  document.querySelectorAll('#regions tr').forEach((r) => r.classList.toggle('hl', r === row));
  d3.selectAll<SVGPathElement, Satrapy>('.region').classed('hov', (d) => names.includes(d.n));
  d3.selectAll<SVGPathElement, Satrapy>('.rline').classed('sel', (d) => names.includes(d.n) || d.n === selRegion);
}

function scrollToAtlas() {
  const top = (document.getElementById('atlas')?.offsetTop ?? 0) - 20;
  window.scrollTo({ top, behavior: 'smooth' });
}

// Selection and era state

function pick(name: string) {
  selected = selected === name ? null : name;
  selRegion = null;
  if (selected && !ERAS[era].sites.includes(selected)) {
    const j = ERAS.findIndex((x) => x.sites.includes(selected!));
    if (j >= 0) {
      era = j;
      writeStored(ERA_KEY, String(era));
    }
  }
  update();
}

function selectRegion(name: string) {
  selRegion = selRegion === name ? null : name;
  selected = null;
  update();
}

function update() {
  renderEras();
  renderPanel();
  drawSites();
}

// The historical-regions / modern-countries toggle above the map.

function setOverlay(mode: Overlay) {
  overlay = mode;
  writeStored(OVERLAY_KEY, mode);
  document.querySelectorAll<HTMLElement>('#mode .seg-opt').forEach((o) => o.classList.toggle('on', o.dataset.m === mode));
  if (mode !== 'regions') selRegion = null;
  renderPanel();
  drawLabels();
  drawSites();
}

document.querySelectorAll<HTMLElement>('#mode .seg-opt').forEach((o) => {
  o.addEventListener('click', () => setOverlay(o.dataset.m as Overlay));
  o.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      setOverlay(o.dataset.m as Overlay);
    }
  });
});

// The atlas

let svgSel: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
let labelLayer: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
let regionFillLayer: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
let regionLineLayer: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
let siteLayer: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
const proj = d3
  .geoMercator()
  .fitExtent(
    [
      [0, 0],
      [W, H],
    ],
    // Wide enough to hold every satrapy, from Susiana in the west to Gandhara in the east.
    { type: 'MultiPoint', coordinates: [[47.5, 24.6], [76.5, 42]] } as any,
  );

const P = (lon: number, lat: number): [number, number] => {
  const p = proj([lon, lat])!;
  return zoomT.apply(p) as [number, number];
};

function marker(name: string) {
  return siteLayer?.select<SVGGElement>(`g.site[data-n="${name}"] circle`) ?? null;
}

function drawLabels() {
  if (!labelLayer) return;
  const useRegions = overlay === 'regions';
  regionFillLayer?.style('display', useRegions ? null : 'none');
  regionLineLayer?.style('display', useRegions ? null : 'none');

  type LabelDatum = { key: string; cls: string; x: number; y: number; text: string };
  const data: LabelDatum[] = useRegions
    ? regions.map((r) => {
        const [x, y] = zoomT.apply(r.c) as [number, number];
        return { key: `r${r.n}`, cls: 'rlabel', x, y, text: lang === 'en' ? r.n : r.fa };
      })
    : (Object.entries(LABELS) as [string, [number, number]][]).map(([n, ll]) => {
        const [x, y] = P(ll[0], ll[1]);
        return { key: `c${n}`, cls: 'clabel', x, y, text: countryName(n) };
      });

  labelLayer
    .selectAll<SVGTextElement, LabelDatum>('text')
    .data(data, (d) => d.key)
    .join('text')
    .attr('class', (d) => d.cls)
    .attr('text-anchor', 'middle')
    .attr('x', (d) => d.x)
    .attr('y', (d) => d.y)
    .text((d) => d.text);
}

function drawSites() {
  if (!siteLayer) return;
  regionFillLayer?.selectAll<SVGPathElement, Satrapy>('path').classed('sel', (d) => d.n === selRegion);
  regionLineLayer?.selectAll<SVGPathElement, Satrapy>('path').classed('sel', (d) => d.n === selRegion);

  const on = ERAS[era].sites;
  const sites = siteLayer
    .selectAll<SVGGElement, string>('g.site')
    .data(NAMES, (d) => d)
    .join((enter) => {
      const g = enter
        .append('g')
        .attr('class', 'site')
        .attr('data-n', (d) => d)
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', (d) => d);
      g.append('circle').attr('r', 12);
      g.append('text').text((d) => NAMES.indexOf(d) + 1);
      g.append('title').text((d) => d);
      return g;
    });

  sites
    .attr('transform', (d) => {
      const [x, y] = P(S[d][0], S[d][1]);
      return `translate(${x},${y})`;
    })
    .attr('class', (d) => `site ${on.includes(d) ? 'on' : 'off'}${d === selected ? ' sel' : ''}`)
    .on('click', (_ev, d) => pick(d))
    .on('keydown', (ev: KeyboardEvent, d) => {
      if (ev.key === 'Enter') pick(d);
    });
  sites.filter('.on').raise();
}

function drawMap() {
  const box = $('#map');
  const tip = $('#tip');
  const feats = (topojson.feature(countries110 as any, (countries110 as any).objects.countries) as any).features;
  const path = d3.geoPath(proj);
  const svg = d3.select<HTMLDivElement, unknown>(box).insert('svg', ':first-child')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid slice')
    .attr('role', 'img')
    .attr('aria-label', 'Map of the region, showing either the classical satrapies or modern borders');
  svgSel = svg as any;

  // Countries, the region fills, their boundary lines, and the Afghanistan outline all live in
  // one group, so they scale together as real geography on zoom.
  const mapLayer = svg.append('g');

  const inScope = Object.keys(COUNT);
  const countryLayer = mapLayer.append('g');
  countryLayer
    .selectAll('path')
    .data(feats)
    .join('path')
    .attr('class', (d: any) => `country${inScope.includes(d.properties.name) ? ' focus' : ''}`)
    .attr('d', path as any);

  // Region fills are clipped to the coastline so colour never spills into the sea.
  const defs = svg.append('defs');
  defs
    .append('clipPath')
    .attr('id', 'landclip')
    .append('path')
    .attr('d', path(topojson.merge(countries110 as any, (countries110 as any).objects.countries.geometries)) as any);

  const regionFills = mapLayer.append('g').attr('clip-path', 'url(#landclip)');
  const regionLines = mapLayer.append('g');
  regionFillLayer = regionFills as any;
  regionLineLayer = regionLines as any;

  // Each satrapy is a hand-placed ring of points, smoothed into an organic shape and inflated
  // 4% from its centroid so neighbouring regions read as touching rather than gapped. Colour is
  // derived from longitude, giving a west-to-east hue sweep rather than arbitrary colours.
  const curve = d3.line<[number, number]>().curve(d3.curveCatmullRomClosed.alpha(0.5));
  const lons = REG.map((r) => d3.mean(r.pts, (p) => p[0])!);
  const lo = d3.min(lons)!;
  const hi = d3.max(lons)!;
  regions = REG.map((r, i) => {
    const hull = r.pts.map((p) => proj(p as [number, number])!);
    const c = d3.polygonCentroid(hull as [number, number][]);
    const px = hull.map(([x, y]) => [c[0] + (x - c[0]) * 1.04, c[1] + (y - c[1]) * 1.04]) as [number, number][];
    const area = Math.abs(d3.polygonArea(px));
    const col = `oklch(0.72 0.15 ${Math.round(105 + ((lons[i] - lo) / (hi - lo)) * 195)})`;
    return { ...r, px, c: c as [number, number], area, col };
  });

  regionFills
    .selectAll('path')
    .data(regions)
    .join('path')
    .attr('class', 'region')
    .attr('d', (r) => curve(r.px))
    .style('fill', (r) => r.col);

  regionLines
    .selectAll('path')
    .data([...regions].sort((a, b) => b.area - a.area))
    .join('path')
    .attr('class', 'rline')
    .attr('d', (r) => curve(r.px))
    .on('mouseenter', (_ev, r) => regionFills.selectAll<SVGPathElement, Satrapy>('path').classed('hov', (d) => d === r))
    .on('mousemove', (ev: MouseEvent, r) => {
      const b = box.getBoundingClientRect();
      tip.innerHTML = `<b>${lang === 'en' ? r.n : r.fa}</b>${r.m}`;
      tip.style.opacity = '1';
      tip.style.left = `${ev.clientX - b.left + 14}px`;
      tip.style.top = `${ev.clientY - b.top + 14}px`;
    })
    .on('mouseleave', () => {
      tip.style.opacity = '0';
      regionFills.selectAll('path').classed('hov', false);
    })
    .on('click', (_ev, r) => selectRegion(r.n));

  const afg = feats.find((f: any) => f.properties.name === 'Afghanistan');
  if (afg) mapLayer.append('path').attr('class', 'afg').attr('d', path(afg));

  labelLayer = svg.append('g') as any;
  siteLayer = svg.append('g') as any;

  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 6])
    .translateExtent([
      [0, 0],
      [W, H],
    ])
    .on('zoom', (ev) => {
      zoomT = ev.transform;
      mapLayer.attr('transform', zoomT.toString());
      drawLabels();
      drawSites();
    });
  svg.call(zoom).on('dblclick.zoom', null);

  $('#zin').addEventListener('click', () => svg.transition().call(zoom.scaleBy, 1.6));
  $('#zout').addEventListener('click', () => svg.transition().call(zoom.scaleBy, 1 / 1.6));
  $('#zreset').addEventListener('click', () => svg.transition().call(zoom.transform, d3.zoomIdentity));

  $('#showG').addEventListener('click', () => {
    era = 2;
    selected = 'Taxila';
    writeStored(ERA_KEY, String(era));
    update();
    scrollToAtlas();
  });

  drawLabels();
  drawSites();
}

// Language changes re-render every string that depends on the language.
document.addEventListener('ariana:langchange', (e) => {
  lang = (e as CustomEvent<Lang>).detail;
  renderPillars();
  renderPanel();
  drawLabels();
});

renderPillars();
renderRegions();
update();
setOverlay(overlay);
drawMap();
