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
import { RUNTIME_CONFIG } from './runtime-config';
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
});
describe('realtime lifecycle', () => {
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
