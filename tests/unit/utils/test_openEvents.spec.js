/**
 * "Open to all" filter rule (src/utils/openEvents.ts, real code from dist-test/):
 * hide only events whose name/category says they are restricted.
 */
const { loadProductionModule } = require('../../helpers/production');
const { isRestrictedEvent } = loadProductionModule('utils/openEvents.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`✅ ${name}`); passed++; } catch (e) { console.log(`❌ ${name}\n   Error: ${e.message}`); failed++; }
}
function check(name, category, expected) {
    const got = isRestrictedEvent(name.toLowerCase(), category.toLowerCase());
    if (got !== expected) throw new Error(`"${name}" [${category}]: expected ${expected ? 'restricted' : 'open'}`);
}

console.log('\n🧪 Open-to-all rule\n' + '='.repeat(60));

test('unlabelled ordinary events count as open (most of chess-results.com)', () => {
    check('Varna Chess Festival 2026', 'Classical', false);
    check('Chessbattle Grand Rapid', 'Rapid', false);
    check('Wiener Stadtmeisterschaft', 'Classical', false);
});

test('round robins, norm and closed events are restricted', () => {
    check('GM2 RR 28 October - 2 November BIH Chess Legend', 'Classical', true);
    check('MEGA BIG NORMS WARSAW GM ROUND-ROBIN', 'Classical', true);
    check('Tallinn IM Norm Tournament 2026', 'Classical', true);
    check('6th Gambit GM Closed Tournament', 'Classical', true);
    check('Bergen Invitational', 'Classical', true);
});

test('club championships are restricted', () => {
    check('SK Union Oldenburg Vereinsmeisterschaft 2026', 'Classical', true);
    check('Club Championship 2026', 'Classical', true);
    check('Clubkampioenschap Leiden', 'Classical', true);
});

test('an explicit "Open" (in any of several languages) always wins', () => {
    check('Barcelona Open', 'Classical', false);
    check('Round Robin and Open', 'Classical', false);
    check('Offene Vereinsmeisterschaft', 'Classical', false);
    check('Torneo Abierto de Ajedrez', 'Rapid', false);
    check('Some event', 'Classical, Open', false);
});

test('word boundaries: "rr" only as a word, not inside names', () => {
    check('Ferrara Chess Festival', 'Classical', false);
    check('Torneo Carrara', 'Rapid', false);
});

console.log('='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total\n`);
process.exit(failed === 0 ? 0 : 1);
