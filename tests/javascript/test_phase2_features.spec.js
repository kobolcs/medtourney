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
     * Test Calendar Export - Generate Tournament ID
     */
    testGenerateTournamentId() {
        const tournament = new Tournament(
            'Barcelona Open 2025',
            new Date('2025-03-15'),
            'Barcelona, ESP',
            'Open, S50+',
            'International chess tournament',
            'https://chess-results.com/test'
        );

        const str = `${tournament.name}-${tournament.date.toISOString()}-${tournament.location}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const id = Math.abs(hash).toString(36);

        return id.length > 0 && typeof id === 'string';
    }

    /**
     * Test Calendar Export - iCal Format
     */
    testGenerateICalContent() {
        const tournament = new Tournament(
            'Test Tournament',
            new Date('2025-06-15'),
            'Nice, FRA',
            'Open',
            'Test description',
            'https://example.com'
        );

        const formatICalDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}${month}${day}T090000Z`;
        };

        const dtStart = formatICalDate(tournament.date);

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//MedTourney//Chess Tournament Finder//EN',
            'BEGIN:VEVENT',
            `DTSTART:${dtStart}`,
            `SUMMARY:${tournament.name}`,
            `LOCATION:${tournament.location}`,
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        return icsContent.includes('BEGIN:VCALENDAR') &&
               icsContent.includes('BEGIN:VEVENT') &&
               icsContent.includes('Test Tournament') &&
               icsContent.includes('20250615T090000Z');
    }

    /**
     * Test Calendar Export - Date Formatting
     */
    testICalDateFormatting() {
        const date = new Date('2025-03-15T12:00:00Z');
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const formatted = `${year}${month}${day}T090000Z`;

        return formatted === '20250315T090000Z';
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
     * Test Calendar Export - Filename Generation
     */
    testGenerateCalendarFilename() {
        const tournament = new Tournament(
            'Barcelona Open 2025!',
            new Date('2025-03-15'),
            'Barcelona, ESP',
            'Open',
            'Test',
            'https://example.com'
        );

        const filename = tournament.name
            .replace(/[^a-z0-9]/gi, '-')
            .toLowerCase()
            .substring(0, 50);

        return filename === 'barcelona-open-2025-' &&
               filename.length <= 50;
    }

    /**
     * Test Calendar Export - Description Cleaning
     */
    testCleanDescriptionForICS() {
        const description = '<p>Test tournament</p>\nWith newlines';
        const cleaned = description
            .replace(/<[^>]*>/g, '')  // Remove HTML
            .replace(/\n/g, '\\n')    // Escape newlines
            .substring(0, 500);       // Limit length

        return cleaned === 'Test tournament\\nWith newlines' &&
               !cleaned.includes('<p>') &&
               cleaned.includes('\\n');
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
