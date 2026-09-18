/**
 * Integration tests for service composition.
 *
 * These tests exercise the REAL production `FilterService` and `ExportService`
 * (compiled to `dist-test/` via `npm run build:test`) working together. Only
 * the CacheManager/DataService are represented by small in-memory test doubles,
 * because those touch the DOM/network — the business logic under test
 * (filtering, sorting, CSV/ICS generation) is the genuine production code.
 *
 * Previously this file re-declared simplified fake FilterService/ExportService
 * classes, which tested nothing about production behavior.
 */

const { loadProductionModule } = require('../helpers/production');
const { FilterService } = loadProductionModule('services/FilterService.js');
const { ExportService } = loadProductionModule('services/ExportService.js');

// ---------------------------------------------------------------------------
// Lightweight in-memory test doubles for cache + data source
// ---------------------------------------------------------------------------
class InMemoryCache {
    constructor() { this.store = new Map(); }
    save(key, data) { this.store.set(key, data); }
    load(key) { return this.store.has(key) ? this.store.get(key) : null; }
}

const SAMPLE = [
    {
        name: 'Barcelona Open', location: 'Barcelona, ESP', date: new Date('2025-06-01'),
        category: 'Open, Classical', url: 'https://chess-results.com/tnr1.aspx', description: 'Barcelona Open',
    },
    {
        name: 'Madrid Classical', location: 'Madrid, ESP', date: new Date('2025-05-15'),
        category: 'Classical', url: 'https://chess-results.com/tnr2.aspx', description: 'Madrid Classical',
    },
    {
        name: 'Athens Rapid', location: 'Athens, GRE', date: new Date('2025-07-01'),
        category: 'Open, Rapid', url: 'https://chess-results.com/tnr3.aspx', description: 'Athens Rapid',
    },
];

class StubDataService {
    constructor(cache) { this.cache = cache; this.fetchCount = 0; }
    async fetchTournaments() {
        const cached = this.cache.load('tournaments');
        if (cached) return cached;
        this.fetchCount++;
        const data = SAMPLE.map(t => ({ ...t }));
        this.cache.save('tournaments', data);
        return data;
    }
}

// A complete default FilterState (matches production FilterState shape).
function filterState(overrides = {}) {
    return {
        openOnly: false,
        excludeYouth: false,
        mediterraneanOnly: false,
        seniorCategory: false,
        seniorS60: false,
        womenOnly: false,
        includeTeamTournaments: true,
        classicalTime: false,
        rapidTime: false,
        blitzTime: false,
        startDate: null,
        endDate: null,
        countryFilter: [],
        minDays: 0,
        youthCategory: '',
        ratingCategory: '',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
    }
}

function assertContains(str, substring, message) {
    if (!str.includes(substring)) {
        throw new Error(`${message || 'Assertion failed'}: output does not contain "${substring}"`);
    }
}

async function runAllTests() {
    console.log('\n🧪 Running Service Integration Tests (REAL FilterService + ExportService)\n');
    console.log('='.repeat(60));

    await test('Full workflow: Fetch → Filter (open) → Export CSV', async () => {
        const data = new StubDataService(new InMemoryCache());
        const filter = new FilterService();
        const exporter = new ExportService();

        const tournaments = await data.fetchTournaments();
        assertEqual(tournaments.length, 3);

        const filtered = filter.filterTournaments(tournaments, filterState({ openOnly: true }), new Set());
        assertEqual(filtered.length, 2, 'Barcelona Open + Athens Rapid');

        const csv = exporter.buildCSV(filtered);
        assertContains(csv, 'Barcelona Open');
        assertContains(csv, 'Athens Rapid');
        assertContains(csv, 'Name,Location,Date,Category,URL');
    });

    await test('Data is cached and reused on second fetch', async () => {
        const data = new StubDataService(new InMemoryCache());
        const first = await data.fetchTournaments();
        const second = await data.fetchTournaments();
        assertEqual(first.length, 3);
        assertEqual(second.length, 3);
        assertEqual(data.fetchCount, 1, 'second fetch should hit cache');
    });

    await test('Filter (Mediterranean) + sort by date work together', async () => {
        const filter = new FilterService();
        const tournaments = await new StubDataService(new InMemoryCache()).fetchTournaments();

        const med = new Set(['barcelona', 'athens']);
        const filtered = filter.filterTournaments(tournaments, filterState({ mediterraneanOnly: true }), med);
        assertEqual(filtered.length, 2, 'Barcelona + Athens');

        const sorted = filter.sortTournaments(filtered, 'date-asc');
        assertEqual(sorted[0].name, 'Barcelona Open');
        assertEqual(sorted[1].name, 'Athens Rapid');
    });

    await test('Date range filtering narrows to June', async () => {
        const filter = new FilterService();
        const tournaments = await new StubDataService(new InMemoryCache()).fetchTournaments();

        const filtered = filter.filterTournaments(
            tournaments,
            filterState({ startDate: new Date('2025-06-01'), endDate: new Date('2025-06-30') }),
            new Set()
        );
        assertEqual(filtered.length, 1);
        assertEqual(filtered[0].name, 'Barcelona Open');
    });

    await test('Combined filters: Open + Mediterranean + June–July', async () => {
        const filter = new FilterService();
        const tournaments = await new StubDataService(new InMemoryCache()).fetchTournaments();

        const filtered = filter.filterTournaments(
            tournaments,
            filterState({
                openOnly: true,
                mediterraneanOnly: true,
                startDate: new Date('2025-06-01'),
                endDate: new Date('2025-07-31'),
            }),
            new Set(['barcelona', 'athens'])
        );
        assertEqual(filtered.length, 2);
    });

    await test('CSV export of an empty set throws (production contract)', async () => {
        const exporter = new ExportService();
        let threw = false;
        try { exporter.buildCSV([]); } catch { threw = true; }
        assertEqual(threw, true, 'buildCSV([]) must throw');
    });

    await test('Sort by name is alphabetical', async () => {
        const filter = new FilterService();
        const tournaments = await new StubDataService(new InMemoryCache()).fetchTournaments();
        const sorted = filter.sortTournaments(tournaments, 'name');
        assertEqual(sorted[0].name, 'Athens Rapid');
        assertEqual(sorted[1].name, 'Barcelona Open');
        assertEqual(sorted[2].name, 'Madrid Classical');
    });

    await test('Realistic flow: search → filter → sort → export CSV + ICS', async () => {
        const filter = new FilterService();
        const exporter = new ExportService();
        const all = await new StubDataService(new InMemoryCache()).fetchTournaments();

        let results = filter.filterTournaments(
            all, filterState({ openOnly: true, mediterraneanOnly: true }), new Set(['barcelona', 'athens'])
        );
        results = filter.sortTournaments(results, 'date-asc');
        assertEqual(results.length, 2);
        assertEqual(results[0].name, 'Barcelona Open');

        const csv = exporter.buildCSV(results);
        assertContains(csv, 'Barcelona Open');

        const ics = exporter.buildICSForTournaments(results);
        assertEqual(ics.split('BEGIN:VEVENT').length - 1, 2, 'one VEVENT per result');
        assertContains(ics, 'DTSTART;VALUE=DATE:');
    });

    console.log('='.repeat(60));
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log(`✨ Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);
    return failed === 0 ? 0 : 1;
}

runAllTests().then(exitCode => process.exit(exitCode));
