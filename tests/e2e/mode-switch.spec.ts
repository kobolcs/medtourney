import { test, expect } from '@playwright/test';
import { stubTournaments, openAdvancedFilters, openFilters, isoInDays, TournamentFixture } from './_fixtures';

test.describe('Seaside/Senior mode switch and live filtering', () => {
  test.beforeEach(async ({ page }) => {
    await stubTournaments(page);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking a mode switch button checks the matching checkbox and filters live, with no Search click', async ({ page }) => {
    const before = await page.locator('#resultsCount').textContent();

    await page.locator('.mode-switch-btn[data-mode="seaside"]').click();

    await expect(page.locator('#mediterraneanOnly')).toBeChecked();
    await expect(page.locator('.mode-switch-btn[data-mode="seaside"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.mode-switch-btn[data-mode="all"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page).toHaveURL(/[?&]med=1(&|$)/);

    // Results updated without touching the Search button.
    await expect(page.locator('#resultsCount')).not.toHaveText(before ?? '');
  });

  test('"Both" mode checks Mediterranean and Senior 50+ together', async ({ page }) => {
    await page.locator('.mode-switch-btn[data-mode="both"]').click();

    await expect(page.locator('#mediterraneanOnly')).toBeChecked();
    await openAdvancedFilters(page);
    await expect(page.locator('#seniorCategory')).toBeChecked();
  });

  test('checking the drawer Senior checkbox directly updates the mode switch', async ({ page }) => {
    await openAdvancedFilters(page);
    await page.locator('#seniorCategory').check();

    await expect(page.locator('.mode-switch-btn[data-mode="senior"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('active-filter chips appear for narrowing filters and remove them on click', async ({ page }) => {
    await page.locator('.mode-switch-btn[data-mode="seaside"]').click();

    const chip = page.locator('.active-filter-chip', { hasText: 'Seaside' });
    await expect(chip).toBeVisible();

    await chip.click();
    await expect(page.locator('#mediterraneanOnly')).not.toBeChecked();
    await expect(page.locator('#activeFilterChips')).toBeHidden();
  });

  test('"Clear all" in the chip row resets every filter', async ({ page }) => {
    await page.locator('.mode-switch-btn[data-mode="both"]').click();
    await expect(page.locator('.active-filter-clear-all')).toBeVisible();

    await page.locator('.active-filter-clear-all').click();
    await expect(page.locator('#mediterraneanOnly')).not.toBeChecked();
    await expect(page.locator('.mode-switch-btn[data-mode="all"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#activeFilterChips')).toBeHidden();
  });
});

test.describe('No Search button - live results', () => {
  test('a failed load offers "Try again", which recovers', async ({ page }) => {
    // Fail every tournament-data source (local file + remote fallbacks)
    await page.route('**/*tournaments_data*.json*', route => route.abort());
    await page.goto('/');

    const retry = page.getByRole('button', { name: 'Try again' });
    await expect(retry).toBeVisible({ timeout: 20000 });

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stubTournaments(page);
    await retry.click();

    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#error')).toBeHidden();
  });

  test('"Show N tournaments" jumps to the results on phones', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'The jump button is only shown below 1024px');
    await stubTournaments(page);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    // Phones: it's the filters sheet's "done" button
    await openFilters(page);
    const btn = page.locator('#showResultsBtn');
    await expect(btn).toContainText(/show \d+ tournaments?/i);
    await btn.click();
    await expect(page.locator('#resultsHeading')).toBeFocused();
    await expect(page.locator('#resultsHeading')).toBeInViewport();
  });

  test('the jump button is hidden on the desktop sidebar layout', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop layout only');
    await stubTournaments(page);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#showResultsBtn')).toBeHidden();
  });
});

test.describe('Country list region ticks', () => {
  // Two Mediterranean countries (ESP, ITA) so a region can be partly ticked,
  // plus one Central European (AUT).
  const fixtures: TournamentFixture[] = [
    ['Barcelona, ESP', 'Barcelona Open'], ['Rome, ITA', 'Roma Open'], ['Vienna, AUT', 'Vienna Open'],
  ].map(([location, name], i) => ({
    name, location, date: isoInDays(7 * (i + 1)), category: 'Open, Classical',
    url: `https://chess-results.com/tnr9${i}.aspx?lan=1`, description: '',
  }));

  test.beforeEach(async ({ page }) => {
    await stubTournaments(page, fixtures);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
    await openAdvancedFilters(page);
  });

  test('a region tick selects every shown country in that region', async ({ page }) => {
    const med = page.getByRole('checkbox', { name: 'Select all Mediterranean countries' });
    // Tap the region row (the label wraps the tick), as a user would
    const medRow = page.locator('label.country-group-label', { hasText: 'Mediterranean' });
    await medRow.click();
    await expect(med).toBeChecked();

    await expect(page.locator('#countryList input[value="ESP"]')).toBeChecked();
    await expect(page.locator('#countryList input[value="ITA"]')).toBeChecked();
    await expect(page.locator('#countryList input[value="AUT"]')).not.toBeChecked();
    await expect(page.locator('.tournament-card')).toHaveCount(2);

    await medRow.click();
    await expect(med).not.toBeChecked();
    await expect(page.locator('#countryList input[value="ESP"]')).not.toBeChecked();
    await expect(page.locator('.tournament-card')).toHaveCount(3);
  });

  test('a region tick shows partly-selected as indeterminate', async ({ page }) => {
    const med = page.getByRole('checkbox', { name: 'Select all Mediterranean countries' });
    await page.locator('#countryList input[value="ESP"]').check();
    await expect(med).not.toBeChecked();
    await expect(med).toHaveJSProperty('indeterminate', true);

    await page.locator('#countryList input[value="ITA"]').check();
    await expect(med).toBeChecked();
    await expect(med).toHaveJSProperty('indeterminate', false);
  });

  test('Seaside mode is disabled when only non-seaside countries are picked', async ({ page }) => {
    await page.locator('#countryList input[value="AUT"]').check();
    await expect(page.locator('.mode-switch-btn[data-mode="seaside"]')).toBeDisabled();
    await expect(page.locator('.mode-switch-btn[data-mode="both"]')).toBeDisabled();

    await page.locator('#countryList input[value="AUT"]').uncheck();
    await expect(page.locator('.mode-switch-btn[data-mode="seaside"]')).toBeEnabled();
  });
});
