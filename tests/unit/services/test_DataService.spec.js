/**
 * Unit tests for DataService with HTTP mocking
 * Tests data fetching, caching, and fallback strategies
 */

// Mock CacheManager
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.CACHE_KEYS = {
            TOURNAMENTS: 'medtourney_tournaments',
            CONFIG: 'medtourney_config'
        };
    }

    saveToCache(key, data) {
        this.cache.set(key, data);
    }

    loadFromCache(key) {
        return this.cache.get(key) || null;
    }

    clearCache(key) {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }
}

// Simple DataService implementation for testing
class DataService {
    constructor(cacheManager) {
        this.cacheManager = cacheManager;
        this.corsProxies = [
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?',
            '' // Direct fetch
        ];
    }

    async fetchTournaments() {
        // Strategy 0: Try cache first
        const cached = this.cacheManager.loadFromCache(this.cacheManager.CACHE_KEYS.TOURNAMENTS);
        if (cached) {
            console.log('Loaded from cache');
            return cached;
        }

        // Strategy 1: Try local file
        try {
            const response = await global.fetch('/tournaments_data.json');
            if (response.ok) {
                const data = await response.json();
                const tournaments = this.parseTournaments(data);
                this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.TOURNAMENTS, tournaments);
                return tournaments;
            }
        } catch (error) {
            console.log('Local file fetch failed, trying proxies');
        }

        // Strategy 2: Try CORS proxies
        for (const proxy of this.corsProxies) {
            try {
                const url = proxy ? `${proxy}https://example.com/tournaments` : 'https://example.com/tournaments';
                const response = await global.fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    const tournaments = this.parseTournaments(data);
                    this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.TOURNAMENTS, tournaments);
                    return tournaments;
                }
            } catch (error) {
                continue;
            }
        }

        throw new Error('Failed to fetch tournaments from all sources');
    }

    async loadConfig() {
        // Try cache first
        const cached = this.cacheManager.loadFromCache(this.cacheManager.CACHE_KEYS.CONFIG);
        if (cached) {
            return cached;
        }

        const response = await global.fetch('/config.json');
        if (!response.ok) {
            throw new Error('Failed to load config');
        }

        const config = await response.json();
        this.cacheManager.saveToCache(this.cacheManager.CACHE_KEYS.CONFIG, config);
        return config;
    }

    parseTournaments(data) {
        if (Array.isArray(data)) {
            return data.map(t => ({
                ...t,
                date: new Date(t.date)
            }));
        }
        return [];
    }

    parseDate(dateStr) {
        const formats = [
            /(\d{4})-(\d{2})-(\d{2})/,
            /(\d{2})\.(\d{2})\.(\d{4})/,
            /(\d{2})\/(\d{2})\/(\d{4})/
        ];

        for (const format of formats) {
            const match = dateStr.match(format);
            if (match && match[1] && match[2] && match[3]) {
                try {
                    if (format === formats[0]) {
                        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
                    } else {
                        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
                    }
                } catch {
                    continue;
                }
            }
        }

        return new Date();
    }
}

// Test suite
function runTests() {
    console.log('\n🧪 Running DataService Unit Tests (with HTTP Mocking)\n');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        // Reset global.fetch before each test
        delete global.fetch;

        return new Promise((resolve) => {
            setTimeout(async () => {
                try {
                    await fn();
                    console.log(`✅ ${name}`);
                    passed++;
                    resolve();
                } catch (error) {
                    console.log(`❌ ${name}`);
                    console.log(`   Error: ${error.message}`);
                    failed++;
                    resolve();
                }
            }, 0);
        });
    }

    function assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
        }
    }

    function assertNotNull(value, message) {
        if (value === null || value === undefined) {
            throw new Error(message || 'Value should not be null');
        }
    }

    async function runAllTests() {
        // Test 1: Fetch from cache
        await test('Fetch tournaments from cache', async () => {
            const cacheManager = new CacheManager();
            const mockTournaments = [
                { name: 'Test Tournament', location: 'Barcelona, ESP', date: '2025-06-01', category: 'Open' }
            ];
            cacheManager.saveToCache(cacheManager.CACHE_KEYS.TOURNAMENTS, mockTournaments);

            const service = new DataService(cacheManager);
            const result = await service.fetchTournaments();

            assertEqual(result, mockTournaments);
        });

        // Test 2: Fetch from local file
        await test('Fetch tournaments from local file', async () => {
            const cacheManager = new CacheManager();
            const service = new DataService(cacheManager);

            // Mock fetch
            global.fetch = async (url) => {
                if (url === '/tournaments_data.json') {
                    return {
                        ok: true,
                        json: async () => [{
                            name: 'Barcelona Open',
                            location: 'Barcelona, ESP',
                            date: '2025-06-01',
                            category: 'Open'
                        }]
                    };
                }
                return { ok: false };
            };

            const result = await service.fetchTournaments();
            assertEqual(result.length, 1);
            assertEqual(result[0].name, 'Barcelona Open');
        });

        // Test 3: Fetch with CORS proxy fallback
        await test('Fetch with CORS proxy fallback', async () => {
            const cacheManager = new CacheManager();
            const service = new DataService(cacheManager);

            let fetchCount = 0;
            global.fetch = async (url) => {
                fetchCount++;
                // Fail local file, succeed on first proxy
                if (url === '/tournaments_data.json') {
                    return { ok: false };
                }
                if (url.includes('api.allorigins.win')) {
                    return {
                        ok: true,
                        json: async () => [{
                            name: 'Remote Tournament',
                            location: 'Athens, GRE',
                            date: '2025-07-01',
                            category: 'Rapid'
                        }]
                    };
                }
                return { ok: false };
            };

            const result = await service.fetchTournaments();
            assertEqual(result.length, 1);
            assertEqual(result[0].name, 'Remote Tournament');
            if (fetchCount < 2) {
                throw new Error('Should have tried local file first');
            }
        });

        // Test 4: All fetches fail
        await test('Throw error when all fetch strategies fail', async () => {
            const cacheManager = new CacheManager();
            const service = new DataService(cacheManager);

            global.fetch = async () => ({ ok: false });

            let threwError = false;
            try {
                await service.fetchTournaments();
            } catch (error) {
                threwError = true;
                if (!error.message.includes('Failed to fetch')) {
                    throw new Error('Wrong error message');
                }
            }

            if (!threwError) {
                throw new Error('Should have thrown an error');
            }
        });

        // Test 5: Load config from cache
        await test('Load config from cache', async () => {
            const cacheManager = new CacheManager();
            const mockConfig = {
                europeanCountries: ['ESP', 'FRA'],
                mediterraneanLocations: ['Barcelona', 'Athens']
            };
            cacheManager.saveToCache(cacheManager.CACHE_KEYS.CONFIG, mockConfig);

            const service = new DataService(cacheManager);
            const result = await service.loadConfig();

            assertEqual(result, mockConfig);
        });

        // Test 6: Load config from file
        await test('Load config from file', async () => {
            const cacheManager = new CacheManager();
            const service = new DataService(cacheManager);

            global.fetch = async (url) => {
                if (url === '/config.json') {
                    return {
                        ok: true,
                        json: async () => ({
                            europeanCountries: ['ESP', 'FRA', 'ITA'],
                            mediterraneanLocations: ['Barcelona']
                        })
                    };
                }
                return { ok: false };
            };

            const result = await service.loadConfig();
            assertNotNull(result.europeanCountries);
            assertEqual(result.europeanCountries.length, 3);
        });

        // Test 7: Config fetch fails
        await test('Throw error when config fetch fails', async () => {
            const cacheManager = new CacheManager();
            const service = new DataService(cacheManager);

            global.fetch = async () => ({ ok: false });

            let threwError = false;
            try {
                await service.loadConfig();
            } catch (error) {
                threwError = true;
            }

            if (!threwError) {
                throw new Error('Should have thrown an error');
            }
        });

        // Test 8: Parse tournaments with dates
        await test('Parse tournaments and convert dates', async () => {
            const cacheManager = new CacheManager();
            const service = new DataService(cacheManager);

            global.fetch = async () => ({
                ok: true,
                json: async () => [{
                    name: 'Test',
                    location: 'Test, ESP',
                    date: '2025-06-01',
                    category: 'Open'
                }]
            });

            const result = await service.fetchTournaments();
            assertEqual(result[0].date instanceof Date, true);
        });

        // Test 9: Parse date - YYYY-MM-DD format
        await test('Parse date in YYYY-MM-DD format', () => {
            const service = new DataService(new CacheManager());
            const date = service.parseDate('2025-06-15');

            assertEqual(date.getFullYear(), 2025);
            assertEqual(date.getMonth(), 5); // June is month 5 (0-indexed)
            assertEqual(date.getDate(), 15);
        });

        // Test 10: Parse date - DD.MM.YYYY format
        await test('Parse date in DD.MM.YYYY format', () => {
            const service = new DataService(new CacheManager());
            const date = service.parseDate('15.06.2025');

            assertEqual(date.getFullYear(), 2025);
            assertEqual(date.getMonth(), 5);
            assertEqual(date.getDate(), 15);
        });

        // Test 11: Parse date - DD/MM/YYYY format
        await test('Parse date in DD/MM/YYYY format', () => {
            const service = new DataService(new CacheManager());
            const date = service.parseDate('15/06/2025');

            assertEqual(date.getFullYear(), 2025);
            assertEqual(date.getMonth(), 5);
            assertEqual(date.getDate(), 15);
        });

        // Test 12: Caching after fetch
        await test('Cache tournaments after successful fetch', async () => {
            const cacheManager = new CacheManager();
            const service = new DataService(cacheManager);

            global.fetch = async () => ({
                ok: true,
                json: async () => [{ name: 'Test', location: 'Test', date: '2025-06-01', category: 'Open' }]
            });

            await service.fetchTournaments();

            const cached = cacheManager.loadFromCache(cacheManager.CACHE_KEYS.TOURNAMENTS);
            assertNotNull(cached);
            assertEqual(cached.length, 1);
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
