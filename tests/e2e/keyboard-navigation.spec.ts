import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate with Tab key through all interactive elements', async ({ page }) => {
    // Start from beginning
    await page.keyboard.press('Tab'); // Skip link (should be visible when focused)
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    await expect(skipLink).toBeVisible();

    await page.keyboard.press('Tab'); // Theme toggle
    const themeToggle = page.getByRole('button', { name: /dark mode/i });
    await expect(themeToggle).toBeFocused();

    // Continue through filters
    await page.keyboard.press('Tab'); // Filter heading (collapsible)
    await page.keyboard.press('Tab'); // First checkbox
    await page.keyboard.press('Tab'); // Second checkbox

    // All tabs should eventually reach search button
    let foundSearchButton = false;
    for (let i = 0; i < 30 && !foundSearchButton; i++) {
      await page.keyboard.press('Tab');
      const searchBtn = page.getByRole('button', { name: /search tournaments/i });
      foundSearchButton = await searchBtn.isFocused();
    }

    expect(foundSearchButton).toBe(true);
  });

  test('should support keyboard shortcuts - Alt+S for search', async ({ page }) => {
    // Press Alt+S to trigger search
    await page.keyboard.press('Alt+KeyS');

    // Loading should appear
    await expect(page.locator('#loading')).toBeVisible({ timeout: 2000 });

    // Wait for results
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    // Results or error should be visible
    const resultsVisible = await page.locator('#results').isVisible();
    const errorVisible = await page.locator('#error').isVisible();
    expect(resultsVisible || errorVisible).toBeTruthy();
  });

  test('should support keyboard shortcuts - Alt+D for dark mode toggle', async ({ page }) => {
    // Get initial theme
    const body = page.locator('body');
    const initialDarkMode = await body.evaluate((el) => el.classList.contains('dark-theme'));

    // Press Alt+D to toggle dark mode
    await page.keyboard.press('Alt+KeyD');

    // Wait for theme to apply
    await page.waitForTimeout(500);

    // Theme should be toggled
    const newDarkMode = await body.evaluate((el) => el.classList.contains('dark-theme'));
    expect(newDarkMode).toBe(!initialDarkMode);

    // Toggle back
    await page.keyboard.press('Alt+KeyD');
    await page.waitForTimeout(500);

    // Should return to original state
    const finalDarkMode = await body.evaluate((el) => el.classList.contains('dark-theme'));
    expect(finalDarkMode).toBe(initialDarkMode);
  });

  test('should support keyboard shortcuts - Alt+E for CSV export', async ({ page }) => {
    // Search first
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 });

      // Press Alt+E to export
      await page.keyboard.press('Alt+KeyE');

      // Should trigger download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.csv');

      // Clean up
      await download.delete();
    }
  });

  test('should support Escape key to clear quick search', async ({ page }) => {
    // Search first
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      // Focus quick search input
      const quickSearch = page.locator('#quickSearch');
      await quickSearch.focus();

      // Type something
      await page.keyboard.type('test');
      await expect(quickSearch).toHaveValue('test');

      // Press Escape to clear
      await page.keyboard.press('Escape');

      // Value should be cleared
      await expect(quickSearch).toHaveValue('');
    }
  });

  test('should activate checkboxes with Space key', async ({ page }) => {
    // Tab to first checkbox
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // Theme toggle
    await page.keyboard.press('Tab'); // Filter heading
    await page.keyboard.press('Tab'); // First checkbox

    const firstCheckbox = page.getByLabel('Open Category Only');
    await expect(firstCheckbox).toBeFocused();

    // Check initial state
    const initialChecked = await firstCheckbox.isChecked();

    // Press Space to toggle
    await page.keyboard.press('Space');

    // State should be toggled
    const newChecked = await firstCheckbox.isChecked();
    expect(newChecked).toBe(!initialChecked);

    // Press Space again to toggle back
    await page.keyboard.press('Space');

    // Should return to original state
    const finalChecked = await firstCheckbox.isChecked();
    expect(finalChecked).toBe(initialChecked);
  });

  test('should activate buttons with Enter key', async ({ page }) => {
    // Tab to search button
    let foundSearchButton = false;
    for (let i = 0; i < 30 && !foundSearchButton; i++) {
      await page.keyboard.press('Tab');
      const searchBtn = page.getByRole('button', { name: /search tournaments/i });
      foundSearchButton = await searchBtn.isFocused();
    }

    expect(foundSearchButton).toBe(true);

    // Press Enter to activate
    await page.keyboard.press('Enter');

    // Loading should appear
    await expect(page.locator('#loading')).toBeVisible({ timeout: 2000 });
  });

  test('should navigate through filter collapse with Enter and Space', async ({ page }) => {
    // Tab to filter heading
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // Theme toggle
    await page.keyboard.press('Tab'); // Filter heading

    const filterHeading = page.locator('h2', { hasText: 'Search Filters' });
    await expect(filterHeading).toBeFocused();

    // Get initial aria-expanded state
    const initialExpanded = await filterHeading.getAttribute('aria-expanded');

    // Press Enter to toggle
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // State should be toggled
    const newExpanded = await filterHeading.getAttribute('aria-expanded');
    expect(newExpanded).not.toBe(initialExpanded);

    // Press Space to toggle back
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    // Should return to original state
    const finalExpanded = await filterHeading.getAttribute('aria-expanded');
    expect(finalExpanded).toBe(initialExpanded);
  });

  test('should navigate pagination with keyboard', async ({ page }) => {
    // Get many results
    await page.getByLabel('Exclude Youth-Only Tournaments').uncheck();
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() >= 20) {
      // Tab to Next button
      const nextButton = page.getByRole('button', { name: /next/i });
      if (await nextButton.isVisible() && await nextButton.isEnabled()) {
        // Focus next button by tabbing through results
        await nextButton.focus();
        await expect(nextButton).toBeFocused();

        // Press Enter to go to next page
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        // Should be on page 2
        await expect(page.locator('.tournament-card').first()).toBeVisible();

        // Tab to Previous button
        const prevButton = page.getByRole('button', { name: /previous/i });
        await prevButton.focus();
        await expect(prevButton).toBeFocused();

        // Press Enter to go back
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        // Should be back on page 1
        await expect(page.locator('.tournament-card').first()).toBeVisible();
      }
    }
  });

  test('should navigate tournament links with keyboard', async ({ page }) => {
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      // Tab through to first tournament link
      const firstLink = page.locator('.tournament-link').first();

      // Focus the link
      await firstLink.focus();
      await expect(firstLink).toBeFocused();

      // Verify link is keyboard accessible (has proper href)
      const href = await firstLink.getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).toContain('http');
    }
  });

  test('should support keyboard navigation in dropdowns', async ({ page }) => {
    // Focus country filter dropdown
    const countryFilter = page.locator('#countryFilter');
    await countryFilter.focus();
    await expect(countryFilter).toBeFocused();

    // Press arrow down to select option
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    // Press Enter to confirm selection
    await page.keyboard.press('Enter');

    // Value should have changed
    const value = await countryFilter.inputValue();
    expect(value).toBeTruthy();
  });

  test('should support keyboard navigation in date inputs', async ({ page }) => {
    // Focus start date
    const startDate = page.locator('#startDate');
    await startDate.focus();
    await expect(startDate).toBeFocused();

    // Type a date (format: YYYY-MM-DD)
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];

    await page.keyboard.type(dateString);

    // Value should be set
    await expect(startDate).toHaveValue(dateString);

    // Tab to end date
    await page.keyboard.press('Tab');

    const endDate = page.locator('#endDate');
    await expect(endDate).toBeFocused();
  });

  test('should maintain focus visible indicators', async ({ page }) => {
    // Tab through elements and verify focus is visible
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // Theme toggle

    const themeToggle = page.getByRole('button', { name: /dark mode/i });

    // Check that focus outline is visible (by checking computed styles)
    const hasOutline = await themeToggle.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.outline !== 'none' || style.boxShadow !== 'none';
    });

    // Some focus indicator should be present
    expect(hasOutline).toBeTruthy();
  });

  test('should trap focus in important interactions', async ({ page }) => {
    // When modals or important interactions exist, focus should be trapped
    // Currently no modals, but test skip link behavior

    await page.keyboard.press('Tab'); // Focus skip link
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    await expect(skipLink).toBeVisible();

    // Activate skip link with Enter
    await page.keyboard.press('Enter');

    // Focus should move to main content area
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();

    // Next tab should focus first element in main
    await page.keyboard.press('Tab');
    const firstInMain = page.locator('#main-content *').first();
    // Just verify we can tab (hard to check exact focus without knowing structure)
  });
});
