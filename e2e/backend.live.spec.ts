import { expect, test, APIRequestContext } from '@playwright/test';
import type {
  Camera,
  LiveCamera,
  LiveSite,
  Page,
  Session,
  Site,
  Zone,
} from '../src/app/core/models';
async function all<T>(request: APIRequestContext, base: string, path: string): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let pages = 1;
  do {
    const response = await request.get(`${base}/${path}`, { params: { page, pageSize: 100 } });
    expect(response.ok(), `Backend request failed: ${path}`).toBe(true);
    const result = (await response.json()) as Page<T>;
    items.push(...result.items);
    pages = result.totalPages;
    page++;
  } while (page <= pages);
  return items;
}
async function configuration(request: APIRequestContext): Promise<string> {
  const config = await (await request.get('/config.json')).json();
  const ready = await request.get(`${config.apiBaseUrl}/health/ready`);
  expect(
    ready.ok(),
    'Start the API, SQL Server and MQTT prerequisites described in docs/INTEGRATION.md',
  ).toBe(true);
  return config.apiBaseUrl;
}
test('real registry and live observations only contain registered external IDs', async ({
  page,
  request,
}) => {
  const base = await configuration(request);
  const sites = await all<Site>(request, base, 'sites');
  const site = sites.find((item) => item.name === 'Main Mall');
  expect(site, 'Create Main Mall using the UI').toBeTruthy();
  const cameras = (await all<Camera>(request, base, 'cameras')).filter(
    (item) => item.siteId === site!.id,
  );
  for (const externalId of ['cam1', '2']) {
    const camera = cameras.find((item) => item.externalCameraId === externalId);
    expect(camera, `Register external camera ID ${externalId}`).toBeTruthy();
    const zones = await all<Zone>(request, base, `cameras/${camera!.id}/zones`);
    expect(zones.some((zone) => zone.externalZoneId === 'zone_01')).toBe(true);
    if (externalId === '2')
      expect(zones.some((zone) => zone.externalZoneId === 'zone_02')).toBe(true);
    const snapshot = (await (
      await request.get(`${base}/cameras/${camera!.id}/live`)
    ).json()) as LiveCamera;
    expect(snapshot.lastSequence, 'Publish analytics before running the live suite').not.toBeNull();
    for (const zone of snapshot.zones)
      expect(zones.some((registered) => registered.id === zone.zoneId)).toBe(true);
  }
  await page.goto('/live');
  await page.getByLabel('Current site').selectOption(site!.id);
  await expect(
    page.getByRole('heading', {
      name: cameras.find((camera) => camera.externalCameraId === 'cam1')!.name,
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: 'artifacts/live-backend-desktop.png', fullPage: true });
});
test('real publisher advances sequences and SignalR recovers after a lost connection', async ({
  page,
  request,
}) => {
  const base = await configuration(request);
  const camera = (await all<Camera>(request, base, 'cameras')).find(
    (item) => item.externalCameraId === 'cam1',
  );
  expect(camera).toBeTruthy();
  const snapshot = async () =>
    (await (await request.get(`${base}/cameras/${camera!.id}/live`)).json()) as LiveCamera;
  const before = await snapshot();
  await page.goto(`/live/${camera!.id}`);
  await expect
    .poll(async () => (await snapshot()).stateVersion, {
      timeout: 60000,
      message: 'Run the live MQTT publisher with -CameraId cam1 -Messages 120 while this test runs',
    })
    .toBeGreaterThan(before.stateVersion ?? -1);
  await expect(page.locator('.workspace-footer')).toContainText('Connected', { timeout: 30000 });
  await page.context().setOffline(true);
  await expect(page.locator('.workspace-footer')).toContainText(/Reconnecting|Polling/, {
    timeout: 45000,
  });
  await page.context().setOffline(false);
  await expect(page.locator('.workspace-footer')).toContainText('Connected', { timeout: 45000 });
  await expect(page.locator('main')).not.toContainText('Unable to load data');
});
test('real video session report uses source time and actual server metrics', async ({
  page,
  request,
}) => {
  const base = await configuration(request);
  const sessions = await all<Session>(request, base, 'analytics/sessions');
  const session = sessions.find((item) => item.sourceType === 'video_file');
  expect(session, 'Publish a video_file session first').toBeTruthy();
  const response = await request.get(`${base}/analytics/sessions/${session!.id}/report`, {
    params: { sourceType: 'video_file', sessionId: session!.id, interval: 'minute' },
  });
  expect(response.ok()).toBe(true);
  const report = await response.json();
  expect(report.analytics.period.timeBasis).toBe('sourceTime');
  await page.goto(`/sessions/${session!.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(session!.sourceName);
  for (const zone of report.analytics.zones)
    await expect(page.getByRole('heading', { name: zone.zoneName, exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/session-backend-desktop.png', fullPage: true });
});
