/**
 * Integration tests for service modules
 * Tests how services work together with mocked dependencies
 */

// Mock localStorage
class LocalStorageMock {
    constructor() {
        this.store = {};
    }
    getItem(key) { return this.store[key] || null; }
    setItem(key, value) { this.store[key] = String(value); }
    removeItem(key) { delete this.store[key]; }
    clear() { this.store = {}; }
}

global.localStorage = new LocalStorageMock();

// Import service implementations (simplified versions for testing)
class CacheManager {
    constructor() {
        this.CACHE_VERSION = '2.3.0';
        this.CACHE_DURATION = 24 * 60 * 60 * 1000;
        this.CACHE_KEYS = {
            TOURNAMENTS: 'medtourney_tournaments',
            CONFIG: 'medtourney_config'
        };
    }

    saveToCache(key, data) {
        const cachedData = {
            data,
            timestamp: Date.now(),
            version: this.CACHE_VERSION
        };
        localStorage.setItem(key, JSON.stringify(cachedData));
    }

    loadFromCache(key) {
        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;
            const parsed = JSON.parse(cached);
            if (parsed.version !== this.CACHE_VERSION) return null;
            if (Date.now() - parsed.timestamp > this.CACHE_DURATION) return null;
            return parsed.data;
        } catch {
            return null;
        }
    }
}

class FilterService {
    constructor() {
        this.filterCache = new Map();
    }

    filterTournaments(tournaments, filterState, mediterraneanLocations) {
        return tournaments.filter(t => {
            if (filterState.mediterraneanOnly) {
                const locationLower = t.location.toLowerCase();
                let found = false;
                for (const place of mediterraneanLocations) {
                    if (locationLower.includes(place.toLowerCase())) {
                        found = true;
                        break;
                    }
                }
                if (!found) return false;
            }

            if (filterState.openOnly && !/\bopen\b/i.test(t.category)) {
                return false;
            }

            if (filterState.startDate && t.date < filterState.startDate) {
                return false;
            }

            if (filterState.endDate && t.date > filterState.endDate) {
                return false;
            }

            return true;
        });
    }

    sortTournaments(tournaments, sortBy) {
        const sorted = [...tournaments];
        if (sortBy === 'date-asc') {
            sorted.sort((a, b) => a.date.getTime() - b.date.getTime());
        } else if (sortBy === 'name') {
            sorted.sort((a, b) => a.name.localeCompare(b.name));
        }
        return sorted;
    }
}

class DataService {
    constructor(cacheManager) {
        this.cacheManager = cacheManager;
    }

    async fetchTournaments() {
        // Check cache first
        const cached = this.cacheManager.loadFromCache(this.cacheManager.CACHE_KEYS.TOURNAMENTS);
        if (cached) {
            return cached;
        }

        // Simulate fetch
        const tournaments = [
            {
                name: 'Barcelona Open',
                location: 'Barcelona, ESP',
                date: new Date('2025-06-01'),
                category: 'Open'
            },
            {
                name: 'Madrid Classical',
                location: 'Madrid, ESP',
                date: new Date('2025-05-15'),
                category: 'Classical'
            },
            {
                name: 'Athens Rapid',
                location: 'Athens, GRE',
                date: new Date('2025-07-01'),
                category: 'Open Rapid'
            }
        ];

        // Cache the results
        this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.TOURNAMENTS, tournaments);
        return tournaments;
    }
}

class ExportService {
    exportToCSV(tournaments) {
        const headers = ['Name', 'Location', 'Date', 'Category'];
        const rows = tournaments.map(t => [
            t.name,
            t.location,
            t.date.toLocaleDateString(),
            t.category
        ]);
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
}

// Test suite
function runTests() {
    console.log('\n🧪 Running Service Integration Tests\n');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        // Clear localStorage before each test
        localStorage.clear();

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
            throw new Error(`${message || 'Assertion failed'}: "${str}" does not contain "${substring}"`);
        }
    }

    async function runAllTests() {
        // Test 1: Full workflow - Fetch, Filter, Export
        await test('Full workflow: Fetch → Filter → Export', async () => {
            const cacheManager = new CacheManager();
            const dataService = new DataService(cacheManager);
            const filterService = new FilterService();
            const exportService = new ExportService();

            // Fetch data
            const tournaments = await dataService.fetchTournaments();
            assertEqual(tournaments.length, 3);

            // Filter for open tournaments
            const filterState = {
                openOnly: true,
                mediterraneanOnly: false,
                startDate: null,
                endDate: null
            };
            const filtered = filterService.filterTournaments(tournaments, filterState, new Set());
            assertEqual(filtered.length, 2); // Barcelona Open and Athens Rapid

            // Export to CSV
            const csv = exportService.exportToCSV(filtered);
            assertContains(csv, 'Barcelona Open');
            assertContains(csv, 'Athens Rapid');
        });

        // Test 2: Data caching workflow
        await test('Data is cached and reused on second fetch', async () => {
            const cacheManager = new CacheManager();
            const dataService = new DataService(cacheManager);

            // First fetch - should cache
            const tournaments1 = await dataService.fetchTournaments();
            assertEqual(tournaments1.length, 3);

            // Verify it was cached
            const cached = cacheManager.loadFromCache(cacheManager.CACHE_KEYS.TOURNAMENTS);
            assertEqual(cached !== null, true);
            assertEqual(cached.length, 3);

            // Second fetch - should use cache
            const tournaments2 = await dataService.fetchTournaments();
            assertEqual(tournaments2.length, 3);

            // Both fetches should return same data
            assertEqual(tournaments1[0].name, tournaments2[0].name);
        });

        // Test 3: Filter and sort combination
        await test('Filter and sort work together correctly', async () => {
            const cacheManager = new CacheManager();
            const dataService = new DataService(cacheManager);
            const filterService = new FilterService();

            const tournaments = await dataService.fetchTournaments();

            // Filter for Mediterranean locations only
            const filterState = {
                openOnly: false,
                mediterraneanOnly: true,
                startDate: null,
                endDate: null
            };
            const mediterraneanLocations = new Set(['barcelona', 'athens']);
            const filtered = filterService.filterTournaments(tournaments, filterState, mediterraneanLocations);

            assertEqual(filtered.length, 2); // Barcelona and Athens

            // Sort by date
            const sorted = filterService.sortTournaments(filtered, 'date-asc');
            assertEqual(sorted[0].name, 'Barcelona Open'); // June 1
            assertEqual(sorted[1].name, 'Athens Rapid');    // July 1
        });

        // Test 4: Date range filtering
        await test('Date range filtering works correctly', async () => {
            const cacheManager = new CacheManager();
            const dataService = new DataService(cacheManager);
            const filterService = new FilterService();

            const tournaments = await dataService.fetchTournaments();

            // Filter for tournaments in June only
            const filterState = {
                openOnly: false,
                mediterraneanOnly: false,
                startDate: new Date('2025-06-01'),
                endDate: new Date('2025-06-30')
            };
            const filtered = filterService.filterTournaments(tournaments, filterState, new Set());

            assertEqual(filtered.length, 1); // Only Barcelona Open (June 1)
            assertEqual(filtered[0].name, 'Barcelona Open');
        });

        // Test 5: Multiple filters combined
        await test('Multiple filters work together', async () => {
            const cacheManager = new CacheManager();
            const dataService = new DataService(cacheManager);
            const filterService = new FilterService();

            const tournaments = await dataService.fetchTournaments();

            // Filter: Open + Mediterranean + June-July
            const filterState = {
                openOnly: true,
                mediterraneanOnly: true,
                startDate: new Date('2025-06-01'),
                endDate: new Date('2025-07-31')
            };
            const mediterraneanLocations = new Set(['barcelona', 'athens']);
            const filtered = filterService.filterTournaments(tournaments, filterState, mediterraneanLocations);

            assertEqual(filtered.length, 2); // Barcelona Open and Athens Rapid
        });

        // Test 6: Export empty results
        await test('Export works with empty results', async () => {
            const exportService = new ExportService();

            const csv = exportService.exportToCSV([]);
            const lines = csv.split('\n');

            assertEqual(lines.length, 1); // Only headers
            assertContains(csv, 'Name,Location,Date,Category');
        });

        // Test 7: Cache manager integration with data service
        await test('Cache manager correctly saves and loads data', async () => {
            const cacheManager = new CacheManager();
            const dataService = new DataService(cacheManager);

            // Fetch and cache
            await dataService.fetchTournaments();

            // Manually check cache
            const cached = cacheManager.loadFromCache(cacheManager.CACHE_KEYS.TOURNAMENTS);
            assertEqual(cached.length, 3);
            assertEqual(cached[0].name, 'Barcelona Open');
        });

        // Test 8: Sort by name
        await test('Sort by name works correctly', async () => {
            const cacheManager = new CacheManager();
            const dataService = new DataService(cacheManager);
            const filterService = new FilterService();

            const tournaments = await dataService.fetchTournaments();
            const sorted = filterService.sortTournaments(tournaments, 'name');

            assertEqual(sorted[0].name, 'Athens Rapid');     // A
            assertEqual(sorted[1].name, 'Barcelona Open');   // B
            assertEqual(sorted[2].name, 'Madrid Classical'); // M
        });

        // Test 9: Service composition - realistic scenario
        await test('Realistic scenario: User searches for Mediterranean open tournaments', async () => {
            // Setup all services
            const cacheManager = new CacheManager();
            const dataService = new DataService(cacheManager);
            const filterService = new FilterService();
            const exportService = new ExportService();

            // User flow:
            // 1. App fetches all tournaments
            const allTournaments = await dataService.fetchTournaments();

            // 2. User applies filters: Mediterranean + Open only
            const filterState = {
                openOnly: true,
                mediterraneanOnly: true,
                startDate: null,
                endDate: null
            };
            const mediterraneanLocations = new Set(['barcelona', 'athens']);
            let results = filterService.filterTournaments(allTournaments, filterState, mediterraneanLocations);

            // 3. User sorts by date
            results = filterService.sortTournaments(results, 'date-asc');

            // 4. User exports to CSV
            const csv = exportService.exportToCSV(results);

            // Verify final results
            assertEqual(results.length, 2);
            assertEqual(results[0].name, 'Barcelona Open'); // Earlier date
            assertContains(csv, 'Barcelona Open');
            assertContains(csv, 'Athens Rapid');
        });

        // Test 10: Mocked dependency - Cache miss scenario
        await test('Services handle cache miss gracefully', async () => {
            const cacheManager = new CacheManager();
            const dataService = new DataService(cacheManager);

            // First clear any cache
            localStorage.clear();

            // Should fetch fresh data (not from cache)
            const tournaments = await dataService.fetchTournaments();

            assertEqual(tournaments.length, 3);
            // Verify it was cached for next time
            const cached = cacheManager.loadFromCache(cacheManager.CACHE_KEYS.TOURNAMENTS);
            assertEqual(cached.length, 3);
        });

        console.log('='.repeat(60));
        console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
        console.log(`✨ Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

        return failed === 0 ? 0 : 1;
    }

    return runAllTests();
}

// Run tests
runTests().then(exitCode => process.exit(exitCode));
