/**
 * Unit tests for src/utils/countrySelection.ts (real code from dist-test/)
 * and the region groups of the country checklist in the real index.html.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { loadProductionModule } = require('../../helpers/production');
const {
    checkedCountryCodes, setCountryChecked, syncCountryCopies, clearCountries
} = loadProductionModule('utils/countrySelection.js');

const INDEX_HTML = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'index.html'), 'utf8');

function page() {
    return new JSDOM(INDEX_HTML).window.document;
}

/** { 'Mediterranean': ['ALB', ...], ... } from the checklist markup */
function groups(doc) {
    const result = {};
    doc.querySelectorAll('#countryList .country-group-label').forEach(label => {
        const grid = label.nextElementSibling;
        result[label.textContent.trim()] = [...grid.querySelectorAll('input[name="countryFilter"]')].map(i => i.value);
    });
    return result;
}

function runTests() {
    console.log('\n🧪 Running countrySelection + region group tests\n');
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
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    }

    function assert(condition, message) {
        if (!condition) throw new Error(message || 'Assertion failed');
    }

    const copies = (doc, code) => [...doc.querySelectorAll(`input[name="countryFilter"][value="${code}"]`)];

    test('setCountryChecked checks every copy; codes are listed once', () => {
        const doc = page();
        setCountryChecked('ESP', true, doc);
        assertEqual(copies(doc, 'ESP').map(cb => cb.checked), [true, true], 'both Spain boxes');
        setCountryChecked('ITA', true, doc);
        assertEqual(checkedCountryCodes(doc).sort(), ['ESP', 'ITA']);
    });

    test('syncCountryCopies makes the other copy follow the one clicked', () => {
        const doc = page();
        const [med, atlantic] = copies(doc, 'ESP');
        atlantic.checked = true;
        syncCountryCopies(atlantic, doc);
        assert(med.checked, 'Mediterranean copy follows');
        atlantic.checked = false;
        syncCountryCopies(atlantic, doc);
        assert(!med.checked, 'and unchecks too');
    });

    test('clearCountries unchecks everything', () => {
        const doc = page();
        ['ESP', 'TUR', 'AUT'].forEach(code => setCountryChecked(code, true, doc));
        clearCountries(doc);
        assertEqual(checkedCountryCodes(doc), []);
    });

    test('Mediterranean: only countries with a Mediterranean coast (+ San Marino, with Italy)', () => {
        const med = groups(page())['Mediterranean'];
        for (const code of ['ESP', 'FRA', 'ITA', 'SMR', 'GRE', 'CRO', 'TUR', 'CYP', 'MLT']) {
            assert(med.includes(code), `${code} in Mediterranean`);
        }
        for (const code of ['BIH', 'AND', 'POR']) {
            assert(!med.includes(code), `${code} not in Mediterranean`);
        }
    });

    test('Atlantic has Spain, Portugal and France; Western and Central Europe are split', () => {
        const g = groups(page());
        assertEqual(g['Atlantic (Spain, Portugal & France)'].sort(), ['ESP', 'FRA', 'POR']);
        for (const code of ['FRA', 'SUI', 'BEL', 'NED', 'LUX', 'AND']) {
            assert(g['Western Europe'].includes(code), `${code} in Western Europe`);
            assert(!g['Central Europe'].includes(code), `${code} not in Central Europe`);
        }
        assert(g['Balkans'].includes('BIH'), 'Bosnia in Balkans');
        assertEqual(g['Black Sea & Caspian'].sort(), ['AZE', 'BUL', 'GEO', 'ROU', 'TUR', 'UKR']);
    });

    test('Every country is listed; France in three regions, seven others in two', () => {
        const g = groups(page());
        const count = {};
        for (const [region, codes] of Object.entries(g)) {
            assertEqual(new Set(codes).size, codes.length, `duplicate inside ${region}`);
            codes.forEach(c => { count[c] = (count[c] || 0) + 1; });
        }
        assert(Object.keys(count).length >= 55, 'all countries listed');
        const multi = Object.fromEntries(Object.entries(count).filter(([, n]) => n > 1).sort());
        assertEqual(multi, { AZE: 2, BUL: 2, ESP: 2, FRA: 3, GEO: 2, ROU: 2, TUR: 2, UKR: 2 }, 'countries in several regions');
    });

    console.log('='.repeat(60));
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log(`✨ Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

    return failed === 0 ? 0 : 1;
}

process.exit(runTests());
