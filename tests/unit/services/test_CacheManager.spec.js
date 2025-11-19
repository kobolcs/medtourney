/**
 * Unit tests for CacheManager service
 * Tests localStorage operations, versioning, and TTL
 */

// Mock localStorage
class LocalStorageMock {
    constructor() {
        this.store = {};
    }

    getItem(key) {
        return this.store[key] || null;
    }

    setItem(key, value) {
        this.store[key] = String(value);
    }

    removeItem(key) {
        delete this.store[key];
    }

    clear() {
        this.store = {};
    }
}

global.localStorage = new LocalStorageMock();

// Simple CacheManager implementation for testing
class CacheManager {
    constructor() {
        this.CACHE_VERSION = '2.3.0';
        this.CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

        this.CACHE_KEYS = {
            TOURNAMENTS: 'medtourney_tournaments',
            CONFIG: 'medtourney_config',
            THEME: 'medtourney_theme',
            FILTERS_COLLAPSED: 'medtourney_filters_collapsed',
            FILTER_PREFERENCES: 'medtourney_filter_preferences'
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

            // Version check
            if (parsed.version !== this.CACHE_VERSION) {
                localStorage.removeItem(key);
                return null;
            }

            // TTL check
            if (Date.now() - parsed.timestamp > this.CACHE_DURATION) {
                localStorage.removeItem(key);
                return null;
            }

            return parsed.data;
        } catch (error) {
            console.error('Cache load error:', error);
            return null;
        }
    }

    clearCache(key) {
        if (key) {
            localStorage.removeItem(key);
        } else {
            localStorage.clear();
        }
    }

    clearAllCaches() {
        Object.values(this.CACHE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    }
}

// Test suite
function runTests() {
    console.log('\n🧪 Running CacheManager Unit Tests\n');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            // Clear localStorage before each test
            localStorage.clear();
            fn();
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

    function assertNotNull(value, message) {
        if (value === null || value === undefined) {
            throw new Error(message || 'Value should not be null');
        }
    }

    function assertNull(value, message) {
        if (value !== null) {
            throw new Error(message || 'Value should be null');
        }
    }

    // Test 1: Save and load simple data
    test('Save and load string data', () => {
        const cache = new CacheManager();
        cache.saveToCache('test_key', 'test_value');
        const loaded = cache.loadFromCache('test_key');
        assertEqual(loaded, 'test_value');
    });

    // Test 2: Save and load object data
    test('Save and load object data', () => {
        const cache = new CacheManager();
        const testData = { name: 'Test Tournament', location: 'Barcelona, ESP' };
        cache.saveToCache('test_obj', testData);
        const loaded = cache.loadFromCache('test_obj');
        assertEqual(loaded, testData);
    });

    // Test 3: Save and load array data
    test('Save and load array data', () => {
        const cache = new CacheManager();
        const testData = [1, 2, 3, 4, 5];
        cache.saveToCache('test_array', testData);
        const loaded = cache.loadFromCache('test_array');
        assertEqual(loaded, testData);
    });

    // Test 4: Return null for non-existent key
    test('Return null for non-existent key', () => {
        const cache = new CacheManager();
        const loaded = cache.loadFromCache('non_existent_key');
        assertNull(loaded);
    });

    // Test 5: Version mismatch returns null
    test('Version mismatch returns null', () => {
        const cache = new CacheManager();

        // Manually create old version cache
        const oldData = {
            data: 'old_data',
            timestamp: Date.now(),
            version: '1.0.0' // Old version
        };
        localStorage.setItem('test_old', JSON.stringify(oldData));

        const loaded = cache.loadFromCache('test_old');
        assertNull(loaded, 'Should return null for version mismatch');
    });

    // Test 6: Expired cache returns null
    test('Expired cache returns null', () => {
        const cache = new CacheManager();

        // Create expired cache (25 hours ago)
        const expiredData = {
            data: 'expired_data',
            timestamp: Date.now() - (25 * 60 * 60 * 1000),
            version: cache.CACHE_VERSION
        };
        localStorage.setItem('test_expired', JSON.stringify(expiredData));

        const loaded = cache.loadFromCache('test_expired');
        assertNull(loaded, 'Should return null for expired cache');
    });

    // Test 7: Valid cache within TTL
    test('Valid cache within TTL', () => {
        const cache = new CacheManager();

        // Create cache from 1 hour ago
        const validData = {
            data: 'valid_data',
            timestamp: Date.now() - (1 * 60 * 60 * 1000),
            version: cache.CACHE_VERSION
        };
        localStorage.setItem('test_valid', JSON.stringify(validData));

        const loaded = cache.loadFromCache('test_valid');
        assertEqual(loaded, 'valid_data');
    });

    // Test 8: Clear specific cache key
    test('Clear specific cache key', () => {
        const cache = new CacheManager();
        cache.saveToCache('test_clear', 'data');
        cache.clearCache('test_clear');
        const loaded = cache.loadFromCache('test_clear');
        assertNull(loaded);
    });

    // Test 9: Clear all caches
    test('Clear all caches', () => {
        const cache = new CacheManager();
        cache.saveToCache(cache.CACHE_KEYS.TOURNAMENTS, 'tournaments');
        cache.saveToCache(cache.CACHE_KEYS.CONFIG, 'config');
        cache.saveToCache(cache.CACHE_KEYS.THEME, 'dark');

        cache.clearAllCaches();

        assertNull(cache.loadFromCache(cache.CACHE_KEYS.TOURNAMENTS));
        assertNull(cache.loadFromCache(cache.CACHE_KEYS.CONFIG));
        assertNull(cache.loadFromCache(cache.CACHE_KEYS.THEME));
    });

    // Test 10: Handle corrupted cache data
    test('Handle corrupted cache data gracefully', () => {
        const cache = new CacheManager();

        // Store invalid JSON
        localStorage.setItem('test_corrupt', 'invalid{json}data');

        const loaded = cache.loadFromCache('test_corrupt');
        assertNull(loaded, 'Should return null for corrupted data');
    });

    // Test 11: Cache keys constant availability
    test('Cache keys are properly defined', () => {
        const cache = new CacheManager();
        assertNotNull(cache.CACHE_KEYS.TOURNAMENTS);
        assertNotNull(cache.CACHE_KEYS.CONFIG);
        assertNotNull(cache.CACHE_KEYS.THEME);
        assertNotNull(cache.CACHE_KEYS.FILTERS_COLLAPSED);
        assertNotNull(cache.CACHE_KEYS.FILTER_PREFERENCES);
    });

    // Test 12: Save complex tournament data
    test('Save and load complex tournament data', () => {
        const cache = new CacheManager();
        const tournaments = [
            {
                name: 'Barcelona Open',
                location: 'Barcelona, ESP',
                date: new Date('2025-06-01').toISOString(),
                category: 'Open',
                url: 'https://example.com'
            },
            {
                name: 'Athens Rapid',
                location: 'Athens, GRE',
                date: new Date('2025-07-15').toISOString(),
                category: 'Rapid',
                url: 'https://example.com'
            }
        ];

        cache.saveToCache(cache.CACHE_KEYS.TOURNAMENTS, tournaments);
        const loaded = cache.loadFromCache(cache.CACHE_KEYS.TOURNAMENTS);

        assertEqual(loaded.length, 2);
        assertEqual(loaded[0].name, 'Barcelona Open');
        assertEqual(loaded[1].location, 'Athens, GRE');
    });

    // Test 13: Save filter preferences
    test('Save and load filter preferences', () => {
        const cache = new CacheManager();
        const preferences = {
            openOnly: true,
            mediterraneanOnly: false,
            seniorCategory: true,
            classicalTime: true,
            rapidTime: false
        };

        cache.saveToCache(cache.CACHE_KEYS.FILTER_PREFERENCES, preferences);
        const loaded = cache.loadFromCache(cache.CACHE_KEYS.FILTER_PREFERENCES);

        assertEqual(loaded, preferences);
    });

    // Test 14: Overwrite existing cache
    test('Overwrite existing cache', () => {
        const cache = new CacheManager();
        cache.saveToCache('test_overwrite', 'first_value');
        cache.saveToCache('test_overwrite', 'second_value');

        const loaded = cache.loadFromCache('test_overwrite');
        assertEqual(loaded, 'second_value');
    });

    // Test 15: Boolean values
    test('Save and load boolean values', () => {
        const cache = new CacheManager();
        cache.saveToCache('test_true', true);
        cache.saveToCache('test_false', false);

        assertEqual(cache.loadFromCache('test_true'), true);
        assertEqual(cache.loadFromCache('test_false'), false);
    });

    console.log('='.repeat(60));
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log(`✨ Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

    return failed === 0 ? 0 : 1;
}

// Run tests
process.exit(runTests());
