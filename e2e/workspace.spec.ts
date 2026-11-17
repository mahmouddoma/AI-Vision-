import { expect, test } from '@playwright/test';
import { ids, mockBackend } from './fixtures';
test.beforeEach(async ({ page }) => {
  await mockBackend(page);
});
test('overview, routes and responsive layout', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What the period tells us' })).toBeVisible();
  await page.screenshot({
    path: `artifacts/overview-${testInfo.project.name}.png`,
    fullPage: true,
  });
  for (const path of [
    '/sites',
    '/cameras',
    `/cameras/${ids.camera}/zones`,
    '/live',
    `/live/${ids.camera}`,
    '/analytics',
    '/sessions',
    `/sessions/${ids.session}`,
    '/missing-page',
  ]) {
    await page.goto(path);
    await expect(page.locator('main h1, main .state-view h2').first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test('site create, validation, editing and status confirmation', async ({ page }) => {
  await page.goto('/sites');
  await page.getByRole('button', { name: 'Add site', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Save site' }).click();
  await expect(page.getByText('Site code is required.')).toBeVisible();
  await page.getByLabel('Name *', { exact: true }).fill('West Wing');
  await page.getByLabel('Site code').fill('WEST');
  await page.getByRole('button', { name: 'Save site' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Site created successfully' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit West Wing' }).click();
  await page.getByLabel('Name *', { exact: true }).fill('West Wing Updated');
  await page.getByRole('button', { name: 'Save site' }).click();
  await expect(page.getByRole('row', { name: /West Wing Updated/ })).toBeVisible();
  await page
    .getByRole('row', { name: /West Wing Updated/ })
    .getByRole('button', { name: 'Deactivate' })
    .click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(
    page.getByRole('row', { name: /West Wing Updated/ }).getByText('Inactive', { exact: true }),
  ).toBeVisible();
});
test('analytics tabs, drilldown and accessible chart data', async ({ page }) => {
  await page.goto('/analytics');
  await expect(page.getByRole('heading', { name: 'Zone ranking', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Entrance zone' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('dialog').getByText('Estimated historical dwell', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  for (const tab of ['Occupancy', 'Traffic', 'Dwell time', 'Wrong-way', 'Staff']) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await expect(page.locator('.loading-state')).toHaveCount(0);
    await expect(page.getByRole('tabpanel')).not.toContainText('Unable to load data');
  }
  await page.getByRole('tab', { name: 'Occupancy', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Occupancy & capacity' })).toBeVisible();
  await page
    .getByText(/View accessible data table/)
    .first()
    .click();
  await expect(page.getByRole('table').filter({ hasText: 'Average occupancy' })).toBeVisible();
});
test('video session requests source positions and never wall-clock dates', async ({ page }) => {
  const requests: URL[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/report?')) requests.push(new URL(request.url()));
  });
  await page.goto(`/sessions/${ids.session}`);
  await expect(page.getByRole('heading', { name: 'Entrance zone', exact: true })).toBeVisible();
  expect(requests.length).toBeGreaterThan(0);
  for (const request of requests) {
    expect(request.searchParams.get('sourceType')).toBe('video_file');
    expect(request.searchParams.get('sessionId')).toBe(ids.session);
    expect(request.searchParams.has('from')).toBe(false);
    expect(request.searchParams.has('to')).toBe(false);
  }
  await expect(page.getByText(/not real venue visit times/)).toBeVisible();
});
test('API failure, retry and not-ready backend remain actionable', async ({ page }) => {
  await page.route('**/api/v1/health/ready', (route) =>
    route.fulfill({
      status: 503,
      json: { status: 'Unhealthy', database: 'Unavailable', mqtt: 'Disconnected' },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Open system status' }).click();
  await expect(page.getByRole('dialog').getByText('Unhealthy', { exact: true })).toBeVisible();
  await expect(page.getByText(/backend is not ready/i)).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.route('**/api/v1/sites?**', (route) =>
    route.fulfill({
      status: 500,
      json: { status: 500, detail: 'internal secret', traceId: 'trace-test' },
    }),
  );
  await page.goto('/sites');
  await expect(page.getByRole('heading', { name: 'Unable to load data' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('internal secret');
});
test('mobile navigation and native dialog focus handling', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile navigation is viewport-specific');
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  await dialog.getByRole('link', { name: 'Sites', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sites', exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/sites-mobile.png', fullPage: true });
});

test('camera and zone forms preserve string IDs and validate thresholds', async ({ page }) => {
  await page.goto('/cameras');
  await page.getByRole('button', { name: 'Add camera', exact: true }).first().click();
  await page.getByLabel('Name *', { exact: true }).fill('Second camera');
  await page.getByLabel('External camera ID').fill('2');
  await expect(page.getByRole('dialog')).toContainText('cameras/2/analytics');
  const saved = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/cameras'),
  );
  await page.getByRole('button', { name: 'Save camera' }).click();
  expect((await saved).postDataJSON().externalCameraId).toBe('2');
  await expect(page.getByRole('row', { name: /Second camera/ })).toBeVisible();
  await page.goto(`/cameras/${ids.camera}/zones`);
  await expect(page.getByText('Not configured', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add zone', exact: true }).first().click();
  await page.getByLabel('Name *', { exact: true }).fill('Waiting area');
  await page.getByLabel('External zone ID').fill('zone_02');
  await page.getByLabel('Warning threshold').fill('120');
  await page.getByRole('button', { name: 'Save zone' }).click();
  await expect(page.getByText(/Warning must be lower than critical/)).toBeVisible();
  await page.getByLabel('Warning threshold').fill('80');
  const zoneRequest = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/zones'),
  );
  await page.getByRole('button', { name: 'Save zone' }).click();
  expect((await zoneRequest).postDataJSON().capacity).toBeNull();
  await expect(page.getByRole('row', { name: /Waiting area/ })).toBeVisible();
});
test('conflicting edit requires a fresh row version before retrying', async ({ page }) => {
  let conflict = true;
  let requestBody: Record<string, unknown> | null = null;
  await page.route(`**/api/v1/sites/${ids.site}`, async (route) => {
    if (route.request().method() === 'PUT') {
      if (conflict) {
        conflict = false;
        return route.fulfill({
          status: 409,
          json: {
            status: 409,
            detail: 'Record changed. Reload the latest version.',
            traceId: 'conflict-ref',
          },
        });
      }
      requestBody = route.request().postDataJSON();
      return route.fallback();
    }
    const { site } = await import('./fixtures');
    return route.fulfill({ json: { ...site, rowVersion: 'AgIDBAUGBwg=' } });
  });
  await page.goto('/sites');
  await page.getByRole('button', { name: 'Edit Main Mall (test fixture)' }).click();
  await page.getByRole('button', { name: 'Save site' }).click();
  await expect(page.getByRole('button', { name: 'Save site' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reload latest record' }).click();
  await expect(page.getByRole('button', { name: 'Save site' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save site' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requestBody!['rowVersion']).toBe('AgIDBAUGBwg=');
});
test('sidebar collapse and expand toggle', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Sidebar collapse/expand is desktop-specific; mobile uses drawer');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('.sidebar .brand-logo')).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCSS('width', '232px');

  await page.locator('.sidebar-toggle-btn').click();
  await expect(page.locator('.sidebar.collapsed')).toBeVisible();
  await expect(page.locator('.sidebar .brand-icon-collapsed')).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCSS('width', '68px');

  const firstLink = page.locator('.sidebar nav a').first();
  await firstLink.hover();
  await expect(firstLink.locator('.nav-flyout')).toBeVisible();
  await expect(firstLink.locator('.nav-flyout')).toContainText('Overview');

  await page.locator('.sidebar-toggle-btn').click();
  await expect(page.locator('.sidebar.collapsed')).toHaveCount(0);
  await expect(page.locator('.sidebar .brand-logo')).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCSS('width', '232px');
});
