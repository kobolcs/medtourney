/**
 * Unit tests for UIManager
 * Runs the REAL UIManager (compiled to dist-test/ by `npm run build:test`)
 * against the real index.html markup in jsdom (scripts are not executed).
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { loadProductionModule } = require('../../helpers/production');
const { UIManager } = loadProductionModule('services/UIManager.js');

const INDEX_HTML = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'index.html'), 'utf8');

// A fresh copy of the production page for every test
function setupDOM() {
    const dom = new JSDOM(INDEX_HTML, { url: 'http://localhost/' });
    global.document = dom.window.document;
    global.window = dom.window;
    // Not implemented by jsdom
    global.CSS = { escape: s => String(s).replace(/["\\]/g, '\\$&') };
    dom.window.HTMLElement.prototype.scrollIntoView = function () {};
    dom.window.scrollTo = () => {};
    return dom;
}

function tournament(i, overrides = {}) {
    return {
        name: `Open ${i}`,
        url: `https://chess-results.com/tnr${i}.aspx`,
        location: 'Barcelona, ESP',
        date: new Date(2026, 5, 1 + i),
        category: 'Open, Classical',
        description: '',
        ...overrides
    };
}

function tournaments(n, overrides) {
    return Array.from({ length: n }, (_, i) => tournament(i, overrides));
}

const $ = id => document.getElementById(id);
const cards = () => document.querySelectorAll('#tournamentList .tournament-card');

function runTests() {
    console.log('\n🧪 Running UIManager Unit Tests (real UIManager, real index.html)\n');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        setupDOM();
        try {
            fn(new UIManager());
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

    const text = el => el.textContent.replace(/\s+/g, ' ').trim();

    test('showLoading / hideLoading toggle #loading', ui => {
        ui.showLoading();
        assertEqual($('loading').style.display, 'block');
        ui.hideLoading();
        assertEqual($('loading').style.display, 'none');
    });

    test('showLoadingSkeletons: 6 skeletons, loading text, export hidden', ui => {
        ui.showLoadingSkeletons();
        assertEqual(document.querySelectorAll('#tournamentList .skeleton-card').length, 6);
        assertEqual($('resultsCount').textContent, 'Loading tournaments...');
        assertEqual($('exportBtn').style.display, 'none');
        assertEqual($('results').style.display, 'block');
    });

    test('displayTournaments: cards replace skeletons, count and export shown', ui => {
        ui.showLoadingSkeletons();
        ui.displayTournaments(tournaments(3));
        assertEqual(cards().length, 3);
        assertEqual(document.querySelectorAll('.skeleton-card').length, 0, 'skeletons cleared');
        assertEqual($('resultsCount').textContent, '3 tournaments found');
        assertEqual($('exportBtn').style.display, 'inline-flex');
    });

    test('Results count is singular for one tournament', ui => {
        ui.displayTournaments(tournaments(1));
        assertEqual($('resultsCount').textContent, '1 tournament found');
    });

    test('Empty list: default suggestions, export hidden', ui => {
        ui.displayTournaments([]);
        assertEqual(cards().length, 0);
        assert(document.querySelector('.empty-state'), 'empty state rendered');
        assert(text(document.querySelector('.empty-state')).includes('Expand the date range'));
        assertEqual($('exportBtn').style.display, 'none');
    });

    test('prepareEmptyState: total count and one-tap relaxations, used once', ui => {
        ui.prepareEmptyState(1234, [{ label: 'Any dates', count: 42 }]);
        ui.displayTournaments([]);
        const state = text(document.querySelector('.empty-state'));
        assert(state.includes('0 of 1,234 tournaments match'), state);
        const btn = document.querySelector('.empty-state-relaxation-btn');
        assertEqual(text(btn), 'Any dates (42)');
        ui.displayTournaments([]);
        assert(!document.querySelector('.empty-state-relaxation-btn'), 'context is consumed');
    });

    test('Card structure: article, link, shortlist and action buttons', ui => {
        ui.displayTournaments([tournament(1)]);
        const card = cards()[0];
        assertEqual(card.tagName, 'ARTICLE');
        assertEqual(card.getAttribute('aria-label'), 'Open 1');
        assertEqual(card.dataset.tournamentUrl, 'https://chess-results.com/tnr1.aspx');
        assertEqual(card.querySelector('.tournament-link').getAttribute('href'), 'https://chess-results.com/tnr1.aspx');
        assertEqual(card.querySelector('.shortlist-btn').getAttribute('aria-pressed'), 'false');
        assert(card.querySelector('.calendar-export-btn') && card.querySelector('.copy-link-btn'), 'action buttons');
    });

    test('Card escapes HTML in the name and the link URL', ui => {
        ui.displayTournaments([tournament(1, {
            name: '<img src=x onerror=alert(1)>',
            url: 'https://chess-results.com/tnr1.aspx?x="onmouseover="alert(1)'
        })]);
        const card = cards()[0];
        assertEqual(card.querySelectorAll('[onerror]').length, 0, 'no injected <img onerror>');
        assert(text(card.querySelector('.tournament-link')).includes('<img src=x'), 'name shown as text');
        const link = card.querySelector('.tournament-link');
        assertEqual(link.getAttribute('onmouseover'), null, 'no injected attribute');
        assertEqual(link.getAttribute('href'), 'https://chess-results.com/tnr1.aspx?x="onmouseover="alert(1)');
    });

    test('Airport hint: city + code, code alone without a city, none without airport', ui => {
        const airport = { iata: 'XRY', name: 'Jerez Airport', km: 32 };
        ui.displayTournaments([
            tournament(1, { airport: { ...airport, city: 'Jerez de la Frontera' } }),
            tournament(2, { airport }),
            tournament(3)
        ]);
        const hints = [...cards()].map(c => c.querySelector('.airport-hint'));
        assertEqual(text(hints[0].querySelector('[aria-hidden]')), '✈ Jerez de la Frontera XRY · 32 km');
        assert(hints[0].title.includes('Jerez Airport (XRY), about 32 km'), hints[0].title);
        assertEqual(text(hints[1].querySelector('[aria-hidden]')), '✈ XRY · 32 km');
        assertEqual(hints[2], null);
    });

    test('Category tags drop time-control words', ui => {
        ui.displayTournaments([tournament(1, { category: 'Open, Classical, Senior 50+' })]);
        const tags = [...cards()[0].querySelectorAll('.category-tag')].map(text);
        assertEqual(tags, ['Open', 'Senior 50+']);
    });

    test('Pagination: 10 per page, Next moves to page 2', ui => {
        ui.displayTournaments(tournaments(25));
        assertEqual(cards().length, 10);
        assertEqual(text(document.querySelector('.pagination-info')), 'Showing 1-10 of 25 tournaments');
        assert(document.querySelector('[data-page="prev"]').disabled, 'Previous disabled on page 1');
        document.querySelector('[data-page="next"]').click();
        assertEqual(text(document.querySelector('.pagination-info')), 'Showing 11-20 of 25 tournaments');
        assertEqual(cards()[0].getAttribute('aria-label'), 'Open 10');
    });

    test('updateDisplayedTournaments goes back to page 1', ui => {
        ui.displayTournaments(tournaments(25));
        document.querySelector('[data-page="next"]').click();
        ui.updateDisplayedTournaments(tournaments(25));
        assertEqual(text(document.querySelector('.pagination-info')), 'Showing 1-10 of 25 tournaments');
    });

    test('Date sort groups cards under month dividers with counts', ui => {
        const list = [
            tournament(1, { date: new Date(2026, 5, 3) }),
            tournament(2, { date: new Date(2026, 5, 20) }),
            tournament(3, { date: new Date(2026, 6, 4) })
        ];
        ui.displayTournaments(list, 'date-asc');
        const dividers = [...document.querySelectorAll('.month-divider')].map(text);
        assertEqual(dividers, ['June 2026 2', 'July 2026 1']);
        ui.displayTournaments(list, 'name-asc');
        assertEqual(document.querySelectorAll('.month-divider').length, 0, 'no dividers for other sorts');
    });

    test('showError: type class, retry button, hideError', ui => {
        let retried = 0;
        ui.showError('Could not load', 'warning', () => retried++);
        const error = $('error');
        assertEqual(error.className, 'error-message warning-type');
        assertEqual(error.style.display, 'block');
        error.querySelector('.error-retry-btn').click();
        assertEqual(retried, 1);
        assertEqual(error.style.display, 'none');
        ui.showError('Again');
        ui.hideError();
        assertEqual(error.style.display, 'none');
    });

    test('setDarkMode / toggleDarkMode: body class and button label', ui => {
        ui.setDarkMode(true);
        assert(document.body.classList.contains('dark-theme'));
        assertEqual($('themeToggle').getAttribute('aria-label'), 'Switch to light mode');
        ui.toggleDarkMode();
        assert(!document.body.classList.contains('dark-theme'));
        assertEqual($('themeToggle').getAttribute('aria-label'), 'Switch to dark mode');
    });

    test('Shortlist: count badge and star buttons follow the set', ui => {
        ui.displayTournaments(tournaments(2));
        ui.refreshShortlistButtons(new Set([tournament(1).url]));
        const btns = [...document.querySelectorAll('.shortlist-btn')];
        assertEqual(btns.map(b => b.getAttribute('aria-pressed')), ['false', 'true']);
        assertEqual(text(btns[1]), '★');
        ui.updateShortlistCount(1);
        assertEqual($('shortlistCount').textContent, '1');
        assertEqual($('shortlistCount').style.display, 'inline-flex');
        ui.updateShortlistCount(0);
        assertEqual($('shortlistCount').style.display, 'none');
    });

    test('Shortlisted cards render starred', ui => {
        ui.setShortlistedUrls(new Set([tournament(0).url]));
        ui.displayTournaments(tournaments(1));
        assertEqual(document.querySelector('.shortlist-btn').getAttribute('aria-pressed'), 'true');
    });

    test('updateShowResultsButton text', ui => {
        ui.updateShowResultsButton(0);
        assertEqual($('showResultsBtn').textContent, 'No matches – see suggestions ↓');
        ui.updateShowResultsButton(1);
        assertEqual($('showResultsBtn').textContent, 'Show 1 tournament ↓');
        ui.updateShowResultsButton(1234);
        assertEqual($('showResultsBtn').textContent, 'Show 1,234 tournaments ↓');
    });

    test('showTournamentInList jumps to the page with that tournament', ui => {
        const list = tournaments(25);
        ui.displayTournaments(list);
        ui.showTournamentInList(list[22].url);
        assertEqual(text(document.querySelector('.pagination-info')), 'Showing 21-25 of 25 tournaments');
        const card = [...cards()].find(c => c.dataset.tournamentUrl === list[22].url);
        assert(card && card.classList.contains('highlighted'), 'card highlighted');
    });

    test('getTournamentByUrl / getFilteredTournaments', ui => {
        const list = tournaments(3);
        ui.displayTournaments(list);
        assertEqual(ui.getFilteredTournaments().length, 3);
        assertEqual(ui.getTournamentByUrl(list[2].url).name, 'Open 2');
        assertEqual(ui.getTournamentByUrl('https://nope.example'), null);
    });

    test('showStalenessBanner shows the message', ui => {
        ui.showStalenessBanner('Data is 3 days old');
        assertEqual($('staleness-banner').textContent, 'Data is 3 days old');
        assertEqual($('staleness-banner').style.display, 'block');
    });

    console.log('='.repeat(60));
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log(`✨ Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

    return failed === 0 ? 0 : 1;
}

process.exit(runTests());
