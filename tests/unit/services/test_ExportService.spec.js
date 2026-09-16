/**
 * Unit tests for the REAL production ExportService.
 *
 * These tests `require` the compiled production implementation from
 * `dist-test/` (built by `npm run build:test`). They do NOT define a local
 * fake ExportService — that would test nothing. If production code regresses
 * (random UID, invalid VALUE=DATE date-time, broken escaping, …) these tests
 * must fail.
 */

const { loadProductionModule } = require('../../helpers/production');
const { ExportService } = loadProductionModule('services/ExportService.js');

// ---------------------------------------------------------------------------
// Tiny test harness
// ---------------------------------------------------------------------------
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

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Assertion failed'}: expected "${expected}", got "${actual}"`);
    }
}

function assertContains(str, substring, message) {
    if (!str.includes(substring)) {
        throw new Error(`${message || 'Assertion failed'}: output does not contain "${substring}"`);
    }
}

function assertNotContains(str, substring, message) {
    if (str.includes(substring)) {
        throw new Error(`${message || 'Assertion failed'}: output unexpectedly contains "${substring}"`);
    }
}

function count(haystack, needle) {
    return haystack.split(needle).length - 1;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const tournament = {
    name: 'Barcelona Open 2025',
    location: 'Barcelona, ESP',
    date: new Date('2025-06-01'),
    category: 'Open',
    url: 'https://chess-results.com/tnr123.aspx?lan=1',
    description: 'International chess tournament in Barcelona',
};

const tournament2 = {
    name: 'Athens Rapid',
    location: 'Athens, GRE',
    date: new Date('2025-07-15'),
    category: 'Rapid',
    url: 'https://chess-results.com/tnr456.aspx?lan=1',
    description: 'Rapid chess in Athens',
};

console.log('\n🧪 Running ExportService Unit Tests (REAL production code)\n');
console.log('='.repeat(60));

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
test('CSV: header + single row', () => {
    const csv = new ExportService().buildCSV([tournament]);
    assertContains(csv, 'Name,Location,Date,Category,URL');
    assertContains(csv, 'Barcelona Open 2025');
    assertContains(csv, '2025-06-01');
});

test('CSV: multiple tournaments produce header + N rows', () => {
    const csv = new ExportService().buildCSV([tournament, tournament2]);
    const lines = csv.split('\n');
    assertEqual(lines.length, 3, 'Header + 2 rows');
    assertContains(csv, 'Athens Rapid');
});

test('CSV: escapes commas', () => {
    const csv = new ExportService().buildCSV([{ ...tournament, name: 'Barcelona Open, 2025' }]);
    assertContains(csv, '"Barcelona Open, 2025"');
});

test('CSV: escapes embedded quotes', () => {
    const csv = new ExportService().buildCSV([{ ...tournament, name: 'Barcelona "Premium" Open' }]);
    assertContains(csv, '"Barcelona ""Premium"" Open"');
});

test('CSV: empty array throws', () => {
    let threw = false;
    try { new ExportService().buildCSV([]); } catch { threw = true; }
    assert(threw, 'Expected buildCSV([]) to throw');
});

// ---------------------------------------------------------------------------
// iCalendar — single event
// ---------------------------------------------------------------------------
test('ICS: has VCALENDAR wrapper and exactly one VEVENT', () => {
    const ics = new ExportService().buildICSForTournament(tournament);
    assertContains(ics, 'BEGIN:VCALENDAR');
    assertContains(ics, 'END:VCALENDAR');
    assertEqual(count(ics, 'BEGIN:VEVENT'), 1, 'exactly one VEVENT');
    assertEqual(count(ics, 'END:VEVENT'), 1, 'exactly one END:VEVENT');
    assertContains(ics, 'VERSION:2.0');
});

test('ICS: all-day DTSTART uses VALUE=DATE:YYYYMMDD', () => {
    const ics = new ExportService().buildICSForTournament(tournament);
    assertContains(ics, 'DTSTART;VALUE=DATE:20250601');
});

test('ICS: DTEND is exclusive (start + 1 day) as VALUE=DATE when no dateTo', () => {
    const ics = new ExportService().buildICSForTournament(tournament);
    assertContains(ics, 'DTEND;VALUE=DATE:20250602');
});

test('ICS: DTEND uses dateTo + 1 day for multi-day tournaments', () => {
    const multiDay = { ...tournament, dateTo: '2025-06-05' };
    const ics = new ExportService().buildICSForTournament(multiDay);
    assertContains(ics, 'DTSTART;VALUE=DATE:20250601');
    assertContains(ics, 'DTEND;VALUE=DATE:20250606');
});

test('ICS: does NOT emit invalid VALUE=DATE date-time (no T000000Z)', () => {
    const ics = new ExportService().buildICSForTournament(tournament);
    assertNotContains(ics, 'DTSTART;VALUE=DATE:20250601T000000Z');
    // No VALUE=DATE property may carry a time component.
    assert(!/VALUE=DATE:\d{8}T/.test(ics), 'VALUE=DATE must not include a time component');
});

test('ICS: DTSTAMP is a UTC date-time YYYYMMDDTHHMMSSZ', () => {
    const ics = new ExportService().buildICSForTournament(tournament);
    assert(/DTSTAMP:\d{8}T\d{6}Z/.test(ics), 'DTSTAMP must be UTC date-time');
});

test('ICS: contains stable UID at medtourney.github.io', () => {
    const ics = new ExportService().buildICSForTournament(tournament);
    assert(/UID:medtourney-[a-z0-9]+@medtourney\.github\.io/.test(ics), 'UID must be stable medtourney UID');
});

test('ICS: UID is deterministic (no Math.random) across repeated exports', () => {
    const svc = new ExportService();
    const uid1 = svc.buildICSForTournament(tournament).match(/UID:(.+)/)[1].trim();
    const uid2 = svc.buildICSForTournament(tournament).match(/UID:(.+)/)[1].trim();
    assertEqual(uid1, uid2, 'Same tournament must yield same UID');
});

test('ICS: different tournaments yield different UIDs', () => {
    const svc = new ExportService();
    assert(
        svc.generateStableUID(tournament) !== svc.generateStableUID(tournament2),
        'Different tournaments must yield different UIDs'
    );
});

test('ICS: escapes commas in SUMMARY/LOCATION', () => {
    const ics = new ExportService().buildICSForTournament(tournament);
    assertContains(ics, 'LOCATION:Barcelona\\, ESP');
    assertContains(ics, 'SUMMARY:Barcelona Open 2025');
});

test('ICS: includes the tournament URL', () => {
    const ics = new ExportService().buildICSForTournament(tournament);
    assertContains(ics, 'URL:https://chess-results.com/tnr123.aspx?lan=1');
});

test('ICS: uses CRLF line endings', () => {
    const ics = new ExportService().buildICSForTournament(tournament);
    assertContains(ics, '\r\n');
    assert(ics.startsWith('BEGIN:VCALENDAR\r\n'), 'must use CRLF between lines');
});

// ---------------------------------------------------------------------------
// Escaping primitives (RFC 5545 §3.3.11)
// ---------------------------------------------------------------------------
test('escapeICS: backslash, semicolon, comma, newline', () => {
    const svc = new ExportService();
    assertEqual(svc.escapeICS('a\\b'), 'a\\\\b', 'backslash');
    assertEqual(svc.escapeICS('a;b'), 'a\\;b', 'semicolon');
    assertEqual(svc.escapeICS('a,b'), 'a\\,b', 'comma');
    assertEqual(svc.escapeICS('a\nb'), 'a\\nb', 'newline');
});

test('escapeICS: backslash escaped before others (no double-escape)', () => {
    // A real newline must become \n (single backslash), not \\n.
    const svc = new ExportService();
    assertEqual(svc.escapeICS('line1\nline2'), 'line1\\nline2');
});

// ---------------------------------------------------------------------------
// Date format helpers
// ---------------------------------------------------------------------------
test('formatICSDateOnly: YYYYMMDD in UTC', () => {
    assertEqual(new ExportService().formatICSDateOnly(new Date('2025-06-01')), '20250601');
});

test('formatICSDateTimeUTC: YYYYMMDDTHHMMSSZ in UTC', () => {
    assertEqual(
        new ExportService().formatICSDateTimeUTC(new Date('2025-06-01T09:30:15Z')),
        '20250601T093015Z'
    );
});

// ---------------------------------------------------------------------------
// iCalendar — multiple events (shortlist)
// ---------------------------------------------------------------------------
test('Multi-ICS: one VCALENDAR, multiple VEVENT', () => {
    const ics = new ExportService().buildICSForTournaments([tournament, tournament2]);
    assertEqual(count(ics, 'BEGIN:VCALENDAR'), 1, 'one VCALENDAR');
    assertEqual(count(ics, 'BEGIN:VEVENT'), 2, 'two VEVENT');
});

test('Multi-ICS: each event has a distinct stable UID', () => {
    const ics = new ExportService().buildICSForTournaments([tournament, tournament2]);
    const uids = (ics.match(/UID:[^\r\n]+/g) || []).map(u => u.trim());
    assertEqual(uids.length, 2, 'two UIDs');
    assert(uids[0] !== uids[1], 'UIDs must be distinct');
});

test('Multi-ICS: all-day dates + CRLF', () => {
    const ics = new ExportService().buildICSForTournaments([tournament, tournament2]);
    assertContains(ics, 'DTSTART;VALUE=DATE:20250601');
    assertContains(ics, 'DTSTART;VALUE=DATE:20250715');
    assertContains(ics, '\r\n');
});

test('Multi-ICS: empty array throws', () => {
    let threw = false;
    try { new ExportService().buildICSForTournaments([]); } catch { threw = true; }
    assert(threw, 'Expected buildICSForTournaments([]) to throw');
});

// ---------------------------------------------------------------------------
console.log('='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
console.log(`✨ Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);
process.exit(failed === 0 ? 0 : 1);
