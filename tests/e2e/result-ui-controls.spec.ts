import { test, expect } from '@playwright/test';
import { stubTournaments, openAdvancedFilters, closeFilters } from './_fixtures';

test.describe('UI controls', () => {
  test.beforeEach(async ({ page }) => {
    await stubTournaments(page);
    await page.goto('/');
  });

  test('should show error messages properly', async ({ page }) => {
    const error = page.locator('#error');

    // Initially hidden
    await expect(error).toBeHidden();

    // Error should have proper ARIA attributes
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error).toHaveAttribute('aria-live', 'assertive');
  });

  test('should have responsive design on mobile', async ({ page, isMobile }) => {
    if (isMobile) {
      await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

      // The "Filters" bar is fixed to the bottom, and its real screen position
      // tracks the visual viewport rather than the (usually taller,
      // toolbar-inflated) layout viewport - see
      // UIManager.initViewportOffsetFix(). A plain `bottom: 0` would leave it
      // below the actually-visible/tappable area on real Chrome for Android.
      const bottomOf = (selector: string) => page.locator(selector).evaluate((el) => ({
        position: window.getComputedStyle(el).position,
        rectBottom: el.getBoundingClientRect().bottom,
        visualViewportHeight: window.visualViewport?.height ?? window.innerHeight,
      }));

      const bar = await bottomOf('#openFiltersBtn');
      expect(bar.position).toBe('fixed');
      expect(bar.rectBottom).toBeCloseTo(bar.visualViewportHeight, 0);

      // Same for the open sheet: its "Show N tournaments" footer must be tappable
      await page.locator('#openFiltersBtn').click();
      await expect(page.locator('#filtersSheet .sheet-close')).toBeVisible();
      // Wait for the slide-up transition to finish (WebKit starts it late)
      await expect.poll(() => page.locator('#filtersSheet').evaluate(el => getComputedStyle(el).transform)).toBe('none');
      const sheet = await bottomOf('#filtersSheet');
      expect(sheet.position).toBe('fixed');
      expect(sheet.rectBottom).toBeCloseTo(sheet.visualViewportHeight, 0);
      const footer = await bottomOf('#showResultsBtn');
      expect(footer.rectBottom).toBeLessThanOrEqual(footer.visualViewportHeight + 1);
    }
  });

  test('should show proper pagination info', async ({ page }) => {
    // Get many results
    await openAdvancedFilters(page);
    await page.getByLabel('Exclude Youth-Only Tournaments').uncheck();
    await closeFilters(page);
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() >= 20) {
      const paginationInfo = page.locator('.pagination-info');
      if (await paginationInfo.isVisible()) {
        // Should show "Showing X-Y of Z tournaments"
        const infoText = await paginationInfo.textContent();
        expect(infoText).toMatch(/showing \d+-\d+ of \d+ tournaments/i);
      }
    }
  });

  test('should highlight active sort option', async ({ page }) => {
    // Results-first: results are already on screen from the automatic first
    // search, so just wait for them rather than re-clicking Search.
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      const sortSelect = page.locator('#sortBy');
      await expect(sortSelect).toBeVisible();

      // Default should be "date-asc"
      const defaultValue = await sortSelect.inputValue();
      expect(defaultValue).toBe('date-asc');

      // Change sort
      await sortSelect.selectOption('name');
      await page.waitForTimeout(500);

      // Value should be updated
      const newValue = await sortSelect.inputValue();
      expect(newValue).toBe('name');
    }
  });

  test('should persist filter preferences', async ({ page, context }) => {
    // Change some filters
    await page.locator('.mode-switch-btn[data-mode="seaside"]').click(); // Seaside mode = mediterraneanOnly
    await openAdvancedFilters(page);
    await page.getByLabel('Open to all', { exact: true }).uncheck();

    // Wait for filter preferences to be saved (happens on change)
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Filters should be restored
    await expect(page.getByLabel('Open to all', { exact: true })).not.toBeChecked();
    await expect(page.locator('#mediterraneanOnly')).toBeChecked();
  });
});

test.describe('Theme follows the device unless the person chose one', () => {
  test('a dark device gets the dark site from the first paint', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await stubTournaments(page);
    await page.goto('/');
    await expect(page.locator('body')).toHaveClass(/dark-theme/);
    await expect(page.locator('#themeToggleIcon')).toHaveText('☀');
  });

  test('an explicit light choice beats a dark device, and is kept after reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await stubTournaments(page);
    await page.goto('/');
    await page.locator('#themeToggle').click(); // dark -> light, saved
    await expect(page.locator('body')).not.toHaveClass(/dark-theme/);
    await page.reload();
    await expect(page.locator('body')).not.toHaveClass(/dark-theme/);
  });

  test('a theme saved days ago by an older version still applies', async ({ page }) => {
    await stubTournaments(page);
    await page.addInitScript(() => {
      // The old CacheManager format, 3 days old, from version 3.0.0 - it used
      // to expire after 24 h and be wiped by any version bump
      localStorage.setItem('medtourney_theme', JSON.stringify({
        data: 'dark', timestamp: Date.now() - 3 * 86400000, version: '3.0.0',
      }));
    });
    await page.goto('/');
    await expect(page.locator('body')).toHaveClass(/dark-theme/);
  });
});

test.describe('Tablets use the filters sheet too', () => {
  test('at 820px the filters open from the bar, and results come first', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Viewport set explicitly below');
    await page.setViewportSize({ width: 820, height: 1180 });
    await stubTournaments(page);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    await expect(page.locator('#openFiltersBtn')).toBeVisible();
    await expect(page.locator('#openFiltersBtn')).toContainText('Filters · 24 tournaments');
    await expect(page.locator('.tournament-card').first()).toBeInViewport();

    await page.locator('#openFiltersBtn').click();
    await expect(page.locator('#filtersSheet')).toHaveAttribute('role', 'dialog');
    await expect(page.locator('#startDate')).toBeVisible();
  });
});
