import { test, expect, Page } from '@playwright/test';
import { stubTournaments, isoInDays, TournamentFixture } from './_fixtures';

// Clicking a tournament opens its details on MedTourney (first user reviews:
// "try not to redirect out of your site"); chess-results.com is one link.
const fixtures: TournamentFixture[] = [
  { name: 'Nice Open', location: 'Palais des Congrès, FRA', town: 'Nice', lat: 43.7, lng: 7.26, coast: 'med',
    airport: { iata: 'NCE', name: "Nice-Côte d'Azur Airport", km: 6, city: 'Nice' } },
  { name: 'Vienna Open', location: 'Vienna, AUT', lat: 48.2, lng: 16.37 },
].map((t, i) => ({
  ...t, date: isoInDays(7 * (i + 1)), category: 'Open, Classical',
  url: `https://chess-results.com/tnr3${i}.aspx?lan=1`, description: '',
}));

const panel = (page: Page) => page.locator('#tournamentDetail');
const card = (page: Page, name: string) => page.locator('.tournament-card', { hasText: name });

async function load(page: Page, query = ''): Promise<void> {
  await stubTournaments(page, fixtures);
  await page.goto('/' + query);
  await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
}

test.describe('Tournament detail panel', () => {
  test('clicking a card opens its details here - no new tab', async ({ page, context }) => {
    await load(page);
    let newTabs = 0;
    context.on('page', () => newTabs++);
    await card(page, 'Nice Open').locator('.tournament-location').click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).locator('#detailTitle')).toHaveText('Nice Open');
    await expect(panel(page)).toContainText("Nice-Côte d'Azur Airport (NCE)");
    await expect(panel(page)).toContainText('Mediterranean coast');
    await expect(panel(page).locator('.detail-cr-link')).toHaveAttribute('href', fixtures[0].url);
    expect(newTabs).toBe(0);
  });

  test('a plain click on the name opens the panel; the name still links to chess-results', async ({ page }) => {
    await load(page);
    const link = card(page, 'Vienna Open').locator('.tournament-link');
    await expect(link).toHaveAttribute('href', fixtures[1].url);
    await link.click();
    await expect(panel(page).locator('#detailTitle')).toHaveText('Vienna Open');
  });

  test('closes with ✕, Escape and the back button - and stays on the site', async ({ page }) => {
    await load(page);
    const opener = card(page, 'Nice Open').locator('.tournament-location');
    await opener.click();
    await panel(page).locator('.detail-close').click();
    await expect(panel(page)).toBeHidden();

    await opener.click();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();

    await opener.click();
    await expect(panel(page)).toBeVisible();
    await page.goBack();
    await expect(panel(page)).toBeHidden();
    await expect(page.locator('.tournament-card').first()).toBeVisible();
  });

  test('the calendar menu works inside the panel', async ({ page }) => {
    await load(page);
    await card(page, 'Nice Open').locator('.tournament-location').click();
    await panel(page).locator('.calendar-export-btn').click();
    const google = panel(page).locator('.calendar-menu-item[data-action="google"]');
    await expect(google).toBeVisible();
    await expect(google).toHaveAttribute('href', /^https:\/\/calendar\.google\.com\/calendar\/render\?/);
  });

  test('the ★ in the panel shortlists the tournament (card star follows)', async ({ page }) => {
    await load(page);
    await card(page, 'Nice Open').locator('.tournament-location').click();
    await panel(page).locator('.shortlist-btn').click();
    await expect(panel(page).locator('.shortlist-btn')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(card(page, 'Nice Open').locator('.shortlist-btn')).toHaveAttribute('aria-pressed', 'true');
  });

  test('page shortcuts are off while it is open', async ({ page }) => {
    await load(page);
    await card(page, 'Nice Open').locator('.tournament-location').click();
    const dark = await page.evaluate(() => document.body.classList.contains('dark-theme'));
    await page.keyboard.press('d');
    expect(await page.evaluate(() => document.body.classList.contains('dark-theme'))).toBe(dark);
  });

  test('a shared ?t= link opens that tournament\'s details', async ({ page }) => {
    await load(page, `?t=${encodeURIComponent(fixtures[1].url)}`);
    await expect(panel(page).locator('#detailTitle')).toHaveText('Vienna Open');
  });

  test('older browsers without <dialog> showModal get an overlay', async ({ page }) => {
    await page.addInitScript(() => {
      // Safari < 15.4 (e.g. iPads stuck on iOS 12)
      delete (HTMLDialogElement.prototype as { showModal?: unknown }).showModal;
    });
    await load(page);
    await card(page, 'Nice Open').locator('.tournament-location').click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toHaveClass(/detail-panel--fallback-open/);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
  });
});
