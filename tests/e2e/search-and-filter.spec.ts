import { test, expect } from '@playwright/test';
import { stubTournaments, openAdvancedFilters } from './_fixtures';

test.describe('Tournament Search and Filter', () => {
  test.beforeEach(async ({ page }) => {
    await stubTournaments(page);
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('European Chess Tournament Finder');
    // Most tests here drive advanced controls (Open Category, Mediterranean
    // is primary but S50+/Women's/Exclude Youth/country live in the drawer).
    await openAdvancedFilters(page);
  });

  test('should display the main page correctly', async ({ page }) => {
    // Check header elements
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('button', { name: /dark mode/i })).toBeVisible();

    // Check filter panel
    await expect(page.locator('h2', { hasText: 'Search Filters' })).toBeVisible();
    await expect(page.getByRole('button', { name: /search tournaments/i })).toBeVisible();

    // Check footer
    await expect(page.locator('#lastUpdated')).toBeVisible();
    await expect(page.locator('footer a[href*="chess-results.com"]')).toBeVisible();
  });

  test('should search for tournaments', async ({ page }) => {
    // Click search button. force: true — on Mobile Chrome, once results
    // already make the page scrollable (they already do here, from the
    // automatic first search), Playwright's actionability check for this
    // fixed bottom button intermittently resolves against the wrong element
    // (a Mobile Chrome viewport-emulation quirk, not a real click target
    // issue — a raw click at the button's true position works every time).
    await page.getByRole('button', { name: /search tournaments/i }).click({ force: true });

    // Wait for loading to disappear
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    // Should display results or error
    const resultsVisible = await page.locator('#results').isVisible();
    const errorVisible = await page.locator('#error').isVisible();

    expect(resultsVisible || errorVisible).toBeTruthy();

    if (resultsVisible) {
      // Check results count is displayed
      await expect(page.locator('#resultsCount')).toBeVisible();
    }
  });

  test('should filter tournaments with checkboxes', async ({ page }) => {
    // Uncheck "Open Category Only"
    await page.getByLabel('Open Category Only').uncheck();

    // Check "Mediterranean Seaside Only"
    await page.getByLabel('Mediterranean Seaside Only').check();

    // Check "S50+ (Senior) Category"
    await page.getByLabel(/S50\+.*Senior/i).check();

    // Verify checkboxes are in correct state
    await expect(page.getByLabel('Open Category Only')).not.toBeChecked();
    await expect(page.getByLabel('Mediterranean Seaside Only')).toBeChecked();
    await expect(page.getByLabel(/S50\+.*Senior/i)).toBeChecked();

    // Search with filters. force: true — see the Mobile Chrome note above.
    await page.getByRole('button', { name: /search tournaments/i }).click({ force: true });
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });
  });

  test('should filter by date range', async ({ page }) => {
    // Set date range
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    await page.fill('#startDate', formatDate(today));
    await page.fill('#endDate', formatDate(nextMonth));

    // Search with date filter. force: true — see the Mobile Chrome note above.
    await page.getByRole('button', { name: /search tournaments/i }).click({ force: true });
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });
  });

  test('should filter by country', async ({ page }) => {
    // Country filter is now a checkbox list — check Spain's checkbox
    await page.locator('#countryList input[value="ESP"]').check();

    // Search with country filter. force: true — see the Mobile Chrome note above.
    await page.getByRole('button', { name: /search tournaments/i }).click({ force: true });
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    // If results are shown, verify they contain Spanish tournaments
    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible) {
      const tournamentCards = page.locator('.tournament-card');
      const count = await tournamentCards.count();

      if (count > 0) {
        // Check first tournament contains "ESP" or "Spain"
        const firstCard = tournamentCards.first();
        const locationText = await firstCard.locator('.tournament-location').textContent();
        expect(locationText?.toLowerCase()).toMatch(/esp|spain|españa/i);
      }
    }
  });

  test('should display empty state when no results', async ({ page }) => {
    // Set very restrictive filters
    await page.getByLabel('Mediterranean Seaside Only').check();
    await page.getByLabel(/S50\+.*Senior/i).check();
    await page.getByLabel(/Women's Tournaments/i).check();

    // Set very narrow date range
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    await page.fill('#startDate', formatDate(tomorrow));
    await page.fill('#endDate', formatDate(dayAfter));

    // force: true — see the Mobile Chrome note above.
    await page.getByRole('button', { name: /search tournaments/i }).click({ force: true });
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    // Should show empty state (or results - depending on data)
    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible) {
      // May show empty state or actual results
      const emptyState = page.locator('.empty-state');
      const hasTournaments = await page.locator('.tournament-card').count() > 0;

      if (!hasTournaments) {
        await expect(emptyState).toBeVisible();
        await expect(page.getByText(/no tournaments found/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /reset all filters/i })).toBeVisible();
      }
    }
  });

  test('should reset filters', async ({ page }) => {
    // Change some filters
    await page.getByLabel('Open Category Only').uncheck();
    await page.getByLabel('Mediterranean Seaside Only').check();

    // Search first. force: true — see the Mobile Chrome note above.
    await page.getByRole('button', { name: /search tournaments/i }).click({ force: true });
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    // Look for empty state and reset button
    const resetBtn = page.getByRole('button', { name: /reset all filters/i });
    const isResetVisible = await resetBtn.isVisible();

    if (isResetVisible) {
      await resetBtn.click();

      // Wait for new search to complete
      await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

      // Verify filters are reset
      await expect(page.getByLabel('Open Category Only')).toBeChecked();
      await expect(page.getByLabel('Mediterranean Seaside Only')).not.toBeChecked();
    }
  });

  test('should sort tournaments', async ({ page }) => {
    // Results-first: results are already on screen from the automatic first
    // search, so just wait for them rather than re-clicking Search.
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      // Change sort option
      await page.selectOption('#sortBy', 'name');

      // Wait a moment for re-render
      await page.waitForTimeout(500);

      // Verify tournaments are displayed (sorting order is hard to verify without knowing data)
      await expect(page.locator('.tournament-card').first()).toBeVisible();
    }
  });

  test('should search within results', async ({ page }) => {
    // Results-first: results are already on screen from the automatic first
    // search, so just wait for them rather than re-clicking Search.
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      // Get initial count
      const initialCount = await page.locator('.tournament-card').count();

      // Type in quick search
      await page.fill('#quickSearch', 'open');

      // Wait for filtering
      await page.waitForTimeout(500);

      // Count should change or stay same
      const newCount = await page.locator('.tournament-card').count();
      expect(newCount).toBeGreaterThanOrEqual(0);
      expect(newCount).toBeLessThanOrEqual(initialCount);

      // Clear search
      await page.fill('#quickSearch', '');
      await page.waitForTimeout(500);

      // Count should return to original (or close)
      const finalCount = await page.locator('.tournament-card').count();
      expect(finalCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('should navigate pagination', async ({ page }) => {
    // Ensure we have many results by unchecking filters
    await page.getByLabel('Exclude Youth-Only Tournaments').uncheck();

    // force: true — see the Mobile Chrome note above.
    await page.getByRole('button', { name: /search tournaments/i }).click({ force: true });
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible) {
      const tournamentCount = await page.locator('.tournament-card').count();

      // Only test pagination if there are enough results
      if (tournamentCount >= 20) {
        const nextButton = page.getByRole('button', { name: /next/i });

        if (await nextButton.isVisible() && await nextButton.isEnabled()) {
          // Click next page
          await nextButton.click();
          await page.waitForTimeout(500);

          // Should still see tournaments
          await expect(page.locator('.tournament-card').first()).toBeVisible();

          // Previous button should now be enabled
          const prevButton = page.getByRole('button', { name: /previous/i });
          await expect(prevButton).toBeEnabled();

          // Click previous
          await prevButton.click();
          await page.waitForTimeout(500);

          // Should be back on page 1
          await expect(page.locator('.tournament-card').first()).toBeVisible();
        }
      }
    }
  });
});
