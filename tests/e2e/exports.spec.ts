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

async function search(page: Page): Promise<void> {
    await page.locator('#searchBtn').click();
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
}

test.describe('Export Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await stubData(page);
        await page.goto('/');
        await expect(page.locator('h1')).toContainText('European Chess Tournament Finder');
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

    test('export button is hidden before any search', async ({ page }) => {
        await expect(page.locator('#exportBtn')).not.toBeVisible();
    });

    test('should export a tournament to calendar (.ics)', async ({ page }) => {
        await search(page);
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
        await page.locator('.calendar-export-btn').first().click();
        await expect(page.locator('#error')).toContainText(/calendar event created/i, { timeout: 3000 });
    });
});
