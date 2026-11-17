import { Page as BrowserPage } from '@playwright/test';
export const ids = {
  site: '11111111-1111-4111-8111-111111111111',
  camera: '22222222-2222-4222-8222-222222222222',
  zone: '33333333-3333-4333-8333-333333333333',
  session: '44444444-4444-4444-8444-444444444444',
};
const now = new Date().toISOString();
export const quality = {
  kind: 'Derived',
  sampleCount: 18,
  coveragePercent: 84.5,
  observationDurationSeconds: 780,
  counterResetCount: 1,
  baselineCount: 1,
  gapCount: 2,
};
export const period = {
  sourceType: 'live',
  timeBasis: 'eventTime',
  interval: 'hour',
  timeZoneId: 'Africa/Cairo',
  from: new Date(Date.now() - 86400000).toISOString(),
  to: now,
  fromSourceTimeMs: null,
  toSourceTimeMs: null,
};
const traffic = {
  arrivals: 120,
  departures: 105,
  entries: 90,
  exits: 82,
  wrongWayIn: 2,
  wrongWayOut: 1,
  wrongWayEvents: 3,
};
const series = [12, 20, 32, 25, null, 40, 34, 22].map((value, i) => ({
  period: {
    startUtc: new Date(Date.now() - (8 - i) * 3600000).toISOString(),
    endUtc: new Date(Date.now() - (7 - i) * 3600000).toISOString(),
    localStart: null,
    startSourceTimeMs: i * 60000,
    endSourceTimeMs: (i + 1) * 60000,
  },
  averageOccupancy: value,
  peakOccupancy: value === null ? null : value + 5,
  peakAtUtc: now,
  peakAtSourceTimeMs: i * 60000,
  traffic,
  dataQuality:
    value === null ? { ...quality, kind: 'InsufficientData', coveragePercent: 0 } : quality,
}));
export const site = {
  id: ids.site,
  name: 'Main Mall (test fixture)',
  code: 'MAIN',
  description: 'Synthetic browser test data',
  timeZoneId: 'Africa/Cairo',
  isActive: true,
  createdAtUtc: now,
  updatedAtUtc: now,
  rowVersion: 'AQIDBAUGBwg=',
};
export const camera = {
  id: ids.camera,
  siteId: ids.site,
  siteName: site.name,
  externalCameraId: 'cam1',
  name: 'Main entrance',
  description: null,
  isActive: true,
  zonesCount: 1,
  mqttTopic: 'cameras/cam1/analytics',
  lastReceivedAtUtc: now,
  createdAtUtc: now,
  updatedAtUtc: now,
  rowVersion: 'AQIDBAUGBwg=',
};
export const zone = {
  id: ids.zone,
  cameraId: ids.camera,
  externalZoneId: 'zone_01',
  name: 'Entrance zone',
  description: null,
  capacity: null,
  warningThresholdPercent: 80,
  criticalThresholdPercent: 100,
  isActive: true,
  createdAtUtc: now,
  updatedAtUtc: now,
  rowVersion: 'AQIDBAUGBwg=',
};
const zoneReport = {
  zoneId: ids.zone,
  cameraId: ids.camera,
  zoneName: zone.name,
  capacity: null,
  averageOccupancy: 26.5,
  peakOccupancy: 45,
  peakAtUtc: now,
  peakAtSourceTimeMs: 300000,
  peakUtilizationPercent: null,
  averageUtilizationPercent: null,
  reportedAverageDwellSeconds: 55,
  longestActiveDwellSeconds: 140,
  estimatedCompletedVisits: 20,
  estimatedTotalDwellSeconds: 1200,
  estimatedHistoricalAverageDwellSeconds: 60,
  uncertainVisits: 3,
  traffic,
  dataQuality: quality,
  series,
  peakHour: series[5],
};
const ranking = {
  rank: 1,
  zoneId: ids.zone,
  zoneName: zone.name,
  value: 120,
  dataQuality: quality,
};
const liveZone = {
  ...zone,
  zoneId: ids.zone,
  zoneName: zone.name,
  sessionId: ids.session,
  sequence: 123,
  stateVersion: 10,
  previousSession: false,
  dataFreshness: 'Fresh',
  occupancy: 34,
  zoneArrivals: 250,
  zoneDepartures: 220,
  entry: 200,
  exit: 190,
  wrongWayIn: 2,
  wrongWayOut: 1,
  reportedAverageDwellSeconds: 55,
  longestActiveDwellSeconds: 140,
  activeVisitorsCount: 34,
  utilizationPercent: null,
  capacityStatus: null,
  lastUpdatedAtUtc: now,
};
const liveCamera = {
  cameraId: ids.camera,
  siteId: ids.site,
  externalCameraId: 'cam1',
  cameraName: camera.name,
  isActive: true,
  sessionId: ids.session,
  lastSequence: 123,
  sourceType: 'live',
  analyticsStatus: 'running',
  dataFreshness: 'Fresh',
  processingFps: 23.8,
  staffCount: 3,
  lastReceivedAtUtc: now,
  stateVersion: 10,
  zones: [liveZone],
};
export const session = {
  id: ids.session,
  cameraId: ids.camera,
  cameraName: camera.name,
  externalSessionId: 'video-test-01',
  sourceType: 'video_file',
  sourceName: 'mall-entrance-test.mp4',
  status: 'ended',
  firstSequence: 1,
  lastSequence: 123,
  firstSourceTimeMs: 0,
  lastSourceTimeMs: 480000,
  firstSourceTimestampUtc: now,
  lastSourceTimestampUtc: now,
  startedAtUtc: now,
  lastReceivedAtUtc: now,
  endedAtUtc: now,
  createdAtUtc: now,
};
const staff = {
  cameraId: ids.camera,
  cameraName: camera.name,
  latestStaffCount: 3,
  lastReceivedAtUtc: now,
  averageStaffCount: 2.6,
  peakStaffCount: 4,
  dataQuality: quality,
  series: series.map((point) => ({
    period: point.period,
    averageStaffCount: point.averageOccupancy === null ? null : 2.6,
    peakStaffCount: 4,
    dataQuality: point.dataQuality,
  })),
};
export async function mockBackend(page: BrowserPage): Promise<void> {
  await page.addInitScript(() => {
    if (!localStorage.getItem('ai_vision_lang')) localStorage.setItem('ai_vision_lang', 'en');
  });
  const sites = [{ ...site }];
  const cameras = [{ ...camera }];
  const zones = [{ ...zone }];
  await page.route('**/config.json', (route) =>
    route.fulfill({
      json: {
        apiBaseUrl: 'http://localhost:5080/api/v1',
        hubPath: '/hubs/analytics',
        signalREnabled: false,
        refreshIntervalSeconds: 30,
      },
    }),
  );
  await page.route('http://localhost:5080/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1/', '');
    const method = request.method();
    const paged = (items: unknown[]) => ({
      items,
      page: 1,
      pageSize: 20,
      totalCount: items.length,
      totalPages: 1,
    });
    if (method === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': '*',
          'access-control-allow-headers': '*',
        },
      });
    if (method !== 'GET') {
      const rows = path.startsWith('sites')
        ? sites
        : path.startsWith('zones') || path.endsWith('/zones')
          ? zones
          : cameras;
      const body = request.postDataJSON();
      if (method === 'POST') {
        const item = {
          ...rows[0],
          ...body,
          id: '55555555-5555-4555-8555-555555555555',
          rowVersion: 'AgIDBAUGBwg=',
        };
        (rows as unknown[]).push(item);
        return route.fulfill({ status: 201, json: item });
      }
      const item = rows.find((row) => path.includes(row.id));
      if (!item) return route.fulfill({ status: 404, json: {} });
      Object.assign(item, body, { rowVersion: 'AgIDBAUGBwg=' });
      return method === 'PATCH' ? route.fulfill({ status: 204 }) : route.fulfill({ json: item });
    }
    let result: unknown;
    const rp =
      url.searchParams.get('sourceType') === 'video_file'
        ? {
            ...period,
            sourceType: 'video_file',
            timeBasis: 'sourceTime',
            from: null,
            to: null,
            fromSourceTimeMs: 0,
            toSourceTimeMs: 480000,
          }
        : period;
    if (path === 'sites') result = paged(sites);
    else if (path === 'cameras') result = paged(cameras);
    else if (path === `cameras/${ids.camera}/zones`) result = paged(zones);
    else if (path === `sites/${ids.site}`) result = sites[0];
    else if (path === `cameras/${ids.camera}`) result = cameras[0];
    else if (path === `zones/${ids.zone}`) result = zones[0];
    else if (path === `sites/${ids.site}/live`)
      result = { siteId: ids.site, siteName: site.name, isActive: true, cameras: [liveCamera] };
    else if (path === `cameras/${ids.camera}/live`) result = liveCamera;
    else if (path === `zones/${ids.zone}/live`) result = liveZone;
    else if (path === 'monitoring/status')
      result = {
        registeredCameras: 1,
        activeCameras: 1,
        fresh: 1,
        stale: 0,
        noRecentData: 0,
        neverReceived: 0,
        ended: 1,
        mqttEnabled: true,
        mqttSubscribed: true,
        checkedAtUtc: now,
      };
    else if (path === 'health/live') result = { status: 'Healthy' };
    else if (path === 'health/ready')
      result = { status: 'Healthy', database: 'Ready', mqtt: 'Subscribed' };
    else if (path === 'analytics/overview')
      result = {
        period: rp,
        mostVisitedZone: ranking,
        topEntryZone: { ...ranking, value: 90 },
        mostCrowdedZone: { ...ranking, value: 26.5 },
        peakOccupancy: { ...ranking, value: 45 },
        longestActiveStay: { ...ranking, value: 140 },
        estimatedHistoricalDwell: { ...ranking, value: 60 },
        observedZoneAverageOccupancy: 26.5,
        traffic,
        dataQuality: quality,
      };
    else if (path === 'analytics/occupancy') result = { period: rp, zones: [zoneReport] };
    else if (path === 'analytics/occupancy/utilization')
      result = { period: rp, zones: [zoneReport] };
    else if (path === 'analytics/peak-hours')
      result = {
        period: rp,
        zones: [
          {
            zoneId: ids.zone,
            zoneName: zone.name,
            occupancy: series[5],
            arrivals: series[5],
            entries: series[5],
            departures: series[5],
            wrongWayEvents: null,
          },
        ],
      };
    else if (path.endsWith('/rankings'))
      result = {
        period: rp,
        metric: url.searchParams.get('metric'),
        unit: 'count',
        items: [ranking],
      };
    else if (path === 'analytics/traffic' || path === 'analytics/traffic/trends')
      result = { period: rp, totals: traffic, zones: [zoneReport] };
    else if (path === 'analytics/dwell') result = { period: rp, zones: [zoneReport] };
    else if (path === 'analytics/wrong-way')
      result = {
        period: rp,
        wrongWayIn: 2,
        wrongWayOut: 1,
        wrongWayEvents: 3,
        highestWrongWayZone: ranking,
        zones: [zoneReport],
      };
    else if (path === 'analytics/staff') result = { period: rp, cameras: [staff] };
    else if (path === `analytics/zones/${ids.zone}/summary`) result = zoneReport;
    else if (path === `analytics/zones/${ids.zone}/timeseries`)
      result = { period: rp, zones: [zoneReport] };
    else if (path === 'analytics/sessions') result = paged([session]);
    else if (path === `analytics/sessions/${ids.session}`) result = session;
    else if (path === `analytics/sessions/${ids.session}/report`)
      result = {
        session,
        analytics: { period: rp, zones: [zoneReport] },
        staff: { period: rp, cameras: [staff] },
        untimedVideoObservations: 2,
      };
    else
      return route.fulfill({
        status: 404,
        json: { status: 404, detail: 'Missing test fixture', traceId: 'fixture' },
      });
    return route.fulfill({ json: result, headers: { 'access-control-allow-origin': '*' } });
  });
}
