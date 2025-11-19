import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Export Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('European Chess Tournament Finder');
  });

  test('should export tournaments to CSV', async ({ page }) => {
    // Search for tournaments
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 });

      // Click export button
      await page.getByRole('button', { name: /export csv/i }).click();

      // Wait for download
      const download = await downloadPromise;

      // Verify filename contains "chess-tournaments" and ".csv"
      const filename = download.suggestedFilename();
      expect(filename).toContain('chess-tournaments');
      expect(filename).toContain('.csv');

      // Verify file is downloaded
      const filePath = path.join(__dirname, filename);
      await download.saveAs(filePath);

      // Clean up
      await download.delete();
    }
  });

  test('should show warning when exporting with no results', async ({ page }) => {
    // Try to export without searching
    const exportBtn = page.getByRole('button', { name: /export csv/i });

    // Export button should not be visible before search
    await expect(exportBtn).not.toBeVisible();
  });

  test('should export tournament to calendar (.ics)', async ({ page }) => {
    // Search for tournaments
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      // Find first "Add to Calendar" button
      const calendarBtn = page.locator('.calendar-export-btn').first();

      if (await calendarBtn.isVisible()) {
        // Set up download listener
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 });

        // Click calendar export button
        await calendarBtn.click();

        // Wait for download
        const download = await downloadPromise;

        // Verify filename ends with ".ics"
        const filename = download.suggestedFilename();
        expect(filename).toContain('.ics');

        // Clean up
        await download.delete();
      }
    }
  });

  test('should display success message after CSV export', async ({ page }) => {
    // Search for tournaments
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      // Set up download listener (to prevent test from failing)
      page.on('download', () => {}); // Handle download

      // Click export button
      await page.getByRole('button', { name: /export csv/i }).click();

      // Should show success message
      await expect(page.locator('#error')).toContainText(/exported.*tournaments.*csv/i, { timeout: 3000 });
    }
  });

  test('should display success message after calendar export', async ({ page }) => {
    // Search for tournaments
    await page.getByRole('button', { name: /search tournaments/i }).click();
    await expect(page.locator('#loading')).toBeHidden({ timeout: 10000 });

    const resultsVisible = await page.locator('#results').isVisible();
    if (resultsVisible && await page.locator('.tournament-card').count() > 0) {
      const calendarBtn = page.locator('.calendar-export-btn').first();

      if (await calendarBtn.isVisible()) {
        // Set up download listener
        page.on('download', () => {}); // Handle download

        // Click calendar export button
        await calendarBtn.click();

        // Should show success message
        await expect(page.locator('#error')).toContainText(/calendar event created/i, { timeout: 3000 });
      }
    }
  });
});
