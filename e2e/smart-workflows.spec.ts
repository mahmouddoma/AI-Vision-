import { expect, test } from '@playwright/test';
import { ids } from './fixtures';
import { alertId, floorId, mockSmartBackend, ruleId } from './smart-fixtures';

test.beforeEach(async ({ page }) => {
  await mockSmartBackend(page);
});

test('new routes render without runtime errors or horizontal page overflow', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const path of [
    '/setup',
    '/system-health',
    `/sites/${ids.site}`,
    `/cameras/${ids.camera}`,
    `/zones/${ids.zone}`,
    `/live/zones/${ids.zone}`,
    '/floors',
    `/floors/${floorId}/editor`,
    `/floors/${floorId}/heatmap`,
    '/analytics/flow',
    '/analytics/congestion',
    '/analytics/distribution',
    '/analytics/quality',
    '/analytics/insights',
    '/alerts',
    `/alerts/${alertId}`,
    '/alert-rules',
    '/alert-rules/new',
    `/alert-rules/${ruleId}/edit`,
  ]) {
    await page.goto(path);
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.locator('main .loading-state')).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.goto(`/floors/${floorId}/heatmap`);
  await expect(page.locator('main svg polygon')).toHaveCount(1);
  await page.screenshot({
    path: `artifacts/floor-heatmap-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('floor edit submits concurrency token and a conflict preserves the draft', async ({
  page,
}) => {
  await page.goto('/floors');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('Changed floor');
  await page.route(`**/api/v1/floors/${floorId}`, (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({
          status: 409,
          json: { code: 'concurrency_conflict', detail: 'Reload the current floor.' },
        })
      : route.fallback(),
  );
  const saved = page.waitForRequest(
    (r) => r.method() === 'PUT' && r.url().endsWith(`/floors/${floorId}`),
  );
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await saved).postDataJSON().rowVersion).toBe('AQID');
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Changed floor');
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Reload latest record' }).click();
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Ground floor (test)');
});

test('saved polygons retain normalized vertices and rowVersion', async ({ page }) => {
  await page.goto(`/floors/${floorId}/editor`);
  await page.getByLabel('Camera', { exact: true }).selectOption(ids.camera);
  await page.getByLabel('Zone', { exact: true }).selectOption(ids.zone);
  await page.getByLabel('X', { exact: true }).first().fill('0.2');
  const saved = page.waitForRequest(
    (r) => r.method() === 'PUT' && r.url().endsWith(`/zones/${ids.zone}/layout`),
  );
  await page.getByRole('button', { name: 'Save polygon' }).click();
  const body = (await saved).postDataJSON();
  expect(body.rowVersion).toBe('AQID');
  expect(body.vertices[0].x).toBe(0.2);
});

test('acknowledgement persists and active rules reserve resolution for observed recovery', async ({
  page,
}) => {
  await page.goto(`/alerts/${alertId}`);
  await expect(page.getByRole('button', { name: 'Resolve', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await expect(page.locator('main h2')).toContainText('Acknowledged');
  await expect(page.getByRole('button', { name: 'Acknowledge', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('main h2')).toContainText('Acknowledged');
});

test('rule builder locks immutable scope and sends the current version', async ({ page }) => {
  await page.goto(`/alert-rules/${ruleId}/edit`);
  await expect(page.getByLabel('Kind', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Camera', { exact: true })).toBeDisabled();
  await page.getByLabel('Name', { exact: true }).fill('Revised capacity rule');
  const saved = page.waitForRequest(
    (r) => r.method() === 'PUT' && r.url().endsWith(`/alert-rules/${ruleId}`),
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const body = (await saved).postDataJSON();
  expect(body.rowVersion).toBe('AQID');
  expect(body.siteId).toBe(ids.site);
  expect(body.cameraId).toBe(ids.camera);
  expect(body.zoneId).toBe(ids.zone);
});

test('smart chart data distinguishes a measured zero from an unavailable bucket', async ({
  page,
}) => {
  await page.goto('/analytics/flow');
  await page.getByText(/View accessible data table/).click();
  const chartTable = page
    .getByRole('region', { name: 'Chart data', exact: true })
    .getByRole('table');
  await expect(chartTable.getByRole('cell', { name: '0', exact: true })).toBeVisible();
  await expect(chartTable.getByRole('cell', { name: 'N/A', exact: true })).toBeVisible();
});
