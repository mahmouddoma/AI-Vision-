import { expect, test } from '@playwright/test';
import { mockBackend } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
});

test('Test A: Healthy readiness renders Healthy topbar status', async ({ page }) => {
  await page.goto('/');
  const btn = page.getByTestId('topbar-health-btn');
  await expect(btn).toHaveAttribute('data-health', 'healthy');
  await expect(btn).toContainText('Healthy');
});

test('Test B: MQTT Disconnected renders Degraded topbar status and warning in System Health', async ({
  page,
}) => {
  await page.route('**/api/v1/health/ready', (route) =>
    route.fulfill({
      json: { status: 'Degraded', database: 'Ready', mqtt: 'Disconnected' },
    }),
  );
  await page.goto('/');
  const btn = page.getByTestId('topbar-health-btn');
  await expect(btn).toHaveAttribute('data-health', 'degraded');
  await expect(btn).toContainText('Degraded');

  await btn.click();
  await expect(page.getByRole('dialog')).toContainText('MQTT connection unavailable');
});

test('Test C: HTTP 503 Unhealthy database payload renders Unhealthy topbar status', async ({
  page,
}) => {
  await page.route('**/api/v1/health/ready', (route) =>
    route.fulfill({
      status: 503,
      json: { status: 'Unhealthy', database: 'Unavailable', mqtt: 'Subscribed' },
    }),
  );
  await page.goto('/');
  const btn = page.getByTestId('topbar-health-btn');
  await expect(btn).toHaveAttribute('data-health', 'unhealthy');
  await expect(btn).toContainText('Unhealthy');
});

test('Test D: Failed refresh after previous Healthy drops green indicator and marks diagnostics outdated', async ({
  page,
}) => {
  await page.goto('/system-health');
  const btn = page.getByTestId('topbar-health-btn');
  await expect(btn).toHaveAttribute('data-health', 'healthy');

  // Next health check fails completely
  await page.route('**/api/v1/health/live', (route) => route.abort('failed'));
  await page.route('**/api/v1/health/ready', (route) => route.abort('failed'));
  await page.route('**/api/v1/monitoring/status', (route) => route.abort('failed'));

  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(btn).toHaveAttribute('data-health', 'unhealthy');
  await expect(page.locator('main')).toContainText('outdated');
  await expect(page.locator('main')).toContainText('Backend connection unavailable');
});

test('Arabic RTL renders localized Degraded status in Topbar', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ai_vision_lang', 'ar'));
  await page.route('**/api/v1/health/ready', (route) =>
    route.fulfill({
      json: { status: 'Degraded', database: 'Ready', mqtt: 'Disconnected' },
    }),
  );
  await page.goto('/');
  const btn = page.getByTestId('topbar-health-btn');
  await expect(btn).toHaveAttribute('data-health', 'degraded');
  await expect(btn).toContainText('يعمل بشكل جزئي');
});
