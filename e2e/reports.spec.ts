import { Download, Page, expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// A manager signs in, reads the analytics page and downloads both reports, which then show in My reports.
// The sign-in defaults to a manager of the local stack at http://localhost:8088.
const email = process.env['E2E_EMAIL'] ?? 'manager@example.com';
const password = process.env['E2E_PASSWORD'] ?? 'Demo-Manager-2026';

async function signIn(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/analytics/);
}

/** Exports the page's report in one format and returns the download once the file is complete. */
async function exportReport(page: Page, item: 'PDF report' | 'Excel workbook'): Promise<Download> {
  await page.getByRole('button', { name: 'Export' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: item }).click();
  const download = await downloaded;
  expect(await download.failure()).toBeNull();
  await expect(page.getByText(`Downloaded ${download.suggestedFilename()}.`)).toBeVisible();
  return download;
}

async function firstBytes(download: Download, count: number): Promise<Buffer> {
  return (await readFile(await download.path())).subarray(0, count);
}

test('a manager reads the analytics page and downloads both reports', async ({ page }) => {
  // Anything the Content-Security-Policy blocks, any uncaught error and any failed request fails the test.
  // Chrome also logs each failed request as a console error; those are judged by their response instead
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      problems.push(message.text());
    }
  });
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    // The first visit has no session to restore, so its refresh is turned away
    const noSessionYet = url.pathname === '/api/v1/auth/refresh' && response.status() === 401;
    if (response.status() >= 400 && !noSessionYet) {
      problems.push(`${response.status()} ${url.pathname}`);
    }
  });

  await signIn(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Analytics' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Burnout' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Noisiest services' })).toBeVisible();
  // The export menu is enabled once the page has loaded what it would export
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();

  const pdf = await exportReport(page, 'PDF report');
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect((await firstBytes(pdf, 5)).toString('latin1')).toBe('%PDF-');

  const xlsx = await exportReport(page, 'Excel workbook');
  expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
  // An XLSX file is a ZIP archive
  expect((await firstBytes(xlsx, 4)).toString('latin1')).toBe('PK\x03\x04');

  // Both exports are in the history, newest first
  await page.getByRole('link', { name: 'My reports' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'My reports' })).toBeVisible();
  const rows = page.locator('tbody tr');
  await expect(rows.nth(0)).toContainText('Excel');
  await expect(rows.nth(1)).toContainText('PDF');

  expect(problems).toEqual([]);
});
