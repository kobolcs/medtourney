/**
 * Tournament detail panel content (src/utils/detailPanel.ts, real code from
 * dist-test/): dates, map links, and the panel HTML built from a tournament.
 * Opening/closing the <dialog> is tested in Playwright (detail-panel.spec.ts).
 */
const { JSDOM } = require('jsdom');
const { loadProductionModule } = require('../../helpers/production');
const { detailDates, mapLinks, detailPanelHTML } = loadProductionModule('utils/detailPanel.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`✅ ${name}`); passed++; } catch (e) { console.log(`❌ ${name}\n   Error: ${e.message}`); failed++; }
}
function assertEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}
function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

const base = {
    name: 'Nice Open', location: 'Palais des Congrès, FRA', town: 'Nice', category: 'Open, Classical',
    description: 'Nice Open', url: 'https://chess-results.com/tnr1.aspx?lan=1',
    date: new Date(2026, 9, 2), dateTo: '2026-10-11', timeControl: '90 minutes + 30 second increment from move 1',
    lat: 43.7, lng: 7.26, coast: 'med', seaM: 120,
    airport: { iata: 'NCE', name: "Nice-Côte d'Azur Airport", km: 6, city: 'Nice' },
};
// escapeHTML() (used by the builder) needs a document
const page = new JSDOM('<!DOCTYPE html><body></body>');
global.document = page.window.document;
global.window = page.window;
const dom = html => new JSDOM(`<div>${html}</div>`).window.document;
const row = (doc, label) => [...doc.querySelectorAll('.detail-row')].find(r => r.querySelector('dt').textContent === label);
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const val = (doc, label) => text(row(doc, label).querySelector('dd'));

console.log('\n🧪 Detail panel content\n' + '='.repeat(60));

test('dates: weekday range and length; one-day events', () => {
    assertEqual(detailDates(base), 'Fri, 2 Oct 2026 – Sun, 11 Oct 2026 · 10 days');
    assertEqual(detailDates({ ...base, dateTo: undefined }), 'Fri, 2 Oct 2026 · 1 day');
    assertEqual(detailDates({ ...base, dateTo: 'soon' }), 'Fri, 2 Oct 2026 · 1 day', 'bad end date');
});

test('map links: exact spot when placed, a search for the venue otherwise', () => {
    const placed = mapLinks(base);
    assertEqual(placed.google, 'https://www.google.com/maps/search/?api=1&query=43.7,7.26');
    assert(placed.osm.includes('mlat=43.7&mlon=7.26'), placed.osm);
    const unplaced = mapLinks({ ...base, lat: undefined, lng: undefined });
    assertEqual(unplaced.google, 'https://www.google.com/maps/search/?api=1&query=Palais%20des%20Congr%C3%A8s%2C%20FRA');
});

test('panel: every section from the data', () => {
    const doc = dom(detailPanelHTML(base, false));
    assertEqual(doc.querySelector('#detailTitle').textContent, 'Nice Open');
    assert(val(doc, 'When').includes('10 days'), 'when');
    assert(val(doc, 'Where').includes('Palais des Congrès'), 'venue text under the town');
    assertEqual(row(doc, 'Where').querySelectorAll('a[target="_blank"]').length, 2, 'two map links');
    assertEqual(val(doc, 'Seaside'), 'Mediterranean coast · 🏖 venue about 120 m from the sea');
    assert(val(doc, 'Nearest airport').startsWith("Nice-Côte d'Azur Airport (NCE), Nice – about 6 km"), 'airport');
    assert(val(doc, 'Time control').startsWith('90+30 · 90 minutes'), val(doc, 'Time control'));
    assertEqual([...row(doc, 'Category').querySelectorAll('.category-tag')].map(text), ['Open', 'Classical']);
});

test('panel: actions and the chess-results link', () => {
    const doc = dom(detailPanelHTML(base, true));
    const star = doc.querySelector('.shortlist-btn');
    assertEqual(star.getAttribute('aria-pressed'), 'true');
    assertEqual(text(star), '★ Shortlist');
    assertEqual(doc.querySelector('.calendar-export-btn').dataset.tournamentUrl, base.url);
    assertEqual(doc.querySelector('.copy-link-btn').dataset.tournamentUrl, base.url);
    const cr = doc.querySelector('.detail-cr-link');
    assertEqual(cr.getAttribute('href'), base.url);
    assert(text(cr).startsWith('Registration, players, pairings and results on chess-results.com'), text(cr));
});

test('panel: rows without data are left out; no airport within 150 km is said', () => {
    const minimal = { ...base, coast: undefined, seaM: undefined, airport: undefined, timeControl: '', town: undefined };
    const doc = dom(detailPanelHTML(minimal, false));
    assertEqual(row(doc, 'Seaside'), undefined);
    assertEqual(row(doc, 'Time control'), undefined);
    assertEqual(val(doc, 'Nearest airport'), 'None with airline flights within 150 km');
    const unplaced = dom(detailPanelHTML({ ...minimal, lat: undefined, lng: undefined }, false));
    assertEqual(row(unplaced, 'Nearest airport'), undefined, 'unknown when not placed');
});

test('panel: names and URLs are escaped', () => {
    const doc = dom(detailPanelHTML({ ...base, name: '<img src=x onerror=alert(1)>', url: 'https://x/?a="onmouseover="alert(1)' }, false));
    assertEqual(doc.querySelectorAll('[onerror],[onmouseover]').length, 0);
    assertEqual(doc.querySelector('#detailTitle').textContent, '<img src=x onerror=alert(1)>');
});

console.log('='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total\n`);
process.exit(failed === 0 ? 0 : 1);
