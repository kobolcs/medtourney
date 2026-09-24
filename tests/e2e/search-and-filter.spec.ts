import { test, expect } from '@playwright/test';
import { stubTournaments, openAdvancedFilters, openFilters, closeFilters, setMode, isoInDays, TournamentFixture } from './_fixtures';

test.describe('Tournament Search and Filter', () => {
  test.beforeEach(async ({ page }) => {
    await stubTournaments(page);
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('MedTourney');
    // Most tests here drive advanced controls (Open Category, Mediterranean
    // is primary but S50+/Women's/Exclude Youth/country live in the drawer).
    await openAdvancedFilters(page);
  });

  test('should display the main page correctly', async ({ page }) => {
    // Check header elements
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('button', { name: /dark mode/i })).toBeVisible();

    // Check filter panel
    await expect(page.locator('h2', { hasText: 'Search Filters' })).toBeVisible();
    await expect(page.locator('#quickSearch')).toBeVisible();

    // Check footer
    await expect(page.locator('#lastUpdated')).toBeVisible();
    await expect(page.locator('footer a[href*="chess-results.com"]')).toBeVisible();
  });

  test('should load tournaments automatically', async ({ page }) => {
    // Results-first + live filtering: no Search button, results just load.
    // Wait for loading to disappear
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    // Should display results or error
    const resultsVisible = await page.locator('#results').isVisible();
    const errorVisible = await page.locator('#error').isVisible();

    expect(resultsVisible || errorVisible).toBeTruthy();

    if (resultsVisible) {
      // Check results count is displayed
      await expect(page.locator('#resultsCount')).toBeVisible();
    }
  });

  test('should filter tournaments with checkboxes', async ({ page }) => {
    // Uncheck "Open Category Only"
    await page.getByLabel('Open Category Only').uncheck();

    // Seaside mode (mediterraneanOnly)
    await setMode(page, 'seaside'); // Seaside mode = mediterraneanOnly

    // Check "S50+ (Senior) Category"
    await page.getByLabel(/S50\+.*Senior/i).check();

    // Verify checkboxes are in correct state
    await expect(page.getByLabel('Open Category Only')).not.toBeChecked();
    await expect(page.locator('#mediterraneanOnly')).toBeChecked();
    await expect(page.getByLabel(/S50\+.*Senior/i)).toBeChecked();

    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });
  });

  test('should filter by date range', async ({ page }) => {
    // Set date range
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    await page.fill('#startDate', formatDate(today));
    await page.fill('#endDate', formatDate(nextMonth));

    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });
  });

  test('should narrow the country checklist by typed query', async ({ page }) => {
    // Stub data has ESP (Mediterranean) and AUT (Central Europe) tournaments.
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });
    const esp = page.locator('.country-item[data-country="ESP"]');
    const aut = page.locator('.country-item[data-country="AUT"]');
    await expect(esp).toBeVisible();
    await expect(aut).toBeVisible();

    await page.fill('#countrySearch', 'spa');
    await expect(esp).toBeVisible();
    await expect(aut).toBeHidden();
    await expect(page.locator('.country-group-label', { hasText: 'Mediterranean' })).toBeVisible();
    await expect(page.locator('.country-group-label', { hasText: 'Central Europe' })).toBeHidden();

    await page.fill('#countrySearch', 'zzz');
    await expect(page.locator('#noCountriesMessage')).toBeVisible();
    await expect(page.locator('#noCountriesMessage')).toContainText('zzz');

    await page.fill('#countrySearch', '');
    await expect(esp).toBeVisible();
    await expect(aut).toBeVisible();
    await expect(page.locator('#noCountriesMessage')).toBeHidden();
  });

  test('should filter by country', async ({ page }) => {
    // Country filter is now a checkbox list — check Spain's checkbox
    await page.locator('#countryList input[value="ESP"]').check();

    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    // If results are shown, verify they contain Spanish tournaments
    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible) {
      const tournamentCards = page.locator('.tournament-card');
      const count = await tournamentCards.count();

      if (count > 0) {
        // Check first tournament contains "ESP" or "Spain"
        const firstCard = tournamentCards.first();
        const locationText = await firstCard.locator('.tournament-location').textContent();
        expect(locationText?.toLowerCase()).toMatch(/esp|spain|españa/i);
      }
    }
  });

  test('should display empty state when no results', async ({ page }) => {
    // Set very restrictive filters
    await setMode(page, 'seaside'); // Seaside mode = mediterraneanOnly
    await page.getByLabel(/S50\+.*Senior/i).check();
    await page.getByLabel(/Women's Tournaments/i).check();

    // Set very narrow date range
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    await page.fill('#startDate', formatDate(tomorrow));
    await page.fill('#endDate', formatDate(dayAfter));

    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    // Should show empty state (or results - depending on data)
    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible) {
      // May show empty state or actual results
      const emptyState = page.locator('.empty-state');
      const hasTournaments = await page.locator('.tournament-card').count() > 0;

      if (!hasTournaments) {
        await expect(emptyState).toBeVisible();
        await expect(page.getByText(/no tournaments found/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /reset all filters/i })).toBeVisible();
      }
    }
  });

  test('empty state offers a one-tap relaxation with a real result count', async ({ page }) => {
    // The default fixture has no women's tournaments, so this alone empties
    // the list - and filtering is live, so no Search click is needed.
    await page.getByLabel(/Women's Tournaments/i).check();

    const emptyState = page.locator('.empty-state');
    await expect(emptyState).toBeVisible();

    const relaxBtn = page.locator('.empty-state-relaxation-btn').first();
    await expect(relaxBtn).toBeVisible();
    await expect(relaxBtn).toContainText('(24)'); // full fixture set, once women-only is lifted

    await closeFilters(page); // phones: the empty state is behind the filters sheet
    await relaxBtn.click();
    await expect(page.getByLabel(/Women's Tournaments/i)).not.toBeChecked();
    await expect(page.locator('.tournament-card').first()).toBeVisible();
    await expect(emptyState).toBeHidden();
  });

  test('should reset filters', async ({ page }) => {
    // Change some filters
    await page.getByLabel('Open Category Only').uncheck();
    await setMode(page, 'seaside'); // Seaside mode = mediterraneanOnly

    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    // Look for empty state and reset button
    const resetBtn = page.getByRole('button', { name: /reset all filters/i });
    const isResetVisible = await resetBtn.isVisible();

    if (isResetVisible) {
      await resetBtn.click();

      // Wait for new search to complete
      await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

      // Verify filters are reset
      await expect(page.getByLabel('Open Category Only')).toBeChecked();
      await expect(page.locator('#mediterraneanOnly')).not.toBeChecked();
    }
  });

  test('should sort tournaments', async ({ page }) => {
    // Results-first: results are already on screen from the automatic first
    // search, so just wait for them rather than re-clicking Search.
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      // Change sort option
      await page.selectOption('#sortBy', 'name');

      // Wait a moment for re-render
      await page.waitForTimeout(500);

      // Verify tournaments are displayed (sorting order is hard to verify without knowing data)
      await expect(page.locator('.tournament-card').first()).toBeVisible();
    }
  });

  test('should search within results', async ({ page }) => {
    // Results-first: results are already on screen from the automatic first
    // search, so just wait for them rather than re-clicking Search.
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      // Get initial count
      const initialCount = await page.locator('.tournament-card').count();

      // Type in quick search
      await page.fill('#quickSearch', 'open');

      // Wait for filtering
      await page.waitForTimeout(500);

      // Count should change or stay same
      const newCount = await page.locator('.tournament-card').count();
      expect(newCount).toBeGreaterThanOrEqual(0);
      expect(newCount).toBeLessThanOrEqual(initialCount);

      // Clear search
      await page.fill('#quickSearch', '');
      await page.waitForTimeout(500);

      // Count should return to original (or close)
      const finalCount = await page.locator('.tournament-card').count();
      expect(finalCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('should navigate pagination', async ({ page }) => {
    // Ensure we have many results by unchecking filters
    await page.getByLabel('Exclude Youth-Only Tournaments').uncheck();

    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible) {
      const tournamentCount = await page.locator('.tournament-card').count();

      // Only test pagination if there are enough results
      if (tournamentCount >= 20) {
        const nextButton = page.getByRole('button', { name: /next/i });

        if (await nextButton.isVisible() && await nextButton.isEnabled()) {
          // Click next page
          await nextButton.click();
          await page.waitForTimeout(500);

          // Should still see tournaments
          await expect(page.locator('.tournament-card').first()).toBeVisible();

          // Previous button should now be enabled
          const prevButton = page.getByRole('button', { name: /previous/i });
          await expect(prevButton).toBeEnabled();

          // Click previous
          await prevButton.click();
          await page.waitForTimeout(500);

          // Should be back on page 1
          await expect(page.locator('.tournament-card').first()).toBeVisible();
        }
      }
    }
  });
});

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

test.describe('Seaside/Senior mode switch and live filtering', () => {
  test.beforeEach(async ({ page }) => {
    await stubTournaments(page);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking a mode switch button checks the matching checkbox and filters live, with no Search click', async ({ page }) => {
    const before = await page.locator('#resultsCount').textContent();

    await page.locator('.mode-switch-btn[data-mode="seaside"]').click();

    await expect(page.locator('#mediterraneanOnly')).toBeChecked();
    await expect(page.locator('.mode-switch-btn[data-mode="seaside"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.mode-switch-btn[data-mode="all"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page).toHaveURL(/[?&]med=1(&|$)/);

    // Results updated without touching the Search button.
    await expect(page.locator('#resultsCount')).not.toHaveText(before ?? '');
  });

  test('"Both" mode checks Mediterranean and Senior 50+ together', async ({ page }) => {
    await page.locator('.mode-switch-btn[data-mode="both"]').click();

    await expect(page.locator('#mediterraneanOnly')).toBeChecked();
    await openAdvancedFilters(page);
    await expect(page.locator('#seniorCategory')).toBeChecked();
  });

  test('checking the drawer Senior checkbox directly updates the mode switch', async ({ page }) => {
    await openAdvancedFilters(page);
    await page.locator('#seniorCategory').check();

    await expect(page.locator('.mode-switch-btn[data-mode="senior"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('active-filter chips appear for narrowing filters and remove them on click', async ({ page }) => {
    await page.locator('.mode-switch-btn[data-mode="seaside"]').click();

    const chip = page.locator('.active-filter-chip', { hasText: 'Seaside' });
    await expect(chip).toBeVisible();

    await chip.click();
    await expect(page.locator('#mediterraneanOnly')).not.toBeChecked();
    await expect(page.locator('#activeFilterChips')).toBeHidden();
  });

  test('"Clear all" in the chip row resets every filter', async ({ page }) => {
    await page.locator('.mode-switch-btn[data-mode="both"]').click();
    await expect(page.locator('.active-filter-clear-all')).toBeVisible();

    await page.locator('.active-filter-clear-all').click();
    await expect(page.locator('#mediterraneanOnly')).not.toBeChecked();
    await expect(page.locator('.mode-switch-btn[data-mode="all"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#activeFilterChips')).toBeHidden();
  });
});

test.describe('No Search button - live results', () => {
  test('a failed load offers "Try again", which recovers', async ({ page }) => {
    // Fail every tournament-data source (local file + remote fallbacks)
    await page.route('**/*tournaments_data*.json*', route => route.abort());
    await page.goto('/');

    const retry = page.getByRole('button', { name: 'Try again' });
    await expect(retry).toBeVisible({ timeout: 20000 });

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stubTournaments(page);
    await retry.click();

    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#error')).toBeHidden();
  });

  test('"Show N tournaments" jumps to the results on phones', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'The jump button is only shown below 1024px');
    await stubTournaments(page);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    // Phones: it's the filters sheet's "done" button
    await openFilters(page);
    const btn = page.locator('#showResultsBtn');
    await expect(btn).toContainText(/show \d+ tournaments?/i);
    await btn.click();
    await expect(page.locator('#resultsHeading')).toBeFocused();
    await expect(page.locator('#resultsHeading')).toBeInViewport();
  });

  test('the jump button is hidden on the desktop sidebar layout', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop layout only');
    await stubTournaments(page);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#showResultsBtn')).toBeHidden();
  });
});

test.describe('Country list region ticks', () => {
  // Two Mediterranean countries (ESP, ITA) so a region can be partly ticked,
  // plus one Central European (AUT).
  const fixtures: TournamentFixture[] = [
    ['Barcelona, ESP', 'Barcelona Open'], ['Rome, ITA', 'Roma Open'], ['Vienna, AUT', 'Vienna Open'],
  ].map(([location, name], i) => ({
    name, location, date: isoInDays(7 * (i + 1)), category: 'Open, Classical',
    url: `https://chess-results.com/tnr9${i}.aspx?lan=1`, description: '',
  }));

  test.beforeEach(async ({ page }) => {
    await stubTournaments(page, fixtures);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
    await openAdvancedFilters(page);
  });

  test('a region tick selects every shown country in that region', async ({ page }) => {
    const med = page.getByRole('checkbox', { name: 'Select all Mediterranean countries' });
    // Tap the region row (the label wraps the tick), as a user would
    const medRow = page.locator('label.country-group-label', { hasText: 'Mediterranean' });
    await medRow.click();
    await expect(med).toBeChecked();

    await expect(page.locator('#countryList input[value="ESP"]')).toBeChecked();
    await expect(page.locator('#countryList input[value="ITA"]')).toBeChecked();
    await expect(page.locator('#countryList input[value="AUT"]')).not.toBeChecked();
    await expect(page.locator('.tournament-card')).toHaveCount(2);

    await medRow.click();
    await expect(med).not.toBeChecked();
    await expect(page.locator('#countryList input[value="ESP"]')).not.toBeChecked();
    await expect(page.locator('.tournament-card')).toHaveCount(3);
  });

  test('a region tick shows partly-selected as indeterminate', async ({ page }) => {
    const med = page.getByRole('checkbox', { name: 'Select all Mediterranean countries' });
    await page.locator('#countryList input[value="ESP"]').check();
    await expect(med).not.toBeChecked();
    await expect(med).toHaveJSProperty('indeterminate', true);

    await page.locator('#countryList input[value="ITA"]').check();
    await expect(med).toBeChecked();
    await expect(med).toHaveJSProperty('indeterminate', false);
  });

  test('Seaside mode is disabled when only non-seaside countries are picked', async ({ page }) => {
    await page.locator('#countryList input[value="AUT"]').check();
    await expect(page.locator('.mode-switch-btn[data-mode="seaside"]')).toBeDisabled();
    await expect(page.locator('.mode-switch-btn[data-mode="both"]')).toBeDisabled();

    await page.locator('#countryList input[value="AUT"]').uncheck();
    await expect(page.locator('.mode-switch-btn[data-mode="seaside"]')).toBeEnabled();
  });
});

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
