import { test, expect } from '@playwright/test';
import { stubTournaments, isoInDays, openAdvancedFilters, TournamentFixture } from './_fixtures';

// Spain is listed twice in the country checklist - under Mediterranean and
// under Atlantic (Spain & Portugal). The two boxes are one selection.
test.describe('Countries listed under two regions', () => {
  const fixtures: TournamentFixture[] = [
    ['Barcelona, ESP', 'Barcelona Open'], ['Porto, POR', 'Porto Open'], ['Rome, ITA', 'Roma Open'],
  ].map(([location, name], i) => ({
    name, location, date: isoInDays(7 * (i + 1)), category: 'Open, Classical',
    url: `https://chess-results.com/tnr6${i}.aspx?lan=1`, description: '',
  }));

  const spain = (page: import('@playwright/test').Page) => page.locator('#countryList input[value="ESP"]');

  test.beforeEach(async ({ page }) => {
    await stubTournaments(page, fixtures);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
    await openAdvancedFilters(page);
  });

  test('ticking Spain under Atlantic ticks it under Mediterranean too', async ({ page }) => {
    await expect(spain(page)).toHaveCount(2);
    await spain(page).nth(1).check();
    await expect(spain(page).nth(0)).toBeChecked();
    await expect(page.locator('.tournament-card')).toHaveCount(1);
    await expect(page.locator('#countryFilterSummary')).toHaveText('ESP');
    await expect(page).toHaveURL(/[?&]country=ESP(&|$)/);

    await spain(page).nth(0).uncheck();
    await expect(spain(page).nth(1)).not.toBeChecked();
    await expect(page.locator('.tournament-card')).toHaveCount(3);
  });

  test('the Atlantic region tick selects Spain and Portugal once each', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Select all Atlantic (Spain & Portugal) countries' }).check();
    await expect(spain(page).nth(0)).toBeChecked();
    await expect(page.locator('#countryList input[value="POR"]')).toBeChecked();
    await expect(page.locator('.tournament-card')).toHaveCount(2);
    await expect(page.locator('#countryFilterSummary')).toHaveText('ESP, POR');
    // Spain ticked, Italy not: Mediterranean is partly selected
    const med = page.getByRole('checkbox', { name: 'Select all Mediterranean countries' });
    expect(await med.evaluate(el => (el as HTMLInputElement).indeterminate)).toBe(true);
  });

  test('a saved selection restores both copies', async ({ page }) => {
    await spain(page).nth(1).check();
    const stored = await page.evaluate(() => localStorage.getItem('medtourney_filter_preferences'));
    expect((JSON.parse(stored!) as { countryFilter: string[] }).countryFilter).toEqual(['ESP']);

    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
    await openAdvancedFilters(page);
    await expect(spain(page).nth(0)).toBeChecked();
    await expect(spain(page).nth(1)).toBeChecked();
  });
});
