/**
 * Calendar export tests against the REAL production ExportService.
 *
 * Previously this file contained a duplicated/fake `CalendarExportTester`
 * implementation (with VALARM, T090000Z date-times, etc.) that did not match
 * production code at all — so it proved nothing. It now exercises the compiled
 * production `ExportService` from `dist-test/` (built via `npm run build:test`).
 *
 * Run with: npm run test:calendar
 */

const { loadProductionModule } = require('../helpers/production');
const { ExportService } = loadProductionModule('services/ExportService.js');

function makeTournament(overrides = {}) {
    return {
        name: 'Test Tournament',
        date: new Date('2025-06-15'),
        location: 'Nice, FRA',
        category: 'Open',
        description: 'Test description',
        url: 'https://chess-results.com/tnr999.aspx?lan=1',
        ...overrides,
    };
}

const tests = [
    {
        name: 'Different tournaments yield different UIDs',
        fn: () => {
            const svc = new ExportService();
            const a = svc.generateStableUID(makeTournament({ date: new Date('2025-03-15') }));
            const b = svc.generateStableUID(makeTournament({ date: new Date('2025-03-16') }));
            return a !== b && a.length > 0 && b.length > 0;
        },
    },
    {
        name: 'Same tournament yields the same UID (deterministic, no Math.random)',
        fn: () => {
            const svc = new ExportService();
            const t = makeTournament();
            return svc.generateStableUID(t) === svc.generateStableUID(t);
        },
    },
    {
        name: 'Stable UID uses the medtourney.github.io domain',
        fn: () => {
            const uid = new ExportService().generateStableUID(makeTournament());
            return /^medtourney-[a-z0-9]+@medtourney\.github\.io$/.test(uid);
        },
    },
    {
        name: 'iCalendar has the required structure',
        fn: () => {
            const ics = new ExportService().buildICSForTournament(makeTournament());
            return ics.includes('BEGIN:VCALENDAR') &&
                ics.includes('VERSION:2.0') &&
                ics.includes('PRODID:-//MedTourney') &&
                ics.includes('BEGIN:VEVENT') &&
                ics.includes('END:VEVENT') &&
                ics.includes('END:VCALENDAR') &&
                ics.includes('UID:') &&
                ics.includes('SUMMARY:Test Tournament') &&
                ics.includes('LOCATION:Nice\\, FRA');
        },
    },
    {
        name: 'All-day DTSTART/DTEND use VALUE=DATE:YYYYMMDD',
        fn: () => {
            const ics = new ExportService().buildICSForTournament(makeTournament());
            return ics.includes('DTSTART;VALUE=DATE:20250615') &&
                ics.includes('DTEND;VALUE=DATE:20250616');
        },
    },
    {
        name: 'Does NOT emit invalid VALUE=DATE date-time (no YYYYMMDDT000000Z)',
        fn: () => {
            const ics = new ExportService().buildICSForTournament(makeTournament());
            return !ics.includes('DTSTART;VALUE=DATE:20250615T000000Z') &&
                !/VALUE=DATE:\d{8}T/.test(ics);
        },
    },
    {
        name: 'DTSTAMP is a UTC date-time (YYYYMMDDTHHMMSSZ)',
        fn: () => /DTSTAMP:\d{8}T\d{6}Z/.test(new ExportService().buildICSForTournament(makeTournament())),
    },
    {
        name: 'Escapes commas/semicolons in text fields',
        fn: () => {
            const ics = new ExportService().buildICSForTournament(
                makeTournament({ name: 'Open; Rapid, Blitz', location: 'Nice, FRA' })
            );
            return ics.includes('SUMMARY:Open\\; Rapid\\, Blitz') && ics.includes('LOCATION:Nice\\, FRA');
        },
    },
    {
        name: 'Includes the tournament URL',
        fn: () => new ExportService()
            .buildICSForTournament(makeTournament({ url: 'https://chess-results.com/test123' }))
            .includes('URL:https://chess-results.com/test123'),
    },
    {
        name: 'Uses CRLF line endings (RFC 5545)',
        fn: () => new ExportService().buildICSForTournament(makeTournament()).includes('\r\n'),
    },
    {
        name: 'Multi-event export: one VCALENDAR, multiple unique VEVENTs',
        fn: () => {
            const ics = new ExportService().buildICSForTournaments([
                makeTournament({ url: 'https://chess-results.com/a', name: 'A' }),
                makeTournament({ url: 'https://chess-results.com/b', name: 'B' }),
            ]);
            const vcal = ics.split('BEGIN:VCALENDAR').length - 1;
            const vevent = ics.split('BEGIN:VEVENT').length - 1;
            const uids = (ics.match(/UID:[^\r\n]+/g) || []).map(u => u.trim());
            return vcal === 1 && vevent === 2 && uids.length === 2 && uids[0] !== uids[1];
        },
    },
];

function runCalendarExportTests() {
    console.log('🗓️  Running Calendar Export Tests (REAL production code)\n');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    tests.forEach((t, index) => {
        try {
            if (t.fn()) {
                console.log(`✅ Test ${index + 1}: ${t.name}`);
                passed++;
            } else {
                console.log(`❌ Test ${index + 1}: ${t.name} - FAILED`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ Test ${index + 1}: ${t.name} - ERROR: ${error.message}`);
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

module.exports = { runCalendarExportTests };
