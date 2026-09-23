/**
 * Hardening E2E tests for export correctness.
 *
 * These tests are deterministic: `tournaments_data.json` is stubbed via
 * `page.route` with dates generated relative to "now" (so they always fall
 * inside the app's default 6-month search window). The app actually boots
 * (served by Vite), so assertions run for real — they do NOT silently skip
 * when no cards exist.
 *
 * Covered:
 *  - search renders cards
 *  - CSV exports only the *visible* set after quick-search
 *  - CSV exports only the shortlisted set in shortlist-only mode
 *  - calendar export on page 2 downloads the correct tournament (stable key)
 *  - shortlist export produces one .ics with multiple VEVENTs
 *  - reload-with-saved-shortlist is not misleading
 *  - success messages appear after CSV and calendar export
 */

import { test, expect, Page, Download } from '@playwright/test';
import * as fs from 'fs';

interface Fixture {
    name: string;
    location: string;
    date: string;
    category: string;
    url: string;
    description: string;
}

/** ISO YYYY-MM-DD a given number of days from today (UTC). */
function isoInDays(days: number): string {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/** 12 tournaments → two pages (10 per page). Dates increase with index so the
 *  default date-asc sort preserves creation order, making page 2 predictable. */
function buildFixtures(): Fixture[] {
    const fixtures: Fixture[] = [];
    for (let n = 1; n <= 12; n++) {
        const name = n === 3 ? 'Marbella Masters Open' : `Coastal Open ${n}`;
        fixtures.push({
            name,
            location: n % 2 === 0 ? 'Barcelona, ESP' : 'Vienna, AUT',
            date: isoInDays(n * 7),
            category: 'Open, Classical',
            url: `https://chess-results.com/tnr${n}.aspx?lan=1`,
            description: `${name} description`,
        });
    }
    return fixtures;
}

async function stubData(page: Page): Promise<void> {
    await page.route('**/tournaments_data.json', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(buildFixtures()),
        })
    );
}

async function readDownload(download: Download): Promise<string> {
    const filePath = await download.path();
    return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Results-first: the app auto-searches on load with the default filters, and
 * none of these tests change filters beforehand, so just wait for that
 * auto-search rather than re-clicking Search. (Re-clicking the sticky mobile
 * Search button once results already make the page scrollable hits a Mobile
 * Chrome emulation quirk where the fixed button's actionability check
 * misses — see search-and-filter.spec.ts for tests that genuinely need a
 * real click after changing filters.)
 */
async function search(page: Page): Promise<void> {
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
}

test.describe('Export hardening', () => {
    test.beforeEach(async ({ page }) => {
        await stubData(page);
        await page.goto('/');
        await expect(page.locator('h1')).toContainText('European Chess Tournament Finder');
    });

    test('search renders cards (no vacuous skip)', async ({ page }) => {
        await search(page);
        const count = await page.locator('.tournament-card').count();
        expect(count).toBe(10); // first page of 12
        await expect(page.locator('#resultsCount')).toContainText('12 tournaments');
    });

    test('CSV exports only the visible set after quick-search', async ({ page }) => {
        await search(page);

        // Narrow to a single, uniquely-named tournament.
        await page.locator('#quickSearch').fill('Marbella');
        await expect(page.locator('.tournament-card')).toHaveCount(1);

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('#exportBtn').click(),
        ]);
        const csv = await readDownload(download);
        const dataRows = csv.trim().split('\n').slice(1); // drop header

        expect(dataRows.length).toBe(1);
        expect(csv).toContain('Marbella Masters Open');
        expect(csv).not.toContain('Coastal Open 1');

        // Success message
        await expect(page.locator('#error')).toContainText(/exported .* csv/i);
    });

    test('CSV exports only shortlisted rows in shortlist-only mode', async ({ page }) => {
        await search(page);

        // Shortlist the first two visible cards.
        const cards = page.locator('.tournament-card');
        const firstName = await cards.nth(0).locator('.tournament-name').innerText();
        const secondName = await cards.nth(1).locator('.tournament-name').innerText();
        await cards.nth(0).locator('.shortlist-btn').click();
        await cards.nth(1).locator('.shortlist-btn').click();

        // Switch to shortlist-only view.
        await page.locator('#showShortlistOnly').check();
        await expect(page.locator('.tournament-card')).toHaveCount(2);

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('#exportBtn').click(),
        ]);
        const csv = await readDownload(download);
        const dataRows = csv.trim().split('\n').slice(1);

        expect(dataRows.length).toBe(2);
        expect(csv).toContain(firstName);
        expect(csv).toContain(secondName);
        expect(csv).not.toContain('Coastal Open 12'); // a non-shortlisted one
    });

    test('calendar export on page 2 downloads the correct tournament', async ({ page }) => {
        await search(page);

        // Go to page 2 (cards 11 & 12).
        await page.locator('.pagination-btn[data-page="2"]').click();
        await expect(page.locator('.tournament-card').first().locator('.tournament-name'))
            .toContainText('Coastal Open 11');

        // Calendar/copy-link are hover-revealed secondary actions on the card.
        await page.locator('.tournament-card').first().hover();
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.calendar-export-btn').first().click(),
        ]);
        const ics = await readDownload(download);

        // Must be tournament #11 — NOT the first card on page 1.
        expect(ics).toContain('SUMMARY:Coastal Open 11');
        expect(ics).toContain('URL:https://chess-results.com/tnr11.aspx?lan=1');
        expect(ics).not.toContain('URL:https://chess-results.com/tnr1.aspx?lan=1');
        // Valid all-day event, deterministic UID.
        expect(ics).toMatch(/DTSTART;VALUE=DATE:\d{8}\r\n/);
        expect(ics).toMatch(/UID:medtourney-[a-z0-9]+@medtourney\.github\.io/);

        await expect(page.locator('#error')).toContainText(/calendar event created/i);
    });

    test('shortlist export produces one .ics with multiple VEVENTs', async ({ page }) => {
        await search(page);

        const cards = page.locator('.tournament-card');
        await cards.nth(0).locator('.shortlist-btn').click();
        await cards.nth(1).locator('.shortlist-btn').click();

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('#exportShortlistBtn').click(),
        ]);
        const ics = await readDownload(download);

        expect(ics.split('BEGIN:VCALENDAR').length - 1).toBe(1);
        expect(ics.split('BEGIN:VEVENT').length - 1).toBe(2);
        const uids = ics.match(/UID:[^\r\n]+/g) || [];
        expect(uids.length).toBe(2);
        expect(uids[0]).not.toBe(uids[1]);

        await expect(page.locator('#error')).toContainText(/exported 2 shortlisted/i);
    });

    test('reload with a saved shortlist is not misleading', async ({ page }) => {
        await search(page);

        // Shortlist one tournament (persists to localStorage).
        await page.locator('.tournament-card').first().locator('.shortlist-btn').click();
        await expect(page.locator('#shortlistCount')).toHaveText('1');

        // Reload: allTournaments starts empty, but a saved shortlist exists.
        // The shortlist count is restored even before any search runs.
        await page.reload();
        await expect(page.locator('#shortlistCount')).toHaveText('1');

        // Trigger shortlist export while no search has run (allTournaments empty).
        // The Ctrl+S shortcut is enabled once a shortlist exists. This is exactly
        // the path that previously showed a false "star tournaments first" message.
        page.on('download', () => { /* swallow the .ics download */ });
        await page.keyboard.press('Control+s');

        // Must NOT falsely tell the user to "star tournaments first".
        await expect(page.locator('#error')).not.toContainText(/star tournaments/i);
        // With data auto-loaded in the background, the export succeeds.
        await expect(page.locator('#error')).toContainText(/exported 1 shortlisted/i, { timeout: 10000 });
    });

    test('Ctrl+E keyboard shortcut exports the visible set to CSV', async ({ page }) => {
        await search(page);
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.keyboard.press('Control+e'),
        ]);
        expect(download.suggestedFilename()).toContain('.csv');
    });
});
