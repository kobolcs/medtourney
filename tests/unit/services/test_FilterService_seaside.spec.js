/**
 * Unit tests for FilterService's Seaside rule, against the compiled real module:
 * seaside = geocoder coast flag (<= 10 km of the Med / Iberian Atlantic coast)
 * OR a listed coastal town in the location text.
 */

const { loadProductionModule } = require('../../helpers/production');
const { FilterService } = loadProductionModule('services/FilterService.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`✅ ${name}`); passed++; } catch (e) { console.log(`❌ ${name}\n   ${e.message}`); failed++; }
}
function assertEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

const towns = new Set(['benidorm', 'nice', 'rome', 'roma', 'bar', 'crete']);
const t = (location, extra = {}) => ({ name: 'X Open', location, category: 'Open', date: new Date(), url: 'u', description: '', ...extra });
const fs = new FilterService();

console.log('\n🧪 FilterService seaside rule\n' + '='.repeat(60));

test('a listed coastal town counts', () => assertEqual(fs.isSeaside(t('Benidorm, ESP'), towns), true, 'benidorm'));
test('the geocoder coast flag counts without a listed town', () => assertEqual(fs.isSeaside(t('Matosinhos, POR', { lat: 41.18, lng: -8.69, coast: 'atlantic' }), towns), true, 'matosinhos'));
test('neither -> not seaside', () => assertEqual(fs.isSeaside(t('Madrid, ESP'), towns), false, 'madrid'));

test('coordinates decide: a listed town that is inland is not seaside (Rome)', () => {
    assertEqual(fs.isSeaside(t('ROMA, ITA', { lat: 41.893, lng: 12.483 }), towns), false, 'roma');
});

test('coordinates decide: "Chillout Bar" in Slovakia is not Bar, Montenegro', () => {
    assertEqual(fs.isSeaside(t('Chillout Bar, SVK', { lat: 48.308, lng: 18.084 }), towns), false, 'bar');
});

test('unplaced: the town list never matches text in brackets ("Tivoli (Rome)")', () => {
    assertEqual(fs.isSeaside(t('Tivoli (Rome), ITA'), towns), false, 'tivoli');
});

test('unplaced: a listed coastal town still counts ("Hersonissos Crete")', () => {
    assertEqual(fs.isSeaside(t('Hotel Royal Belvedere | Hersonissos Crete, GRE'), towns), true, 'crete');
});

test('Atlantic seaside is tagged Seaside but not Mediterranean', () => {
    const tags = fs.annotate(t('Matosinhos, POR', { lat: 41.18, lng: -8.69, coast: 'atlantic' }), towns).travelTags;
    assertEqual(tags.includes('Seaside'), true, 'Seaside');
    assertEqual(tags.includes('Mediterranean'), false, 'Mediterranean');
});

test('Mediterranean seaside gets both tags', () => {
    const tags = fs.annotate(t('Hotel X, ESP', { lat: 38.54, lng: -0.13, coast: 'med' }), towns).travelTags;
    assertEqual(tags.includes('Mediterranean') && tags.includes('Seaside'), true, 'both');
});

// --- Tournament of the Week (pickFeatured) -------------------------------
const day = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const trip = (name, startIn, days, extra = {}) => {
    const start = new Date(Date.now() + startIn * day);
    start.setUTCHours(0, 0, 0, 0);
    return {
        name, location: 'Calvià (Mallorca), ESP', lat: 39.57, lng: 2.51, coast: 'med',
        category: 'Rapid, Open', url: `u-${name}`, description: '',
        date: start, dateTo: iso(start.getTime() + (days - 1) * day), ...extra,
    };
};

test('Tournament of the Week: a 7-week club championship is not a trip', () => {
    const club = trip('Campionato circolo Scacchistico fase 1', 2, 50, { category: 'Classical, Open' });
    assertEqual(fs.pickFeatured([club], towns), null, 'club');
});

test('Tournament of the Week: closed (non-Open) and team events are skipped', () => {
    const closed = trip('75th National Championship', 2, 9, { category: 'Classical' });
    const team = trip('Copa por Equipos 2026', 3, 9);
    assertEqual(fs.pickFeatured([closed, team], towns), null, 'closed/team');
});

test('Tournament of the Week: an Open seaside event of 5-16 days is picked', () => {
    const open = trip('XXIII Calvia Amateur Open', 5, 9);
    assertEqual(fs.pickFeatured([open, trip('Too short', 1, 3)], towns).name, 'XXIII Calvia Amateur Open', 'open');
});

test('Tournament of the Week: beachfront beats an earlier start', () => {
    const early = trip('Early Open', 2, 7);
    const beach = trip('Beach Open', 10, 7, { seaM: 120 });
    assertEqual(fs.pickFeatured([early, beach], towns).name, 'Beach Open', 'beach');
});

console.log('='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
process.exit(failed > 0 ? 1 : 0);
