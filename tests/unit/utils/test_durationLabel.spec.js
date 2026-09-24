/**
 * Unit tests for utils/durationLabel.formatDurationLabel
 */

// Weekdays are computed in local time (matching the card's date badge);
// pin a European zone so results don't depend on the machine running this.
process.env.TZ = 'Europe/Berlin';

const { loadProductionModule } = require('../../helpers/production');
const { formatDurationLabel } = loadProductionModule('utils/durationLabel.js');

let passed = 0;
let failed = 0;

function check(from, to, expected) {
    const actual = formatDurationLabel(new Date(from), to);
    if (actual === expected) {
        console.log(`✅ ${from} → ${to ?? '(none)'}: ${actual}`);
        passed++;
    } else {
        console.log(`❌ ${from} → ${to ?? '(none)'}: expected "${expected}", got "${actual}"`);
        failed++;
    }
}

console.log('\n🧪 formatDurationLabel\n' + '='.repeat(60));

check('2026-09-26', undefined, 'Sat');                  // no end date
check('2026-09-26', '2026-09-26', 'Sat · 1 day');       // single day
check('2026-10-02', '2026-10-04', 'Fri–Sun · 3 days');  // weekend
check('2026-10-24', '2026-11-01', 'Sat–Sun · 9 days');  // spans a DST change
check('2026-10-01', '2026-10-10', 'Thu–Sat · 10 days'); // longest with a span
check('2026-10-01', '2026-10-11', '11 days');           // weekly league: no span
check('2026-09-25', '2026-11-20', '57 days');
check('2026-10-04', '2026-10-02', 'Sun');               // end before start
check('2026-10-04', 'not-a-date', 'Sun');
check('not-a-date', '2026-10-04', '');

console.log('='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
process.exit(failed > 0 ? 1 : 0);
