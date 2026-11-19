import {
  calculateLiveOccupancy,
  describeLiveOccupancy,
  isEligibleLiveCamera,
  isEligibleLiveZone,
} from './live-occupancy';
import { LiveCamera, LiveZone } from './models';

function makeZone(overrides: Partial<LiveZone> = {}): LiveZone {
  return {
    zoneId: 'zone-1',
    cameraId: 'cam-1',
    externalZoneId: 'z1',
    zoneName: 'Entrance',
    isActive: true,
    sessionId: 'sess-1',
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
    reportedAverageDwellSeconds: 45,
    longestActiveDwellSeconds: 120,
    activeVisitorsCount: 15,
    capacity: 100,
    warningThresholdPercent: 80,
    criticalThresholdPercent: 100,
    utilizationPercent: 15,
    capacityStatus: 'WithinCapacity',
    lastUpdatedAtUtc: '2026-11-19T10:00:00Z',
    ...overrides,
  };
}

function makeCamera(overrides: Partial<LiveCamera> = {}): LiveCamera {
  const cameraId = overrides.cameraId ?? 'cam-1';
  const sessionId = overrides.sessionId === undefined ? 'sess-1' : overrides.sessionId;
  return {
    cameraId,
    siteId: 'site-1',
    externalCameraId: 'c1',
    cameraName: 'Camera A',
    isActive: true,
    sessionId,
    lastSequence: 10,
    sourceType: 'live',
    analyticsStatus: 'running',
    dataFreshness: 'Fresh',
    processingFps: 24,
    staffCount: 2,
    lastReceivedAtUtc: '2026-11-19T10:00:00Z',
    stateVersion: 10,
    zones: [makeZone({ cameraId, sessionId })],
    ...overrides,
  };
}

describe('calculateLiveOccupancy', () => {
  it('includes a fresh live camera with a fresh active zone', () => {
    const result = calculateLiveOccupancy([makeCamera()]);
    expect(result).toEqual({
      observedOccupancy: 15,
      status: 'complete',
      includedZones: 1,
      excludedZones: 0,
      totalCameras: 1,
      monitoredCameras: 1,
      freshCameras: 1,
      staleCameras: 0,
      noRecentDataCameras: 0,
      otherExcludedCameras: 0,
      hasIncompleteCoverage: false,
      isDisconnected: false,
    });
  });

  it('excludes a stale camera even when its zone still reports Fresh', () => {
    const camera = makeCamera({
      dataFreshness: 'Stale',
      zones: [makeZone({ dataFreshness: 'Fresh', occupancy: 20 })],
    });
    const result = calculateLiveOccupancy([camera]);
    expect(result.observedOccupancy).toBeNull();
    expect(result.status).toBe('unavailable');
    expect(result.freshCameras).toBe(0);
    expect(result.staleCameras).toBe(1);
    expect(result.includedZones).toBe(0);
    expect(result.excludedZones).toBe(1);
    expect(result.hasIncompleteCoverage).toBe(true);
  });

  it('excludes a stale zone on an otherwise fresh camera', () => {
    const camera = makeCamera({
      zones: [makeZone({ dataFreshness: 'Stale', occupancy: 12 })],
    });
    const result = calculateLiveOccupancy([camera]);
    expect(result.observedOccupancy).toBeNull();
    expect(result.status).toBe('unavailable');
    expect(result.includedZones).toBe(0);
    expect(result.excludedZones).toBe(1);
  });

  it('excludes cameras with NoRecentData', () => {
    const camera = makeCamera({
      dataFreshness: 'NoRecentData',
      zones: [makeZone({ dataFreshness: 'NoRecentData', occupancy: 10 })],
    });
    const result = calculateLiveOccupancy([camera]);
    expect(result.observedOccupancy).toBeNull();
    expect(result.status).toBe('unavailable');
    expect(result.noRecentDataCameras).toBe(1);
    expect(result.excludedZones).toBe(1);
  });

  it('excludes zones belonging to a previous analytics session', () => {
    const camera = makeCamera({
      zones: [makeZone({ previousSession: true, occupancy: 18 })],
    });
    const result = calculateLiveOccupancy([camera]);
    expect(result.observedOccupancy).toBeNull();
    expect(result.status).toBe('unavailable');
    expect(result.excludedZones).toBe(1);
  });

  it('excludes zones whose sessionId does not match camera sessionId', () => {
    const camera = makeCamera({
      sessionId: 'sess-new',
      zones: [makeZone({ sessionId: 'sess-old', previousSession: false, occupancy: 9 })],
    });
    expect(isEligibleLiveZone(camera.zones[0], camera)).toBe(false);
    const result = calculateLiveOccupancy([camera]);
    expect(result.observedOccupancy).toBeNull();
    expect(result.status).toBe('unavailable');
  });

  it('excludes inactive cameras without falsely marking active fresh coverage partial', () => {
    const activeCam = makeCamera({ cameraId: 'cam-1', zones: [makeZone({ occupancy: 11 })] });
    const inactiveCam = makeCamera({
      cameraId: 'cam-2',
      isActive: false,
      zones: [makeZone({ zoneId: 'z2', cameraId: 'cam-2', occupancy: 99 })],
    });
    const result = calculateLiveOccupancy([activeCam, inactiveCam]);
    expect(result.observedOccupancy).toBe(11);
    expect(result.status).toBe('complete');
    expect(result.monitoredCameras).toBe(1);
    expect(result.totalCameras).toBe(2);
    expect(result.otherExcludedCameras).toBe(1);
    expect(result.hasIncompleteCoverage).toBe(false);
  });

  it('excludes inactive zones without falsely marking active fresh coverage partial', () => {
    const camera = makeCamera({
      zones: [
        makeZone({ zoneId: 'z1', isActive: true, occupancy: 8 }),
        makeZone({ zoneId: 'z2', isActive: false, occupancy: 40 }),
      ],
    });
    const result = calculateLiveOccupancy([camera]);
    expect(result.observedOccupancy).toBe(8);
    expect(result.status).toBe('complete');
    expect(result.includedZones).toBe(1);
    expect(result.excludedZones).toBe(0);
  });

  it('excludes recorded-video (video_file) sources from live occupancy', () => {
    const videoCam = makeCamera({
      sourceType: 'video_file',
      zones: [makeZone({ occupancy: 30 })],
    });
    expect(isEligibleLiveCamera(videoCam)).toBe(false);
    const result = calculateLiveOccupancy([videoCam]);
    expect(result.observedOccupancy).toBeNull();
    expect(result.status).toBe('unavailable');
    expect(result.otherExcludedCameras).toBe(1);
    expect(result.staleCameras).toBe(0);
    expect(result.noRecentDataCameras).toBe(0);
  });

  it('excludes cameras with ended analytics sessions', () => {
    for (const analyticsStatus of ['ended', 'Ended', 'stopped', 'Completed']) {
      const camera = makeCamera({ analyticsStatus });
      expect(isEligibleLiveCamera(camera)).toBe(false);
      const result = calculateLiveOccupancy([camera]);
      expect(result.observedOccupancy).toBeNull();
      expect(result.status).toBe('unavailable');
    }
  });

  it('excludes unknown source types and unknown freshness states', () => {
    expect(isEligibleLiveCamera(makeCamera({ sourceType: null }))).toBe(false);
    expect(isEligibleLiveCamera(makeCamera({ sourceType: 'rtsp_unknown' }))).toBe(false);
    expect(isEligibleLiveCamera(makeCamera({ dataFreshness: 'Unknown' }))).toBe(false);
  });

  it('excludes missing session, missing occupancy, negative, NaN, and non-integer occupancy', () => {
    const noSession = makeCamera({ sessionId: null, zones: [makeZone({ sessionId: null })] });
    const blankSession = makeCamera({ sessionId: '   ', zones: [makeZone({ sessionId: '   ' })] });
    const invalidZones = makeCamera({
      zones: [
        makeZone({ zoneId: 'z-null', occupancy: null }),
        makeZone({ zoneId: 'z-neg', occupancy: -2 }),
        makeZone({ zoneId: 'z-float', occupancy: 3.5 }),
        makeZone({ zoneId: 'z-nan', occupancy: Number.NaN }),
      ],
    });

    expect(calculateLiveOccupancy([noSession]).observedOccupancy).toBeNull();
    expect(calculateLiveOccupancy([blankSession]).observedOccupancy).toBeNull();
    const invalidResult = calculateLiveOccupancy([invalidZones]);
    expect(invalidResult.observedOccupancy).toBeNull();
    expect(invalidResult.status).toBe('unavailable');
    expect(invalidResult.excludedZones).toBe(4);
  });

  it('treats valid zero occupancy as 0 rather than unavailable', () => {
    const camera = makeCamera({
      zones: [makeZone({ occupancy: 0 })],
    });
    const result = calculateLiveOccupancy([camera]);
    expect(result.observedOccupancy).toBe(0);
    expect(result.status).toBe('complete');
    expect(result.includedZones).toBe(1);
    expect(result.hasIncompleteCoverage).toBe(false);
  });

  it('sums multiple eligible cameras and zones accurately', () => {
    const camA = makeCamera({
      cameraId: 'cam-a',
      sessionId: 'sess-a',
      zones: [
        makeZone({ zoneId: 'za1', cameraId: 'cam-a', sessionId: 'sess-a', occupancy: 10 }),
        makeZone({ zoneId: 'za2', cameraId: 'cam-a', sessionId: 'sess-a', occupancy: 5 }),
      ],
    });
    const camB = makeCamera({
      cameraId: 'cam-b',
      sessionId: 'sess-b',
      zones: [makeZone({ zoneId: 'zb1', cameraId: 'cam-b', sessionId: 'sess-b', occupancy: 8 })],
    });
    const result = calculateLiveOccupancy([camA, camB]);
    expect(result.observedOccupancy).toBe(23);
    expect(result.status).toBe('complete');
    expect(result.includedZones).toBe(3);
    expect(result.excludedZones).toBe(0);
    expect(result.freshCameras).toBe(2);
    expect(result.monitoredCameras).toBe(2);
  });

  it('handles the 3-camera mixed freshness scenario (15 Fresh, 20 Stale, 10 NoRecentData)', () => {
    const camA = makeCamera({
      cameraId: 'cam-a',
      cameraName: 'Camera A',
      dataFreshness: 'Fresh',
      zones: [makeZone({ zoneId: 'za', cameraId: 'cam-a', occupancy: 15, dataFreshness: 'Fresh' })],
    });
    const camB = makeCamera({
      cameraId: 'cam-b',
      cameraName: 'Camera B',
      dataFreshness: 'Stale',
      zones: [makeZone({ zoneId: 'zb', cameraId: 'cam-b', occupancy: 20, dataFreshness: 'Stale' })],
    });
    const camC = makeCamera({
      cameraId: 'cam-c',
      cameraName: 'Camera C',
      dataFreshness: 'NoRecentData',
      zones: [
        makeZone({
          zoneId: 'zc',
          cameraId: 'cam-c',
          occupancy: 10,
          dataFreshness: 'NoRecentData',
        }),
      ],
    });

    const result = calculateLiveOccupancy([camA, camB, camC]);
    expect(result.observedOccupancy).toBe(15);
    expect(result.status).toBe('partial');
    expect(result.includedZones).toBe(1);
    expect(result.excludedZones).toBe(2);
    expect(result.totalCameras).toBe(3);
    expect(result.monitoredCameras).toBe(3);
    expect(result.freshCameras).toBe(1);
    expect(result.staleCameras).toBe(1);
    expect(result.noRecentDataCameras).toBe(1);
    expect(result.otherExcludedCameras).toBe(0);
    expect(result.hasIncompleteCoverage).toBe(true);
    expect(
      result.freshCameras +
        result.staleCameras +
        result.noRecentDataCameras +
        result.otherExcludedCameras,
    ).toBe(result.totalCameras);
  });

  it('returns unavailable when no cameras exist', () => {
    const result = calculateLiveOccupancy([]);
    expect(result.observedOccupancy).toBeNull();
    expect(result.status).toBe('unavailable');
    expect(result.hasIncompleteCoverage).toBe(false);
  });

  it('marks disconnected snapshots unavailable rather than verified live occupancy', () => {
    const result = calculateLiveOccupancy([makeCamera()], { disconnected: true });
    expect(result.observedOccupancy).toBeNull();
    expect(result.status).toBe('unavailable');
    expect(result.isDisconnected).toBe(true);
    expect(result.freshCameras).toBe(0);
    expect(result.includedZones).toBe(0);
    const view = describeLiveOccupancy(result, false);
    expect(view.statusBadge).toBe('Disconnected');
    expect(view.descriptionKey).toBe('live.occupancyDisconnected');
  });

  it('produces consistent presentation metadata for complete, partial, unavailable, and loading states', () => {
    const complete = describeLiveOccupancy(calculateLiveOccupancy([makeCamera()]), false);
    expect(complete.statusBadge).toBeNull();
    expect(complete.descriptionKey).toBe('live.occupancyComplete');

    const partial = describeLiveOccupancy(
      calculateLiveOccupancy([
        makeCamera({ cameraId: 'a' }),
        makeCamera({ cameraId: 'b', dataFreshness: 'Stale' }),
      ]),
      false,
    );
    expect(partial.statusBadge).toBe('PartialData');
    expect(partial.descriptionParams).toEqual({ fresh: 1, total: 2, stale: 1, noRecent: 0 });

    const unavailable = describeLiveOccupancy(calculateLiveOccupancy([]), false);
    expect(unavailable.statusBadge).toBe('Unavailable');
    expect(unavailable.descriptionKey).toBe('live.occupancyUnavailable');

    const loading = describeLiveOccupancy(calculateLiveOccupancy([]), true);
    expect(loading.statusBadge).toBeNull();
    expect(loading.descriptionKey).toBe('live.occupancyLoading');
  });
});
