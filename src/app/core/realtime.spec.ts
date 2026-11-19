import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';
import {
  applyCameraEvent,
  applyZoneEvent,
  CameraEvent,
  FeedState,
  HUB_FACTORY,
  mergeSnapshot,
  Realtime,
  ZoneEvent,
} from './realtime';
import { LiveCamera, LiveZone } from './models';
import { calculateLiveOccupancy } from './live-occupancy';
import { RUNTIME_CONFIG } from './runtime-config';
import { AlertChanged } from './smart-models';
const config = {
  apiBaseUrl: 'http://localhost:5080/api/v1',
  hubPath: 'http://localhost:5080/hubs/analytics',
  signalREnabled: true,
  refreshIntervalSeconds: 30,
};
const zone = {
  zoneId: 'zone',
  cameraId: 'camera',
  sessionId: 'new-session',
  stateVersion: 20,
  occupancy: 5,
  isActive: true,
} as LiveZone;
const camera = {
  cameraId: 'camera',
  siteId: 'site',
  sessionId: 'new-session',
  stateVersion: 20,
  zones: [zone],
  isActive: true,
} as LiveCamera;
describe('realtime ordering', () => {
  it('ignores older camera snapshots and duplicate events', () => {
    const event = { cameraId: 'camera', stateVersion: 19, sessionId: 'old-session' } as CameraEvent;
    expect(applyCameraEvent([camera], event)[0]).toBe(camera);
    expect(applyCameraEvent([camera], { ...event, stateVersion: 20 })[0]).toBe(camera);
  });
  it('rejects mismatched zone sessions and never fabricates unknown zones', () => {
    const event = {
      cameraId: 'camera',
      zoneId: 'zone',
      stateVersion: 25,
      sessionId: 'old-session',
      occupancy: 999,
    } as ZoneEvent;
    expect(applyZoneEvent([camera], event)[0]).toBe(camera);
    expect(
      applyZoneEvent([camera], { ...event, sessionId: 'new-session', zoneId: 'unknown' })[0].zones,
    ).toEqual([zone]);
  });
  it('maps event arrivals and resets stale utilization until REST sync', () => {
    const result = applyZoneEvent([camera], {
      cameraId: 'camera',
      zoneId: 'zone',
      sessionId: 'new-session',
      stateVersion: 21,
      arrivals: 12,
      occupancy: 7,
    } as ZoneEvent)[0].zones[0];
    expect(result.zoneArrivals).toBe(12);
    expect(result.occupancy).toBe(7);
    expect(result.utilizationPercent).toBeNull();
  });
  it('accepts explicit unknown values instead of retaining old camera numbers', () => {
    const result = applyCameraEvent([{ ...camera, processingFps: 20, staffCount: 3 }], {
      cameraId: 'camera',
      sessionId: 'new-session',
      stateVersion: 21,
      processingFps: null,
      staffCount: null,
    } as CameraEvent)[0];
    expect(result.processingFps).toBeNull();
    expect(result.staffCount).toBeNull();
  });
  it('does not roll a new-session zone back to an older REST session', () => {
    const result = mergeSnapshot(
      [camera],
      [
        {
          ...camera,
          sessionId: 'old-session',
          stateVersion: 10,
          zones: [{ ...zone, sessionId: 'old-session', stateVersion: 10, occupancy: 999 }],
        },
      ],
    )[0];
    expect(result.sessionId).toBe('new-session');
    expect(result.zones[0].occupancy).toBe(5);
  });
  it('preserves newer events when an older REST snapshot finishes later', () => {
    expect(
      mergeSnapshot(
        [camera],
        [{ ...camera, stateVersion: 10, zones: [{ ...zone, stateVersion: 10, occupancy: 2 }] }],
      )[0].zones[0].occupancy,
    ).toBe(5);
  });
  it('propagates Fresh-to-Stale and NoRecentData transitions to zones and excludes them from live occupancy', () => {
    const freshCam: LiveCamera = {
      ...camera,
      sourceType: 'live',
      analyticsStatus: 'running',
      dataFreshness: 'Fresh',
      zones: [{ ...zone, previousSession: false, dataFreshness: 'Fresh', occupancy: 14 }],
    };
    expect(calculateLiveOccupancy([freshCam]).observedOccupancy).toBe(14);

    const staleCameras = applyCameraEvent([freshCam], {
      cameraId: 'camera',
      siteId: 'site',
      sessionId: 'new-session',
      stateVersion: 21,
      dataFreshness: 'Stale',
      receivedAtUtc: '2026-11-19T10:05:00Z',
    });
    expect(staleCameras[0].dataFreshness).toBe('Stale');
    expect(staleCameras[0].zones[0].dataFreshness).toBe('Stale');
    expect(calculateLiveOccupancy(staleCameras).observedOccupancy).toBeNull();
    expect(calculateLiveOccupancy(staleCameras).staleCameras).toBe(1);
  });
  it('excludes previous-session zones on session change until new-session zone metrics arrive', () => {
    const freshCam: LiveCamera = {
      ...camera,
      sourceType: 'live',
      analyticsStatus: 'running',
      dataFreshness: 'Fresh',
      zones: [{ ...zone, previousSession: false, dataFreshness: 'Fresh', occupancy: 12 }],
    };
    const switched = applyCameraEvent([freshCam], {
      cameraId: 'camera',
      siteId: 'site',
      sessionId: 'session-2',
      stateVersion: 21,
      dataFreshness: 'Fresh',
      receivedAtUtc: '2026-11-19T10:06:00Z',
    });
    expect(switched[0].zones[0].previousSession).toBe(true);
    expect(calculateLiveOccupancy(switched).observedOccupancy).toBeNull();

    const updated = applyZoneEvent(switched, {
      cameraId: 'camera',
      zoneId: 'zone',
      sessionId: 'session-2',
      sequence: 1,
      stateVersion: 22,
      occupancy: 4,
      arrivals: 4,
      departures: 0,
      entry: 4,
      exit: 0,
      wrongWayIn: 0,
      wrongWayOut: 0,
      reportedAverageDwellSeconds: 10,
      activeVisitorsCount: 4,
      longestActiveDwellSeconds: 10,
      receivedAtUtc: '2026-11-19T10:06:05Z',
    });
    expect(updated[0].zones[0].previousSession).toBe(false);
    expect(calculateLiveOccupancy(updated).observedOccupancy).toBe(4);
  });
});
describe('realtime lifecycle', () => {
  it('coalesces ordered alert invalidations, ignores other sites and resyncs after reconnect without admin REST requests', async () => {
    vi.useFakeTimers();
    const handlers = new Map<string, (event: AlertChanged) => void>();
    let reconnect: (() => Promise<void>) | undefined;
    const hub = {
      state: HubConnectionState.Disconnected,
      on: vi.fn((name: string, handler: (event: AlertChanged) => void) =>
        handlers.set(name, handler),
      ),
      onreconnected: vi.fn((callback: () => Promise<void>) => (reconnect = callback)),
      invoke: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(async () => {
        hub.state = HubConnectionState.Connected;
      }),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: config },
        { provide: HUB_FACTORY, useValue: () => hub as unknown as HubConnection },
      ],
    });
    const invalidation = vi.fn();
    const subscription = TestBed.inject(Realtime).watchAlertChanges('site').subscribe(invalidation);
    try {
      await vi.advanceTimersByTimeAsync(500);
      expect(invalidation).toHaveBeenCalledTimes(1);
      const event: AlertChanged = {
        alertId: 'alert',
        cameraId: 'camera',
        siteId: 'site',
        stateVersion: 2,
        status: 'Active',
      };
      const emit = handlers.get('AnalyticsAlertChanged')!;
      emit({ ...event, siteId: 'different-site' });
      emit(event);
      emit(event);
      emit({ ...event, stateVersion: 1 });
      await vi.advanceTimersByTimeAsync(500);
      expect(invalidation).toHaveBeenCalledTimes(2);
      emit(event);
      await vi.advanceTimersByTimeAsync(500);
      expect(invalidation).toHaveBeenCalledTimes(2);
      await reconnect!();
      await vi.advanceTimersByTimeAsync(500);
      expect(invalidation).toHaveBeenCalledTimes(3);
      TestBed.inject(HttpTestingController).verify();
    } finally {
      subscription.unsubscribe();
      await Promise.resolve();
      await Promise.resolve();
      vi.useRealTimers();
    }
    expect(hub.invoke).toHaveBeenCalledWith('UnsubscribeFromSite', 'site');
    expect(hub.stop).toHaveBeenCalled();
  });
  it('resubscribes and resyncs REST after reconnect, then leaves the group', async () => {
    let reconnect: (() => Promise<void>) | undefined;
    const hub = {
      state: HubConnectionState.Disconnected,
      on: vi.fn(),
      onreconnecting: vi.fn(),
      onclose: vi.fn(),
      onreconnected: vi.fn((callback: () => Promise<void>) => (reconnect = callback)),
      invoke: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(async () => {
        hub.state = HubConnectionState.Connected;
      }),
      stop: vi.fn(async () => {
        hub.state = HubConnectionState.Disconnected;
      }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: config },
        { provide: HUB_FACTORY, useValue: () => hub as unknown as HubConnection },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    let state: FeedState | undefined;
    const subscription = TestBed.inject(Realtime)
      .watch('site', 'site')
      .subscribe((value) => (state = value));
    await new Promise((resolve) => setTimeout(resolve, 10));
    http.expectOne(config.apiBaseUrl + '/sites/site/live').flush({ cameras: [camera] });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(hub.invoke).toHaveBeenCalledWith('SubscribeToSite', 'site');
    for (const request of http.match(config.apiBaseUrl + '/sites/site/live'))
      request.flush({ cameras: [camera] });
    await reconnect!();
    expect(hub.invoke.mock.calls.filter((call) => call[0] === 'SubscribeToSite')).toHaveLength(2);
    http.expectOne(config.apiBaseUrl + '/sites/site/live').flush({ cameras: [camera] });
    expect(state?.cameras).toHaveLength(1);
    subscription.unsubscribe();
    await Promise.resolve();
    await Promise.resolve();
    expect(hub.invoke).toHaveBeenCalledWith('UnsubscribeFromSite', 'site');
    expect(hub.stop).toHaveBeenCalled();
    http.verify();
  });
});
