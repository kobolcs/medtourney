const assert = require('node:assert/strict');
const cases = require('../../fixtures/entry-categories.json');
const { loadProductionModule } = require('../../helpers/production');
const { entryCategories, normalizeEntryCategory } = loadProductionModule('utils/entryCategories.js');
const { validateTournaments } = loadProductionModule('utils/validators.js');
const { FilterService } = loadProductionModule('services/FilterService.js');
for (const item of cases) {
  const { name, ...expected } = item;
  assert.deepEqual(entryCategories(name), expected, name);
}
const base = { name: 'OPEN C Under 1600', category: 'Open, Classical, Youth',
  location: 'London, ENG', date: '2026-11-01', description: '', url: 'https://chess-results.com/tnr1478650.aspx', timeControl: '90+30' };
const rows = validateTournaments([base, { ...base, name: 'Twickenham ChampionshipUnder 12', category: 'Classical, Youth' },
  { ...base, name: 'Open Sub1650', category: 'Classical, Open' },
  { ...base, name: 'Senior Championship 65+', category: 'Classical, S50+' }]).map(row => ({ ...row, date: new Date(row.date) }));
assert.equal(rows[0].category, 'Open, Classical, U1600');
assert.equal(normalizeEntryCategory({ name: 'Junior U1600 / U18', category: 'Youth' }), 'Youth, U18, U1600');
const defaults = { openOnly: false, excludeYouth: true, mediterraneanOnly: false, seniorCategory: false, seniorS60: false,
  womenOnly: false, includeTeamTournaments: false, classicalTime: true, rapidTime: false, blitzTime: false,
  startDate: null, endDate: null, countryFilter: [], minDays: 0, youthCategory: '', ratingCategory: '' };
const service = new FilterService();
const filter = changes => service.filterTournaments(rows, { ...defaults, ...changes }, new Set()).map(row => row.name);
assert.deepEqual(filter({ ratingCategory: 'U1600' }), [base.name]);
assert.deepEqual(filter({ ratingCategory: 'U1650' }), ['Open Sub1650']);
assert.deepEqual(filter({ ratingCategory: 'U1800' }), []);
assert.deepEqual(filter({ youthCategory: 'U12' }), ['Twickenham ChampionshipUnder 12']);
assert.deepEqual(filter({ seniorS60: true }), ['Senior Championship 65+']);
assert.deepEqual(filter({ seniorCategory: true }), []);
console.log(`${cases.length} shared classification cases and 9 ingestion/filter regressions passed`);
