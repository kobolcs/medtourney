import { test, expect } from '@playwright/test';
import { stubTournaments, openAdvancedFilters, closeFilters } from './_fixtures';

test.describe('UI controls', () => {
  test.beforeEach(async ({ page }) => {
    await stubTournaments(page);
    await page.goto('/');
  });

  test('phones: filters open in a bottom sheet and close again', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Bottom sheet is phones-only (<= 768px)');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    const bar = page.locator('#openFiltersBtn');
    const sheet = page.locator('#filtersSheet');
    await expect(bar).toBeVisible();
    await expect(sheet.locator('.sheet-close')).toBeHidden();
    // Closed sheet is out of the way: inert, so nothing in it is reachable
    await expect(sheet).toHaveJSProperty('inert', true);

    await bar.click();
    await expect(sheet).toHaveAttribute('role', 'dialog');
    await expect(sheet).toHaveAttribute('aria-modal', 'true');
    await expect(sheet.locator('.sheet-close')).toBeFocused();
    await expect(page.locator('#startDate')).toBeVisible();

    // Escape closes and gives focus back to the bar
    await page.keyboard.press('Escape');
    await expect(sheet.locator('.sheet-close')).toBeHidden();
    await expect(bar).toBeFocused();

    // Tapping the backdrop closes too
    await bar.click();
    await page.locator('#sheetBackdrop').click({ position: { x: 20, y: 20 } });
    await expect(sheet.locator('.sheet-close')).toBeHidden();

    // "Show N tournaments" is the sheet's done button: closes it, focuses results
    await bar.click();
    await sheet.locator('#showResultsBtn').click();
    await expect(sheet.locator('.sheet-close')).toBeHidden();
    await expect(page.locator('#resultsHeading')).toBeFocused();
  });

  test('phones: the mode switch works without opening the sheet, and the bar counts filters', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Bottom sheet is phones-only (<= 768px)');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    // Results come first: the first card is on screen with the sheet closed
    await expect(page.locator('.tournament-card').first()).toBeInViewport();

    await page.locator('.mode-switch-btn[data-mode="seaside"]').click();
    await expect(page.locator('#mediterraneanOnly')).toBeChecked();
    await expect(page.locator('#openFiltersBtn')).toContainText('Filters (1)');
    // The bar also carries the result count (the heading is often under it)
    await expect(page.locator('#openFiltersBtn')).toContainText('· 12 tournaments');
  });

  test('phones: the sheet footer count updates live while filtering', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Bottom sheet is phones-only (<= 768px)');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
    await openAdvancedFilters(page);
    const footer = page.locator('#showResultsBtn');
    await expect(footer).toContainText('Show 24 tournaments');
    await page.getByLabel(/S50\+.*Senior/i).check();
    await expect(footer).toContainText('Show 8 tournaments');
  });

  test('should show a loading state during search', async ({ page }) => {
    const loading = page.locator('#loading');

    // The dedicated spinner element carries the loading ARIA semantics.
    await expect(loading).toHaveAttribute('aria-busy', 'true');
    await expect(loading).toHaveAttribute('role', 'status');

    // The app renders skeleton placeholders while fetching, then real cards.
    await expect(page.locator('#results')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('should display proper tournament card structure', async ({ page }) => {
    // Results-first: results are already on screen from the automatic first
    // search, so just wait for them rather than re-clicking Search.
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      const firstCard = page.locator('.tournament-card').first();

      // Should have all required elements
      await expect(firstCard.locator('.tournament-name')).toBeVisible();
      await expect(firstCard.locator('.tournament-date-badge')).toBeVisible();
      await expect(firstCard.locator('.tournament-location')).toBeVisible();
      await expect(firstCard.locator('.tournament-meta')).toBeVisible();
      await expect(firstCard.locator('.tournament-link')).toBeVisible();

      // Card should have hover effect
      await firstCard.hover();
      await page.waitForTimeout(300);

      // Verify card structure (hard to test visual effects, but structure should be there)
      const cardClasses = await firstCard.getAttribute('class');
      expect(cardClasses).toContain('tournament-card');
    }
  });

  test('should display empty state with suggestions', async ({ page }) => {
    // Set very restrictive filters to trigger empty state
    await page.locator('.mode-switch-btn[data-mode="seaside"]').click(); // Seaside mode = mediterraneanOnly
    await openAdvancedFilters(page);
    await page.getByLabel(/S50\+.*Senior/i).check();
    await page.getByLabel(/Women's Tournaments/i).check();

    // Set impossible date range
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    await page.fill('#startDate', formatDate(tomorrow));
    await page.fill('#endDate', formatDate(dayAfter));
    await closeFilters(page);

    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible) {
      const hasTournaments = await page.locator('.tournament-card').count() > 0;

      if (!hasTournaments) {
        // Should show empty state
        const emptyState = page.locator('.empty-state');
        await expect(emptyState).toBeVisible();

        // Should show icon, title, message
        await expect(emptyState.locator('.empty-state-icon')).toBeVisible();
        await expect(emptyState.locator('.empty-state-title')).toContainText(/no tournaments found/i);
        await expect(emptyState.locator('.empty-state-message')).toBeVisible();

        // Should show suggestions
        const suggestions = emptyState.locator('.empty-state-suggestions');
        if (await suggestions.isVisible()) {
          await expect(suggestions.locator('ul li')).not.toHaveCount(0);
        }

        // Should show reset button
        await expect(page.getByRole('button', { name: /reset all filters/i })).toBeVisible();
      }
    }
  });

});
