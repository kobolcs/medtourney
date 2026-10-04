/**
 * Unit tests for DataService with HTTP mocking
 * Tests data fetching, caching, validation and the fallback order
 * (network refresh -> validated offline cache) of the REAL
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

    loadPreference(key) {
        return this.loadFromCache(key);
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
        delete global.document;
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
        await test('Offline cache: validated dates returned after trying fresh network', async () => {
            const cache = new StubCacheManager();
            cache.saveToCache(cache.CACHE_KEYS.TOURNAMENTS, [tournament()]);
            const calls = stubFetch({});
            const result = await new DataService(cache).fetchTournaments();
            assertEqual(result.length, 1);
            assert(result[0].date instanceof Date, 'date should be a Date');
            assertEqual(calls.length, 3, 'network tried before offline cache');
        });

        await test('Local file: validated, cached, dates converted', async () => {
            const cache = new StubCacheManager();
            const calls = stubFetch({ [LOCAL]: jsonResponse([tournament(), tournament({ name: 'Athens Open' })]) });
            const result = await new DataService(cache).fetchTournaments();
            assertEqual(result.map(t => t.name), ['Barcelona Open', 'Athens Open']);
            assert(result[1].date instanceof Date, 'date should be a Date');
            assertEqual(calls[0].url, LOCAL, 'first request is the same-origin file');
            assertEqual(cache.loadFromCache(cache.CACHE_KEYS.TOURNAMENTS).rows.length, 2, 'cached raw data');
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

        await test('Fresh network replaces cached old data and records matching metadata', async () => {
            const cache = new StubCacheManager();
            cache.saveToCache(cache.CACHE_KEYS.TOURNAMENTS, [tournament({ name: 'Old' })]);
            stubFetch({ [LOCAL]: jsonResponse([tournament({ name: 'Fresh' })]),
                'tournaments_data_meta.json': jsonResponse({ generatedAt: '2026-10-04T00:00:00Z', keptRows: 1 }) });
            const service = new DataService(cache);
            assertEqual((await service.fetchTournaments())[0].name, 'Fresh');
            assertEqual(service.getLoadedDataInfo(), { source: 'network', dataUrl: LOCAL, generatedAt: '2026-10-04T00:00:00Z' });
        });

        await test('Malformed and empty network responses preserve cached good snapshot', async () => {
            const cache = new StubCacheManager();
            const previous = { rows: [tournament({ name: 'Last good' })], dataUrl: LOCAL, generatedAt: '2026-10-01T00:00:00Z' };
            cache.saveToCache(cache.CACHE_KEYS.TOURNAMENTS, previous);
            stubFetch({ [PAGES]: jsonResponse([]), [LOCAL]: jsonResponse({ wrong: true }) });
            const service = new DataService(cache);
            assertEqual((await service.fetchTournaments())[0].name, 'Last good');
            assertEqual(cache.loadFromCache(cache.CACHE_KEYS.TOURNAMENTS), previous);
            assertEqual(service.getLoadedDataInfo().source, 'cache');
            assertEqual(service.getLoadedDataInfo().generatedAt, previous.generatedAt);
        });

        await test('Expired good cache remains available offline without TTL loading', async () => {
            const cache = new StubCacheManager();
            cache.loadPreference = () => ({ rows: [tournament()], dataUrl: LOCAL });
            cache.loadFromCache = () => null;
            stubFetch({});
            const service = new DataService(cache);
            assertEqual((await service.fetchTournaments()).length, 1);
            assertEqual(service.getLoadedDataInfo().source, 'cache');
        });

        await test('Override cannot reuse a good cache from a different upstream', async () => {
            global.document = { querySelector: () => ({ content: 'https://example.com/public/' }) };
            const cache = new StubCacheManager();
            cache.saveToCache(cache.CACHE_KEYS.TOURNAMENTS, [tournament()]);
            stubFetch({});
            await assertRejects(new DataService(cache).fetchTournaments(), /all sources/);
        });

        await test('Invalid cached payload is rejected when network is unavailable', async () => {
            const cache = new StubCacheManager();
            cache.saveToCache(cache.CACHE_KEYS.TOURNAMENTS, [tournament({ date: 'broken' })]);
            stubFetch({});
            await assertRejects(new DataService(cache).fetchTournaments(), /all sources/);
        });

        await test('Metadata failure or mismatched count cannot label a valid fresh snapshot', async () => {
            for (const meta of [new Error('offline'), jsonResponse({ keptRows: 9, generatedAt: '2026-10-04T00:00:00Z' }),
                jsonResponse({ keptRows: 1, generatedAt: 'broken' })]) {
                const cache = new StubCacheManager();
                stubFetch({ [LOCAL]: jsonResponse([tournament()]), 'tournaments_data_meta.json': meta });
                const service = new DataService(cache);
                assertEqual((await service.fetchTournaments()).length, 1);
                assertEqual(service.getLoadedDataInfo().generatedAt, undefined);
            }
        });

        await test('Source override loads only upstream data and keeps config same-origin', async () => {
            global.document = { querySelector: () => ({ content: 'https://example.com/public' }) };
            const cache = new StubCacheManager();
            const calls = stubFetch({ 'https://example.com/public/tournaments_data.json': jsonResponse([tournament()]),
                'config.json': jsonResponse(validConfig) });
            const service = new DataService(cache);
            await service.fetchTournaments();
            await service.loadConfig();
            assertEqual(calls[0].url, 'https://example.com/public/tournaments_data.json');
            assert(calls.some(call => call.url === 'config.json'), 'config stays local');
            assertEqual(cache.loadFromCache(cache.CACHE_KEYS.TOURNAMENTS), null, 'override cache isolated');
            assert(!calls.some(call => call.url.includes('github')), 'no other data sources');
        });

        await test('Private source outage falls back to bundled data without caching it as upstream', async () => {
            global.document = { querySelector: () => ({ content: 'https://example.com/public/' }) };
            const cache = new StubCacheManager();
            stubFetch({ 'https://example.com/public/': new Error('upstream unavailable'),
                [LOCAL]: jsonResponse([tournament({ name: 'Bundled' })]),
                'tournaments_data_meta.json': jsonResponse({ keptRows: 1, generatedAt: '2026-10-01T00:00:00Z' }) });
            const service = new DataService(cache);
            assertEqual((await service.fetchTournaments())[0].name, 'Bundled');
            assertEqual(service.getLoadedDataInfo(), { source: 'bundled', dataUrl: LOCAL, generatedAt: '2026-10-01T00:00:00Z' });
            assertEqual(cache.cache.size, 0, 'bundled copy never stored as upstream cache');
        });

        await test('Validated upstream cache has priority over the private bundled snapshot', async () => {
            const upstream = 'https://example.com/public/tournaments_data.json';
            global.document = { querySelector: () => ({ content: 'https://example.com/public/' }) };
            const cache = new StubCacheManager();
            cache.saveToCache(`${cache.CACHE_KEYS.TOURNAMENTS}:${upstream}`, { rows: [tournament({ name: 'Cached upstream' })], dataUrl: upstream });
            const calls = stubFetch({ 'https://example.com/public/': new Error('upstream unavailable'),
                [LOCAL]: jsonResponse([tournament({ name: 'Bundled' })]) });
            const service = new DataService(cache);
            assertEqual((await service.fetchTournaments())[0].name, 'Cached upstream');
            assertEqual(service.getLoadedDataInfo().source, 'cache');
            assert(!calls.some(call => call.url === LOCAL), 'bundle not requested with good upstream cache');
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
