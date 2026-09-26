/**
 * Weekly / season-long events (over FilterService.MAX_EVENT_DAYS) are hidden
 * by default - real FilterService + filterUrl from dist-test/.
 */
const { loadProductionModule } = require('../../helpers/production');
const { FilterService } = loadProductionModule('services/FilterService.js');
const { filterStateToSearchParams, filterStateFromSearchParams } = loadProductionModule('utils/filterUrl.js');

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

const start = new Date(Date.now() + 7 * 86400000);
const iso = days => new Date(start.getTime() + (days - 1) * 86400000).toISOString().slice(0, 10);
const t = (name, days) => ({ name, location: 'Praha, CZE', category: 'Classical', url: `https://x/${name}`, description: '', date: start, dateTo: iso(days) });
const list = [t('Weekend', 3), t('Festival', 9), t('Three weeks', 21), t('Club league', 162), t('Autumn open', 64)];
const base = {
    openOnly: true, excludeYouth: true, mediterraneanOnly: false, seniorCategory: false, womenOnly: false,
    includeTeamTournaments: false, classicalTime: true, rapidTime: true, blitzTime: true,
    startDate: null, endDate: null, countryFilter: [], minDays: 0, seniorS60: false, youthCategory: '', ratingCategory: ''
};
const names = s => new FilterService().filterTournaments(list, { ...base, ...s }, new Set()).map(x => x.name);

console.log('\n🧪 Weekly / season-long events\n' + '='.repeat(60));

test('hidden by default: up to 21 days shown', () => {
    assertEqual(FilterService.MAX_EVENT_DAYS, 21);
    assertEqual(names({}), ['Weekend', 'Festival', 'Three weeks']);
});

test('shown when asked for (and cached separately)', () => {
    assertEqual(names({ includeLongEvents: true }).length, 5);
});

test('URL: long=1 round-trips; absent by default', () => {
    assertEqual(filterStateToSearchParams({ ...base }).get('long'), null);
    const params = filterStateToSearchParams({ ...base, includeLongEvents: true });
    assertEqual(params.get('long'), '1');
    assertEqual(filterStateFromSearchParams(params).includeLongEvents, true);
});

console.log('='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total\n`);
process.exit(failed === 0 ? 0 : 1);
