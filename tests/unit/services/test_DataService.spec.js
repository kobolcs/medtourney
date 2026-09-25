/**
 * Unit tests for DataService with HTTP mocking
 * Tests data fetching, caching, validation and the fallback order
 * (cache -> local file -> GitHub Pages -> GitHub API) of the REAL
 * DataService, compiled to dist-test/ by `npm run build:test`.
 * Only its injected CacheManager and global fetch are stubbed.
 */

const { loadProductionModule } = require('../../helpers/production');
const { DataService } = loadProductionModule('services/DataService.js');

// Stub for the injected CacheManager (a Map instead of localStorage)
class StubCacheManager {
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
}

// A tournament that passes the Zod schema in src/utils/validators.ts
function tournament(overrides = {}) {
    return {
        name: 'Barcelona Open',
        url: 'https://chess-results.com/tnr1.aspx',
        location: 'Barcelona, ESP',
        date: '2026-06-01',
        category: 'Open',
        description: '',
        ...overrides
    };
}

const validConfig = {
    europeanCountries: ['spain'],
    nonEuropeanCountries: ['usa'],
    mediterraneanLocations: ['barcelona'],
    countryCodes: { ESP: { name: 'Spain', keywords: ['spain'] } }
};

function jsonResponse(body, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        json: async () => body
    };
}

/**
 * Install a fetch stub. `routes` maps a URL substring to a response (or an
 * Error to reject with); unmatched URLs get a 404. Returns the call log.
 */
function stubFetch(routes) {
    const calls = [];
    global.fetch = async (url, options) => {
        calls.push({ url, options });
        for (const [part, response] of Object.entries(routes)) {
            if (url.includes(part)) {
                if (response instanceof Error) throw response;
                return response;
            }
        }
        return jsonResponse(null, 404);
    };
    return calls;
}

const LOCAL = 'tournaments_data.json';
const PAGES = 'github.io/medtourney/tournaments_data.json';
const API = 'api.github.com/repos/kobolcs/medtourney/contents/tournaments_data.json';

function runTests() {
    console.log('\n🧪 Running DataService Unit Tests (with HTTP Mocking)\n');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        delete global.fetch;
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
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    }

    function assert(condition, message) {
        if (!condition) throw new Error(message || 'Assertion failed');
    }

    async function assertRejects(promise, pattern) {
        try {
            await promise;
        } catch (error) {
            assert(pattern.test(error.message), `Unexpected error: ${error.message}`);
            return;
        }
        throw new Error('Expected a rejection');
    }

    async function runAllTests() {
        await test('Cache hit: returns cached tournaments with Date objects, no fetch', async () => {
            const cache = new StubCacheManager();
            cache.saveToCache(cache.CACHE_KEYS.TOURNAMENTS, [tournament()]);
            const calls = stubFetch({});
            const result = await new DataService(cache).fetchTournaments();
            assertEqual(result.length, 1);
            assert(result[0].date instanceof Date, 'date should be a Date');
            assertEqual(calls.length, 0, 'fetch calls');
        });

        await test('Local file: validated, cached, dates converted', async () => {
            const cache = new StubCacheManager();
            const calls = stubFetch({ [LOCAL]: jsonResponse([tournament(), tournament({ name: 'Athens Open' })]) });
            const result = await new DataService(cache).fetchTournaments();
            assertEqual(result.map(t => t.name), ['Barcelona Open', 'Athens Open']);
            assert(result[1].date instanceof Date, 'date should be a Date');
            assertEqual(calls[0].url, LOCAL, 'first request is the same-origin file');
            assertEqual(cache.loadFromCache(cache.CACHE_KEYS.TOURNAMENTS).length, 2, 'cached raw data');
        });

        await test('Local file fails: falls back to GitHub Pages', async () => {
            const cache = new StubCacheManager();
            const calls = stubFetch({ [PAGES]: jsonResponse([tournament()]), [LOCAL]: jsonResponse(null, 500) });
            const result = await new DataService(cache).fetchTournaments();
            assertEqual(result.length, 1);
            assert(calls.some(c => c.url.includes(PAGES)), 'GitHub Pages requested');
        });

        await test('Local and Pages fail: falls back to the GitHub API (raw)', async () => {
            const cache = new StubCacheManager();
            const calls = stubFetch({
                [API]: jsonResponse([tournament()]),
                [PAGES]: new Error('network down'),
                [LOCAL]: new Error('network down')
            });
            const result = await new DataService(cache).fetchTournaments();
            assertEqual(result.length, 1);
            const apiCall = calls.find(c => c.url.includes(API));
            assert(apiCall, 'GitHub API requested');
            assertEqual(apiCall.options.headers.Accept, 'application/vnd.github.v3.raw');
        });

        await test('Invalid data from a source is skipped, not returned', async () => {
            const cache = new StubCacheManager();
            stubFetch({
                [PAGES]: jsonResponse([tournament({ name: 'Valid' })]),
                [LOCAL]: jsonResponse([tournament({ url: 'not a url' })])
            });
            const result = await new DataService(cache).fetchTournaments();
            assertEqual(result.map(t => t.name), ['Valid']);
        });

        await test('An empty list from a source falls through to the next', async () => {
            const cache = new StubCacheManager();
            stubFetch({ [PAGES]: jsonResponse([tournament()]), [LOCAL]: jsonResponse([]) });
            const result = await new DataService(cache).fetchTournaments();
            assertEqual(result.length, 1);
        });

        await test('All sources fail: throws', async () => {
            stubFetch({ [LOCAL]: new Error('offline'), [PAGES]: new Error('offline'), [API]: jsonResponse(null, 403) });
            await assertRejects(new DataService(new StubCacheManager()).fetchTournaments(), /all sources/);
        });

        await test('loadConfig: cache hit skips fetch', async () => {
            const cache = new StubCacheManager();
            cache.saveToCache(cache.CACHE_KEYS.CONFIG, validConfig);
            const calls = stubFetch({});
            assertEqual(await new DataService(cache).loadConfig(), validConfig);
            assertEqual(calls.length, 0, 'fetch calls');
        });

        await test('loadConfig: validated file is returned and cached', async () => {
            const cache = new StubCacheManager();
            stubFetch({ 'config.json': jsonResponse(validConfig) });
            assertEqual(await new DataService(cache).loadConfig(), validConfig);
            assertEqual(cache.loadFromCache(cache.CACHE_KEYS.CONFIG), validConfig, 'cached');
        });

        await test('loadConfig: invalid file -> built-in defaults, not cached', async () => {
            const cache = new StubCacheManager();
            stubFetch({ 'config.json': jsonResponse({ europeanCountries: 'not an array' }) });
            const config = await new DataService(cache).loadConfig();
            assert(config.europeanCountries.includes('spain'), 'default countries');
            assert(config.mediterraneanLocations.includes('barcelona'), 'default locations');
            assertEqual(cache.loadFromCache(cache.CACHE_KEYS.CONFIG), null, 'defaults are not cached');
        });

        await test('loadConfig: HTTP error or network failure -> defaults', async () => {
            stubFetch({ 'config.json': jsonResponse(null, 500) });
            assert((await new DataService(new StubCacheManager()).loadConfig()).europeanCountries.length > 0);
            stubFetch({ 'config.json': new Error('offline') });
            assert((await new DataService(new StubCacheManager()).loadConfig()).europeanCountries.length > 0);
        });

        await test('parseDate: ISO and YYYY-MM-DD', () => {
            const service = new DataService(new StubCacheManager());
            assertEqual(service.parseDate('2026-06-01T00:00:00Z').toISOString(), '2026-06-01T00:00:00.000Z');
            const d = service.parseDate('2026-06-01');
            assertEqual([d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()], [2026, 5, 1]);
        });

        await test('parseDate: DD.MM.YYYY and DD/MM/YYYY are day-first', () => {
            const service = new DataService(new StubCacheManager());
            for (const s of ['25.12.2026', '25/12/2026']) {
                const d = service.parseDate(s);
                assertEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 11, 25], s);
            }
        });

        await test('parseDate: unparseable -> today', () => {
            const d = new DataService(new StubCacheManager()).parseDate('soon');
            assert(Math.abs(Date.now() - d.getTime()) < 5000, 'should be now');
        });

        await test('extractLocation: text before the first comma', () => {
            const service = new DataService(new StubCacheManager());
            assertEqual(service.extractLocation('Barcelona, ESP'), 'Barcelona');
            assertEqual(service.extractLocation('Nice'), 'Nice');
        });

        console.log('='.repeat(60));
        console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
        console.log(`✨ Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

        return failed === 0 ? 0 : 1;
    }

    return runAllTests();
}

runTests().then(code => process.exit(code));
