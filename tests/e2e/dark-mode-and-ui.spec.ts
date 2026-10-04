import { test, expect } from '@playwright/test';
import { stubTournaments } from './_fixtures';

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

});
