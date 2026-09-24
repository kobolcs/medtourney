import { test, expect } from '@playwright/test';
import { stubTournaments, openAdvancedFilters, closeFilters } from './_fixtures';

test.describe('Dark Mode and UI Features', () => {
  test.beforeEach(async ({ page }) => {
    await stubTournaments(page);
    await page.goto('/');
    // Tests that drive advanced controls (S50+/Women's, in the "More filters"
    // drawer - and on phones inside the filters sheet) open them themselves.
  });

  test('should toggle dark mode', async ({ page }) => {
    const body = page.locator('body');
    // Use the stable id: the button's accessible name changes when toggled.
    const themeToggle = page.locator('#themeToggle');

    // Check initial state (should be light mode)
    const initialDarkMode = await body.evaluate((el) => el.classList.contains('dark-theme'));

    // Click toggle
    await themeToggle.click();
    await page.waitForTimeout(500);

    // Should be in opposite mode
    const newDarkMode = await body.evaluate((el) => el.classList.contains('dark-theme'));
    expect(newDarkMode).toBe(!initialDarkMode);

    // Button text should change
    if (newDarkMode) {
      await expect(themeToggle).toContainText(/light mode/i);
    } else {
      await expect(themeToggle).toContainText(/dark mode/i);
    }
    // ...while staying an icon button: the icon must survive the toggle
    // (it once got replaced by "☀️ Light Mode" text spilling out of the circle)
    await expect(page.locator('#themeToggleIcon')).toHaveText(newDarkMode ? '☀' : '☽');

    // Toggle back
    await themeToggle.click();
    await page.waitForTimeout(500);

    // Should return to original
    const finalDarkMode = await body.evaluate((el) => el.classList.contains('dark-theme'));
    expect(finalDarkMode).toBe(initialDarkMode);
  });

  test('should persist dark mode preference', async ({ page, context }) => {
    const body = page.locator('body');
    const themeToggle = page.getByRole('button', { name: /dark mode/i });

    // Enable dark mode
    await themeToggle.click();
    await page.waitForTimeout(500);

    const darkModeEnabled = await body.evaluate((el) => el.classList.contains('dark-theme'));
    expect(darkModeEnabled).toBe(true);

    // Reload page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Dark mode should still be enabled
    const stillDarkMode = await body.evaluate((el) => el.classList.contains('dark-theme'));
    expect(stillDarkMode).toBe(true);
    await expect(page.locator('#themeToggleIcon')).toHaveText('☀');
  });

  test('footer shows the scrape time from the meta file', async ({ page }) => {
    await page.route('**/tournaments_data_meta.json', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ generatedAt: '2026-09-23T03:43:02+00:00' }),
      })
    );
    await page.reload();

    await expect(page.locator('#lastUpdatedWrap')).toBeVisible();
    await expect(page.locator('#lastUpdatedTime')).toContainText('23 Sept 2026');
    await expect(page.locator('#lastUpdated')).not.toContainText('…');
  });

  test('footer hides "Data updated" when no timestamp is known', async ({ page }) => {
    await page.route('**/tournaments_data_meta.json', route => route.fulfill({ status: 404 }));
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    // No placeholder, no "Never" - just the source links.
    await expect(page.locator('#lastUpdatedWrap')).toBeHidden();
    await expect(page.locator('#lastUpdated')).not.toContainText(/never|…/i);
    await expect(page.locator('#lastUpdated')).toContainText('chess-results.com');
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
      await expect(firstCard.locator('.tournament-date')).toBeVisible();
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
    await page.getByLabel('Open Category Only').uncheck();

    // Wait for filter preferences to be saved (happens on change)
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Filters should be restored
    await expect(page.getByLabel('Open Category Only')).not.toBeChecked();
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
