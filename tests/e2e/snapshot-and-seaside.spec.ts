import { test, expect } from '@playwright/test';
import { stubTournaments, defaultFixtures, isoInDays } from './_fixtures';

for (const width of [1440, 390]) {
  test(`seaside suggestion needs no opening click and date is in footer at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const fixtures = [{ name: 'Barcelona Seaside Open', location: 'Barcelona, ESP', category: 'Open, Classical',
      timeControl: '90+30', coast: 'med' as const, seaM: 100, date: isoInDays(14), dateTo: isoInDays(20),
      url: 'https://chess-results.com/tnr123.aspx', description: '' }];
    await page.route('**/tournaments_data.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixtures) }));
    await page.route('**/tournaments_data_meta.json', route => route.fulfill({ contentType: 'application/json',
      body: JSON.stringify({ generatedAt: '2026-10-04T04:54:00Z', keptRows: 1 }) }));
    await page.goto('/');
    await expect(page.locator('#headerTournamentCount')).toHaveText('1 tournament in index');
    await expect(page.locator('#resultsCount')).toHaveText('1 tournament found');
    await expect(page.locator('#headerLiveStatus')).not.toContainText(/updated|snapshot|Oct 2026/i);
    await expect(page.locator('footer #dataFreshness')).toHaveText('Data updated 4 Oct 2026');
    await expect(page.locator('.featured-suggestion')).toHaveJSProperty('open', true);
    await expect(page.locator('.featured-name-btn')).toBeVisible();
    await expect(page.locator('.featured-external-link')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await testInfo.attach(`seaside-open-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
    await page.locator('.featured-name-btn').click();
    await expect(page.locator('#tournamentDetail')).toHaveJSProperty('open', true);
    await expect(page.locator('#tournamentDetail .detail-cr-link')).toHaveText('Registration, players, pairings and results →');
  });
}

test('no suggestion means no empty accordion; unmatched metadata cannot date loaded rows', async ({ page }) => {
  await stubTournaments(page, defaultFixtures());
  await page.route('**/tournaments_data_meta.json', route => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ generatedAt: '2020-01-01T00:00:00Z' }) }));
  await page.goto('/');
  await expect(page.locator('#headerTournamentCount')).toHaveText('24 tournaments in index');
  await expect(page.locator('#resultsCount')).toHaveText('24 tournaments found');
  await expect(page.locator('footer #dataFreshness')).toHaveText('Data updated: date unavailable');
  await expect(page.locator('.featured-suggestion')).toBeHidden();
  await expect(page.locator('#staleness-banner')).toHaveCount(0);
  await expect(page.locator('footer .data-credit')).toContainText('chess-results.com');
});
