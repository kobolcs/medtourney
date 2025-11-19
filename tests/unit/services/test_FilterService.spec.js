/**
 * Unit tests for FilterService
 * Tests filtering, sorting, and caching logic
 */

// Simple FilterService implementation for testing
class FilterService {
    constructor() {
        this.filterCache = new Map();
        this.MAX_FILTER_CACHE_SIZE = 50;
    }

    clearCache() {
        this.filterCache.clear();
    }

    filterTournaments(tournaments, filterState, mediterraneanLocations) {
        const cacheKey = this.generateCacheKey(filterState);

        if (this.filterCache.has(cacheKey)) {
            return this.filterCache.get(cacheKey);
        }

        const filtered = tournaments.filter(tournament => {
            // Date range filter
            if (filterState.startDate && tournament.date < filterState.startDate) {
                return false;
            }
            if (filterState.endDate && tournament.date > filterState.endDate) {
                return false;
            }

            // Country filter
            if (filterState.countryFilter && filterState.countryFilter !== 'all') {
                const locationLower = tournament.location.toLowerCase();
                const countryLower = filterState.countryFilter.toLowerCase();
                if (!locationLower.includes(countryLower)) {
                    return false;
                }
            }

            const categoryLower = tournament.category.toLowerCase();
            const locationLower = tournament.location.toLowerCase();
            const nameLower = tournament.name.toLowerCase();

            // Open category filter
            if (filterState.openOnly && !this.isOpenCategory(categoryLower)) {
                return false;
            }

            // Exclude youth filter
            if (filterState.excludeYouth && this.isYouthTournament(nameLower, categoryLower)) {
                return false;
            }

            // Mediterranean filter
            if (filterState.mediterraneanOnly && !this.isMediterraneanLocation(locationLower, mediterraneanLocations)) {
                return false;
            }

            // Senior category filter
            if (filterState.seniorCategory && !this.isSeniorCategory(categoryLower, nameLower)) {
                return false;
            }

            // Women's tournament filter
            if (filterState.womenOnly && !this.isWomenTournament(categoryLower, nameLower)) {
                return false;
            }

            // Team tournament filter
            if (!filterState.includeTeamTournaments && this.isTeamTournament(nameLower, categoryLower)) {
                return false;
            }

            // Time control filters
            if (filterState.classicalTime || filterState.rapidTime || filterState.blitzTime) {
                const hasMatchingTimeControl =
                    (filterState.classicalTime && this.isClassicalTime(categoryLower)) ||
                    (filterState.rapidTime && this.isRapidTime(categoryLower)) ||
                    (filterState.blitzTime && this.isBlitzTime(categoryLower));

                if (!hasMatchingTimeControl) {
                    return false;
                }
            }

            return true;
        });

        // Cache with FIFO eviction
        if (this.filterCache.size >= this.MAX_FILTER_CACHE_SIZE) {
            const firstKey = this.filterCache.keys().next().value;
            if (firstKey) {
                this.filterCache.delete(firstKey);
            }
        }
        this.filterCache.set(cacheKey, filtered);

        return filtered;
    }

    generateCacheKey(filterState) {
        return JSON.stringify({
            open: filterState.openOnly,
            youth: filterState.excludeYouth,
            med: filterState.mediterraneanOnly,
            senior: filterState.seniorCategory,
            women: filterState.womenOnly,
            team: filterState.includeTeamTournaments,
            classical: filterState.classicalTime,
            rapid: filterState.rapidTime,
            blitz: filterState.blitzTime,
            start: filterState.startDate?.toISOString(),
            end: filterState.endDate?.toISOString(),
            country: filterState.countryFilter
        });
    }

    isOpenCategory(category) {
        return /\bopen\b/i.test(category);
    }

    isYouthTournament(name, category) {
        const youthPattern = /\b(youth|junior|u\d+|u-\d+|under|school)\b/i;
        return youthPattern.test(name) || youthPattern.test(category);
    }

    isMediterraneanLocation(location, mediterraneanLocations) {
        for (const place of mediterraneanLocations) {
            if (location.includes(place.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    isSeniorCategory(category, name) {
        const seniorPattern = /\b(s50\+|s\s*50\+|s50|senior|veteran|50\+|50\s*\+|over\s*50|o50)\b/i;
        return seniorPattern.test(category) || seniorPattern.test(name);
    }

    isWomenTournament(category, name) {
        const womenPattern = /\b(women|ladies|female|femmes|mujeres|donne)\b/i;
        return womenPattern.test(category) || womenPattern.test(name);
    }

    isTeamTournament(name, category) {
        const teamPattern = /\b(team|mannschaft|équipe|equipo|squadra)\b/i;
        return teamPattern.test(name) || teamPattern.test(category);
    }

    isClassicalTime(category) {
        return /\b(classic|classical|standard)\b/i.test(category);
    }

    isRapidTime(category) {
        return /\brapid\b/i.test(category);
    }

    isBlitzTime(category) {
        return /\bblitz\b/i.test(category);
    }

    sortTournaments(tournaments, sortBy) {
        const sorted = [...tournaments];

        switch (sortBy) {
            case 'date-asc':
                sorted.sort((a, b) => a.date.getTime() - b.date.getTime());
                break;
            case 'date-desc':
                sorted.sort((a, b) => b.date.getTime() - a.date.getTime());
                break;
            case 'name':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'location':
                sorted.sort((a, b) => a.location.localeCompare(b.location));
                break;
            case 'country':
                sorted.sort((a, b) => {
                    const countryA = a.location.split(',').pop()?.trim() || '';
                    const countryB = b.location.split(',').pop()?.trim() || '';
                    return countryA.localeCompare(countryB);
                });
                break;
            default:
                sorted.sort((a, b) => a.date.getTime() - b.date.getTime());
        }

        return sorted;
    }
}

// Test suite
function runTests() {
    console.log('\n🧪 Running FilterService Unit Tests\n');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
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
        if (actual !== expected) {
            throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
        }
    }

    // Test data
    const tournaments = [
        {
            name: 'Barcelona Open',
            location: 'Barcelona, ESP',
            date: new Date('2025-06-01'),
            category: 'Classical Open',
            description: 'Test'
        },
        {
            name: 'Madrid Youth Championship',
            location: 'Madrid, ESP',
            date: new Date('2025-06-15'),
            category: 'Classical Youth U16',
            description: 'Test'
        },
        {
            name: 'Athens Senior Rapid',
            location: 'Athens, GRE',
            date: new Date('2025-07-01'),
            category: 'Rapid Open S50+',
            description: 'Test'
        },
        {
            name: 'Paris Women Blitz',
            location: 'Paris, FRA',
            date: new Date('2025-07-15'),
            category: 'Blitz Open Women',
            description: 'Test'
        },
        {
            name: 'Team Championship',
            location: 'Berlin, GER',
            date: new Date('2025-08-01'),
            category: 'Classical Team Open',
            description: 'Test'
        }
    ];

    const mediterraneanLocations = new Set(['barcelona', 'athens']);

    // Test 1: Filter open tournaments
    test('Filter open tournaments only', () => {
        const service = new FilterService();
        const filterState = {
            openOnly: true,
            excludeYouth: false,
            mediterraneanOnly: false,
            seniorCategory: false,
            womenOnly: false,
            includeTeamTournaments: true,
            classicalTime: true,
            rapidTime: true,
            blitzTime: true,
            startDate: null,
            endDate: null,
            countryFilter: ''
        };

        const filtered = service.filterTournaments(tournaments, filterState, mediterraneanLocations);
        assertEqual(filtered.length, 4); // All except Youth tournament (all others have "Open" in category)
    });

    // Test 2: Exclude youth tournaments
    test('Exclude youth tournaments', () => {
        const service = new FilterService();
        const filterState = {
            openOnly: false,
            excludeYouth: true,
            mediterraneanOnly: false,
            seniorCategory: false,
            womenOnly: false,
            includeTeamTournaments: true,
            classicalTime: true,
            rapidTime: true,
            blitzTime: true,
            startDate: null,
            endDate: null,
            countryFilter: ''
        };

        const filtered = service.filterTournaments(tournaments, filterState, mediterraneanLocations);
        assertEqual(filtered.length, 4); // All except Youth tournament
    });

    // Test 3: Filter Mediterranean locations
    test('Filter Mediterranean locations only', () => {
        const service = new FilterService();
        const filterState = {
            openOnly: false,
            excludeYouth: false,
            mediterraneanOnly: true,
            seniorCategory: false,
            womenOnly: false,
            includeTeamTournaments: true,
            classicalTime: true,
            rapidTime: true,
            blitzTime: true,
            startDate: null,
            endDate: null,
            countryFilter: ''
        };

        const filtered = service.filterTournaments(tournaments, filterState, mediterraneanLocations);
        assertEqual(filtered.length, 2); // Barcelona and Athens
    });

    // Test 4: Filter senior tournaments
    test('Filter senior category tournaments', () => {
        const service = new FilterService();
        const filterState = {
            openOnly: false,
            excludeYouth: false,
            mediterraneanOnly: false,
            seniorCategory: true,
            womenOnly: false,
            includeTeamTournaments: true,
            classicalTime: true,
            rapidTime: true,
            blitzTime: true,
            startDate: null,
            endDate: null,
            countryFilter: ''
        };

        const filtered = service.filterTournaments(tournaments, filterState, mediterraneanLocations);
        assertEqual(filtered.length, 1); // Athens Senior Rapid
    });

    // Test 5: Filter women's tournaments
    test('Filter women\'s tournaments', () => {
        const service = new FilterService();
        const filterState = {
            openOnly: false,
            excludeYouth: false,
            mediterraneanOnly: false,
            seniorCategory: false,
            womenOnly: true,
            includeTeamTournaments: true,
            classicalTime: true,
            rapidTime: true,
            blitzTime: true,
            startDate: null,
            endDate: null,
            countryFilter: ''
        };

        const filtered = service.filterTournaments(tournaments, filterState, mediterraneanLocations);
        assertEqual(filtered.length, 1); // Paris Women Blitz
    });

    // Test 6: Exclude team tournaments
    test('Exclude team tournaments', () => {
        const service = new FilterService();
        const filterState = {
            openOnly: false,
            excludeYouth: false,
            mediterraneanOnly: false,
            seniorCategory: false,
            womenOnly: false,
            includeTeamTournaments: false,
            classicalTime: true,
            rapidTime: true,
            blitzTime: true,
            startDate: null,
            endDate: null,
            countryFilter: ''
        };

        const filtered = service.filterTournaments(tournaments, filterState, mediterraneanLocations);
        assertEqual(filtered.length, 4); // All except Team Championship
    });

    // Test 7: Filter by date range
    test('Filter by date range', () => {
        const service = new FilterService();
        const filterState = {
            openOnly: false,
            excludeYouth: false,
            mediterraneanOnly: false,
            seniorCategory: false,
            womenOnly: false,
            includeTeamTournaments: true,
            classicalTime: true,
            rapidTime: true,
            blitzTime: true,
            startDate: new Date('2025-07-01'),
            endDate: new Date('2025-07-31'),
            countryFilter: ''
        };

        const filtered = service.filterTournaments(tournaments, filterState, mediterraneanLocations);
        assertEqual(filtered.length, 2); // Athens Senior and Paris Women
    });

    // Test 8: Filter by country
    test('Filter by country', () => {
        const service = new FilterService();
        const filterState = {
            openOnly: false,
            excludeYouth: false,
            mediterraneanOnly: false,
            seniorCategory: false,
            womenOnly: false,
            includeTeamTournaments: true,
            classicalTime: true,
            rapidTime: true,
            blitzTime: true,
            startDate: null,
            endDate: null,
            countryFilter: 'ESP'
        };

        const filtered = service.filterTournaments(tournaments, filterState, mediterraneanLocations);
        assertEqual(filtered.length, 2); // Barcelona and Madrid
    });

    // Test 9: Sort by date ascending
    test('Sort by date ascending', () => {
        const service = new FilterService();
        const sorted = service.sortTournaments(tournaments, 'date-asc');
        assertEqual(sorted[0].name, 'Barcelona Open');
        assertEqual(sorted[4].name, 'Team Championship');
    });

    // Test 10: Sort by date descending
    test('Sort by date descending', () => {
        const service = new FilterService();
        const sorted = service.sortTournaments(tournaments, 'date-desc');
        assertEqual(sorted[0].name, 'Team Championship');
        assertEqual(sorted[4].name, 'Barcelona Open');
    });

    // Test 11: Sort by name
    test('Sort by name alphabetically', () => {
        const service = new FilterService();
        const sorted = service.sortTournaments(tournaments, 'name');
        assertEqual(sorted[0].name, 'Athens Senior Rapid');
        assertEqual(sorted[4].name, 'Team Championship');
    });

    // Test 12: Sort by location
    test('Sort by location', () => {
        const service = new FilterService();
        const sorted = service.sortTournaments(tournaments, 'location');
        assertEqual(sorted[0].location, 'Athens, GRE');
        assertEqual(sorted[4].location, 'Paris, FRA');
    });

    // Test 13: Cache usage
    test('Filter cache is used on repeated calls', () => {
        const service = new FilterService();
        const filterState = {
            openOnly: true,
            excludeYouth: true,
            mediterraneanOnly: false,
            seniorCategory: false,
            womenOnly: false,
            includeTeamTournaments: false,
            classicalTime: true,
            rapidTime: true,
            blitzTime: true,
            startDate: null,
            endDate: null,
            countryFilter: ''
        };

        const filtered1 = service.filterTournaments(tournaments, filterState, mediterraneanLocations);
        const filtered2 = service.filterTournaments(tournaments, filterState, mediterraneanLocations);

        // Should be same reference (from cache)
        assertEqual(filtered1 === filtered2, true);
    });

    // Test 14: Clear cache
    test('Clear cache works', () => {
        const service = new FilterService();
        const filterState = {
            openOnly: true,
            excludeYouth: false,
            mediterraneanOnly: false,
            seniorCategory: false,
            womenOnly: false,
            includeTeamTournaments: true,
            classicalTime: true,
            rapidTime: true,
            blitzTime: true,
            startDate: null,
            endDate: null,
            countryFilter: ''
        };

        service.filterTournaments(tournaments, filterState, mediterraneanLocations);
        assertEqual(service.filterCache.size, 1);

        service.clearCache();
        assertEqual(service.filterCache.size, 0);
    });

    // Test 15: Combined filters
    test('Combined filters work correctly', () => {
        const service = new FilterService();
        const filterState = {
            openOnly: true,
            excludeYouth: true,
            mediterraneanOnly: true,
            seniorCategory: false,
            womenOnly: false,
            includeTeamTournaments: false,
            classicalTime: true,
            rapidTime: true,
            blitzTime: true,
            startDate: null,
            endDate: null,
            countryFilter: ''
        };

        const filtered = service.filterTournaments(tournaments, filterState, mediterraneanLocations);
        assertEqual(filtered.length, 2); // Barcelona Open and Athens Senior (both open, not youth, Mediterranean)
    });

    console.log('='.repeat(60));
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log(`✨ Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

    return failed === 0 ? 0 : 1;
}

// Run tests
process.exit(runTests());
