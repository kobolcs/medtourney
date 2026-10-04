import { test, expect } from '@playwright/test';
import { stubTournaments, isoInDays, openAdvancedFilters, closeFilters } from './_fixtures';

for (const width of [1440, 390]) {
  test(`age and rating controls with default exclusion at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await stubTournaments(page, [
      { name: 'OPEN C Under 1600', category: 'Open, Classical, Youth' },
      { name: 'Twickenham ChampionshipUnder 12', category: 'Classical, Youth' },
      { name: 'Rotterdam Minor Under 1650', category: 'Open, Classical, Youth' },
      { name: 'Junior U1800 / U18', category: 'Classical, Youth' },
    ].map((item, index) => ({ ...item, timeControl: '90+30', date: isoInDays(14), location: 'London, ENG',
      url: `https://chess-results.com/tnr${100 + index}.aspx`, description: '' })));
    await page.goto('/');
    await expect(page.locator('.tournament-card')).toHaveCount(2);
    await openAdvancedFilters(page);
    await expect(page.locator('#excludeYouth')).toBeChecked();
    const age = page.locator('#youthCategory');
    await expect(age).toBeEnabled();
    await age.selectOption('U12');
    await expect(page).toHaveURL(/[?&]youthAge=U12/);
    await closeFilters(page);
    await expect(page.locator('.tournament-card')).toHaveCount(1);
    await expect(page.locator('.tournament-card')).toContainText('ChampionshipUnder 12');
    await page.reload();
    await expect(page.locator('.tournament-card')).toHaveCount(1);
    await openAdvancedFilters(page);
    await expect(age).toHaveValue('U12');
    await expect(age).toBeEnabled();
    await age.selectOption('');
    await page.locator('#ratingCategory').selectOption('U1650');
    await closeFilters(page);
    await expect(page.locator('.tournament-card')).toHaveCount(1);
    await expect(page.locator('.tournament-card')).toContainText('Rotterdam Minor Under 1650');
    await expect(page).toHaveURL(/[?&]rating=U1650/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await testInfo.attach(`rating-${width}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    await openAdvancedFilters(page);
    await testInfo.attach(`filters-${width}.png`, { body: await page.screenshot(), contentType: 'image/png' });
  });
}
