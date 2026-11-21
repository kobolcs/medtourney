const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
global.document = new JSDOM('').window.document;
const { loadProductionModule } = require('../../helpers/production');
const { FilterService } = loadProductionModule('services/FilterService.js');
const { filterStateToSearchParams, filterStateFromSearchParams } = loadProductionModule('utils/filterUrl.js');
const { tournamentFormatHTML } = loadProductionModule('utils/tournamentSummary.js');
const defaults = { openOnly: false, excludeYouth: false, mediterraneanOnly: false,
  seniorCategory: false, seniorS60: false, womenOnly: false, includeTeamTournaments: true,
  classicalTime: true, rapidTime: true, blitzTime: true, startDate: null, endDate: null,
  countryFilter: [], minDays: 0, youthCategory: '', ratingCategory: '' };
const rows = ['Open', 'Women', 'Senior S50+', 'Senior S65+', 'Open U1600', 'Open U1800', 'Open U2200'].map(name => ({
  name, category: `Classical, ${name}`, location: 'Vienna, AUT', date: new Date('2026-11-01'),
  description: '', url: 'https://chess-results.com/tnr1.aspx'
}));
const service = new FilterService();
const filter = changes => service.filterTournaments(rows, { ...defaults, ...changes }, new Set()).map(row => row.name);
assert(!filter({ excludeWomen: true }).includes('Women'));
assert(filter({}).includes('Women'), 'exclusion cache must not leak');
assert(!filter({ excludeSeniors: true }).some(name => name.startsWith('Senior')));
assert(filter({ womenOnly: true }).includes('Women'));
assert(!filter({ ratingCategory: 'min:1800' }).includes('Open U1600'));
assert(filter({ ratingCategory: 'min:1800' }).includes('Open U1800'));
assert(filter({ ratingCategory: 'min:1800' }).includes('Open'), 'unknown ceilings stay visible');
assert.deepEqual(filter({ ratingCategory: 'U1600' }), ['Open U1600']);
const state = { ...defaults, excludeWomen: true, excludeSeniors: true, ratingCategory: 'min:1800' };
const restored = filterStateFromSearchParams(filterStateToSearchParams(state));
assert.equal(restored.excludeWomen, true);
assert.equal(restored.excludeSeniors, true);
assert.equal(restored.ratingCategory, 'min:1800');
assert.match(tournamentFormatHTML(rows[0]), /FIDE rating unconfirmed/);
assert.match(tournamentFormatHTML({ ...rows[0], details: { rated: ['Rating international'] } }), /FIDE-rated/);
assert.match(tournamentFormatHTML({ ...rows[0], details: { rated: ['Rating national'] } }), /unconfirmed/);
console.log('14 player-feedback regression checks passed');
