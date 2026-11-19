import { Page } from '@playwright/test';
import { ids, mockBackend, period } from './fixtures';
export const floorId = '55555555-5555-4555-8555-555555555555';
export const alertId = '66666666-6666-4666-8666-666666666666';
export const ruleId = '77777777-7777-4777-8777-777777777777';
export const metricQuality = {
  provenance: 'Derived',
  sampleCount: 12,
  coveredSeconds: 60,
  coveragePercent: 90,
  gapCount: 1,
  resetCount: 0,
  baselineCount: 1,
  isPartial: true,
  isStale: false,
  warningCodes: ['partial_coverage'],
};
const scope = { siteId: ids.site, cameraId: ids.camera, zoneId: ids.zone };
const floor = {
  id: floorId,
  siteId: ids.site,
  name: 'Ground floor (test)',
  description: null,
  displayOrder: 0,
  isActive: true,
  rowVersion: 'AQID',
};
const rule = {
  id: ruleId,
  scope,
  name: 'Capacity rule (test)',
  kind: 'Congestion',
  severity: 'Warning',
  threshold: 80,
  minimumObservedSeconds: 30,
  recoverySeconds: 15,
  windowSeconds: 60,
  cooldownSeconds: 60,
  minimumCoveragePercent: 80,
  allowVideo: false,
  isActive: true,
  rowVersion: 'AQID',
};
const bucket = {
  startUtc: period.from,
  endUtc: period.to,
  localStart: null,
  startSourceTimeMs: 0,
  endSourceTimeMs: 60000,
};
const layout = {
  floorId,
  zoneId: ids.zone,
  cameraId: ids.camera,
  zoneName: 'Entrance zone',
  cameraName: 'Main entrance',
  vertices: [
    { x: 0.1, y: 0.1 },
    { x: 0.8, y: 0.1 },
    { x: 0.8, y: 0.8 },
  ],
  rowVersion: 'AQID',
};

export async function mockSmartBackend(page: Page): Promise<void> {
  await mockBackend(page);
  let alert = {
    id: alertId,
    ruleId,
    scope,
    sessionId: null,
    videoLoop: null,
    kind: 'Congestion',
    severity: 'Warning',
    status: 'Active',
    openedAtUtc: period.from,
    lastObservedAtUtc: period.to,
    acknowledgedAtUtc: null as string | null,
    acknowledgedBy: null as string | null,
    resolvedAtUtc: null,
    resolvedBy: null,
    resolutionReason: null,
    stateVersion: 1,
    evidence: {
      period,
      conditionWindow: bucket,
      value: 90,
      threshold: 80,
      unit: '%',
      observedSeconds: 35,
      quality: metricQuality,
      activeVisitCount: null,
    },
  };
  await page.route('http://localhost:5080/api/v1/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace('/api/v1/', '');
    const paged = (items: unknown[]) => ({
      items,
      page: 1,
      pageSize: 20,
      totalCount: items.length,
      totalPages: 1,
    });
    if (path === `sites/${ids.site}/floors`)
      return route.fulfill({
        json:
          request.method() === 'POST' ? { ...floor, ...request.postDataJSON() } : paged([floor]),
      });
    if (path === `floors/${floorId}`) return route.fulfill({ json: floor });
    if (path === `floors/${floorId}/layouts`) return route.fulfill({ json: [layout] });
    if (path === `floors/${floorId}/zones/${ids.zone}/layout`)
      return route.fulfill({ json: { ...layout, ...request.postDataJSON() } });
    if (path === 'alerts') return route.fulfill({ json: paged([alert]) });
    if (path === `alerts/${alertId}`) return route.fulfill({ json: alert });
    if (path === `alerts/${alertId}/acknowledge`) {
      alert = {
        ...alert,
        status: 'Acknowledged',
        stateVersion: 2,
        acknowledgedAtUtc: period.to,
        acknowledgedBy: 'test-operator',
      };
      return route.fulfill({ json: alert });
    }
    if (path === 'alert-rules')
      return route.fulfill({
        json: request.method() === 'POST' ? { ...rule, ...request.postDataJSON() } : paged([rule]),
      });
    if (path === `alert-rules/${ruleId}`)
      return route.fulfill({
        json: request.method() === 'PUT' ? { ...rule, ...request.postDataJSON() } : rule,
      });
    if (path === `alert-rules/${ruleId}/status`)
      return route.fulfill({ json: { ...rule, ...request.postDataJSON() } });
    if (path === 'analytics/traffic/flow-rate')
      return route.fulfill({
        json: {
          period,
          zones: [
            {
              scope,
              zoneName: 'Entrance zone',
              total: {
                period: bucket,
                eventsPerMinute: {
                  arrivals: 0,
                  departures: 2,
                  entries: 0,
                  exits: 1,
                  wrongWayIn: 0,
                  wrongWayOut: 0,
                },
                observedCounts: null,
                trafficBalance: -2,
                averageOccupancy: 12,
                peakOccupancy: 15,
                quality: metricQuality,
              },
              buckets: [],
            },
          ],
        },
      });
    if (path === 'analytics/congestion')
      return route.fulfill({
        json: {
          period,
          zones: [
            {
              scope,
              zoneName: 'Entrance zone',
              averageUtilizationPercent: 90,
              peakUtilizationPercent: 110,
              aboveWarningSeconds: 35,
              aboveCriticalSeconds: 4,
              quality: metricQuality,
              episodes: [],
            },
          ],
        },
      });
    if (path === 'analytics/congestion/history')
      return route.fulfill({ json: { period, episodes: paged([]) } });
    if (path === 'analytics/dwell/distribution' || path === 'analytics/dwell/long-stay')
      return route.fulfill({
        json: { period, longStayThresholdSeconds: 120, evaluatedAtUtc: period.to, zones: [] },
      });
    if (path === 'analytics/quality')
      return route.fulfill({ json: { period, cameras: [], rejections: [] } });
    if (path === 'analytics/insights')
      return route.fulfill({ json: { period, items: [], quality: metricQuality } });
    const base = {
      schemaVersion: 1,
      metricKey: 'arrivals',
      title: 'Measured arrivals',
      unit: 'events',
      period,
      sourceType: 'live',
      timeBasis: 'eventTime',
      interval: 'hour',
      refreshSeconds: 30,
      quality: metricQuality,
    };
    if (path.startsWith('analytics/visualizations/'))
      return route.fulfill({
        json: {
          ...base,
          visualizationType: 'line',
          series: [
            {
              seriesId: ids.zone,
              label: 'Entrance zone',
              scope,
              points: [
                { period: bucket, value: 0, quality: metricQuality },
                {
                  period: bucket,
                  value: null,
                  quality: { ...metricQuality, provenance: 'InsufficientData' },
                },
              ],
            },
          ],
        },
      });
    if (path === 'analytics/heatmap')
      return route.fulfill({
        json: {
          ...base,
          visualizationType: 'heatmap',
          floor,
          zones: [{ layout, value: 0, quality: metricQuality }],
        },
      });
    return route.fallback();
  });
}
