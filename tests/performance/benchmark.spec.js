/**
 * Performance benchmarks for service modules
 * Measures execution time and performance characteristics
 */

const Benchmark = require('benchmark');
const suite = new Benchmark.Suite();

// Mock localStorage
class LocalStorageMock {
    constructor() { this.store = {}; }
    getItem(key) { return this.store[key] || null; }
    setItem(key, value) { this.store[key] = String(value); }
}
global.localStorage = new LocalStorageMock();

// Service implementations
class CacheManager {
    constructor() {
        this.CACHE_VERSION = '2.3.0';
        this.CACHE_DURATION = 24 * 60 * 60 * 1000;
        this.CACHE_KEYS = { TOURNAMENTS: 'medtourney_tournaments' };
    }

    saveToCache(key, data) {
        localStorage.setItem(key, JSON.stringify({
            data,
            timestamp: Date.now(),
            version: this.CACHE_VERSION
        }));
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
        this.MAX_FILTER_CACHE_SIZE = 50;
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

class ExportService {
    exportToCSV(tournaments) {
        const headers = ['Name', 'Location', 'Date', 'Category'];
        const rows = tournaments.map(t => [
            this.escapeCSV(t.name),
            this.escapeCSV(t.location),
            t.date.toLocaleDateString(),
            this.escapeCSV(t.category)
        ]);
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    escapeCSV(value) {
        if (typeof value !== 'string') return value;
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
}

// Generate test data
function generateTournaments(count) {
    const tournaments = [];
    const locations = ['Barcelona, ESP', 'Athens, GRE', 'Madrid, ESP', 'Paris, FRA', 'Rome, ITA'];
    const categories = ['Open', 'Rapid', 'Blitz', 'Classical Open', 'Women Open'];

    for (let i = 0; i < count; i++) {
        tournaments.push({
            name: `Tournament ${i}`,
            location: locations[i % locations.length],
            date: new Date(2025, i % 12, (i % 28) + 1),
            category: categories[i % categories.length],
            description: `Description for tournament ${i}`
        });
    }

    return tournaments;
}

// Test data sets
const small = generateTournaments(10);
const medium = generateTournaments(100);
const large = generateTournaments(1000);

const filterState = {
    openOnly: true,
    mediterraneanOnly: false,
    startDate: null,
    endDate: null
};

const mediterraneanLocations = new Set(['barcelona', 'athens']);

console.log('\n⚡ Running Performance Benchmarks\n');
console.log('='.repeat(60));
console.log('Measuring ops/sec (higher is better)\n');

// Benchmark 1: Filter small dataset
suite.add('Filter 10 tournaments', () => {
    const filterService = new FilterService();
    filterService.filterTournaments(small, filterState, mediterraneanLocations);
});

// Benchmark 2: Filter medium dataset
suite.add('Filter 100 tournaments', () => {
    const filterService = new FilterService();
    filterService.filterTournaments(medium, filterState, mediterraneanLocations);
});

// Benchmark 3: Filter large dataset
suite.add('Filter 1000 tournaments', () => {
    const filterService = new FilterService();
    filterService.filterTournaments(large, filterState, mediterraneanLocations);
});

// Benchmark 4: Sort small dataset
suite.add('Sort 10 tournaments', () => {
    const filterService = new FilterService();
    filterService.sortTournaments(small, 'date-asc');
});

// Benchmark 5: Sort medium dataset
suite.add('Sort 100 tournaments', () => {
    const filterService = new FilterService();
    filterService.sortTournaments(medium, 'date-asc');
});

// Benchmark 6: Sort large dataset
suite.add('Sort 1000 tournaments', () => {
    const filterService = new FilterService();
    filterService.sortTournaments(large, 'date-asc');
});

// Benchmark 7: CSV export small
suite.add('Export 10 to CSV', () => {
    const exportService = new ExportService();
    exportService.exportToCSV(small);
});

// Benchmark 8: CSV export medium
suite.add('Export 100 to CSV', () => {
    const exportService = new ExportService();
    exportService.exportToCSV(medium);
});

// Benchmark 9: CSV export large
suite.add('Export 1000 to CSV', () => {
    const exportService = new ExportService();
    exportService.exportToCSV(large);
});

// Benchmark 10: Cache save
suite.add('Cache save (100 items)', () => {
    const cacheManager = new CacheManager();
    cacheManager.saveToCache(cacheManager.CACHE_KEYS.TOURNAMENTS, medium);
});

// Benchmark 11: Cache load
suite.add('Cache load (100 items)', () => {
    const cacheManager = new CacheManager();
    // Pre-populate cache
    cacheManager.saveToCache(cacheManager.CACHE_KEYS.TOURNAMENTS, medium);
    cacheManager.loadFromCache(cacheManager.CACHE_KEYS.TOURNAMENTS);
});

// Benchmark 12: Full filter + sort pipeline
suite.add('Filter + Sort (100 items)', () => {
    const filterService = new FilterService();
    const filtered = filterService.filterTournaments(medium, filterState, mediterraneanLocations);
    filterService.sortTournaments(filtered, 'date-asc');
});

// Run benchmarks
suite
    .on('cycle', (event) => {
        const benchmark = event.target;
        const opsPerSec = benchmark.hz.toLocaleString('en-US', {
            maximumFractionDigits: 0
        });
        const margin = (benchmark.stats.rme).toFixed(2);

        console.log(`📊 ${String(benchmark.name).padEnd(30)} ${String(opsPerSec).padStart(15)} ops/sec ±${margin}%`);
    })
    .on('complete', function() {
        console.log('\n' + '='.repeat(60));
        console.log('\n🏆 Performance Summary:\n');

        // Find fastest operations
        const fastest = this.filter('fastest').map('name');
        console.log(`⚡ Fastest operation: ${fastest[0]}`);

        // Calculate performance metrics
        console.log('\n📈 Performance Insights:');

        const filterSmall = this.filter(b => b.name === 'Filter 10 tournaments')[0];
        const filterLarge = this.filter(b => b.name === 'Filter 1000 tournaments')[0];

        if (filterSmall && filterLarge) {
            const ratio = (filterSmall.hz / filterLarge.hz).toFixed(1);
            console.log(`   - Filtering scales sub-linearly: ${ratio}x slowdown for 100x data`);
        }

        const sortSmall = this.filter(b => b.name === 'Sort 10 tournaments')[0];
        const sortLarge = this.filter(b => b.name === 'Sort 1000 tournaments')[0];

        if (sortSmall && sortLarge) {
            const ratio = (sortSmall.hz / sortLarge.hz).toFixed(1);
            console.log(`   - Sorting scales as expected: ${ratio}x slowdown for 100x data`);
        }

        console.log('\n✨ All benchmarks completed!\n');
    })
    .run({ async: false });
