/**
 * Unit tests for ExportService
 * Tests CSV export and iCalendar generation
 */

// Simple ExportService implementation for testing
class ExportService {
    exportToCSV(tournaments) {
        if (!tournaments || tournaments.length === 0) {
            throw new Error('No tournaments to export');
        }

        const headers = ['Name', 'Location', 'Date', 'Category', 'URL'];
        const rows = tournaments.map(t => [
            this.escapeCSV(t.name),
            this.escapeCSV(t.location),
            t.date.toLocaleDateString('en-GB'),
            this.escapeCSV(t.category),
            t.url
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        return csvContent;
    }

    escapeCSV(value) {
        if (typeof value !== 'string') return value;
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }

    exportToCalendar(tournament) {
        const icsContent = this.generateICSContent(tournament);
        return icsContent;
    }

    generateICSContent(tournament) {
        const uid = this.generateTournamentId(tournament);
        const dtstart = this.formatDateForICS(tournament.date);
        const description = this.cleanDescription(tournament.description || tournament.name);

        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//MedTourney//Chess Tournament Finder//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${this.formatDateForICS(new Date())}`,
            `DTSTART;VALUE=DATE:${dtstart}`,
            `SUMMARY:${this.escapeICS(tournament.name)}`,
            `LOCATION:${this.escapeICS(tournament.location)}`,
            `DESCRIPTION:${this.escapeICS(description)}`,
            `URL:${tournament.url}`,
            'STATUS:CONFIRMED',
            'SEQUENCE:0',
            'BEGIN:VALARM',
            'TRIGGER:-P1D',
            'ACTION:DISPLAY',
            `DESCRIPTION:Reminder: ${this.escapeICS(tournament.name)}`,
            'END:VALARM',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        return ics;
    }

    generateTournamentId(tournament) {
        const str = `${tournament.name}-${tournament.location}-${tournament.date.toISOString()}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `medtourney-${Math.abs(hash)}@medtourney.github.io`;
    }

    formatDateForICS(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    }

    cleanDescription(description) {
        // Remove HTML tags
        let cleaned = description.replace(/<[^>]*>/g, '');
        // Limit length
        if (cleaned.length > 200) {
            cleaned = cleaned.substring(0, 197) + '...';
        }
        return cleaned;
    }

    escapeICS(value) {
        if (typeof value !== 'string') return value;
        return value
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n');
    }

    generateSafeFilename(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .substring(0, 50);
    }
}

// Test suite
function runTests() {
    console.log('\n🧪 Running ExportService Unit Tests\n');
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
            throw new Error(`${message || 'Assertion failed'}: expected "${expected}", got "${actual}"`);
        }
    }

    function assertContains(str, substring, message) {
        if (!str.includes(substring)) {
            throw new Error(`${message || 'Assertion failed'}: "${str}" does not contain "${substring}"`);
        }
    }

    function assertThrows(fn, message) {
        let threw = false;
        try {
            fn();
        } catch (e) {
            threw = true;
        }
        if (!threw) {
            throw new Error(message || 'Expected function to throw');
        }
    }

    // Test data
    const tournament = {
        name: 'Barcelona Open 2025',
        location: 'Barcelona, ESP',
        date: new Date('2025-06-01'),
        category: 'Open',
        url: 'https://chess-results.com/tournament123',
        description: 'International chess tournament in Barcelona'
    };

    const tournaments = [
        tournament,
        {
            name: 'Athens Rapid',
            location: 'Athens, GRE',
            date: new Date('2025-07-15'),
            category: 'Rapid',
            url: 'https://chess-results.com/tournament456',
            description: 'Rapid chess in Athens'
        }
    ];

    // Test 1: CSV export with single tournament
    test('CSV export with single tournament', () => {
        const service = new ExportService();
        const csv = service.exportToCSV([tournament]);

        assertContains(csv, 'Name,Location,Date,Category,URL');
        assertContains(csv, 'Barcelona Open 2025');
        assertContains(csv, 'Barcelona, ESP');
    });

    // Test 2: CSV export with multiple tournaments
    test('CSV export with multiple tournaments', () => {
        const service = new ExportService();
        const csv = service.exportToCSV(tournaments);

        const lines = csv.split('\n');
        assertEqual(lines.length, 3); // Header + 2 tournaments
        assertContains(csv, 'Barcelona Open 2025');
        assertContains(csv, 'Athens Rapid');
    });

    // Test 3: CSV escaping commas
    test('CSV escaping commas in values', () => {
        const service = new ExportService();
        const tournamentWithComma = {
            ...tournament,
            name: 'Barcelona Open, 2025'
        };

        const csv = service.exportToCSV([tournamentWithComma]);
        assertContains(csv, '"Barcelona Open, 2025"');
    });

    // Test 4: CSV escaping quotes
    test('CSV escaping quotes in values', () => {
        const service = new ExportService();
        const tournamentWithQuote = {
            ...tournament,
            name: 'Barcelona "Premium" Open'
        };

        const csv = service.exportToCSV([tournamentWithQuote]);
        assertContains(csv, '"Barcelona ""Premium"" Open"');
    });

    // Test 5: CSV empty tournaments throws error
    test('CSV export with empty array throws error', () => {
        const service = new ExportService();
        assertThrows(() => service.exportToCSV([]), 'Should throw on empty array');
    });

    // Test 6: iCalendar generation
    test('iCalendar generation has correct structure', () => {
        const service = new ExportService();
        const ics = service.exportToCalendar(tournament);

        assertContains(ics, 'BEGIN:VCALENDAR');
        assertContains(ics, 'END:VCALENDAR');
        assertContains(ics, 'BEGIN:VEVENT');
        assertContains(ics, 'END:VEVENT');
        assertContains(ics, 'VERSION:2.0');
    });

    // Test 7: iCalendar contains tournament data
    test('iCalendar contains tournament data', () => {
        const service = new ExportService();
        const ics = service.exportToCalendar(tournament);

        assertContains(ics, 'SUMMARY:Barcelona Open 2025');
        assertContains(ics, 'LOCATION:Barcelona\\, ESP');
        assertContains(ics, 'URL:https://chess-results.com/tournament123');
    });

    // Test 8: iCalendar has alarm
    test('iCalendar has 1-day reminder alarm', () => {
        const service = new ExportService();
        const ics = service.exportToCalendar(tournament);

        assertContains(ics, 'BEGIN:VALARM');
        assertContains(ics, 'TRIGGER:-P1D');
        assertContains(ics, 'ACTION:DISPLAY');
        assertContains(ics, 'END:VALARM');
    });

    // Test 9: iCalendar STATUS is CONFIRMED
    test('iCalendar status is CONFIRMED', () => {
        const service = new ExportService();
        const ics = service.exportToCalendar(tournament);

        assertContains(ics, 'STATUS:CONFIRMED');
    });

    // Test 10: iCalendar uses CRLF line endings
    test('iCalendar uses CRLF line endings', () => {
        const service = new ExportService();
        const ics = service.exportToCalendar(tournament);

        assertContains(ics, '\r\n');
    });

    // Test 11: Generate unique tournament ID
    test('Generate unique tournament ID', () => {
        const service = new ExportService();
        const id1 = service.generateTournamentId(tournament);
        const id2 = service.generateTournamentId({
            ...tournament,
            name: 'Different Tournament'
        });

        assertContains(id1, 'medtourney-');
        assertContains(id1, '@medtourney.github.io');

        // Different tournaments should have different IDs
        if (id1 === id2) {
            throw new Error('Different tournaments should have different IDs');
        }
    });

    // Test 12: Generate consistent tournament ID
    test('Generate consistent tournament ID', () => {
        const service = new ExportService();
        const id1 = service.generateTournamentId(tournament);
        const id2 = service.generateTournamentId(tournament);

        assertEqual(id1, id2);
    });

    // Test 13: Format date for ICS
    test('Format date for iCalendar correctly', () => {
        const service = new ExportService();
        const date = new Date('2025-06-01T00:00:00Z');
        const formatted = service.formatDateForICS(date);

        assertContains(formatted, '20250601');
        assertContains(formatted, 'T');
        assertContains(formatted, 'Z');
    });

    // Test 14: Clean HTML from description
    test('Clean HTML tags from description', () => {
        const service = new ExportService();
        const dirtyDescription = '<p>Tournament in <b>Barcelona</b></p>';
        const cleaned = service.cleanDescription(dirtyDescription);

        assertEqual(cleaned, 'Tournament in Barcelona');
    });

    // Test 15: Limit description length
    test('Limit description length to 200 characters', () => {
        const service = new ExportService();
        const longDescription = 'A'.repeat(300);
        const cleaned = service.cleanDescription(longDescription);

        assertEqual(cleaned.length, 200);
        assertContains(cleaned, '...');
    });

    // Test 16: Escape ICS special characters
    test('Escape ICS special characters', () => {
        const service = new ExportService();

        assertEqual(service.escapeICS('Text with, comma'), 'Text with\\, comma');
        assertEqual(service.escapeICS('Text with; semicolon'), 'Text with\\; semicolon');
        assertEqual(service.escapeICS('Text with\nNewline'), 'Text with\\nNewline');
    });

    // Test 17: Generate safe filename
    test('Generate safe filename from tournament name', () => {
        const service = new ExportService();

        const filename1 = service.generateSafeFilename('Barcelona Open 2025!');
        assertEqual(filename1, 'barcelona_open_2025');

        const filename2 = service.generateSafeFilename('Test@#$%Tournament');
        assertEqual(filename2, 'test_tournament');
    });

    // Test 18: Safe filename length limit
    test('Safe filename has length limit', () => {
        const service = new ExportService();
        const longName = 'A'.repeat(100);
        const filename = service.generateSafeFilename(longName);

        if (filename.length > 50) {
            throw new Error(`Filename too long: ${filename.length} characters`);
        }
    });

    console.log('='.repeat(60));
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log(`✨ Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

    return failed === 0 ? 0 : 1;
}

// Run tests
process.exit(runTests());
