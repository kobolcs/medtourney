import { test, expect } from '@playwright/test';
import { stubTournaments, isoInDays, TournamentFixture } from './_fixtures';

// Fixes from the first user reviews: calendar choice without Outlook, the
// "no airport" hint, the searchable name, and a way to give feedback.
test.describe('First-review fixes', () => {
  const fixtures: TournamentFixture[] = [
    { name: 'Nice Open', location: 'Nice, FRA', lat: 43.7, lng: 7.26,
      airport: { iata: 'NCE', name: "Nice-Côte d'Azur Airport", km: 6, city: 'Nice' } },
    { name: 'Remote Open', location: 'Somewhere, ROU', lat: 45.1, lng: 25.3 },
    { name: 'Unplaced Open', location: 'Unknown venue, ESP' },
  ].map((t, i) => ({
    ...t, date: isoInDays(7 * (i + 1)), category: 'Open, Classical',
    url: `https://chess-results.com/tnr4${i}.aspx?lan=1`, description: '',
  }));

  test.beforeEach(async ({ page }) => {
    await stubTournaments(page, fixtures);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('the calendar button offers Google Calendar and a .ics download', async ({ page }) => {
    const card = page.locator('.tournament-card', { hasText: 'Nice Open' });
    await card.hover();
    const button = card.locator('.calendar-export-btn');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    const google = page.locator('.calendar-menu-item[data-action="google"]');
    await expect(google).toHaveAttribute('href', /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&text=Nice\+Open&dates=\d{8}%2F\d{8}/);
    await expect(google).toHaveAttribute('target', '_blank');
    await expect(page.locator('.calendar-menu-item[data-action="ics"]')).toContainText('Download .ics');
    await page.keyboard.press('Escape');
    await expect(page.locator('.calendar-menu')).toHaveCount(0);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  test('airport line: city + code, "none within 150 km", or nothing if not placed', async ({ page }) => {
    const hint = (name: string) => page.locator('.tournament-card', { hasText: name }).locator('.airport-hint');
    await expect(hint('Nice Open')).toContainText('✈ Nice NCE · 6 km');
    await expect(hint('Remote Open')).toContainText('✈ none within 150 km');
    await expect(hint('Unplaced Open')).toHaveCount(0);
  });

  test('the name says "Chess Tournament Finder"', async ({ page }) => {
    await expect(page).toHaveTitle(/^MedTourney · Chess Tournament Finder/);
    await expect(page.locator('.tagline')).toContainText('Chess Tournament Finder');
  });

  test('footer Feedback link builds the mailto only when clicked', async ({ page }) => {
    const link = page.locator('#feedbackLink');
    await expect(link).toBeVisible();
    expect(await page.content()).not.toContain('medtourney@protonmail.com');
    // Don't let the test browser try to open a mail client
    await page.evaluate(() => document.getElementById('feedbackLink')!.addEventListener('click', e => e.preventDefault()));
    await link.click();
    await expect(link).toHaveAttribute('href', 'mailto:medtourney@protonmail.com?subject=MedTourney%20feedback');
  });
});
