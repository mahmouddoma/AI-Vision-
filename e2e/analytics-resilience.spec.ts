import { expect, test } from '@playwright/test';
import { ids, mockBackend, site } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
});

test('Scenario A & B: Occupancy partial success and single-endpoint Peak Hours retry recovery', async ({
  page,
}) => {
  let occupancyHits = 0;
  let utilizationHits = 0;
  let peakHits = 0;
  let failPeakHours = true;

  await page.route('**/api/v1/analytics/occupancy?*', (route) => {
    occupancyHits += 1;
    return route.fallback();
  });
  await page.route('**/api/v1/analytics/occupancy/utilization?*', (route) => {
    utilizationHits += 1;
    return route.fallback();
  });
  await page.route('**/api/v1/analytics/peak-hours?*', (route) => {
    peakHits += 1;
    if (failPeakHours) {
      return route.fulfill({ status: 500, json: { status: 500, detail: 'Peak hours failure' } });
    }
    return route.fallback();
  });

  await page.goto('/analytics?tab=occupancy');
  await expect(page.getByTestId('occupancy-charts')).toBeVisible();
  await expect(page.getByTestId('analytics-partial-banner')).toBeVisible();
  await expect(page.getByTestId('peaks-error')).toBeVisible();

  const occBeforeRetry = occupancyHits;
  const utilBeforeRetry = utilizationHits;
  const peakBeforeRetry = peakHits;

  failPeakHours = false;
  await page.getByTestId('peaks-error').getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('peaks-section')).toBeVisible();
  await expect(page.getByTestId('peaks-error')).toHaveCount(0);
  await expect(page.getByTestId('analytics-partial-banner')).toHaveCount(0);

  // Verify ONLY Peak Hours was retried — no duplicate sibling requests
  expect(peakHits).toBe(peakBeforeRetry + 1);
  expect(occupancyHits).toBe(occBeforeRetry);
  expect(utilizationHits).toBe(utilBeforeRetry);
});

test('Scenario C: All Occupancy requests fail shows page-level error with retry', async ({
  page,
}) => {
  await page.route('**/api/v1/analytics/occupancy?*', (route) =>
    route.fulfill({ status: 500, json: { status: 500 } }),
  );
  await page.route('**/api/v1/analytics/peak-hours?*', (route) =>
    route.fulfill({ status: 500, json: { status: 500 } }),
  );
  await page.route('**/api/v1/analytics/occupancy/utilization?*', (route) =>
    route.fulfill({ status: 500, json: { status: 500 } }),
  );

  await page.goto('/analytics?tab=occupancy');
  await expect(page.getByTestId('analytics-all-failed')).toBeVisible();
  await expect(
    page.getByTestId('analytics-all-failed').getByRole('button', { name: 'Try again' }),
  ).toBeVisible();
});

test('Scenario D: Switching sites clears prior site partial errors and loads clean data', async ({
  page,
}) => {
  const siteBId = '99999999-9999-4999-8999-999999999999';
  const siteB = {
    ...site,
    id: siteBId,
    name: 'Branch Mall',
    code: 'BRANCH',
  };

  await page.route('**/api/v1/sites?*', (route) =>
    route.fulfill({
      json: {
        items: [site, siteB],
        page: 1,
        pageSize: 100,
        totalCount: 2,
        totalPages: 1,
      },
    }),
  );
  await page.route('**/api/v1/analytics/peak-hours?*', (route) => {
    if (route.request().url().includes(`siteId=${ids.site}`)) {
      return route.fulfill({ status: 500, json: { status: 500, detail: 'Site A peak failure' } });
    }
    return route.fallback();
  });

  await page.goto('/analytics?tab=occupancy');
  await expect(page.getByTestId('peaks-error')).toBeVisible();
  await expect(page.getByTestId('analytics-partial-banner')).toBeVisible();

  // Switch site in topbar selector to Branch Mall
  const siteSelect = page.locator('.topbar select, select[aria-label*="site" i]').first();
  await siteSelect.selectOption(siteBId);

  // Site A error must disappear and Site B peaks must render
  await expect(page.getByTestId('peaks-error')).toHaveCount(0);
  await expect(page.getByTestId('analytics-partial-banner')).toHaveCount(0);
  await expect(page.getByTestId('peaks-section')).toBeVisible();
});

test('Scenario E: Overview partial failure preserves Overview KPIs and Live Occupancy', async ({
  page,
}) => {
  await page.route('**/api/v1/analytics/occupancy?*', (route) =>
    route.fulfill({ status: 500, json: { status: 500, detail: 'Historical occupancy failed' } }),
  );

  await page.goto('/');
  // Live Occupancy remains unaffected (34 from fixture)
  await expect(page.getByTestId('overview-live-occupancy').locator('.ov-kpi-val')).toHaveText('34');
  // Overview summary KPI remains visible (45 peak occupancy from fixture)
  await expect(page.locator('.ov-kpi-grid')).toContainText('45');
  // Failed occupancy section shows its own error & retry
  await expect(page.getByTestId('overview-occupancy-error')).toBeVisible();
});
