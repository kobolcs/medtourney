/**
 * Unit tests for utils/mapPlaces (grouping tournaments into map markers)
 */

const { loadProductionModule } = require('../../helpers/production');
const { groupByPlace, placeKind } = loadProductionModule('utils/mapPlaces.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (error) {
        console.log(`❌ ${name}\n   ${error.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, message) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${message}: expected ${e}, got ${a}`);
}

const t = (name, lat, lng, travelTags = []) => ({ name, lat, lng, travelTags, location: `${name}, AUT` });

console.log('\n🧪 mapPlaces\n' + '='.repeat(60));

test('tournaments at the same coordinates share one place', () => {
    const { places, unplaced } = groupByPlace([t('A', 47.07, 15.44), t('B', 47.07, 15.44), t('C', 48.2, 16.37)]);
    assertEqual(places.length, 2, 'places');
    assertEqual(places[0].tournaments.map(x => x.name), ['A', 'B'], 'grouped');
    assertEqual(unplaced, 0, 'unplaced');
});

test('tournaments without coordinates are counted as unplaced', () => {
    const { places, unplaced } = groupByPlace([t('A', 47.07, 15.44), { name: 'B', location: 'Pfarrheim, AUT' }]);
    assertEqual(places.length, 1, 'places');
    assertEqual(unplaced, 1, 'unplaced');
});

test('zero is a valid coordinate', () => {
    assertEqual(groupByPlace([t('Null Island', 0, 0)]).unplaced, 0, 'unplaced');
});

test('seaside beats senior for the marker colour', () => {
    const place = { lat: 0, lng: 0, tournaments: [t('A', 0, 0, ['Senior-friendly']), t('B', 0, 0, ['Mediterranean'])] };
    assertEqual(placeKind(place), 'sea', 'kind');
});

test('senior-only and plain places', () => {
    assertEqual(placeKind({ lat: 0, lng: 0, tournaments: [t('A', 0, 0, ['Senior-friendly'])] }), 'senior', 'senior');
    assertEqual(placeKind({ lat: 0, lng: 0, tournaments: [t('A', 0, 0)] }), 'plain', 'plain');
});

console.log('='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
process.exit(failed > 0 ? 1 : 0);
