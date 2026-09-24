import { test, expect } from '@playwright/test';
import { stubTournaments, openAdvancedFilters } from './_fixtures';

/**
 * Site-level checks ported from the old Robot Framework UI suite
 * (tests/e2e/test_phase2_ui.robot, removed): SEO metadata, static files,
 * filter persistence, mobile touch targets, card actions. The rest of that
 * suite (dark mode, empty state + reset, sticky mobile button) is already
 * covered by the other Playwright specs.
 */

test.describe('SEO metadata', () => {
  test.beforeEach(async ({ page }) => {
    await stubTournaments(page);
    await page.goto('/');
  });

  test('title, description, Open Graph and canonical are set', async ({ page }) => {
    await expect(page).toHaveTitle(/MedTourney/);
    await expect(page).toHaveTitle(/Mediterranean/);

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toMatch(/Mediterranean/);
    expect(description).toMatch(/senior/i);

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toContain('MedTourney');

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toContain('github.io/medtourney');
  });

  test('Schema.org JSON-LD describes the web app', async ({ page }) => {
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(jsonLd ?? '{}') as Record<string, unknown>;
    expect(data['@type']).toBe('WebApplication');
    expect(data['name']).toContain('MedTourney');
    expect(data['featureList']).toBeTruthy();
  });

  // Link previews (Facebook, WhatsApp, Slack, X) - public/og-image.png,
  // rendered from scripts/og-image.html. It was missing (404) until 3.1.0.
  test('the og:image file is served at its declared size', async ({ page, request }) => {
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    const file = new URL(ogImage ?? '').pathname.split('/').pop() ?? '';
    const res = await request.get(`/${file}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');

    // PNG header: width and height are big-endian at bytes 16-23
    const png = await res.body();
    expect(png.readUInt32BE(16)).toBe(Number(await page.locator('meta[property="og:image:width"]').getAttribute('content')));
    expect(png.readUInt32BE(20)).toBe(Number(await page.locator('meta[property="og:image:height"]').getAttribute('content')));
  });
});

test.describe('Static files', () => {
  for (const file of ['sitemap.xml', 'robots.txt']) {
    test(`${file} is served`, async ({ request }) => {
      const res = await request.get(`/${file}`);
      expect(res.status()).toBe(200);
      expect((await res.text()).length).toBeGreaterThan(0);
    });
  }
});

test.describe('Filter persistence', () => {
  test('filter changes are saved to localStorage', async ({ page }) => {
    await stubTournaments(page);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });

    await page.locator('.mode-switch-btn[data-mode="seaside"]').click();
    await openAdvancedFilters(page);
    await page.locator('#countryList input[value="ESP"]').check();

    const stored = await page.evaluate(() => localStorage.getItem('medtourney_filter_preferences'));
    expect(stored).toBeTruthy();
    // Stored as-is (a preference never expires - unlike cached data)
    const prefs = JSON.parse(stored!) as Record<string, unknown>;
    expect(prefs['mediterraneanOnly']).toBe(true);
    expect(prefs['countryFilter']).toEqual(['ESP']);
  });
});

test.describe('Mobile touch targets', () => {
  test('checkboxes and the bottom button are large enough to tap', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile layout only');
    await stubTournaments(page);
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
    await openAdvancedFilters(page);

    // The tappable area of a checkbox is its whole label row (the bare
    // input is ~17px; WCAG 2.5.8's 24px minimum applies to the target).
    const row = await page.locator('label:has(#openOnly)').boundingBox();
    expect(row!.height).toBeGreaterThanOrEqual(24);
    expect(row!.width).toBeGreaterThanOrEqual(24);

    const btn = await page.locator('#showResultsBtn').boundingBox();
    expect(btn!.height).toBeGreaterThanOrEqual(48);

    for (const mode of await page.locator('.mode-switch-btn').all()) {
      expect((await mode.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    }
  });
});

test.describe('Tournament card actions', () => {
  test('every card has Add to Calendar and Copy link', async ({ page }) => {
    await stubTournaments(page);
    await page.goto('/');
    const cards = page.locator('.tournament-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const count = await cards.count();
    await expect(page.locator('.tournament-card .tournament-actions')).toHaveCount(count);
    await expect(page.locator('.tournament-card .calendar-export-btn')).toHaveCount(count);
    await expect(page.locator('.tournament-card .copy-link-btn')).toHaveCount(count);
  });
});
