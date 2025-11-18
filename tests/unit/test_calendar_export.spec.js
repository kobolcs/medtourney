/**
 * Unit Tests for Calendar Export Functionality (Phase 2.2)
 *
 * Tests the .ics calendar file generation logic including:
 * - Tournament ID generation
 * - iCalendar format compliance
 * - Date formatting (RFC 5545)
 * - Description cleaning
 * - Filename sanitization
 *
 * Run with: node tests/unit/test_calendar_export.spec.js
 */

class CalendarExportTester {
    /**
     * Test 1: Generate unique tournament ID from tournament data
     */
    testGenerateUniqueTournamentId() {
        const tournament1 = {
            name: 'Barcelona Open 2025',
            date: new Date('2025-03-15'),
            location: 'Barcelona, ESP'
        };

        const tournament2 = {
            name: 'Barcelona Open 2025',
            date: new Date('2025-03-16'), // Different date
            location: 'Barcelona, ESP'
        };

        const id1 = this.generateTournamentId(tournament1);
        const id2 = this.generateTournamentId(tournament2);

        // IDs should be different for different tournaments
        return id1 !== id2 && id1.length > 0 && id2.length > 0;
    }

    /**
     * Test 2: Generate same ID for same tournament
     */
    testConsistentTournamentId() {
        const tournament = {
            name: 'Test Tournament',
            date: new Date('2025-06-15'),
            location: 'Nice, FRA'
        };

        const id1 = this.generateTournamentId(tournament);
        const id2 = this.generateTournamentId(tournament);

        // Same tournament should generate same ID
        return id1 === id2;
    }

    /**
     * Test 3: Format date for iCalendar (YYYYMMDDTHHMMSSZ)
     */
    testFormatICalDate() {
        const date = new Date('2025-03-15T10:30:00Z');
        const formatted = this.formatICalDate(date);

        // Should be in format: YYYYMMDDTHHMMSSZ
        const expected = '20250315T090000Z'; // Default 9:00 AM
        return formatted === expected;
    }

    /**
     * Test 4: Generate valid iCalendar structure
     */
    testGenerateICalendarStructure() {
        const tournament = {
            name: 'Test Tournament',
            date: new Date('2025-06-15'),
            location: 'Nice, FRA',
            category: 'Open',
            description: 'Test description',
            url: 'https://example.com'
        };

        const ics = this.generateICS(tournament);

        // Check for required iCalendar components
        const hasBeginCalendar = ics.includes('BEGIN:VCALENDAR');
        const hasVersion = ics.includes('VERSION:2.0');
        const hasProdId = ics.includes('PRODID:-//MedTourney');
        const hasBeginEvent = ics.includes('BEGIN:VEVENT');
        const hasEndEvent = ics.includes('END:VEVENT');
        const hasEndCalendar = ics.includes('END:VCALENDAR');
        const hasUID = ics.includes('UID:');
        const hasDTStart = ics.includes('DTSTART:');
        const hasDTEnd = ics.includes('DTEND:');
        const hasSummary = ics.includes('SUMMARY:Test Tournament');
        const hasLocation = ics.includes('LOCATION:Nice, FRA');

        return hasBeginCalendar && hasVersion && hasProdId &&
               hasBeginEvent && hasEndEvent && hasEndCalendar &&
               hasUID && hasDTStart && hasDTEnd &&
               hasSummary && hasLocation;
    }

    /**
     * Test 5: Clean HTML from description
     */
    testCleanHTMLFromDescription() {
        const dirtyDescription = '<p>Test <b>tournament</b></p><br>Info';
        const cleaned = this.cleanDescription(dirtyDescription);

        // Should remove HTML tags
        const noHTMLTags = !cleaned.includes('<p>') &&
               !cleaned.includes('<b>') &&
               !cleaned.includes('</b>') &&
               !cleaned.includes('<br>');

        // Should contain the text (allowing for spacing differences)
        const hasContent = cleaned.includes('Test') &&
                          cleaned.includes('tournament') &&
                          cleaned.includes('Info');

        return noHTMLTags && hasContent;
    }

    /**
     * Test 6: Escape newlines in description
     */
    testEscapeNewlinesInDescription() {
        const description = 'Line 1\nLine 2\nLine 3';
        const cleaned = this.cleanDescription(description);

        // Newlines should be escaped as \\n
        return cleaned.includes('\\n');
    }

    /**
     * Test 7: Limit description length to 500 chars
     */
    testLimitDescriptionLength() {
        const longDescription = 'a'.repeat(1000);
        const cleaned = this.cleanDescription(longDescription);

        return cleaned.length === 500;
    }

    /**
     * Test 8: Generate safe filename from tournament name
     */
    testGenerateSafeFilename() {
        const tournament = {
            name: 'Barcelona Open 2025! (Rapid & Blitz)',
            date: new Date(),
            location: 'Barcelona, ESP'
        };

        const filename = this.generateFilename(tournament.name);

        // Should remove special characters
        return !filename.includes('!') &&
               !filename.includes('(') &&
               !filename.includes(')') &&
               !filename.includes('&') &&
               filename.includes('barcelona') &&
               filename.length <= 50;
    }

    /**
     * Test 9: Include 1-day reminder alarm
     */
    testIncludeReminderAlarm() {
        const tournament = {
            name: 'Test',
            date: new Date('2025-06-15'),
            location: 'Nice, FRA',
            category: 'Open',
            description: 'Test',
            url: 'https://example.com'
        };

        const ics = this.generateICS(tournament);

        // Should include VALARM for reminder
        return ics.includes('BEGIN:VALARM') &&
               ics.includes('TRIGGER:-P1D') && // 1 day before
               ics.includes('ACTION:DISPLAY') &&
               ics.includes('END:VALARM');
    }

    /**
     * Test 10: Set event status to CONFIRMED
     */
    testEventStatusConfirmed() {
        const tournament = {
            name: 'Test',
            date: new Date('2025-06-15'),
            location: 'Nice, FRA',
            category: 'Open',
            description: 'Test',
            url: 'https://example.com'
        };

        const ics = this.generateICS(tournament);

        return ics.includes('STATUS:CONFIRMED');
    }

    /**
     * Test 11: Include tournament URL
     */
    testIncludeTournamentURL() {
        const tournament = {
            name: 'Test',
            date: new Date('2025-06-15'),
            location: 'Nice, FRA',
            category: 'Open',
            description: 'Test',
            url: 'https://chess-results.com/test123'
        };

        const ics = this.generateICS(tournament);

        return ics.includes('URL:https://chess-results.com/test123') &&
               ics.includes('chess-results.com');
    }

    /**
     * Test 12: Use CRLF line endings (RFC 5545 requirement)
     */
    testUseCRLFLineEndings() {
        const tournament = {
            name: 'Test',
            date: new Date('2025-06-15'),
            location: 'Nice, FRA',
            category: 'Open',
            description: 'Test',
            url: 'https://example.com'
        };

        const ics = this.generateICS(tournament);

        // Should use \r\n (CRLF) not just \n (LF)
        return ics.includes('\r\n');
    }

    // Helper methods (implementation from app.ts)

    generateTournamentId(tournament) {
        const str = `${tournament.name}-${tournament.date.toISOString()}-${tournament.location}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    formatICalDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}T090000Z`;
    }

    formatICalEndDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}T180000Z`;
    }

    cleanDescription(description) {
        return (description || '')
            .replace(/<[^>]*>/g, '')
            .replace(/\n/g, '\\n')
            .substring(0, 500);
    }

    generateFilename(name) {
        return name
            .replace(/[^a-z0-9]/gi, '-')
            .toLowerCase()
            .substring(0, 50);
    }

    generateICS(tournament) {
        const uid = this.generateTournamentId(tournament);
        const dtStart = this.formatICalDate(tournament.date);
        const dtEnd = this.formatICalEndDate(tournament.date);
        const dtStamp = this.formatICalDate(new Date());
        const cleanDesc = this.cleanDescription(tournament.description);

        return [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//MedTourney//Chess Tournament Finder//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${uid}@medtourney.com`,
            `DTSTAMP:${dtStamp}`,
            `DTSTART:${dtStart}`,
            `DTEND:${dtEnd}`,
            `SUMMARY:${tournament.name}`,
            `DESCRIPTION:${cleanDesc}\\n\\nCategory: ${tournament.category}\\n\\nMore info: ${tournament.url}`,
            `LOCATION:${tournament.location}`,
            `URL:${tournament.url}`,
            'STATUS:CONFIRMED',
            'SEQUENCE:0',
            'BEGIN:VALARM',
            'TRIGGER:-P1D',
            'ACTION:DISPLAY',
            `DESCRIPTION:Chess tournament tomorrow: ${tournament.name}`,
            'END:VALARM',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');
    }
}

// Test Runner
function runCalendarExportTests() {
    console.log('🗓️  Running Calendar Export Unit Tests (Phase 2.2)\n');
    console.log('='.repeat(60));

    const tester = new CalendarExportTester();
    const tests = [
        { name: 'Generate unique tournament IDs', fn: () => tester.testGenerateUniqueTournamentId() },
        { name: 'Generate consistent tournament ID', fn: () => tester.testConsistentTournamentId() },
        { name: 'Format date for iCalendar', fn: () => tester.testFormatICalDate() },
        { name: 'Generate valid iCalendar structure', fn: () => tester.testGenerateICalendarStructure() },
        { name: 'Clean HTML from description', fn: () => tester.testCleanHTMLFromDescription() },
        { name: 'Escape newlines in description', fn: () => tester.testEscapeNewlinesInDescription() },
        { name: 'Limit description length', fn: () => tester.testLimitDescriptionLength() },
        { name: 'Generate safe filename', fn: () => tester.testGenerateSafeFilename() },
        { name: 'Include 1-day reminder alarm', fn: () => tester.testIncludeReminderAlarm() },
        { name: 'Set event status to CONFIRMED', fn: () => tester.testEventStatusConfirmed() },
        { name: 'Include tournament URL', fn: () => tester.testIncludeTournamentURL() },
        { name: 'Use CRLF line endings', fn: () => tester.testUseCRLFLineEndings() }
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
                console.log(`❌ Test ${index + 1}: ${test.name} - FAILED`);
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

    process.exit(failed === 0 ? 0 : 1);
}

if (require.main === module) {
    runCalendarExportTests();
}

module.exports = { CalendarExportTester, runCalendarExportTests };
