import { test, expect } from '@playwright/test';
import { stubTournaments, openAdvancedFilters, openFilters } from './_fixtures';

test.describe('Filter state in the URL', () => {
  test.beforeEach(async ({ page }) => {
    await stubTournaments(page);
  });

  test('checking a filter updates the URL query string', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('MedTourney');

    await page.locator('.mode-switch-btn[data-mode="seaside"]').click();
    await expect(page).toHaveURL(/[?&]med=1(&|$)/);

    await openAdvancedFilters(page);
    await page.locator('#seniorCategory').check();
    await expect(page).toHaveURL(/[?&]senior=1(&|$)/);
    // Earlier param survives a later one being added.
    await expect(page).toHaveURL(/[?&]med=1(&|$)/);
  });

  test('loading a link with filter params applies them on load', async ({ page }) => {
    await page.goto('/?med=1&senior=1');
    await expect(page.locator('h1')).toContainText('MedTourney');

    await expect(page.locator('#mediterraneanOnly')).toBeChecked();
    await openAdvancedFilters(page);
    await expect(page.locator('#seniorCategory')).toBeChecked();
  });

  test('"Clear all" removes filter params from the URL', async ({ page }) => {
    await page.goto('/?med=1');
    await expect(page.locator('#mediterraneanOnly')).toBeChecked();

    await openFilters(page);
    await page.locator('#clearFiltersBtn').click();
    await expect(page).not.toHaveURL(/[?&]med=/);
  });
});
