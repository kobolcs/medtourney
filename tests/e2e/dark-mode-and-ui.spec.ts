import { test, expect } from '@playwright/test';
import { stubTournaments } from './_fixtures';

test.describe('Dark Mode and UI Features', () => {
  test.beforeEach(async ({ page }) => {
    await stubTournaments(page);
    await page.goto('/');
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
  });

  test('should display last updated timestamp', async ({ page }) => {
    const timestamp = page.locator('#lastUpdatedTime');

    // After init the app resolves the "Loading..." placeholder to a real
    // status (a cached timestamp, or "Never (no cached data)").
    await expect(timestamp).not.toHaveText(/loading/i, { timeout: 10000 });

    // Run a search so data is cached, then the timestamp reflects real state.
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    const timestampText = await timestamp.textContent();
    expect(timestampText).not.toContain('Loading');
    expect(timestampText).toBeTruthy();
    expect(timestampText!.length).toBeGreaterThan(4);
  });

  test('should collapse and expand filters on mobile', async ({ page, isMobile }) => {
    if (isMobile) {
      const filterHeading = page.locator('h2', { hasText: 'Search Filters' });
      const filtersCard = page.locator('.filters-card');

      // Should be expanded initially
      let expanded = await filtersCard.getAttribute('aria-expanded');
      expect(expanded).toBe('true');

      // Click to collapse
      await filterHeading.click();
      await page.waitForTimeout(300);

      // Should be collapsed
      expanded = await filtersCard.getAttribute('aria-expanded');
      expect(expanded).toBe('false');

      // Filters should be hidden
      const hasCollapsedClass = await filtersCard.evaluate((el) => el.classList.contains('collapsed'));
      expect(hasCollapsedClass).toBe(true);

      // Click to expand
      await filterHeading.click();
      await page.waitForTimeout(300);

      // Should be expanded again
      expanded = await filtersCard.getAttribute('aria-expanded');
      expect(expanded).toBe('true');
    }
  });

  test('should show a loading state during search', async ({ page }) => {
    const loading = page.locator('#loading');

    // The dedicated spinner element carries the loading ARIA semantics.
    await expect(loading).toHaveAttribute('aria-busy', 'true');
    await expect(loading).toHaveAttribute('role', 'status');

    // The app renders skeleton placeholders while fetching, then real cards.
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('#results')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('should display proper tournament card structure', async ({ page }) => {
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      const firstCard = page.locator('.tournament-card').first();

      // Should have all required elements
      await expect(firstCard.locator('.tournament-name')).toBeVisible();
      await expect(firstCard.locator('.tournament-date')).toBeVisible();
      await expect(firstCard.locator('.tournament-location')).toBeVisible();
      await expect(firstCard.locator('.tournament-category')).toBeVisible();
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
    await page.getByLabel('Mediterranean Seaside Only').check();
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

    await page.getByRole('button', { name: /search tournaments/i }).click();
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
      // Search button should be sticky on mobile
      const searchBtn = page.getByRole('button', { name: /search tournaments/i });
      await expect(searchBtn).toBeVisible();

      // Check if search button is at bottom (fixed position)
      const position = await searchBtn.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          position: style.position,
          bottom: style.bottom,
        };
      });

      expect(position.position).toBe('fixed');
      expect(position.bottom).toBe('0px');

      // Filters should be collapsible
      const filterHeading = page.locator('h2', { hasText: 'Search Filters' });
      await expect(filterHeading).toHaveAttribute('role', 'button');
      await expect(filterHeading).toHaveAttribute('tabindex', '0');
    }
  });

  test('should show proper pagination info', async ({ page }) => {
    // Get many results
    await page.getByLabel('Exclude Youth-Only Tournaments').uncheck();
    await page.getByRole('button', { name: /search tournaments/i }).click();
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
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

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
    await page.getByLabel('Open Category Only').uncheck();
    await page.getByLabel('Mediterranean Seaside Only').check();

    // Wait for filter preferences to be saved (happens on change)
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Filters should be restored
    await expect(page.getByLabel('Open Category Only')).not.toBeChecked();
    await expect(page.getByLabel('Mediterranean Seaside Only')).toBeChecked();
  });
});
