import { expect, test } from '@playwright/test';
import { ids } from './fixtures';
import { mockSmartBackend } from './smart-fixtures';

test('site reader uses scoped reports without requesting administrator catalog APIs', async ({
  page,
}) => {
  await mockSmartBackend(page);
  await page.route('**/config.json', (route) =>
    route.fulfill({
      json: {
        apiBaseUrl: 'http://localhost:5080/api/v1',
        hubPath: '/hubs/analytics',
        signalREnabled: false,
        refreshIntervalSeconds: 30,
        auth: {
          authority: 'https://identity.example',
          clientId: 'test-frontend',
          scope: 'openid analytics',
        },
      },
    }),
  );
  await page.addInitScript(
    ({ siteId }) => {
      const access_token =
        'test.' +
        btoa(JSON.stringify({ role: 'AnalyticsReader', site_id: siteId })) +
        '.synthetic-signature';
      sessionStorage.setItem(
        'oidc.user:https://identity.example:test-frontend',
        JSON.stringify({
          access_token,
          token_type: 'Bearer',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          profile: {
            sub: 'synthetic-reader',
            iss: 'https://identity.example',
            aud: 'test-frontend',
          },
        }),
      );
    },
    { siteId: ids.site },
  );
  const forbiddenCalls: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (['/api/v1/sites', '/api/v1/cameras', '/api/v1/monitoring/status'].includes(path))
      forbiddenCalls.push(path);
  });
  await page.goto('/analytics/flow');
  await expect(page.getByRole('heading', { name: 'Flow rate', exact: true })).toBeVisible();
  await expect(page.locator('#workspace-site')).toHaveValue(ids.site);
  await page.goto('/sites');
  await expect(page.getByRole('heading', { name: 'Account access' })).toBeVisible();
  await page.goto('/floors');
  await expect(page.getByRole('button', { name: 'Add floor' })).toBeDisabled();
  expect(forbiddenCalls).toEqual([]);
});
