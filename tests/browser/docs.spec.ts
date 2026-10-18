import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ledger = JSON.parse(readFileSync('scripts/diagram-migration.json', 'utf8'));
const route = (file: string) => '/' + file.replace(/^content\/docs\//, '').replace(/\.mdx?$/, '') + '/';

test('all 29 routes hydrate with the 109 reviewed D2 diagrams', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let total = 0;
  for (const file of Object.keys(ledger.pages)) {
    const response = await page.goto(route(file));
    expect(response?.status(), file).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    const count = ledger.diagrams.filter((entry: { file: string }) => entry.file === file).length;
    await expect(page.locator('.d2-diagram')).toHaveCount(count);
    total += count;
  }
  expect(total).toBe(109);
  expect(errors).toEqual([]);
});

test('D2 loads automatically, zooms and opens a centered fullscreen dialog', async ({ page }) => {
  await page.goto('/react-internals/vi-sao-component-rerender/');
  const diagram = page.locator('.d2-interactive').first();
  await expect(diagram.locator('.d2-viewer')).toBeVisible();
  const before = await diagram.locator('.d2-zoom-content').getAttribute('style');
  await diagram.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(diagram.locator('.d2-zoom-content')).not.toHaveAttribute('style', before!);
  await diagram.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  const viewport = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: innerHeight }));
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(3);
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(3);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(diagram.getByRole('button', { name: 'Fullscreen', exact: true })).toBeFocused();
});

test('learning components retain their controls and disclosures', async ({ page }) => {
  await page.goto('/patterns/custom-hooks/');
  const walkthrough = page.locator('.code-walkthrough');
  await walkthrough.getByRole('button', { name: 'Bước sau', exact: true }).click();
  await expect(walkthrough.getByLabel('Chọn bước')).toHaveValue('1');
  await page.locator('.protocol-exchange [data-variant="missing"] > summary').click();
  await expect(page.locator('.protocol-exchange [data-variant="missing"]')).toContainText('User not found');
  await page.goto('/toi-uu-rerender/usememo-usecallback/');
  await page.locator('.code-diff').getByRole('button', { name: 'Inline', exact: true }).click();
  await expect(page.locator('.code-diff')).toHaveAttribute('data-view', 'inline');
  await page.goto('/patterns/redux-toolkit/');
  await expect(page.locator('.terminal-session')).toContainText('npm install @reduxjs/toolkit react-redux');
  await page.goto('/toi-uu-rerender/code-splitting/');
  await page.locator('.span-waterfall-table-disclosure > summary').click();
  await expect(page.locator('.span-waterfall table')).toBeVisible();
});

for (const theme of ['light', 'dark']) {
  test(`${theme}: mobile diagrams and learning components do not widen the page`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    for (const url of ['/react-internals/vi-sao-component-rerender/', '/patterns/custom-hooks/', '/toi-uu-rerender/code-splitting/']) {
      await page.goto(url);
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await expect(page.locator(`.d2-diagram-${theme}`).first()).toBeVisible();
    }
  });
}

test('without JavaScript, diagrams and native disclosures remain readable', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/patterns/custom-hooks/');
  await expect(page.locator('.d2-diagram-light').first()).toBeVisible();
  await expect(page.locator('.code-walkthrough noscript ol li')).toHaveCount(3);
  await page.locator('.protocol-exchange [data-variant="missing"] > summary').click();
  await expect(page.locator('.protocol-exchange [data-variant="missing"]')).toContainText('User not found');
  await context.close();
});
