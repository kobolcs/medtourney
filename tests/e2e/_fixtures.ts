import { Page } from '@playwright/test';

/**
 * Shared E2E helpers: deterministic data stubbing.
 *
 * The app fetches `tournaments_data.json`. To keep E2E tests deterministic
 * (and independent of live network data / the current date), tests stub that
 * request with fixtures whose dates are generated relative to "now" so they
 * always fall inside the app's default 6-month search window.
 */

export interface TournamentFixture {
    name: string;
    location: string;
    date: string;
    category: string;
    url: string;
    description: string;
    lat?: number;
    lng?: number;
    coast?: 'med' | 'atlantic' | 'black' | 'caspian';
    seaM?: number;
    airport?: { iata: string; name: string; km: number; city?: string };
    town?: string;
}

/** ISO YYYY-MM-DD a given number of days from today (UTC). */
export function isoInDays(days: number): string {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/**
 * A default set of 24 tournaments → three pages (10 per page), enough to
 * exercise pagination (specs that guard on >= 20 results). Includes
 * Mediterranean (Barcelona) and senior (S50+) events so the filter-oriented
 * specs have matching data, plus variety for sorting.
 */
export function defaultFixtures(): TournamentFixture[] {
    const items: TournamentFixture[] = [];
    for (let n = 1; n <= 24; n++) {
        // Vary location/category so filter and sort assertions have signal.
        const isMed = n % 2 === 0;
        const isSenior = n % 3 === 0;
        const cat = ['Open', 'Classical'];
        if (isSenior) cat.push('S50+');
        items.push({
            name: `${isMed ? 'Barcelona' : 'Vienna'} Open ${n}`,
            location: isMed ? 'Barcelona, ESP' : 'Vienna, AUT',
            // Coordinates as geocode_tournaments.py would add them (map view)
            lat: isMed ? 41.3874 : 48.2082,
            lng: isMed ? 2.1686 : 16.3738,
            // Seaside comes from the geocoder's coast flag once a place has coordinates
            ...(isMed ? { coast: 'med' as const } : {}),
            date: isoInDays(n * 7),
            category: cat.join(', '),
            url: `https://chess-results.com/tnr${n}.aspx?lan=1`,
            description: `Tournament ${n} description`,
        });
    }
    return items;
}

/** Route `tournaments_data.json` to the given fixtures (or the default set). */
export async function stubTournaments(
    page: Page,
    fixtures: TournamentFixture[] = defaultFixtures()
): Promise<void> {
    await page.route('**/tournaments_data.json', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(fixtures),
        })
    );
}

/**
 * Wait for tournament cards to render. Results load automatically and
 * filtering is live, so there's no Search button to click any more.
 */
export async function runSearch(page: Page): Promise<void> {
    await page.locator('.tournament-card').first().waitFor({ state: 'visible', timeout: 10000 });
}

/**
 * Open the "More filters" drawer so advanced controls (Open Category Only,
 * Exclude Youth, Women's, Include Team, Age Group, Duration, Country) become
 * visible and interactable. Blurs the newly-focused summary afterwards so
 * keyboard specs that Tab from the top of the document aren't left starting
 * mid-page (and so the skip-link test still sees an unfocused document).
 */
/**
 * Phones (<= 768px): filters live in a bottom sheet (FilterSheet.ts) - open
 * it so its controls can be used. No-op on wider screens.
 */
export async function openFilters(page: Page): Promise<void> {
    const bar = page.locator('#openFiltersBtn');
    if (!(await bar.isVisible())) return;
    const sheet = page.locator('#filtersSheet');
    if (!(await sheet.evaluate(el => el.classList.contains('is-open')))) {
        await bar.click();
    }
    await sheet.locator('.sheet-close').waitFor({ state: 'visible' });
}

/** Close the phone filters sheet (e.g. before using the results behind it). No-op elsewhere. */
export async function closeFilters(page: Page): Promise<void> {
    const sheet = page.locator('#filtersSheet');
    if (await sheet.evaluate(el => el.classList.contains('is-open'))) {
        await sheet.locator('.sheet-close').click();
        await sheet.locator('.sheet-close').waitFor({ state: 'hidden' });
    }
}

/**
 * Click a Seaside/Senior mode button. On phones it sits above the results,
 * behind the open filters sheet - close the sheet first, then reopen it so
 * the test can carry on with sheet controls.
 */
export async function setMode(page: Page, mode: 'all' | 'seaside' | 'senior' | 'both'): Promise<void> {
    const sheet = page.locator('#filtersSheet');
    const wasOpen = await sheet.evaluate(el => el.classList.contains('is-open'));
    if (wasOpen) await closeFilters(page);
    await page.locator(`.mode-switch-btn[data-mode="${mode}"]`).click();
    if (wasOpen) await openFilters(page);
}

export async function openAdvancedFilters(page: Page): Promise<void> {
    await openFilters(page);
    const details = page.locator('#advancedFilters');
    const isOpen = await details.evaluate((el) => (el as HTMLDetailsElement).open);
    if (!isOpen) {
        await page.locator('.advanced-summary').click();
    }
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** 1x1 transparent PNG - stands in for OpenStreetMap tiles in tests. */
const BLANK_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
);

/** Serve map tiles locally so map tests never hit tile.openstreetmap.org. */
export async function stubMapTiles(page: Page): Promise<void> {
    await page.route('https://tile.openstreetmap.org/**', route =>
        route.fulfill({ status: 200, contentType: 'image/png', body: BLANK_PNG })
    );
}
