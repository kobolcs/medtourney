// Renders scripts/og-image.html to public/og-image.png (1200x630, the size
// Facebook/LinkedIn/X/WhatsApp link previews use). Run: node scripts/render-og-image.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`file://${path.join(here, 'og-image.html')}`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(here, '..', 'public', 'og-image.png') });
await browser.close();
console.log('Wrote public/og-image.png');
