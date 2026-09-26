import { test, expect } from '@playwright/test';
import { stubTournaments, isoInDays, openAdvancedFilters, closeFilters } from './_fixtures';

// Weekly club leagues / season-long events (over 3 weeks) aren't tournaments
// to travel to: hidden by default, one tick in "More filters" to show them.
test('season-long events are hidden until "Weekly / season-long events" is ticked', async ({ page }) => {
  await stubTournaments(page, [
    { name: 'Weekend Open', location: 'Praha, CZE', date: isoInDays(7), dateTo: isoInDays(9),
      category: 'Classical', url: 'https://chess-results.com/tnr81.aspx?lan=1', description: '' },
    { name: 'Club League 2026/27', location: 'Praha, CZE', date: isoInDays(7), dateTo: isoInDays(66),
      category: 'Classical', url: 'https://chess-results.com/tnr82.aspx?lan=1', description: '' },
  ]);
  await page.goto('/');
  await expect(page.locator('.tournament-card')).toHaveCount(1);
  await expect(page.locator('.tournament-card', { hasText: 'Club League' })).toHaveCount(0);

  await openAdvancedFilters(page);
  await page.getByLabel('Weekly / season-long events').check();
  await closeFilters(page);
  await expect(page.locator('.tournament-card')).toHaveCount(2);
  await expect(page).toHaveURL(/[?&]long=1(&|$)/);
});
