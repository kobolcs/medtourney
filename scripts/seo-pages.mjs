import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const DEFAULT_PUBLIC_BASE = 'https://kobolcs.github.io/medtourney/';

const pages = [
  {
    slug: 'classical',
    title: 'Upcoming Classical Chess Tournaments in Europe',
    description: 'Browse upcoming European chess tournaments listed as Classical or Standard, with dates, venues, time controls and on-site event details.',
    heading: 'Classical chess tournaments in Europe',
    intro: 'Upcoming events whose tournament listing identifies the format as Classical or Standard. Check the official event page for the current regulations and entry details.',
    token: /^(classical|standard)$/i,
    params: 'tc=classical',
    filter: event => hasCategory(event, /^(classical|standard)$/i),
  },
  {
    slug: 'rapid',
    title: 'Upcoming Rapid Chess Tournaments in Europe',
    description: 'Browse upcoming European chess tournaments listed as Rapid, with dates, venues, time controls and on-site event details.',
    heading: 'Rapid chess tournaments in Europe',
    intro: 'Upcoming events whose tournament listing identifies the format as Rapid. Confirm the clock and event details on the official source before you travel.',
    token: /rapid/i,
    params: 'tc=rapid',
    filter: event => hasCategory(event, /^rapid$/i),
  },
  {
    slug: 'senior',
    title: 'Upcoming Senior Chess Tournaments in Europe',
    description: 'Find upcoming European chess events whose listings include a senior age category such as S50+ or S60+.',
    heading: 'Senior chess tournaments in Europe',
    intro: 'Events with a senior age label in the tournament listing. Age eligibility can vary by event; use the organizer page to confirm the exact rules.',
    token: /senior|s\d{2}\+/i,
    params: 'senior=1',
    filter: event => hasCategory(event, /^(?:senior|s\d{2}\+)$/i),
  },
  {
    slug: 'seaside',
    title: 'Seaside Chess Tournaments in Europe',
    description: 'Explore upcoming European chess tournaments at coastal locations identified by MedTourney mapping, with official source links for event details.',
    heading: 'Seaside chess tournaments in Europe',
    intro: 'These venues are tagged as coastal by MedTourney location data. The tag describes the venue area; it does not mean the playing hall is on the beach.',
    token: /coast/i,
    params: 'med=1',
    filter: event => Boolean(event.coast),
  },
];

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function hasCategory(event, pattern) {
  return String(event.category ?? '').split(',').some(token => pattern.test(token.trim()));
}

function dateValue(event) {
  const date = String(event.date ?? '');
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ? date : '';
}

function formatDate(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function eventHTML(event, basePath) {
  const date = dateValue(event);
  const dateLabel = event.dateTo && event.dateTo > date ? `${formatDate(date)} – ${formatDate(event.dateTo)}` : formatDate(date);
  const place = [event.town, event.location?.split(',').at(-1)?.trim()].filter(Boolean).join(', ');
  const control = event.timeControl ? ` · ${escapeHTML(event.timeControl)}` : '';
  const detailsUrl = `${basePath}?t=${encodeURIComponent(event.url)}`;
  return `<li><a href="${escapeHTML(detailsUrl)}">${escapeHTML(event.name)}</a><span>${escapeHTML(dateLabel)}${place ? ` · ${escapeHTML(place)}` : ''}${control}</span></li>`;
}

function pageHTML(definition, events, { basePath, canonicalBase, updated }) {
  const canonical = `${canonicalBase}discover/${definition.slug}/`;
  const filterUrl = `${basePath}?${definition.params}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHTML(definition.title)} | MedTourney</title>
  <meta name="description" content="${escapeHTML(definition.description)}">
  <link rel="canonical" href="${escapeHTML(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHTML(definition.title)} | MedTourney">
  <meta property="og:description" content="${escapeHTML(definition.description)}">
  <meta property="og:url" content="${escapeHTML(canonical)}">
  <meta name="robots" content="index,follow">
  <style>
    :root{color-scheme:light;--ink:#18252b;--muted:#52646a;--line:#d8e1df;--accent:#126d64;--paper:#f7f8f5;--white:#fff}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}main{width:min(900px,100% - 32px);margin:40px auto 72px}.brand{font-weight:750;color:var(--accent);text-decoration:none}.eyebrow{margin:38px 0 4px;color:var(--muted);font-size:.84rem;text-transform:uppercase;letter-spacing:.08em}h1{max-width:720px;margin:0;font-size:clamp(2rem,6vw,3.4rem);line-height:1.08;letter-spacing:-.04em}p{max-width:700px;color:var(--muted)}.intro{font-size:1.1rem}.meta{font-size:.9rem}.cta{display:inline-flex;align-items:center;min-height:48px;margin:14px 0 28px;padding:0 18px;border-radius:9px;background:var(--accent);color:#fff;font-weight:700;text-decoration:none}.cta:focus-visible,a:focus-visible{outline:3px solid #e39c30;outline-offset:3px}.events{padding:0;margin:18px 0 30px;list-style:none;border-top:1px solid var(--line)}.events li{padding:15px 0;border-bottom:1px solid var(--line)}.events li a{color:var(--accent);font-weight:700}.events li span{display:block;color:var(--muted);font-size:.93rem}.note{padding:14px 16px;border-left:3px solid #e39c30;background:#fff}.footer{margin-top:32px;font-size:.9rem}
    @media(max-width:600px){main{width:calc(100% - 28px);margin:24px auto 48px}.events li{padding:13px 0}}
  </style>
</head>
<body><main>
  <a class="brand" href="${escapeHTML(basePath)}">MedTourney</a>
  <p class="eyebrow">European chess events</p>
  <h1>${escapeHTML(definition.heading)}</h1>
  <p class="intro">${escapeHTML(definition.intro)}</p>
  <p class="meta">${events.length} upcoming listings · Data snapshot: ${escapeHTML(updated)}</p>
  <a class="cta" href="${escapeHTML(filterUrl)}">Open these filters in MedTourney →</a>
  <h2>Upcoming listings</h2>
  <ul class="events">${events.map(event => eventHTML(event, basePath)).join('\n')}</ul>
  <p class="note">Tournament details can change. Category and location labels help you find events; confirm eligibility, schedule, venue and entry rules with the organizer from the detail view.</p>
  <p class="footer"><a href="${escapeHTML(basePath)}">Search all European chess tournaments</a></p>
</main></body></html>`;
}

export function buildSeoArtifacts({ tournaments, generatedAt, basePath = '/medtourney/', canonicalBase = DEFAULT_PUBLIC_BASE, now = new Date() }) {
  if (!Array.isArray(tournaments) || !tournaments.length) throw new Error('Tournament snapshot is empty');
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('Tournament metadata has no valid generatedAt date');
  const base = `/${basePath.split('/').filter(Boolean).join('/')}${basePath.split('/').filter(Boolean).length ? '/' : ''}`;
  const canonical = canonicalBase.endsWith('/') ? canonicalBase : `${canonicalBase}/`;
  const cutoff = now.toISOString().slice(0, 10);
  const lastmod = generatedAt.slice(0, 10);
  const selected = pages.map(definition => {
    const events = tournaments
      .filter(event => event.url && event.name && dateValue(event) >= cutoff && definition.filter(event))
      .sort((a, b) => dateValue(a).localeCompare(dateValue(b)) || String(a.name).localeCompare(String(b.name)))
      .slice(0, 30);
    if (events.length < 3) return null;
    return { ...definition, events };
  }).filter(Boolean);
  const htmlPages = selected.map(definition => ({
    path: join('discover', definition.slug, 'index.html'),
    html: pageHTML(definition, definition.events, { basePath: base, canonicalBase: canonical, updated: lastmod }),
  }));
  const urls = [canonical, ...selected.map(page => `${canonical}discover/${page.slug}/`)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escapeHTML(url)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  return { pages: htmlPages, sitemap };
}

export async function generateSeoPages({ root = process.cwd(), basePath = process.env.MEDTOURNEY_BASE ?? '/medtourney/', canonicalBase = process.env.MEDTOURNEY_CANONICAL_BASE ?? DEFAULT_PUBLIC_BASE } = {}) {
  const tournaments = JSON.parse(await readFile(join(root, 'tournaments_data.json'), 'utf8'));
  const metadata = JSON.parse(await readFile(join(root, 'tournaments_data_meta.json'), 'utf8'));
  const artifacts = buildSeoArtifacts({ tournaments, generatedAt: metadata.generatedAt, basePath, canonicalBase });
  const dist = join(root, 'dist');
  for (const page of artifacts.pages) {
    const output = join(dist, page.path);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, page.html);
  }
  await writeFile(join(dist, 'sitemap.xml'), artifacts.sitemap);
  return artifacts.pages.map(page => page.path);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const generated = await generateSeoPages();
  console.log(`Generated ${generated.length} crawlable category pages and sitemap.xml`);
}
