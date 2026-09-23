import { test, expect } from '@playwright/test';
import { stubTournaments, stubMapTiles, defaultFixtures, isoInDays } from './_fixtures';

// Default fixtures: 12 tournaments in Barcelona (seaside) + 12 in Vienna,
// each with coordinates - so two map markers with a count of 12.
test.describe('Map view', () => {
  test.beforeEach(async ({ page }) => {
    await stubMapTiles(page);
  });

  async function openMap(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/');
    await expect(page.locator('.tournament-card').first()).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(page.locator('#mapView')).toBeVisible();
  }

  test('the Map toggle shows markers for the current results and hides the list', async ({ page }) => {
    await stubTournaments(page);
    await openMap(page);

    await expect(page.locator('.map-pin')).toHaveCount(2);
    await expect(page.locator('.map-pin--sea')).toHaveCount(1); // Barcelona
    await expect(page.locator('.map-pin').first()).toContainText('12');
    await expect(page.locator('#tournamentList')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Map', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');
    await expect(page.locator('#mapNote')).toBeHidden();
  });

  test('markers follow live filtering', async ({ page }) => {
    await stubTournaments(page);
    await openMap(page);
    await expect(page.locator('.map-pin')).toHaveCount(2);

    await page.locator('.mode-switch-btn[data-mode="seaside"]').click();
    await expect(page.locator('.map-pin')).toHaveCount(1);
    await expect(page.locator('.map-pin--sea')).toHaveCount(1);
  });

  test('"Show in list" from a popup goes to that tournament in the list', async ({ page, isMobile }) => {
    await stubTournaments(page);
    await openMap(page);

    // Bring the map to the middle of the screen first (on phones it sits
    // below the filters, and the fixed "Show N tournaments" bar covers the
    // bottom edge), as a person would before tapping a pin.
    await page.locator('#mapCanvas').evaluate(el => el.scrollIntoView({ block: 'center' }));
    // Press at the element's measured centre: phones tap (Leaflet handles
    // touch separately from mouse clicks). Not locator.tap()/click(): their
    // own scroll-into-view retries resize the mobile visual viewport, Leaflet
    // re-measures, and the pin never counts as "stable".
    const press = async (l: import('@playwright/test').Locator): Promise<void> => {
      await expect(l).toBeInViewport();
      // Wait until it stops moving (a popup opening auto-pans the map)
      let box = (await l.boundingBox())!;
      await expect.poll(async () => {
        const next = (await l.boundingBox())!;
        const settled = next.x === box.x && next.y === box.y;
        box = next;
        return settled;
      }, { intervals: [100] }).toBe(true);
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
      if (isMobile) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
    };
    await press(page.locator('.map-pin--sea'));
    const popup = page.locator('.leaflet-popup');
    await expect(popup).toContainText('Barcelona');
    const firstName = await popup.locator('li a').first().textContent();
    await press(popup.getByRole('button', { name: 'Show in list' }).first());

    await expect(page.locator('#tournamentList')).toBeVisible();
    await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.tournament-card.highlighted')).toContainText(firstName!.trim());
  });

  test('tournaments without coordinates are reported, not dropped silently', async ({ page }) => {
    const fixtures = defaultFixtures().slice(0, 3);
    fixtures.push({
      name: 'Pfarrheim Open', location: 'Pfarrheim, AUT', date: isoInDays(10),
      category: 'Open, Classical', url: 'https://chess-results.com/tnr999.aspx?lan=1', description: '',
    });
    await stubTournaments(page, fixtures);
    await openMap(page);

    await expect(page.locator('#mapNote')).toBeVisible();
    await expect(page.locator('#mapNote')).toContainText('1 of 4 tournaments');
  });

  test('switching back to List restores the cards', async ({ page }) => {
    await stubTournaments(page);
    await openMap(page);
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.locator('#mapView')).toBeHidden();
    await expect(page.locator('.tournament-card').first()).toBeVisible();
  });
});
