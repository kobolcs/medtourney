/**
 * Seas: src/utils/seas.ts (the Seaside rule per sea), the sea picker
 * (src/utils/seaPicker.ts, against the real index.html), FilterService's use
 * of the picked seas and card badges, and the ?sea= URL parameter.
 * Real code from dist-test/.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { loadProductionModule } = require('../../helpers/production');
const seas = loadProductionModule('utils/seas.js');
const picker = loadProductionModule('utils/seaPicker.js');
const { FilterService } = loadProductionModule('services/FilterService.js');
const { filterStateToSearchParams, filterStateFromSearchParams } = loadProductionModule('utils/filterUrl.js');

const INDEX_HTML = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'index.html'), 'utf8');

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

const towns = new Set(['benidorm', 'nice']);
const t = (name, location, extra = {}) => ({
    name, location, category: 'Open, Classical', date: new Date(Date.now() + 30 * 86400000), url: `https://x/${name}`, description: '', ...extra
});
const placed = (name, fed, coast) => t(name, `${name}, ${fed}`, { lat: 1, lng: 1, ...(coast ? { coast } : {}) });
const TOURNAMENTS = [
    placed('Nice', 'FRA', 'med'),
    placed('Biarritz', 'FRA', 'atlantic'),
    placed('Varna', 'BUL', 'black'),
    placed('Baku', 'AZE', 'caspian'),
    placed('Madrid', 'ESP'),
    t('Benidorm', 'Benidorm, ESP'), // unplaced, listed town -> Mediterranean
];
const baseState = {
    openOnly: false, excludeYouth: false, mediterraneanOnly: true, seniorCategory: false, womenOnly: false,
    includeTeamTournaments: true, classicalTime: true, rapidTime: true, blitzTime: true,
    startDate: null, endDate: null, countryFilter: [], minDays: 0, seniorS60: false, youthCategory: '', ratingCategory: ''
};
const names = list => list.map(x => x.name).sort();

console.log('\n🧪 Seas: rule, picker, filter, badges, URL\n' + '='.repeat(60));

test('seaOf: the geocoded sea; an unplaced listed town is Mediterranean', () => {
    assertEqual(TOURNAMENTS.map(x => seas.seaOf(x, towns)), ['med', 'atlantic', 'black', 'caspian', null, 'med']);
});

test('isSeaside: any sea by default, only the given seas otherwise', () => {
    assertEqual(TOURNAMENTS.filter(x => seas.isSeaside(x, towns)).length, 5, 'all four seas');
    assertEqual(names(TOURNAMENTS.filter(x => seas.isSeaside(x, towns, ['black', 'caspian']))), ['Baku', 'Varna']);
});

test('parseSeas / isDefaultSeas', () => {
    assertEqual(seas.parseSeas('black,bogus,med'), ['med', 'black'], 'SEAS order, unknown dropped');
    assertEqual(seas.isDefaultSeas(['atlantic', 'med']), true);
    assertEqual(seas.isDefaultSeas(['med']), false);
});

test('Seaside mode without a sea choice = Mediterranean + Atlantic (as before)', () => {
    const result = new FilterService().filterTournaments(TOURNAMENTS, baseState, towns);
    assertEqual(names(result), ['Benidorm', 'Biarritz', 'Nice']);
});

test('Seaside mode with picked seas; the cache key includes them', () => {
    const service = new FilterService();
    assertEqual(names(service.filterTournaments(TOURNAMENTS, { ...baseState, seas: ['black'] }, towns)), ['Varna']);
    assertEqual(names(service.filterTournaments(TOURNAMENTS, { ...baseState, seas: ['caspian'] }, towns)), ['Baku']);
});

test('Card badges: the sea plus "Seaside"', () => {
    const tags = x => new FilterService().annotate(x, towns).travelTags.filter(tag => tag !== 'Classical' && tag !== 'Rapid');
    assertEqual(tags(TOURNAMENTS[0]), ['Mediterranean', 'Seaside']);
    assertEqual(tags(TOURNAMENTS[1]), ['Atlantic', 'Seaside']);
    assertEqual(tags(TOURNAMENTS[2]), ['Black Sea', 'Seaside']);
    assertEqual(tags(TOURNAMENTS[3]), ['Caspian', 'Seaside']);
    assertEqual(tags(TOURNAMENTS[4]), []);
});

test('URL: ?sea= only when Seaside is on and the seas are not the default', () => {
    assertEqual(filterStateToSearchParams({ ...baseState, seas: ['med', 'atlantic'] }).get('sea'), null);
    assertEqual(filterStateToSearchParams({ ...baseState, mediterraneanOnly: false, seas: ['black'] }).get('sea'), null);
    const params = filterStateToSearchParams({ ...baseState, seas: ['med', 'black'] });
    assertEqual(params.get('sea'), 'med,black');
    assertEqual(filterStateFromSearchParams(params).seas, ['med', 'black']);
    assertEqual(filterStateFromSearchParams(new URLSearchParams('sea=bogus')).seas, undefined, 'unknown seas ignored');
});

test('Picker (real index.html): defaults, set, hidden outside Seaside', () => {
    const doc = new JSDOM(INDEX_HTML).window.document;
    assertEqual(picker.checkedSeas(doc), ['med', 'atlantic'], 'defaults');
    picker.setCheckedSeas(['caspian', 'black', 'nope'], doc);
    assertEqual(picker.checkedSeas(doc), ['black', 'caspian']);
    assertEqual(doc.getElementById('seaPicker').hidden, true, 'hidden by default');
    picker.syncSeaPicker(true, doc);
    assertEqual(doc.getElementById('seaPicker').hidden, false, 'shown in Seaside mode');
});

test('Picker: changes call back; the last sea cannot be unticked', () => {
    const dom = new JSDOM(INDEX_HTML);
    const doc = dom.window.document;
    let changes = 0;
    picker.initSeaPicker(() => changes++, doc);
    const box = value => doc.querySelector(`#seaPicker input[value="${value}"]`);
    const toggle = value => { box(value).checked = !box(value).checked; box(value).dispatchEvent(new dom.window.Event('change')); };
    toggle('atlantic');
    assertEqual(changes, 1);
    toggle('med'); // the last one
    assertEqual(box('med').checked, true, 'still ticked');
    assertEqual(changes, 1, 'no change reported');
});

console.log('='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total\n`);
process.exit(failed === 0 ? 0 : 1);
