import { test, expect, Page } from '@playwright/test';

/**
 * Export functionality E2E.
 *
 * Data is stubbed via `page.route` so these tests are deterministic and never
 * vacuously skip. Dates are generated relative to "now" so they always fall
 * inside the app's default 6-month window.
 */

function isoInDays(days: number): string {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

function fixtures() {
    return [
        {
            name: 'Barcelona Open', location: 'Barcelona, ESP', date: isoInDays(14),
            category: 'Open, Classical', url: 'https://chess-results.com/tnr101.aspx?lan=1',
            description: 'Barcelona Open',
        },
        {
            name: 'Athens Rapid', location: 'Athens, GRE', date: isoInDays(28),
            category: 'Open, Rapid', url: 'https://chess-results.com/tnr102.aspx?lan=1',
            description: 'Athens Rapid',
        },
    ];
}

async function stubData(page: Page): Promise<void> {
    await page.route('**/tournaments_data.json', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures()) })
    );
}

/**
 * Results-first: the app auto-searches on load, so these tests don't need to
 * click Search themselves — just wait for the auto-search to land. (Clicking
 * the sticky mobile Search button a second time, once results already make
 * the page scrollable, hits a Mobile Chrome emulation quirk where the fixed
 * button's actionability check misses — see search-and-filter.spec.ts for
 * the tests that genuinely exercise that click.)
 */
async function search(page: Page): Promise<void> {
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
}

test.describe('Export Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await stubData(page);
        await page.goto('/');
        await expect(page.locator('h1')).toContainText('MedTourney');
    });

    test('should export tournaments to CSV', async ({ page }) => {
        await search(page);
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('#exportBtn').click(),
        ]);
        const filename = download.suggestedFilename();
        expect(filename).toContain('chess-tournaments');
        expect(filename).toContain('.csv');
    });

    test('export button is available once the automatic first search lands', async ({ page }) => {
        // Results-first: the app auto-searches on load, so the export button
        // becomes available without the user clicking Search.
        await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#exportBtn')).toBeVisible();
    });

    test('should export a tournament to calendar (.ics)', async ({ page }) => {
        await search(page);
        // Calendar/copy-link are hover-revealed secondary actions on the card.
        await page.locator('.tournament-card').first().hover();
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.calendar-export-btn').first().click(),
        ]);
        expect(download.suggestedFilename()).toContain('.ics');
    });

    test('should display success message after CSV export', async ({ page }) => {
        await search(page);
        page.on('download', () => { /* swallow download */ });
        await page.locator('#exportBtn').click();
        await expect(page.locator('#error')).toContainText(/exported .* csv/i, { timeout: 3000 });
    });

    test('should display success message after calendar export', async ({ page }) => {
        await search(page);
        page.on('download', () => { /* swallow download */ });
        await page.locator('.tournament-card').first().hover();
        await page.locator('.calendar-export-btn').first().click();
        await expect(page.locator('#error')).toContainText(/calendar event created/i, { timeout: 3000 });
    });
});
