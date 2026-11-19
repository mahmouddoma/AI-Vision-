import { expect, test } from '@playwright/test';
import { ids, mockBackend } from './fixtures';

const now = new Date().toISOString();

function makeLiveZone(overrides: Record<string, unknown> = {}) {
  return {
    zoneId: 'zone-a',
    cameraId: 'cam-a',
    externalZoneId: 'z_a',
    zoneName: 'Zone A',
    isActive: true,
    sessionId: 'sess-a',
    sequence: 10,
    stateVersion: 10,
    previousSession: false,
    dataFreshness: 'Fresh',
    occupancy: 15,
    zoneArrivals: 20,
    zoneDepartures: 5,
    entry: 18,
    exit: 3,
    wrongWayIn: 0,
    wrongWayOut: 0,
    reportedAverageDwellSeconds: 40,
    longestActiveDwellSeconds: 90,
    activeVisitorsCount: 15,
    capacity: 100,
    warningThresholdPercent: 80,
    criticalThresholdPercent: 100,
    utilizationPercent: 15,
    capacityStatus: 'WithinCapacity',
    lastUpdatedAtUtc: now,
    ...overrides,
  };
}

function makeLiveCamera(overrides: Record<string, unknown> = {}) {
  const cameraId = (overrides['cameraId'] as string) ?? 'cam-a';
  const sessionId = overrides['sessionId'] === undefined ? 'sess-a' : overrides['sessionId'];
  return {
    cameraId,
    siteId: ids.site,
    externalCameraId: cameraId,
    cameraName: `Camera ${cameraId}`,
    isActive: true,
    sessionId,
    lastSequence: 10,
    sourceType: 'live',
    analyticsStatus: 'running',
    dataFreshness: 'Fresh',
    processingFps: 24,
    staffCount: 2,
    lastReceivedAtUtc: now,
    stateVersion: 10,
    zones: [makeLiveZone({ cameraId, sessionId })],
    ...overrides,
  };
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
});

test('Live and Overview exclude stale and NoRecentData cameras and show Partial data (15 instead of 45)', async ({
  page,
}) => {
  const mixedCameras = [
    makeLiveCamera({
      cameraId: 'cam-a',
      cameraName: 'Camera A',
      sessionId: 'sess-a',
      dataFreshness: 'Fresh',
      zones: [
        makeLiveZone({
          zoneId: 'zone-a',
          cameraId: 'cam-a',
          sessionId: 'sess-a',
          dataFreshness: 'Fresh',
          occupancy: 15,
        }),
      ],
    }),
    makeLiveCamera({
      cameraId: 'cam-b',
      cameraName: 'Camera B',
      sessionId: 'sess-b',
      dataFreshness: 'Stale',
      zones: [
        makeLiveZone({
          zoneId: 'zone-b',
          cameraId: 'cam-b',
          sessionId: 'sess-b',
          dataFreshness: 'Stale',
          occupancy: 20,
        }),
      ],
    }),
    makeLiveCamera({
      cameraId: 'cam-c',
      cameraName: 'Camera C',
      sessionId: 'sess-c',
      dataFreshness: 'NoRecentData',
      zones: [
        makeLiveZone({
          zoneId: 'zone-c',
          cameraId: 'cam-c',
          sessionId: 'sess-c',
          dataFreshness: 'NoRecentData',
          occupancy: 10,
        }),
      ],
    }),
  ];

  await page.route(`**/api/v1/sites/${ids.site}/live`, (route) =>
    route.fulfill({
      json: {
        siteId: ids.site,
        siteName: 'Main Mall (test fixture)',
        isActive: true,
        cameras: mixedCameras,
      },
    }),
  );

  // Check Live Monitoring
  await page.goto('/live');
  const liveKpi = page.getByTestId('live-occupancy-kpi');
  await expect(liveKpi.locator('.kpi-num')).toHaveText('15');
  await expect(liveKpi).toContainText('Partial data');
  await expect(liveKpi).toContainText('1/3');
  await expect(liveKpi).toContainText('Stale: 1');
  await expect(liveKpi).toContainText('No recent data: 1');

  // Check Overview Dashboard produces identical occupancy and partial status
  await page.goto('/');
  const overviewKpi = page.getByTestId('overview-live-occupancy');
  await expect(overviewKpi.locator('.ov-kpi-val')).toHaveText('15');
  await expect(overviewKpi).toContainText('Partial data');
  await expect(overviewKpi).toContainText('1/3');
});

test('Live distinguishes valid zero occupancy from unavailable video/stale observations', async ({
  page,
}) => {
  await page.route(`**/api/v1/sites/${ids.site}/live`, (route) =>
    route.fulfill({
      json: {
        siteId: ids.site,
        siteName: 'Main Mall (test fixture)',
        isActive: true,
        cameras: [
          makeLiveCamera({
            zones: [makeLiveZone({ occupancy: 0, dataFreshness: 'Fresh' })],
          }),
        ],
      },
    }),
  );

  await page.goto('/live');
  const liveKpi = page.getByTestId('live-occupancy-kpi');
  await expect(liveKpi.locator('.kpi-num')).toHaveText('0');

  // Replace with video_file + previousSession observations -> must show N/A, not 0
  await page.route(`**/api/v1/sites/${ids.site}/live`, (route) =>
    route.fulfill({
      json: {
        siteId: ids.site,
        siteName: 'Main Mall (test fixture)',
        isActive: true,
        cameras: [
          makeLiveCamera({
            cameraId: 'cam-video',
            sourceType: 'video_file',
            zones: [makeLiveZone({ zoneId: 'zv', cameraId: 'cam-video', occupancy: 30 })],
          }),
          makeLiveCamera({
            cameraId: 'cam-prev',
            zones: [
              makeLiveZone({
                zoneId: 'zp',
                cameraId: 'cam-prev',
                previousSession: true,
                occupancy: 12,
              }),
            ],
          }),
        ],
      },
    }),
  );

  await page.reload();
  await expect(liveKpi.locator('.kpi-num')).toHaveText('N/A');
  await expect(liveKpi).toContainText('No reliable live data');
});

test('Arabic RTL renders localized partial occupancy warnings', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ai_vision_lang', 'ar'));
  await page.route(`**/api/v1/sites/${ids.site}/live`, (route) =>
    route.fulfill({
      json: {
        siteId: ids.site,
        siteName: 'Main Mall (test fixture)',
        isActive: true,
        cameras: [
          makeLiveCamera({
            cameraId: 'cam-a',
            dataFreshness: 'Fresh',
            zones: [makeLiveZone({ zoneId: 'za', cameraId: 'cam-a', occupancy: 9 })],
          }),
          makeLiveCamera({
            cameraId: 'cam-b',
            dataFreshness: 'Stale',
            zones: [makeLiveZone({ zoneId: 'zb', cameraId: 'cam-b', occupancy: 20, dataFreshness: 'Stale' })],
          }),
        ],
      },
    }),
  );

  await page.goto('/live');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const liveKpi = page.getByTestId('live-occupancy-kpi');
  await expect(liveKpi.locator('.kpi-num')).toHaveText('9');
  await expect(liveKpi).toContainText('بيانات جزئية');
  await expect(liveKpi).toContainText('1/2');
});
