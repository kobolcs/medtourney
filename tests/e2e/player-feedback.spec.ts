import { test, expect } from '@playwright/test';
import { stubTournaments, openFilters, closeFilters, isoInDays } from './_fixtures';

test('eligibility exclusions survive reload and clear all restores them', async ({ page }) => {
    await stubTournaments(page);
    await page.goto('/');
    await openFilters(page);
    await expect(page.locator('#excludeWomen')).toBeVisible();
    await page.locator('#excludeWomen').check();
    await page.locator('#excludeSeniors').check();
    await expect(page).toHaveURL(/excludeWomen=1/);
    await page.reload();
    await openFilters(page);
    await expect(page.locator('#excludeWomen')).toBeChecked();
    await expect(page.locator('#excludeSeniors')).toBeChecked();
    await page.locator('#womenOnly').check();
    await expect(page.locator('#excludeWomen')).not.toBeChecked();
    await page.locator('#clearFiltersBtn').click();
    await expect(page.locator('#excludeSeniors')).not.toBeChecked();
});

test('annual planning includes events past six months and cards link directly to the source', async ({ page }) => {
    await stubTournaments(page, [{ name: 'Next season open', category: 'Open, Classical',
        location: 'Vienna, AUT', date: isoInDays(300), description: '', timeControl: '90+30',
        url: 'https://chess-results.com/tnr123.aspx' }]);
    await page.goto('/');
    await expect(page.locator('#resultsCount')).toHaveText('0 tournaments found');
    await openFilters(page);
    await page.locator('[data-preset="year"]').click();
    await closeFilters(page);
    const card = page.locator('.tournament-card');
    await expect(card).toContainText('Next season open');
    await expect(card).toContainText('FIDE rating unconfirmed');
    await expect(card.locator('.chess-results-link')).toHaveAttribute('href', 'https://chess-results.com/tnr123.aspx');
});
