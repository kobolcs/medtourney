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

            // Country filter — OR logic across selected codes
            if (filterState.countryFilter && filterState.countryFilter.length > 0) {
                const locationLower = tournament.location.toLowerCase();
                if (!filterState.countryFilter.some(code => locationLower.includes(code.toLowerCase()))) {
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

            // Exclude youth filter (bypassed when a specific U-category is targeted)
            if (filterState.excludeYouth && !filterState.youthCategory && this.isYouthTournament(nameLower, categoryLower)) {
                return false;
            }

            // Mediterranean filter
            if (filterState.mediterraneanOnly && !this.isMediterraneanLocation(locationLower, mediterraneanLocations)) {
                return false;
            }

            // Senior category filter (S50+ and/or S60+ — OR logic)
            if (filterState.seniorCategory || filterState.seniorS60) {
                const matches =
                    (filterState.seniorCategory && this.isSeniorCategory(categoryLower, nameLower)) ||
                    (filterState.seniorS60 && this.isSeniorS60Category(categoryLower, nameLower));
                if (!matches) return false;
            }

            // Youth category filter
            if (filterState.youthCategory && !this.matchesYouthCategory(nameLower, categoryLower, filterState.youthCategory)) {
                return false;
            }

            // Rating category filter
            if (filterState.ratingCategory && !this.matchesRatingCategory(nameLower, categoryLower, filterState.ratingCategory)) {
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

            // Minimum duration filter
            if (filterState.minDays === 'just-weekend') {
                if (!this.isJustWeekend(tournament)) return false;
            } else if (filterState.minDays === 'weekend') {
                if (!this.isLongWeekend(tournament)) return false;
            } else if (filterState.minDays > 0) {
                if (this.getTournamentDays(tournament) < filterState.minDays) return false;
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
            minDays: filterState.minDays,
            s60: filterState.seniorS60,
            youthCat: filterState.youthCategory,
            ratingCat: filterState.ratingCategory,
            country: (filterState.countryFilter || []).join(',')
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

    isSeniorS60Category(category, name) {
        const s60Pattern = /\b(s60\+?|s\s*60\+?|60\+|60\s*\+|over\s*60|o60)/i;
        return s60Pattern.test(category) || s60Pattern.test(name);
    }

    matchesYouthCategory(name, category, target) {
        const age = target.replace(/^u/i, '');
        const re = new RegExp(`\\bu[-\\s]?${age}\\b`, 'i');
        return re.test(name) || re.test(category);
    }

    matchesRatingCategory(name, category, target) {
        const rating = target.replace(/^u/i, '');
        const re = new RegExp(`\\bu[-\\s]?${rating}\\b`, 'i');
        return re.test(name) || re.test(category);
    }

    isWomenTournament(category, name) {
        const womenPattern = /\b(women|ladies|female|femmes|mujeres|donne)\b/i;
        return womenPattern.test(category) || womenPattern.test(name);
    }

    isTeamTournament(name, category) {
        const teamPattern = /\b(team|mannschaft|équipe|equipo|squadra)\b/i;
        return teamPattern.test(name) || teamPattern.test(category);
    }

    getTournamentDays(tournament) {
        if (!tournament.dateTo) return 1;
        const to = new Date(tournament.dateTo);
        if (isNaN(to.getTime())) return 1;
        return Math.round((to.getTime() - tournament.date.getTime()) / 86400000) + 1;
    }

    isJustWeekend(tournament) {
        const days = this.getTournamentDays(tournament);
        if (days > 2) return false;
        const startDay = tournament.date.getUTCDay();
        if (days === 1) return startDay === 6 || startDay === 0;
        return startDay === 6; // 2-day must start Saturday (→ ends Sunday)
    }

    isLongWeekend(tournament) {
        const days = this.getTournamentDays(tournament);
        if (days < 2 || days > 5) return false;
        let hasSat = false;
        let hasSun = false;
        for (let i = 0; i < days; i++) {
            const dow = new Date(tournament.date.getTime() + i * 86400000).getUTCDay();
            if (dow === 6) hasSat = true;
            if (dow === 0) hasSun = true;
        }
        return hasSat && hasSun;
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
            countryFilter: [],
            minDays: 0,
            seniorS60: false,
            youthCategory: ''
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
            countryFilter: [],
            minDays: 0,
            seniorS60: false,
            youthCategory: ''
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
            countryFilter: [],
            minDays: 0,
            seniorS60: false,
            youthCategory: ''
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
            countryFilter: [],
            minDays: 0,
            seniorS60: false,
            youthCategory: ''
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
            countryFilter: [],
            minDays: 0,
            seniorS60: false,
            youthCategory: ''
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
            countryFilter: [],
            minDays: 0,
            seniorS60: false,
            youthCategory: ''
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
            countryFilter: [],
            minDays: 0,
            seniorS60: false,
            youthCategory: ''
        };

        const filtered = service.filterTournaments(tournaments, filterState, mediterraneanLocations);
        assertEqual(filtered.length, 2); // Athens Senior and Paris Women
    });

    // Test 8: Filter by single country
    test('Filter by country', () => {
        const service = new FilterService();
        const filterState = {
            openOnly: false, excludeYouth: false, mediterraneanOnly: false,
            seniorCategory: false, womenOnly: false, includeTeamTournaments: true,
            classicalTime: true, rapidTime: true, blitzTime: true,
            startDate: null, endDate: null,
            countryFilter: ['ESP'],
            minDays: 0, seniorS60: false, youthCategory: '', ratingCategory: ''
        };
        const filtered = service.filterTournaments(tournaments, filterState, mediterraneanLocations);
        assertEqual(filtered.length, 2); // Barcelona and Madrid
    });

    // Test 8b: Multi-country OR logic
    test('Multi-country OR: Spain + Greece returns both', () => {
        const service = new FilterService();
        const filtered = service.filterTournaments(tournaments, {
            openOnly: false, excludeYouth: false, mediterraneanOnly: false,
            seniorCategory: false, womenOnly: false, includeTeamTournaments: true,
            classicalTime: true, rapidTime: true, blitzTime: true,
            startDate: null, endDate: null,
            countryFilter: ['ESP', 'GRE'],
            minDays: 0, seniorS60: false, youthCategory: '', ratingCategory: ''
        }, mediterraneanLocations);
        assertEqual(filtered.length, 3); // Barcelona, Madrid (ESP), Athens (GRE)
    });

    // Test 8c: Empty array = no country filter
    test('Empty countryFilter array shows all tournaments', () => {
        const service = new FilterService();
        const filtered = service.filterTournaments(tournaments, {
            openOnly: false, excludeYouth: false, mediterraneanOnly: false,
            seniorCategory: false, womenOnly: false, includeTeamTournaments: true,
            classicalTime: true, rapidTime: true, blitzTime: true,
            startDate: null, endDate: null,
            countryFilter: [],
            minDays: 0, seniorS60: false, youthCategory: '', ratingCategory: ''
        }, mediterraneanLocations);
        assertEqual(filtered.length, 5); // all tournaments
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
            countryFilter: [],
            minDays: 0,
            seniorS60: false,
            youthCategory: ''
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
            countryFilter: [],
            minDays: 0,
            seniorS60: false,
            youthCategory: ''
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
            countryFilter: [],
            minDays: 0,
            seniorS60: false,
            youthCategory: ''
        };

        const filtered = service.filterTournaments(tournaments, filterState, mediterraneanLocations);
        assertEqual(filtered.length, 2); // Barcelona Open and Athens Senior (both open, not youth, Mediterranean)
    });

    // Test 16: Duration filter — minDays=0 passes everything through
    test('minDays=0 does not filter any tournaments', () => {
        const service = new FilterService();
        const all = [
            { name: 'A', location: 'X', date: new Date('2025-06-01'), category: 'Open', description: '' },
            { name: 'B', location: 'X', date: new Date('2025-06-01'), dateTo: '2025-06-03', category: 'Open', description: '' },
        ];
        const filtered = service.filterTournaments(all, {
            openOnly: false, excludeYouth: false, mediterraneanOnly: false,
            seniorCategory: false, womenOnly: false, includeTeamTournaments: true,
            classicalTime: false, rapidTime: false, blitzTime: false,
            startDate: null, endDate: null, countryFilter: [], minDays: 0
        }, new Set());
        assertEqual(filtered.length, 2);
    });

    // Test 17: Duration filter — numeric minDays excludes short tournaments
    test('minDays=5 keeps only tournaments spanning 5+ days', () => {
        const service = new FilterService();
        const tourns = [
            { name: 'single', location: 'X', date: new Date('2025-06-01'), category: 'Open', description: '' },
            { name: 'three-day', location: 'X', date: new Date('2025-06-01'), dateTo: '2025-06-03', category: 'Open', description: '' },
            { name: 'five-day', location: 'X', date: new Date('2025-06-01'), dateTo: '2025-06-05', category: 'Open', description: '' },
            { name: 'nine-day', location: 'X', date: new Date('2025-06-01'), dateTo: '2025-06-09', category: 'Open', description: '' },
        ];
        const filtered = service.filterTournaments(tourns, {
            openOnly: false, excludeYouth: false, mediterraneanOnly: false,
            seniorCategory: false, womenOnly: false, includeTeamTournaments: true,
            classicalTime: false, rapidTime: false, blitzTime: false,
            startDate: null, endDate: null, countryFilter: [], minDays: 5, seniorS60: false, youthCategory: ''
        }, new Set());
        assertEqual(filtered.length, 2, 'only 5-day and 9-day pass');
        assertEqual(filtered[0].name, 'five-day');
        assertEqual(filtered[1].name, 'nine-day');
    });

    // Test 18: Duration filter — getTournamentDays handles missing/invalid dateTo as 1
    test('getTournamentDays returns 1 for missing or invalid dateTo', () => {
        const service = new FilterService();
        const base = { name: 'X', location: 'X', date: new Date('2025-06-01'), category: 'Open', description: '' };
        assertEqual(service.getTournamentDays(base), 1, 'no dateTo → 1');
        assertEqual(service.getTournamentDays({ ...base, dateTo: 'not-a-date' }), 1, 'invalid dateTo → 1');
        assertEqual(service.getTournamentDays({ ...base, dateTo: '2025-06-05' }), 5, '5-day span');
    });

    // Test 19: Long weekend — must include both Sat and Sun, and be ≤5 days
    test('isLongWeekend: Fri-Sun (3 days) qualifies', () => {
        const service = new FilterService();
        // 2025-09-19 is a Friday
        const t = { name: 'X', location: 'X', date: new Date('2025-09-19'), dateTo: '2025-09-21', category: 'Open', description: '' };
        assertEqual(service.isLongWeekend(t), true, 'Fri–Sun includes Sat+Sun');
    });

    test('isLongWeekend: Mon-Wed (3 days) does not qualify', () => {
        const service = new FilterService();
        // 2025-09-22 is a Monday
        const t = { name: 'X', location: 'X', date: new Date('2025-09-22'), dateTo: '2025-09-24', category: 'Open', description: '' };
        assertEqual(service.isLongWeekend(t), false, 'Mon–Wed has no Sat or Sun');
    });

    test('isLongWeekend: Sat-Wed (5 days) qualifies', () => {
        const service = new FilterService();
        // 2025-09-20 is a Saturday
        const t = { name: 'X', location: 'X', date: new Date('2025-09-20'), dateTo: '2025-09-24', category: 'Open', description: '' };
        assertEqual(service.isLongWeekend(t), true, 'Sat–Wed includes Sat+Sun');
    });

    test('isLongWeekend: 6-day event does not qualify (too long)', () => {
        const service = new FilterService();
        // 2025-09-19 is a Friday — Fri to Wed = 6 days, includes Sat+Sun but > 5 days
        const t = { name: 'X', location: 'X', date: new Date('2025-09-19'), dateTo: '2025-09-24', category: 'Open', description: '' };
        assertEqual(service.isLongWeekend(t), false, '6-day is not a long weekend');
    });

    test('long weekend filter via filterTournaments', () => {
        const service = new FilterService();
        const tourns = [
            // Fri–Sun 2025-09-19–21: qualifies
            { name: 'fri-sun', location: 'X', date: new Date('2025-09-19'), dateTo: '2025-09-21', category: 'Open', description: '' },
            // Mon–Wed: no weekend
            { name: 'mon-wed', location: 'X', date: new Date('2025-09-22'), dateTo: '2025-09-24', category: 'Open', description: '' },
            // No dateTo (1 day): excluded
            { name: 'single', location: 'X', date: new Date('2025-09-20'), category: 'Open', description: '' },
            // 6 days starting Fri: too long
            { name: 'too-long', location: 'X', date: new Date('2025-09-19'), dateTo: '2025-09-24', category: 'Open', description: '' },
        ];
        const filtered = service.filterTournaments(tourns, {
            openOnly: false, excludeYouth: false, mediterraneanOnly: false,
            seniorCategory: false, womenOnly: false, includeTeamTournaments: true,
            classicalTime: false, rapidTime: false, blitzTime: false,
            startDate: null, endDate: null, countryFilter: [], minDays: 'weekend', seniorS60: false, youthCategory: ''
        }, new Set());
        assertEqual(filtered.length, 1);
        assertEqual(filtered[0].name, 'fri-sun');
    });

    // Test 24: Just a weekend — Sat/Sun single-day and Sat+Sun 2-day all qualify
    test('just-weekend: 1-day Sat, 1-day Sun, and 2-day Sat+Sun all qualify', () => {
        const service = new FilterService();
        // 2025-09-20 = Saturday, 2025-09-21 = Sunday
        const tourns = [
            { name: 'single-sat', location: 'X', date: new Date('2025-09-20'), category: 'Open', description: '' },
            { name: 'single-sun', location: 'X', date: new Date('2025-09-21'), category: 'Open', description: '' },
            { name: 'sat-sun',    location: 'X', date: new Date('2025-09-20'), dateTo: '2025-09-21', category: 'Open', description: '' },
            // non-qualifying:
            { name: 'single-fri', location: 'X', date: new Date('2025-09-19'), category: 'Open', description: '' },
            { name: 'fri-sun',    location: 'X', date: new Date('2025-09-19'), dateTo: '2025-09-21', category: 'Open', description: '' },
            { name: 'sun-mon',    location: 'X', date: new Date('2025-09-21'), dateTo: '2025-09-22', category: 'Open', description: '' },
        ];
        const filtered = service.filterTournaments(tourns, {
            openOnly: false, excludeYouth: false, mediterraneanOnly: false,
            seniorCategory: false, womenOnly: false, includeTeamTournaments: true,
            classicalTime: false, rapidTime: false, blitzTime: false,
            startDate: null, endDate: null, countryFilter: [], minDays: 'just-weekend', seniorS60: false, youthCategory: ''
        }, new Set());
        assertEqual(filtered.length, 3, 'single-sat, single-sun, sat-sun qualify');
        assertEqual(filtered.map(t => t.name).join(','), 'single-sat,single-sun,sat-sun');
    });

    // Test 25: S60+ filter
    test('S60+ filter matches s60, s60+, 60+ patterns', () => {
        const service = new FilterService();
        const tourns = [
            { name: 'S60 Championship', location: 'X', date: new Date('2025-06-01'), category: 'Classical Open', description: '' },
            { name: 'Open S60+', location: 'X', date: new Date('2025-06-01'), category: 'Rapid S60+', description: '' },
            { name: 'Veterans 60+ Cup', location: 'X', date: new Date('2025-06-01'), category: 'Classical Open 60+', description: '' },
            { name: 'Regular Open', location: 'X', date: new Date('2025-06-01'), category: 'Classical Open', description: '' },
            { name: 'Senior Open', location: 'X', date: new Date('2025-06-01'), category: 'Classical Open S50+', description: '' },
        ];
        const filterState = {
            openOnly: false, excludeYouth: false, mediterraneanOnly: false,
            seniorCategory: false, womenOnly: false, includeTeamTournaments: true,
            classicalTime: false, rapidTime: false, blitzTime: false,
            startDate: null, endDate: null, countryFilter: [], minDays: 0,
            seniorS60: true, youthCategory: ''
        };
        const filtered = service.filterTournaments(tourns, filterState, new Set());
        assertEqual(filtered.length, 3, 'S60, S60+, and 60+ should match');
    });

    // Test 26: S50+ OR S60+ when both checked
    test('Both S50+ and S60+ checked returns union', () => {
        const service = new FilterService();
        const tourns = [
            { name: 'S50 Open', location: 'X', date: new Date('2025-06-01'), category: 'Classical Senior', description: '' },
            { name: 'S60 Open', location: 'X', date: new Date('2025-06-01'), category: 'Classical S60+', description: '' },
            { name: 'Youth Open', location: 'X', date: new Date('2025-06-01'), category: 'Classical Open', description: '' },
        ];
        const filtered = service.filterTournaments(tourns, {
            openOnly: false, excludeYouth: false, mediterraneanOnly: false,
            seniorCategory: true, womenOnly: false, includeTeamTournaments: true,
            classicalTime: false, rapidTime: false, blitzTime: false,
            startDate: null, endDate: null, countryFilter: [], minDays: 0,
            seniorS60: true, youthCategory: ''
        }, new Set());
        assertEqual(filtered.length, 2, 'Both S50+ and S60+ events returned');
    });

    // Test 27: U-category filter
    test('U14 filter shows only U14 tournaments', () => {
        const service = new FilterService();
        const tourns = [
            { name: 'Open U12', location: 'X', date: new Date('2025-06-01'), category: 'Classical Youth', description: '' },
            { name: 'Open U14', location: 'X', date: new Date('2025-06-01'), category: 'Classical Youth', description: '' },
            { name: 'Championship U-14', location: 'X', date: new Date('2025-06-01'), category: 'Rapid Youth U14', description: '' },
            { name: 'Open U16', location: 'X', date: new Date('2025-06-01'), category: 'Classical Youth', description: '' },
        ];
        const filtered = service.filterTournaments(tourns, {
            openOnly: false, excludeYouth: true, mediterraneanOnly: false,
            seniorCategory: false, womenOnly: false, includeTeamTournaments: true,
            classicalTime: false, rapidTime: false, blitzTime: false,
            startDate: null, endDate: null, countryFilter: [], minDays: 0,
            seniorS60: false, youthCategory: 'U14'
        }, new Set());
        assertEqual(filtered.length, 2, 'U14 and U-14 both match; excludeYouth overridden');
        assertEqual(filtered[0].name, 'Open U14');
        assertEqual(filtered[1].name, 'Championship U-14');
    });

    // Test 28: U-category overrides excludeYouth
    test('Setting U-category overrides excludeYouth', () => {
        const service = new FilterService();
        const tourns = [
            { name: 'U12 Rapid', location: 'X', date: new Date('2025-06-01'), category: 'Youth Rapid U12', description: '' },
            { name: 'Adult Open', location: 'X', date: new Date('2025-06-01'), category: 'Classical Open', description: '' },
        ];
        // excludeYouth is true but youthCategory='U12' should override it
        const filtered = service.filterTournaments(tourns, {
            openOnly: false, excludeYouth: true, mediterraneanOnly: false,
            seniorCategory: false, womenOnly: false, includeTeamTournaments: true,
            classicalTime: false, rapidTime: false, blitzTime: false,
            startDate: null, endDate: null, countryFilter: [], minDays: 0,
            seniorS60: false, youthCategory: 'U12'
        }, new Set());
        assertEqual(filtered.length, 1, 'U12 tournament passes despite excludeYouth=true');
        assertEqual(filtered[0].name, 'U12 Rapid');
    });

    // Test 29: Rating category filter — exact band match
    test('U1800 filter shows only U1800 tournaments', () => {
        const service = new FilterService();
        const tourns = [
            { name: 'Open U1600', location: 'X', date: new Date('2025-06-01'), category: 'Classical Open', description: '' },
            { name: 'Open U1800', location: 'X', date: new Date('2025-06-01'), category: 'Classical Open', description: '' },
            { name: 'Championship U-1800', location: 'X', date: new Date('2025-06-01'), category: 'Rapid Open U1800', description: '' },
            { name: 'Open U2000', location: 'X', date: new Date('2025-06-01'), category: 'Classical Open', description: '' },
        ];
        const filtered = service.filterTournaments(tourns, {
            openOnly: false, excludeYouth: false, mediterraneanOnly: false,
            seniorCategory: false, womenOnly: false, includeTeamTournaments: true,
            classicalTime: false, rapidTime: false, blitzTime: false,
            startDate: null, endDate: null, countryFilter: [], minDays: 0,
            seniorS60: false, youthCategory: '', ratingCategory: 'U1800'
        }, new Set());
        assertEqual(filtered.length, 2, 'U1800 and U-1800 both match; U1600 and U2000 excluded');
        assertEqual(filtered[0].name, 'Open U1800');
        assertEqual(filtered[1].name, 'Championship U-1800');
    });

    // Test 30: Rating filter does not match a different band
    test('U1800 filter does not match U1600 or U2000', () => {
        const service = new FilterService();
        const tourns = [
            { name: 'Festival U1600', location: 'X', date: new Date('2025-06-01'), category: 'Classical Open', description: '' },
            { name: 'Festival U2000', location: 'X', date: new Date('2025-06-01'), category: 'Classical Open U2000', description: '' },
        ];
        const filtered = service.filterTournaments(tourns, {
            openOnly: false, excludeYouth: false, mediterraneanOnly: false,
            seniorCategory: false, womenOnly: false, includeTeamTournaments: true,
            classicalTime: false, rapidTime: false, blitzTime: false,
            startDate: null, endDate: null, countryFilter: [], minDays: 0,
            seniorS60: false, youthCategory: '', ratingCategory: 'U1800'
        }, new Set());
        assertEqual(filtered.length, 0, 'neither U1600 nor U2000 should match U1800');
    });

    // Test 31: Empty ratingCategory passes everything
    test('Empty ratingCategory does not filter', () => {
        const service = new FilterService();
        const tourns = [
            { name: 'Open U1400', location: 'X', date: new Date('2025-06-01'), category: 'Classical Open', description: '' },
            { name: 'Open U2200', location: 'X', date: new Date('2025-06-01'), category: 'Rapid Open', description: '' },
            { name: 'No Rating Class', location: 'X', date: new Date('2025-06-01'), category: 'Classical Open', description: '' },
        ];
        const filtered = service.filterTournaments(tourns, {
            openOnly: false, excludeYouth: false, mediterraneanOnly: false,
            seniorCategory: false, womenOnly: false, includeTeamTournaments: true,
            classicalTime: false, rapidTime: false, blitzTime: false,
            startDate: null, endDate: null, countryFilter: [], minDays: 0,
            seniorS60: false, youthCategory: '', ratingCategory: ''
        }, new Set());
        assertEqual(filtered.length, 3, 'no filtering when ratingCategory is empty');
    });

    console.log('='.repeat(60));
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log(`✨ Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

    return failed === 0 ? 0 : 1;
}

// Run tests
process.exit(runTests());
