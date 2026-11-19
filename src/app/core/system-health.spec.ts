import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import {
  evaluateSystemHealth,
  SystemHealthInput,
  SystemHealthStore,
} from './system-health';
import { Auth } from './auth';
import { MonitoringStatus } from './models';
import { RUNTIME_CONFIG } from './runtime-config';

const healthyMonitoring: MonitoringStatus = {
  registeredCameras: 2,
  activeCameras: 2,
  fresh: 2,
  stale: 0,
  noRecentData: 0,
  neverReceived: 0,
  ended: 0,
  mqttEnabled: true,
  mqttSubscribed: true,
  checkedAtUtc: '2026-11-19T12:00:00Z',
};

function makeInput(overrides: Partial<SystemHealthInput> = {}): SystemHealthInput {
  return {
    authorized: true,
    loading: false,
    hasCompletedCheck: true,
    liveness: { status: 'Healthy' },
    readiness: { status: 'Healthy', database: 'Ready', mqtt: 'Subscribed' },
    monitoring: healthyMonitoring,
    livenessError: null,
    readinessError: null,
    monitoringError: null,
    lastCheckedAt: '2026-11-19T12:00:00Z',
    lastAttemptedAt: '2026-11-19T12:00:00Z',
    ...overrides,
  };
}

describe('evaluateSystemHealth', () => {
  it('1. returns Healthy when API, DB, and MQTT are all ready', () => {
    const state = evaluateSystemHealth(makeInput());
    expect(state.overallStatus).toBe('healthy');
    expect(state.apiStatus).toBe('healthy');
    expect(state.databaseStatus).toBe('healthy');
    expect(state.mqttStatus).toBe('healthy');
    expect(state.liveDataStatus).toBe('healthy');
    expect(state.isOutdated).toBe(false);
  });

  it('2. returns Degraded when MQTT is disconnected while API and DB are healthy', () => {
    const state = evaluateSystemHealth(
      makeInput({
        readiness: { status: 'Degraded', database: 'Ready', mqtt: 'Disconnected' },
        monitoring: { ...healthyMonitoring, mqttSubscribed: false },
      }),
    );
    expect(state.overallStatus).toBe('degraded');
    expect(state.apiStatus).toBe('healthy');
    expect(state.databaseStatus).toBe('healthy');
    expect(state.mqttStatus).toBe('degraded');
    expect(state.reasonKey).toBe('health.mqttDisconnected');
  });

  it('3. returns Unhealthy when database is unavailable (HTTP 503 payload)', () => {
    const state = evaluateSystemHealth(
      makeInput({
        readiness: { status: 'Unhealthy', database: 'Unavailable', mqtt: 'Subscribed' },
        readinessError: {
          title: 'Service unavailable',
          message: 'Backend not ready',
          status: 503,
          conflict: false,
          fields: {},
        },
      }),
    );
    expect(state.overallStatus).toBe('unhealthy');
    expect(state.databaseStatus).toBe('unhealthy');
    expect(state.reasonKey).toBe('health.databaseUnavailable');
  });

  it('4. returns Unhealthy when backend API is unreachable even with cached monitoring data', () => {
    const state = evaluateSystemHealth(
      makeInput({
        liveness: null,
        readiness: null,
        livenessError: {
          title: 'Offline',
          message: 'Connection refused',
          status: 0,
          conflict: false,
          fields: {},
        },
        readinessError: {
          title: 'Offline',
          message: 'Connection refused',
          status: 0,
          conflict: false,
          fields: {},
        },
      }),
    );
    expect(state.overallStatus).toBe('unhealthy');
    expect(state.apiStatus).toBe('unhealthy');
    expect(state.reasonKey).toBe('health.backendUnavailable');
    expect(state.isOutdated).toBe(true);
  });

  it('5. distinguishes intentionally disabled MQTT from accidental disconnection', () => {
    const state = evaluateSystemHealth(
      makeInput({
        readiness: { status: 'Healthy', database: 'Ready', mqtt: 'Disabled' },
        monitoring: { ...healthyMonitoring, mqttEnabled: false, mqttSubscribed: false },
      }),
    );
    expect(state.mqttDisabled).toBe(true);
    expect(state.mqttStatus).toBe('unknown');
    expect(state.overallStatus).toBe('healthy');
    expect(state.reasonKey).toBe('health.mqttDisabled');
  });

  it('6. shows separate live data warning when no fresh cameras exist while MQTT is subscribed', () => {
    const state = evaluateSystemHealth(
      makeInput({
        monitoring: { ...healthyMonitoring, fresh: 0, stale: 2 },
      }),
    );
    expect(state.overallStatus).toBe('healthy');
    expect(state.mqttStatus).toBe('healthy');
    expect(state.liveDataStatus).toBe('degraded');
    expect(state.liveDataMessageKey).toBe('health.noFreshCameras');
  });

  it('7. shows neutral message when no cameras are registered without marking Unhealthy', () => {
    const state = evaluateSystemHealth(
      makeInput({
        monitoring: { ...healthyMonitoring, registeredCameras: 0, activeCameras: 0, fresh: 0 },
      }),
    );
    expect(state.overallStatus).toBe('healthy');
    expect(state.liveDataStatus).toBe('unknown');
    expect(state.liveDataMessageKey).toBe('health.noCamerasRegistered');
  });

  it('8. displays neutral Checking state during initial load', () => {
    const state = evaluateSystemHealth(
      makeInput({
        loading: true,
        hasCompletedCheck: false,
        liveness: null,
        readiness: null,
        monitoring: null,
      }),
    );
    expect(state.overallStatus).toBe('checking');
    expect(state.reasonKey).toBe('health.checking');
  });

  it('9. returns Unknown when readiness properties are missing or unrecognized', () => {
    const state = evaluateSystemHealth(
      makeInput({
        readiness: { status: null, database: null, mqtt: null },
      }),
    );
    expect(state.overallStatus).toBe('unknown');
    expect(state.reasonKey).toBe('health.statusUnknown');
  });

  it('10. returns Unknown and never Healthy for non-administrator users', () => {
    const state = evaluateSystemHealth(makeInput({ authorized: false }));
    expect(state.overallStatus).toBe('unknown');
    expect(state.reasonKey).toBe('health.restricted');
  });
});

describe('SystemHealthStore polling, 503 handling, and recovery', () => {
  const config = {
    apiBaseUrl: 'http://localhost:5080/api/v1',
    hubPath: 'http://localhost:5080/hubs/analytics',
    signalREnabled: false,
    refreshIntervalSeconds: 60,
  };

  it('interprets HTTP 503 readiness body, recovers on manual refresh, and updates state', () => {
    vi.useFakeTimers();
    try {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: RUNTIME_CONFIG, useValue: config },
          { provide: Auth, useValue: { administrator: signal(true), token: () => '' } },
        ],
      });

      const http = TestBed.inject(HttpTestingController);
      const store = TestBed.inject(SystemHealthStore);

      expect(store.state().overallStatus).toBe('checking');
      vi.advanceTimersByTime(0);

      // Initial check: DB Unavailable (HTTP 503 with structured JSON body)
      http.expectOne(`${config.apiBaseUrl}/health/live`).flush({ status: 'Healthy' });
      http
        .expectOne(`${config.apiBaseUrl}/health/ready`)
        .flush(
          { status: 'Unhealthy', database: 'Unavailable', mqtt: 'Subscribed' },
          { status: 503, statusText: 'Service Unavailable' },
        );
      http.expectOne(`${config.apiBaseUrl}/monitoring/status`).flush(healthyMonitoring);

      expect(store.state().overallStatus).toBe('unhealthy');
      expect(store.state().databaseStatus).toBe('unhealthy');

      // Manual refresh -> transitions to Degraded (MQTT disconnected)
      store.refresh();
      http.expectOne(`${config.apiBaseUrl}/health/live`).flush({ status: 'Healthy' });
      http
        .expectOne(`${config.apiBaseUrl}/health/ready`)
        .flush({ status: 'Degraded', database: 'Ready', mqtt: 'Disconnected' });
      http
        .expectOne(`${config.apiBaseUrl}/monitoring/status`)
        .flush({ ...healthyMonitoring, mqttSubscribed: false });

      expect(store.state().overallStatus).toBe('degraded');
      expect(store.state().mqttStatus).toBe('degraded');

      // Manual refresh -> recovers to Healthy
      store.refresh();
      http.expectOne(`${config.apiBaseUrl}/health/live`).flush({ status: 'Healthy' });
      http
        .expectOne(`${config.apiBaseUrl}/health/ready`)
        .flush({ status: 'Healthy', database: 'Ready', mqtt: 'Subscribed' });
      http.expectOne(`${config.apiBaseUrl}/monitoring/status`).flush(healthyMonitoring);

      expect(store.state().overallStatus).toBe('healthy');
      expect(store.state().isOutdated).toBe(false);

      // Next check fails -> marks outdated and never stays Healthy
      store.refresh();
      http
        .expectOne(`${config.apiBaseUrl}/health/live`)
        .flush(null, { status: 0, statusText: 'Error' });
      http
        .expectOne(`${config.apiBaseUrl}/health/ready`)
        .flush(null, { status: 0, statusText: 'Error' });
      http
        .expectOne(`${config.apiBaseUrl}/monitoring/status`)
        .flush(null, { status: 0, statusText: 'Error' });

      expect(store.state().overallStatus).toBe('unhealthy');
      expect(store.state().isOutdated).toBe(true);
      expect(store.monitoring()).toEqual(healthyMonitoring);

      http.verify();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not call admin health endpoints for non-administrator users', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: config },
        { provide: Auth, useValue: { administrator: signal(false), token: () => '' } },
      ],
    });

    const http = TestBed.inject(HttpTestingController);
    const store = TestBed.inject(SystemHealthStore);

    expect(store.state().overallStatus).toBe('unknown');
    http.verify();
  });
});
