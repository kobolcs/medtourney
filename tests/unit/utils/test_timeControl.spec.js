/**
 * Unit tests for utils/timeControl.formatTimeControl
 *
 * Inputs are real strings from tournaments_data.json - organisers type the
 * time control free-form in many languages and notations.
 */

const { loadProductionModule } = require('../../helpers/production');
const { formatTimeControl } = loadProductionModule('utils/timeControl.js');

let passed = 0;
let failed = 0;

function check(input, expected) {
    const actual = formatTimeControl(input);
    if (actual === expected) {
        console.log(`✅ ${JSON.stringify(input)} -> ${actual}`);
        passed++;
    } else {
        console.log(`❌ ${JSON.stringify(input)}: expected "${expected}", got "${actual}"`);
        failed++;
    }
}

console.log('\n🧪 formatTimeControl\n' + '='.repeat(60));

// Quote notation (incl. apostrophe look-alikes)
check("10'05''", '10+5');
check('90\'+30"', '90+30');
check('60\'30"', '60+30');
check("90'  + 30''", '90+30');
check('R20\' + 5"', '20+5');
check('90´+ 30´´', '90+30');
check('10`+5``', '10+5');
check("90'+30", '90+30');
check("10'", '10+0');
check("30' + 30 sec/move", '30+30');

// Bare notation
check('10+5', '10+5');
check('90 + 30', '90+30');
check('3+2sec', '3+2');
check('2x15+5', '15+5');
check('15 plus 5', '15+5');
check("10+5'", '10+5');

// Verbose, multiple languages
check('Rapid: 10min +5sec increment per move starting from move 1', '10+5');
check('Standard: 90 minutes with 30 second increment from move 1', '90+30');
check('12 minut + 3 sekundy za tah', '12+3');
check('110 Minuten plus 30 Sekunden pro Zug', '110+30');
check('60 minutos + 30 segundos por movimiento', '60+30');
check('10 мин. + 5 сек. на ход', '10+5');
check('10хв + 5сек', '10+5');
check('90 perc+30 mp/lépés', '90+30');
check('3 λεπτά + 2 δευτερόλεπτα / κίνηση', '3+2');
check('60 dəq+30 san', '60+30');
check('20 Minuten', '20+0');
check('2 x 20 minut + 5 sekund na tah', '20+5');
check('2 hours + 30 seconds', '120+30');
check('10.min.+ 5.sek.', '10+5');
check('2x15. min. / hráče', '15+0');
check('12 + 5 s/tah', '12+5');

// Multi-period -> first period + "…"
check('90 minutes for 40 moves + 15 minutes to the end with 30 seconds increment from move one', '90+30…');
check('2x 1,5 h/40 + 30 min + 30 s / move', '90+30…');
check('2 Std für 40 Züge + 1 Stunde für Rest', '120+0…');
check('90 мин. за 40 потеза + 30 мин. и  30 сек. додатка за сваки потез', '90+30…');

// Compact notations - each checked against the tournament's chess-results.com
// page (Rapid/Blitz/Standard label) or its announcement PDF
check('3/2', '3+2');
check('15/5', '15+5');
check('2x15', '15+0');
check('10-10', '10+0');
check('Rapid (15-15/all)', '15+0');
check('90-90 min/All + 30 sec/move', '90+30');
check("15'' eklemesiz tempo", '15+0');
check('Game/20 + 5 seconds per move', '20+5');
check('all/0,25', '15+0');
check('all / 130', '130+0');
check('30 all + 30 sec/move', '30+30');
check('90 + 30 +30sec/Zug', '90+30…');
check('90/30/30 sec pro Move', '90+30…');          // Carinthian Winteropen PDF
check("90/40+30''  30+30''", '90+30…');            // Marburger Schachtage PDF
check('1:30/40 + 0:30', '90+0…');                  // Vršovice PDF: no increment
check('1:40/40 + 0:40', '100+0…');
check('40/90+30, 30+30', '90+30…');
check('40/1,5+ 30 sec/move  all/0,5 + 30 sec/mov', '90+30…');
check('40/1,5  All/0,5', '90+0…');
check('90/1,5  -/0,5', '90+0…');
check('40/90  -/30', '90+0…');
check('90/40 + 15 + 30 sec/incr.', '90+30…');

// Not a time control -> "" (badge hidden)
check('TIME CONTROL', '');
check('Standard', '');
check('8:30 - 14:00', '');

// Unreadable -> unchanged
check('10', '10');
check('Fischer Kurz', 'Fischer Kurz');
check('', '');

console.log('='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
process.exit(failed > 0 ? 1 : 0);
