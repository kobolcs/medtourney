import { test, expect } from '@playwright/test';
import { stubTournaments, openFilters } from './_fixtures';

/**
 * Results-first layout: auto-search on load, a primary filter bar with
 * advanced controls tucked behind a "More filters" drawer, and a redesigned
 * tournament card (date badge + name link).
 */
test.describe('Results-First Layout', () => {
  test.beforeEach(async ({ page }) => {
    await stubTournaments(page);
  });

  test('auto-searches on page load without clicking Search', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#resultsCount')).toBeVisible();
  });

  test('the advanced drawer starts collapsed while primary controls stay visible', async ({ page }) => {
    await page.goto('/');

    const details = page.locator('#advancedFilters');
    await expect(details).toHaveJSProperty('open', false);
    await openFilters(page); // phones: the filters live in a bottom sheet

    // Primary controls are usable without opening the drawer.
    await expect(page.locator('#startDate')).toBeVisible();
    await expect(page.locator('#endDate')).toBeVisible();
    await expect(page.getByLabel('Classical / Standard')).toBeVisible();
    await expect(page.locator('.mode-switch-btn[data-mode="seaside"]')).toBeVisible();
    // The old "Mediterranean Seaside Only" checkbox is gone from view - the
    // mode switch is its only visible control.
    await expect(page.locator('#mediterraneanOnly')).toBeHidden();

    // Advanced-only controls are not visible until the drawer opens.
    await expect(page.getByLabel('Open to all', { exact: true })).toBeHidden();
    await expect(page.locator('#minDays')).toBeHidden();
  });

  test('clicking "More filters" opens the drawer and reveals advanced controls', async ({ page }) => {
    await page.goto('/');
    await openFilters(page);

    await page.locator('.advanced-summary').click();

    await expect(page.locator('#advancedFilters')).toHaveJSProperty('open', true);
    await expect(page.getByLabel('Open to all', { exact: true })).toBeVisible();
    await expect(page.locator('#minDays')).toBeVisible();
  });

  test('the filter count badge reflects active advanced filters', async ({ page }) => {
    await page.goto('/');

    const badge = page.locator('#advancedFilterCount');
    await expect(badge).toBeHidden();
    await openFilters(page);

    await page.locator('.advanced-summary').click();
    // openOnly ships checked, so unchecking it counts as one active filter...
    await page.getByLabel('Open to all', { exact: true }).uncheck();
    // ...and checking S50+ counts as a second.
    await page.getByLabel(/S50\+.*Senior/i).check();

    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('2');
  });

  test('a saved advanced filter preference auto-opens the drawer on reload', async ({ page }) => {
    await page.goto('/');
    await openFilters(page);

    await page.locator('.advanced-summary').click();
    await page.getByLabel('Open to all', { exact: true }).uncheck();
    // Filter preferences save on change — give the write a moment to land.
    await page.waitForTimeout(300);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // The restored preference narrows results, so init must auto-open the
    // drawer rather than leaving it invisibly active behind a closed summary.
    await expect(page.locator('#advancedFilters')).toHaveJSProperty('open', true);
    await expect(page.locator('#advancedFilterCount')).toHaveText('1');
  });

  test('the first tournament card sits above the fold on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');

    const firstCard = page.locator('.tournament-card').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    const box = await firstCard.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThan(1000);
  });

  test('a tournament card carries a date badge and a name link to chess-results.com', async ({ page }) => {
    await page.goto('/');

    const firstCard = page.locator('.tournament-card').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    await expect(firstCard.locator('.tournament-date-badge')).toBeVisible();

    const nameLink = firstCard.locator('.tournament-name .tournament-link');
    await expect(nameLink).toBeVisible();
    await expect(nameLink).toHaveAttribute('href', /^https:\/\/chess-results\.com\//);
  });
});
