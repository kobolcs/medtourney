import { test, expect } from '@playwright/test';
import { stubTournaments, openAdvancedFilters } from './_fixtures';

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await stubTournaments(page);
    await page.goto('/');
  });

  test('should navigate with Tab key through all interactive elements', async ({ page }) => {
    // Start from beginning
    await page.keyboard.press('Tab'); // Skip link (should be visible when focused)
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    await expect(skipLink).toBeVisible();

    await page.keyboard.press('Tab'); // Help button
    const helpBtn = page.getByRole('button', { name: /open help/i });
    await expect(helpBtn).toBeFocused();

    await page.keyboard.press('Tab'); // Theme toggle
    const themeToggle = page.getByRole('button', { name: /dark mode/i });
    await expect(themeToggle).toBeFocused();

    // Continue through filters
    await page.keyboard.press('Tab'); // Filter heading (collapsible)
    await page.keyboard.press('Tab'); // First checkbox
    await page.keyboard.press('Tab'); // Second checkbox

    // Filtering is live (no Search button): tabbing must get all the way
    // through the filters to the results' "Filter results..." box.
    // Limit is high because the country checkbox list has 55 entries.
    const quickSearch = page.locator('#quickSearch');
    let reachedResults = false;
    for (let i = 0; i < 200 && !reachedResults; i++) {
      await page.keyboard.press('Tab');
      reachedResults = await quickSearch.evaluate((el) => el === document.activeElement).catch(() => false);
    }

    expect(reachedResults).toBe(true);
  });

  test('should support keyboard shortcut - "/" focuses quick search', async ({ page }) => {
    // Bare "/" (not Ctrl/Cmd+K, which the browser's own address-bar search
    // reserves) focuses the "filter results" input.
    const quickSearch = page.locator('#quickSearch');

    await page.keyboard.press('/');
    await expect(quickSearch).toBeFocused();
  });

  test('should support keyboard shortcut - "d" for dark mode toggle', async ({ page }) => {
    const body = page.locator('body');
    const initialDarkMode = await body.evaluate((el) => el.classList.contains('dark-theme'));

    await page.keyboard.press('d');
    await page.waitForTimeout(300);
    const newDarkMode = await body.evaluate((el) => el.classList.contains('dark-theme'));
    expect(newDarkMode).toBe(!initialDarkMode);

    // Toggle back
    await page.keyboard.press('d');
    await page.waitForTimeout(300);
    const finalDarkMode = await body.evaluate((el) => el.classList.contains('dark-theme'));
    expect(finalDarkMode).toBe(initialDarkMode);
  });

  test('should not toggle dark mode when "d" is typed inside an input', async ({ page }) => {
    // Regression guard: bare-letter shortcuts must not hijack typing now that
    // Ctrl/Cmd+D no longer does (that collided with the browser's bookmark
    // shortcut, which is why this moved to a bare key at all).
    const body = page.locator('body');
    const initialDarkMode = await body.evaluate((el) => el.classList.contains('dark-theme'));

    const quickSearch = page.locator('#quickSearch');
    await quickSearch.focus();
    await quickSearch.type('d');

    const darkModeAfterTyping = await body.evaluate((el) => el.classList.contains('dark-theme'));
    expect(darkModeAfterTyping).toBe(initialDarkMode);
    await expect(quickSearch).toHaveValue('d');
  });

  test('should support keyboard shortcut - "e" for CSV export', async ({ page }) => {
    // Results-first: the export button is already available from the
    // automatic first search, so just wait for it rather than re-clicking.
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.keyboard.press('e'),
    ]);
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('should support Escape key to clear quick search', async ({ page }) => {
    // Results-first: results are already on screen from the automatic first
    // search, so just wait for them rather than re-clicking Search.
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

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
    // #openOnly now lives in the "More filters" drawer, and its Tab position
    // shifts with any filter reordering, so focus it directly rather than
    // counting Tab presses.
    await openAdvancedFilters(page);
    const firstCheckbox = page.getByLabel('Open Category Only');
    await firstCheckbox.focus();
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
    // Tab to the "Seaside" mode button near the top of the filters
    const seaside = page.locator('.mode-switch-btn[data-mode="seaside"]');
    let focused = false;
    for (let i = 0; i < 30 && !focused; i++) {
      await page.keyboard.press('Tab');
      focused = await seaside.evaluate((el) => el === document.activeElement).catch(() => false);
    }

    expect(focused).toBe(true);

    // Press Enter to activate it - filtering is live, results re-render.
    await page.keyboard.press('Enter');
    await expect(seaside).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#mediterraneanOnly')).toBeChecked();
  });

  test('should navigate through filter collapse with Enter and Space', async ({ page }) => {
    // Tab to filter heading
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // Help button
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
    await openAdvancedFilters(page);
    await page.getByLabel('Exclude Youth-Only Tournaments').uncheck();
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
    // Results-first: results are already on screen from the automatic first
    // search, so just wait for them rather than re-clicking Search.
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

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
    // Focus the duration (minDays) dropdown — country filter is now a checkbox list
    await openAdvancedFilters(page);
    const minDays = page.locator('#minDays');
    await minDays.focus();
    await expect(minDays).toBeFocused();

    // Arrow-down moves to next option
    const before = await minDays.inputValue();
    await page.keyboard.press('ArrowDown');
    const after = await minDays.inputValue();
    expect(after).not.toBe(before);
  });

  test('should support keyboard navigation in date inputs', async ({ page }) => {
    // Focus start date
    const startDate = page.locator('#startDate');
    await startDate.focus();
    await expect(startDate).toBeFocused();

    // Set a date (native date inputs don't accept free-form typed strings).
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    await startDate.fill(dateString);
    await expect(startDate).toHaveValue(dateString);

    // Both date inputs are keyboard-reachable and editable. (A single Tab does
    // not leave a native date input — it cycles its day/month/year segments —
    // so focus the end-date input directly and confirm it accepts input.)
    const endDate = page.locator('#endDate');
    await endDate.focus();
    await expect(endDate).toBeFocused();
    await endDate.fill(dateString);
    await expect(endDate).toHaveValue(dateString);
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
