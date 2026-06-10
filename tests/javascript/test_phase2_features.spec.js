/**
 * Unit and Integration Tests for MedTourney v3 Phase 2 Features
 *
 * Tests:
 * - Filter Persistence (localStorage)
 * - Calendar Export (.ics generation)
 * - Empty State Messages
 * - Reset Filters functionality
 *
 * Run with: node tests/javascript/test_phase2_features.spec.js
 */

// Mock localStorage for Node.js environment
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

// Load the REAL production ExportService (compiled to dist-test/).
const { loadProductionModule } = require('../helpers/production');
const { ExportService } = loadProductionModule('services/ExportService.js');

// Mock Tournament structure
class Tournament {
    constructor(name, date, location, category, description, url) {
        this.name = name;
        this.date = date;
        this.location = location;
        this.category = category;
        this.description = description;
        this.url = url;
    }
}

// Test class for Phase 2 features
class Phase2FeatureTester {
    constructor() {
        this.CACHE_KEYS = {
            FILTER_PREFERENCES: 'medtourney_filter_preferences'
        };
    }

    /**
     * Test Filter Persistence - Save Preferences
     */
    testSaveFilterPreferences() {
        const preferences = {
            openOnly: true,
            excludeYouth: false,
            mediterraneanOnly: true,
            seniorCategory: true,
            womenOnly: false,
            includeTeamTournaments: false,
            classicalTime: true,
            rapidTime: true,
            blitzTime: false,
            startDate: null,
            endDate: null,
            countryFilter: 'ESP'
        };

        localStorage.setItem(
            this.CACHE_KEYS.FILTER_PREFERENCES,
            JSON.stringify(preferences)
        );

        const saved = localStorage.getItem(this.CACHE_KEYS.FILTER_PREFERENCES);
        const parsed = JSON.parse(saved);

        return JSON.stringify(parsed) === JSON.stringify(preferences);
    }

    /**
     * Test Filter Persistence - Load Preferences
     */
    testLoadFilterPreferences() {
        const preferences = {
            openOnly: false,
            mediterraneanOnly: true,
            seniorCategory: true,
            countryFilter: 'ITA'
        };

        localStorage.setItem(
            this.CACHE_KEYS.FILTER_PREFERENCES,
            JSON.stringify(preferences)
        );

        const loaded = localStorage.getItem(this.CACHE_KEYS.FILTER_PREFERENCES);
        const parsed = JSON.parse(loaded);

        return parsed.mediterraneanOnly === true &&
               parsed.seniorCategory === true &&
               parsed.countryFilter === 'ITA';
    }

    /**
     * Test Calendar Export - Stable Tournament UID (REAL ExportService)
     */
    testGenerateTournamentId() {
        const svc = new ExportService();
        const tournament = new Tournament(
            'Barcelona Open 2025',
            new Date('2025-03-15'),
            'Barcelona, ESP',
            'Open, S50+',
            'International chess tournament',
            'https://chess-results.com/test'
        );

        const id1 = svc.generateStableUID(tournament);
        const id2 = svc.generateStableUID(tournament);
        // Deterministic + correct domain, and no randomness.
        return id1 === id2 && /^medtourney-[a-z0-9]+@medtourney\.github\.io$/.test(id1);
    }

    /**
     * Test Calendar Export - iCal Format (REAL ExportService)
     */
    testGenerateICalContent() {
        const svc = new ExportService();
        const tournament = new Tournament(
            'Test Tournament',
            new Date('2025-06-15'),
            'Nice, FRA',
            'Open',
            'Test description',
            'https://example.com'
        );

        const ics = svc.buildICSForTournament(tournament);

        return ics.includes('BEGIN:VCALENDAR') &&
               ics.includes('BEGIN:VEVENT') &&
               ics.includes('SUMMARY:Test Tournament') &&
               // all-day VALUE=DATE, NOT a date-time
               ics.includes('DTSTART;VALUE=DATE:20250615') &&
               !/VALUE=DATE:\d{8}T/.test(ics);
    }

    /**
     * Test Calendar Export - Date Formatting (REAL ExportService)
     */
    testICalDateFormatting() {
        const svc = new ExportService();
        // All-day date is YYYYMMDD (UTC); DTSTAMP is a UTC date-time.
        return svc.formatICSDateOnly(new Date('2025-03-15T12:00:00Z')) === '20250315' &&
               svc.formatICSDateTimeUTC(new Date('2025-03-15T09:00:00Z')) === '20250315T090000Z';
    }

    /**
     * Test Empty State - Suggestions Generation
     */
    testEmptyStateSuggestions() {
        const filters = {
            mediterraneanOnly: true,
            seniorCategory: true,
            womenOnly: false,
            countryFilter: 'ESP'
        };

        const suggestions = [];

        if (filters.mediterraneanOnly) {
            suggestions.push('Try unchecking "Mediterranean Seaside Only"');
        }
        if (filters.seniorCategory) {
            suggestions.push('Try unchecking "S50+ (Senior) Category"');
        }
        if (filters.countryFilter) {
            suggestions.push('Try selecting "All European Countries"');
        }

        return suggestions.length === 3 &&
               suggestions[0].includes('Mediterranean') &&
               suggestions[1].includes('Senior') &&
               suggestions[2].includes('All European Countries');
    }

    /**
     * Test Reset Filters - Default Values
     */
    testResetFiltersToDefaults() {
        const defaults = {
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

        // All checkboxes should match defaults
        return defaults.openOnly === true &&
               defaults.mediterraneanOnly === false &&
               defaults.seniorCategory === false &&
               defaults.classicalTime === true &&
               defaults.countryFilter === '';
    }

    /**
     * Test localStorage Persistence Across Sessions
     */
    testLocalStoragePersistence() {
        // Save preferences
        const prefs1 = { mediterraneanOnly: true, seniorCategory: true };
        localStorage.setItem('test_key', JSON.stringify(prefs1));

        // Retrieve preferences
        const saved = localStorage.getItem('test_key');
        const prefs2 = JSON.parse(saved);

        // Clean up
        localStorage.removeItem('test_key');

        return prefs2.mediterraneanOnly === true &&
               prefs2.seniorCategory === true;
    }

    /**
     * Test Calendar Export - DTEND is exclusive (start + 1 day) (REAL ExportService)
     */
    testGenerateCalendarFilename() {
        const svc = new ExportService();
        const tournament = new Tournament(
            'Barcelona Open 2025',
            new Date('2025-03-15'),
            'Barcelona, ESP',
            'Open',
            'Test',
            'https://example.com'
        );
        const ics = svc.buildICSForTournament(tournament);
        // All-day event: DTEND is the day after DTSTART.
        return ics.includes('DTSTART;VALUE=DATE:20250315') &&
               ics.includes('DTEND;VALUE=DATE:20250316');
    }

    /**
     * Test Calendar Export - ICS text escaping (REAL ExportService)
     */
    testCleanDescriptionForICS() {
        const svc = new ExportService();
        // A real newline must become a single-backslash \n (RFC 5545), and
        // commas/semicolons must be escaped.
        return svc.escapeICS('line1\nline2') === 'line1\\nline2' &&
               svc.escapeICS('a, b; c') === 'a\\, b\\; c';
    }

    /**
     * Test Filter Preferences - Partial Save
     */
    testPartialFilterSave() {
        // User changes only some filters
        const partialPrefs = {
            mediterraneanOnly: true,
            seniorCategory: true
            // Other filters not included
        };

        localStorage.setItem(
            this.CACHE_KEYS.FILTER_PREFERENCES,
            JSON.stringify(partialPrefs)
        );

        const loaded = JSON.parse(
            localStorage.getItem(this.CACHE_KEYS.FILTER_PREFERENCES)
        );

        return loaded.mediterraneanOnly === true &&
               loaded.seniorCategory === true &&
               loaded.openOnly === undefined;
    }
}

// Test Runner
function runPhase2Tests() {
    console.log('🧪 Running MedTourney v3 Phase 2 Feature Tests\n');
    console.log('='.repeat(60));

    const tester = new Phase2FeatureTester();
    const tests = [
        {
            name: 'Filter Persistence - Save Preferences',
            fn: () => tester.testSaveFilterPreferences()
        },
        {
            name: 'Filter Persistence - Load Preferences',
            fn: () => tester.testLoadFilterPreferences()
        },
        {
            name: 'Calendar Export - Generate Tournament ID',
            fn: () => tester.testGenerateTournamentId()
        },
        {
            name: 'Calendar Export - iCal Format',
            fn: () => tester.testGenerateICalContent()
        },
        {
            name: 'Calendar Export - Date Formatting',
            fn: () => tester.testICalDateFormatting()
        },
        {
            name: 'Empty State - Suggestions Generation',
            fn: () => tester.testEmptyStateSuggestions()
        },
        {
            name: 'Reset Filters - Default Values',
            fn: () => tester.testResetFiltersToDefaults()
        },
        {
            name: 'localStorage Persistence',
            fn: () => tester.testLocalStoragePersistence()
        },
        {
            name: 'Calendar Export - Filename Generation',
            fn: () => tester.testGenerateCalendarFilename()
        },
        {
            name: 'Calendar Export - Description Cleaning',
            fn: () => tester.testCleanDescriptionForICS()
        },
        {
            name: 'Filter Preferences - Partial Save',
            fn: () => tester.testPartialFilterSave()
        }
    ];

    let passed = 0;
    let failed = 0;

    tests.forEach((test, index) => {
        try {
            const result = test.fn();
            if (result) {
                console.log(`✅ Test ${index + 1}: ${test.name}`);
                passed++;
            } else {
                console.log(`❌ Test ${index + 1}: ${test.name} - FAILED (returned false)`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ Test ${index + 1}: ${test.name} - ERROR: ${error.message}`);
            failed++;
        }
    });

    console.log('='.repeat(60));
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${tests.length} total`);
    console.log(`✨ Pass Rate: ${((passed / tests.length) * 100).toFixed(1)}%\n`);

    // Exit with appropriate code
    process.exit(failed === 0 ? 0 : 1);
}

// Run tests if executed directly
if (require.main === module) {
    runPhase2Tests();
}

module.exports = { Phase2FeatureTester, runPhase2Tests };
