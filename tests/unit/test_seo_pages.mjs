import assert from 'node:assert/strict';
import { buildSeoArtifacts } from '../../scripts/seo-pages.mjs';

const rows = [];
function add(name, category, date, coast) {
  rows.push({
    name, category, date, dateTo: date, coast,
    town: 'Nice', location: 'Nice, FRA', timeControl: '90+30',
    url: `https://chess-results.com/tnr${rows.length + 1}.aspx?lan=1`,
  });
}
for (let n = 0; n < 3; n++) {
  add(`Classical & Open ${n}`, 'Classical, Open', '2026-11-01');
  add(`Rapid ${n}`, 'Rapid', '2026-11-02');
  add(`Senior ${n}`, 'Classical, S50+', '2026-11-03');
  add(`Coastal ${n}`, 'Blitz', '2026-11-04', 'med');
}
add('Past classical', 'Classical', '2026-10-01');
add('Malformed', 'Classical', 'not-a-date');

const result = buildSeoArtifacts({
  tournaments: rows,
  generatedAt: '2026-10-04T04:43:43Z',
  basePath: '/medtourney/',
  now: new Date('2026-10-04T12:00:00Z'),
});

assert.equal(result.pages.length, 4, 'one generated page for each useful category');
assert.match(result.sitemap, /<lastmod>2026-10-04<\/lastmod>/);
assert.match(result.sitemap, /^.*<loc>https:\/\/kobolcs\.github\.io\/medtourney\/discover\/senior\/<\/loc>.*$/m);
assert.doesNotMatch(result.sitemap, /tournaments_data\.json|config\.json|github\.com/);

const classical = result.pages.find(page => page.path.includes('classical'));
assert.ok(classical);
assert.match(classical.html, /Classical &amp; Open 0/);
assert.match(classical.html, /href="\/medtourney\/\?tc=classical"/);
assert.match(classical.html, /href="\/medtourney\/\?t=https%3A%2F%2Fchess-results\.com%2Ftnr1\.aspx%3Flan%3D1"/);
assert.doesNotMatch(classical.html, /href="https:\/\/chess-results\.com/);
assert.doesNotMatch(classical.html, /Past classical|Malformed/);
assert.match(classical.html, /rel="canonical" href="https:\/\/kobolcs\.github\.io\/medtourney\/discover\/classical\//);

const rootBuild = buildSeoArtifacts({
  tournaments: rows,
  generatedAt: '2026-10-04T04:43:43Z',
  basePath: '/',
  canonicalBase: 'https://medtourney-private.example/',
  robots: 'noindex,nofollow',
  now: new Date('2026-10-04T12:00:00Z'),
});
assert.match(rootBuild.pages[0].html, /href="\/\?tc=classical"/);
assert.match(rootBuild.pages[0].html, /href="https:\/\/medtourney-private\.example\/discover\/classical\//);
assert.match(rootBuild.pages[0].html, /<meta name="robots" content="noindex,nofollow">/);

assert.throws(() => buildSeoArtifacts({ tournaments: [], generatedAt: '2026-10-04' }), /empty/);
assert.throws(() => buildSeoArtifacts({ tournaments: rows, generatedAt: 'invalid' }), /generatedAt/);
console.log('SEO page generation checks passed');
