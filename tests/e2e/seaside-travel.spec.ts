import { test, expect } from '@playwright/test';
import { stubTournaments, isoInDays, TournamentFixture } from './_fixtures';

test.describe('Seaside rule and beachfront', () => {
  // Matosinhos (Porto's beach town) isn't in config.json's town list: it only
  // counts as seaside through the geocoder's coast flag. The Benidorm hotel
  // is a venue 120 m from the sea (seaM) - the featured "beachfront" case.
  const fixtures: TournamentFixture[] = [
    { name: 'Matosinhos Open', location: 'Matosinhos, POR', lat: 41.18, lng: -8.69, coast: 'atlantic' },
    { name: 'Benidorm Beach Open', location: 'Gran Hotel Bali (Benidorm), ESP', lat: 38.5315, lng: -0.1635, coast: 'med', seaM: 120,
      airport: { iata: 'ALC', name: 'Alicante-Elche Miguel Hernández Airport', km: 47 } },
    { name: 'Madrid Open', location: 'Madrid, ESP', lat: 40.42, lng: -3.70 },
  ].map((t, i) => ({
    ...t, date: isoInDays(7 * (i + 1)), category: 'Open, Classical',
    url: `https://chess-results.com/tnr8${i}.aspx?lan=1`, description: '',
  }));

  test.beforeEach(async ({ page }) => {
    await stubTournaments(page, fixtures);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('Seaside mode includes coast-flagged places not in the town list', async ({ page }) => {
    await page.locator('.mode-switch-btn[data-mode="seaside"]').click();
    await expect(page.locator('.tournament-card')).toHaveCount(2);
    await expect(page.locator('.tournament-card', { hasText: 'Madrid Open' })).toHaveCount(0);

    // Atlantic coast: Seaside, but not tagged Mediterranean
    const matosinhos = page.locator('.tournament-card', { hasText: 'Matosinhos Open' });
    await expect(matosinhos.locator('.travel-tag', { hasText: 'Seaside' })).toBeVisible();
    await expect(matosinhos.locator('.travel-tag', { hasText: 'Mediterranean' })).toHaveCount(0);
  });

  test('a venue within 500 m of the sea is featured as beachfront', async ({ page }) => {
    const benidorm = page.locator('.tournament-card', { hasText: 'Benidorm Beach Open' });
    await expect(benidorm).toHaveClass(/tournament-card--beachfront/);
    await expect(benidorm.locator('.beachfront-pill')).toContainText('Beachfront · 120 m from the sea');

    const others = page.locator('.tournament-card.tournament-card--beachfront');
    await expect(others).toHaveCount(1);
  });
});

test.describe('Travel context', () => {
  test('a card shows the nearest airport, spelled out in its tooltip', async ({ page }) => {
    await stubTournaments(page, [
      { name: 'Benidorm Open', location: 'Benidorm, ESP', lat: 38.54, lng: -0.13, date: isoInDays(7),
        category: 'Open, Classical', url: 'https://chess-results.com/tnr71.aspx?lan=1', description: '',
        airport: { iata: 'ALC', name: 'Alicante-Elche Miguel Hernández Airport', km: 47 } },
      { name: 'Somewhere Open', location: 'Somewhere, UKR', date: isoInDays(8),
        category: 'Open, Classical', url: 'https://chess-results.com/tnr72.aspx?lan=1', description: '' },
    ]);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    const hint = page.locator('.tournament-card', { hasText: 'Benidorm Open' }).locator('.airport-hint');
    await expect(hint).toContainText('✈ ALC · 47 km');
    await expect(hint).toHaveAttribute('title', /Alicante-Elche Miguel Hernández Airport \(ALC\), about 47 km in a straight line/);

    // No airport data -> no hint (e.g. Ukraine: no civilian flights)
    await expect(page.locator('.tournament-card', { hasText: 'Somewhere Open' }).locator('.airport-hint')).toHaveCount(0);
  });
});

test.describe('Empty state and the results search box', () => {
  test('when the search text empties the list, clearing it is the first fix - with a real count', async ({ page }) => {
    await stubTournaments(page);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    await page.fill('#quickSearch', 'zzzz');
    const emptyState = page.locator('.empty-state');
    await expect(emptyState).toBeVisible();

    const buttons = page.locator('.empty-state-relaxation-btn');
    await expect(buttons.first()).toContainText('Clear search "zzzz" (24)');
    // No other suggestion may promise results the search box would still hide
    await expect(buttons).toHaveCount(1);

    await buttons.first().click();
    await expect(page.locator('#quickSearch')).toHaveValue('');
    await expect(page.locator('.tournament-card').first()).toBeVisible();
    await expect(emptyState).toBeHidden();
  });
});

test.describe('Town instead of street', () => {
  test('a card shows the geocoded town, keeping the original location in the tooltip', async ({ page }) => {
    await stubTournaments(page, [
      { name: 'Athens Open', location: 'Fragkopoulou 29, GRE', lat: 37.98, lng: 23.73, town: 'Athens',
        date: isoInDays(7), category: 'Open, Classical', url: 'https://chess-results.com/tnr61.aspx?lan=1', description: '' },
      { name: 'Hall Open', location: 'Sports Hall, Main Street 5, ESP',
        date: isoInDays(8), category: 'Open, Classical', url: 'https://chess-results.com/tnr62.aspx?lan=1', description: '' },
    ]);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    const athens = page.locator('.tournament-card', { hasText: 'Athens Open' }).locator('.tournament-place');
    await expect(athens).toContainText('Athens · Greece');
    await expect(athens).not.toContainText('Fragkopoulou');
    await expect(athens).toHaveAttribute('title', 'Fragkopoulou 29');

    // No town yet: the location text, and a country from the LAST part even with two commas
    const hall = page.locator('.tournament-card', { hasText: 'Hall Open' }).locator('.tournament-place');
    await expect(hall).toContainText('Sports Hall, Main Street 5 · Spain');
  });
});
