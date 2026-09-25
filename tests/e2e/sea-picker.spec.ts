import { test, expect } from '@playwright/test';
import { stubTournaments, isoInDays, openFilters, closeFilters, setMode, TournamentFixture } from './_fixtures';

// The Seaside mode counts the seas ticked in the sea picker - Mediterranean
// and Atlantic by default; the Black Sea and the Caspian are opt-in.
test.describe('Sea picker', () => {
  const fixtures: TournamentFixture[] = [
    { name: 'Nice Open', location: 'Nice, FRA', lat: 43.7, lng: 7.26, coast: 'med' },
    { name: 'Biarritz Open', location: 'Biarritz, FRA', lat: 43.48, lng: -1.56, coast: 'atlantic' },
    { name: 'Varna Open', location: 'Varna, BUL', lat: 43.2, lng: 27.92, coast: 'black' },
    { name: 'Baku Open', location: 'Baku, AZE', lat: 40.41, lng: 49.87, coast: 'caspian' },
    { name: 'Madrid Open', location: 'Madrid, ESP', lat: 40.42, lng: -3.7 },
  ].map((t, i) => ({
    ...t, date: isoInDays(7 * (i + 1)), category: 'Open, Classical',
    url: `https://chess-results.com/tnr5${i}.aspx?lan=1`, description: '',
  }));

  const card = (page: import('@playwright/test').Page, name: string) =>
    page.locator('.tournament-card', { hasText: name });

  test.beforeEach(async ({ page }) => {
    await stubTournaments(page, fixtures);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('cards name their sea', async ({ page }) => {
    await expect(card(page, 'Nice Open').locator('.travel-tag')).toHaveText(['Mediterranean', 'Seaside']);
    await expect(card(page, 'Biarritz Open').locator('.travel-tag')).toHaveText(['Atlantic', 'Seaside']);
    await expect(card(page, 'Varna Open').locator('.travel-tag')).toHaveText(['Black Sea', 'Seaside']);
    await expect(card(page, 'Baku Open').locator('.travel-tag')).toHaveText(['Caspian', 'Seaside']);
    await expect(card(page, 'Madrid Open').locator('.travel-tag')).toHaveCount(0);
  });

  test('Seaside shows Mediterranean + Atlantic; ticking the Black Sea adds Varna', async ({ page }) => {
    await openFilters(page);
    await expect(page.locator('#seaPicker')).toBeHidden();
    await setMode(page, 'seaside');
    await openFilters(page);
    await expect(page.locator('#seaPicker')).toBeVisible();
    await closeFilters(page);
    await expect(page.locator('.tournament-card')).toHaveCount(2);
    await expect(card(page, 'Varna Open')).toHaveCount(0);

    await openFilters(page);
    await page.locator('#seaPicker').getByLabel('Black Sea').check();
    await closeFilters(page);
    await expect(page.locator('.tournament-card')).toHaveCount(3);
    await expect(card(page, 'Varna Open')).toHaveCount(1);
    await expect(page).toHaveURL(/[?&]sea=med%2Catlantic%2Cblack(&|$)/);
    await expect(page.locator('.active-filter-chip', { hasText: 'Seaside' })).toContainText('Mediterranean, Atlantic, Black Sea');
  });

  test('a shared ?sea= link opens with those seas', async ({ page }) => {
    await page.goto('/?med=1&sea=caspian');
    await expect(page.locator('.tournament-card')).toHaveCount(1);
    await expect(card(page, 'Baku Open')).toHaveCount(1);
    await openFilters(page);
    await expect(page.locator('#seaPicker').getByLabel('Caspian')).toBeChecked();
    await expect(page.locator('#seaPicker').getByLabel('Mediterranean')).not.toBeChecked();
  });
});
