/**
 * Google Calendar link, the calendar button's menu, and the footer Feedback
 * link (src/utils/googleCalendar.ts, calendarMenu.ts, contact.ts) - real code
 * from dist-test/, the DOM parts against the real index.html in jsdom.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { loadProductionModule } = require('../../helpers/production');
const { googleCalendarUrl } = loadProductionModule('utils/googleCalendar.js');
const { openCalendarMenu, closeCalendarMenu } = loadProductionModule('utils/calendarMenu.js');
const contact = loadProductionModule('utils/contact.js');

const INDEX_HTML = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'index.html'), 'utf8');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`✅ ${name}`); passed++; } catch (e) { console.log(`❌ ${name}\n   Error: ${e.message}`); failed++; }
}
function assertEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

const tournament = {
    name: 'Nice Open', location: 'Nice, FRA', category: 'Open, Classical', description: '9 rounds',
    url: 'https://chess-results.com/tnr1.aspx?lan=1', date: new Date(2026, 9, 3), dateTo: '2026-10-11'
};
const params = url => new URL(url).searchParams;

function setupDOM() {
    const dom = new JSDOM(INDEX_HTML, { url: 'http://localhost/' });
    global.document = dom.window.document;
    global.window = dom.window;
    return dom;
}

console.log('\n🧪 Google Calendar link, calendar menu, Feedback link\n' + '='.repeat(60));

test('Google Calendar: all-day event, end date exclusive, details and location', () => {
    const url = googleCalendarUrl(tournament);
    assertEqual(url.startsWith('https://calendar.google.com/calendar/render?'), true, 'host');
    const p = params(url);
    assertEqual(p.get('action'), 'TEMPLATE');
    assertEqual(p.get('text'), 'Nice Open');
    assertEqual(p.get('dates'), '20261003/20261012', 'Oct 3 to Oct 11 inclusive');
    assertEqual(p.get('location'), 'Nice, FRA');
    assertEqual(p.get('details').includes('More info: https://chess-results.com/tnr1.aspx?lan=1'), true, 'link in details');
});

test('Google Calendar: one-day event without / with a bad end date', () => {
    assertEqual(params(googleCalendarUrl({ ...tournament, dateTo: undefined })).get('dates'), '20261003/20261004');
    assertEqual(params(googleCalendarUrl({ ...tournament, dateTo: 'soon' })).get('dates'), '20261003/20261004');
    assertEqual(params(googleCalendarUrl({ ...tournament, dateTo: '2026-10-01' })).get('dates'), '20261003/20261004', 'end before start');
});

test('Calendar menu: opens under its button with both choices, toggles, closes', () => {
    setupDOM();
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    openCalendarMenu(btn, tournament);
    const menu = document.querySelector('.calendar-menu');
    assertEqual(menu.getAttribute('role'), 'menu');
    assertEqual(btn.getAttribute('aria-expanded'), 'true');
    const items = [...menu.querySelectorAll('.calendar-menu-item')];
    assertEqual(items.map(i => i.dataset.action), ['google', 'ics']);
    assertEqual(items[0].getAttribute('href'), googleCalendarUrl(tournament), 'Google link');
    assertEqual(items[0].getAttribute('target'), '_blank');
    assertEqual(document.activeElement, items[0], 'first choice focused');
    openCalendarMenu(btn, tournament); // same button again = close
    assertEqual(document.querySelectorAll('.calendar-menu').length, 0, 'toggled closed');
    openCalendarMenu(btn, tournament);
    closeCalendarMenu(true);
    assertEqual(document.querySelectorAll('.calendar-menu').length, 0, 'closed');
    assertEqual(btn.getAttribute('aria-expanded'), 'false');
    assertEqual(document.activeElement, btn, 'focus back on the button');
});

test('Calendar menu: a small scroll keeps it open, a real scroll closes it', () => {
    const { closeCalendarMenuOnScroll } = loadProductionModule('utils/calendarMenu.js');
    setupDOM();
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    openCalendarMenu(btn, tournament);
    Object.defineProperty(window, 'scrollY', { value: 10, configurable: true });
    closeCalendarMenuOnScroll();
    assertEqual(document.querySelectorAll('.calendar-menu').length, 1, 'still open after 10 px');
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
    closeCalendarMenuOnScroll();
    assertEqual(document.querySelectorAll('.calendar-menu').length, 0, 'closed after 200 px');
});

test('Calendar menu: only one open at a time', () => {
    setupDOM();
    const [a, b] = [document.createElement('button'), document.createElement('button')];
    document.body.append(a, b);
    openCalendarMenu(a, tournament);
    openCalendarMenu(b, tournament);
    assertEqual(document.querySelectorAll('.calendar-menu').length, 1);
    assertEqual(a.getAttribute('aria-expanded'), 'false');
    closeCalendarMenu();
});

test('Contact: the configured address; built only from two reversed pieces', () => {
    assertEqual(contact.contactAddress(), 'medtourney@protonmail.com', 'the configured address');
    assertEqual(contact.contactAddress([]), null);
    assertEqual(contact.contactAddress(['kcabdeef', 'moc.elpmaxe']), 'feedback@example.com');
    assertEqual(contact.feedbackMailto('a@b.c'), 'mailto:a@b.c?subject=MedTourney%20feedback');
});

test('Feedback link: hidden without an address; with one, mailto only after a click', () => {
    setupDOM();
    contact.initFeedbackLink([], document);
    assertEqual(document.getElementById('feedbackWrap').hidden, true, 'hidden without address');
    const dom = setupDOM();
    contact.initFeedbackLink(['kcabdeef', 'moc.elpmaxe'], document);
    const link = document.getElementById('feedbackLink');
    assertEqual(document.getElementById('feedbackWrap').hidden, false, 'shown');
    assertEqual(document.documentElement.outerHTML.includes('feedback@example.com'), false, 'not in the page before a click');
    link.dispatchEvent(new dom.window.MouseEvent('click', { cancelable: true }));
    assertEqual(link.getAttribute('href'), 'mailto:feedback@example.com?subject=MedTourney%20feedback');
});

console.log('='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total\n`);
process.exit(failed === 0 ? 0 : 1);
