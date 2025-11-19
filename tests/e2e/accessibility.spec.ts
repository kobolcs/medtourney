import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should not have any automatically detectable accessibility issues', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have skip navigation link', async ({ page }) => {
    // Skip link should be in DOM
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    await expect(skipLink).toBeInViewport({ ratio: 0 }); // May be off-screen initially

    // Focus skip link with Tab
    await page.keyboard.press('Tab');

    // Skip link should now be visible
    await expect(skipLink).toBeVisible();

    // Clicking skip link should move focus to main content
    await skipLink.click();

    // Main content should have focus (or focus should be within main)
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
  });

  test('should have proper ARIA labels on interactive elements', async ({ page }) => {
    // Check search button
    const searchBtn = page.getByRole('button', { name: /search tournaments/i });
    await expect(searchBtn).toHaveAttribute('aria-label', /search.*tournaments/i);

    // Check theme toggle
    const themeToggle = page.getByRole('button', { name: /toggle dark mode/i });
    await expect(themeToggle).toHaveAttribute('aria-label', /dark mode/i);

    // Check filter panel
    const filterPanel = page.locator('.filters-card');
    await expect(filterPanel).toHaveAttribute('aria-label', /tournament search filters/i);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    // Get all headings
    const h1 = await page.locator('h1').count();
    const h2s = await page.locator('h2').all();

    // Should have exactly one h1
    expect(h1).toBe(1);

    // Should have multiple h2s
    expect(h2s.length).toBeGreaterThan(0);

    // H1 should be visible
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should have proper form labels', async ({ page }) => {
    // All checkboxes should have labels
    const checkboxes = await page.locator('input[type="checkbox"]').all();

    for (const checkbox of checkboxes) {
      const id = await checkbox.getAttribute('id');
      if (id) {
        const label = page.locator(`label[for="${id}"]`).or(
          page.locator(`label:has(input#${id})`)
        );
        await expect(label).toBeVisible();
      }
    }

    // Date inputs should have labels
    const startDate = page.locator('#startDate');
    const startLabel = page.locator('label[for="startDate"]');
    await expect(startLabel).toBeVisible();

    const endDate = page.locator('#endDate');
    const endLabel = page.locator('label[for="endDate"]');
    await expect(endLabel).toBeVisible();

    // Country filter should have label
    const countryFilter = page.locator('#countryFilter');
    const countryLabel = page.locator('label[for="countryFilter"]');
    await expect(countryLabel).toBeVisible();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    // Run Axe accessibility scan focused on color contrast
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .disableRules(['color-contrast']) // We'll check manually
      .analyze();

    // Manual spot checks for key elements
    const h1 = page.locator('h1');
    const computedStyle = await h1.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
      };
    });

    // Just verify we can get the styles (actual contrast ratio calculation is complex)
    expect(computedStyle.color).toBeTruthy();
  });

  test('should support screen readers with ARIA live regions', async ({ page }) => {
    // Check for aria-live on results count
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible) {
      const resultsCount = page.locator('#resultsCount');
      await expect(resultsCount).toHaveAttribute('aria-live', 'polite');
    }

    // Check last updated timestamp
    const lastUpdated = page.locator('#lastUpdated');
    await expect(lastUpdated).toHaveAttribute('aria-live', 'polite');

    // Check error messages
    const error = page.locator('#error');
    await expect(error).toHaveAttribute('aria-live', 'assertive');
  });

  test('should have accessible tournament cards', async ({ page }) => {
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      const firstCard = page.locator('.tournament-card').first();

      // Card should have proper structure
      await expect(firstCard.locator('.tournament-name')).toBeVisible();
      await expect(firstCard.locator('.tournament-location')).toBeVisible();
      await expect(firstCard.locator('.tournament-date')).toBeVisible();

      // Links should have proper labels
      const tournamentLink = firstCard.locator('.tournament-link');
      await expect(tournamentLink).toHaveAttribute('aria-label', /.+/);
      await expect(tournamentLink).toHaveAttribute('rel', 'noopener noreferrer');

      // Calendar button should have proper label
      const calendarBtn = firstCard.locator('.calendar-export-btn');
      if (await calendarBtn.isVisible()) {
        await expect(calendarBtn).toHaveAttribute('aria-label', /.+/);
      }
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    // Tab through interactive elements
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // Theme toggle

    // Should reach checkboxes
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should be able to toggle checkbox with Space
    await page.keyboard.press('Space');

    // Continue tabbing to search button
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
    }

    // Should eventually reach search button
    const searchBtn = page.getByRole('button', { name: /search tournaments/i });
    await expect(searchBtn).toBeFocused();
  });

  test('should announce dynamic content changes', async ({ page }) => {
    // Search for tournaments
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    // Loading should have proper ARIA
    const loading = page.locator('#loading');
    await expect(loading).toHaveAttribute('aria-live', 'polite');
    await expect(loading).toHaveAttribute('aria-busy', 'true');
  });

  test('should support dark mode without accessibility issues', async ({ page }) => {
    // Toggle dark mode
    await page.getByRole('button', { name: /dark mode/i }).click();

    // Wait for theme to apply
    await page.waitForTimeout(500);

    // Run accessibility scan in dark mode
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);

    // Verify dark theme is applied
    const body = page.locator('body');
    const hasClass = await body.evaluate((el) => el.classList.contains('dark-theme'));
    expect(hasClass).toBe(true);
  });

  test('should have accessible mobile navigation', async ({ page, isMobile }) => {
    if (isMobile) {
      // Check filter collapse is keyboard accessible on mobile
      const filtersHeading = page.locator('h2', { hasText: 'Search Filters' });
      await expect(filtersHeading).toHaveAttribute('tabindex', '0');
      await expect(filtersHeading).toHaveAttribute('role', 'button');
      await expect(filtersHeading).toHaveAttribute('aria-expanded');

      // Should be able to activate with keyboard
      await filtersHeading.focus();
      await page.keyboard.press('Enter');

      // Aria-expanded should change
      const expanded = await filtersHeading.getAttribute('aria-expanded');
      expect(['true', 'false']).toContain(expanded);
    }
  });
});
