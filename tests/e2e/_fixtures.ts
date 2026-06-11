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

/** Click the search button and wait for tournament cards to render. */
export async function runSearch(page: Page): Promise<void> {
    await page.locator('#searchBtn').click();
    await page.locator('.tournament-card').first().waitFor({ state: 'visible', timeout: 10000 });
}
