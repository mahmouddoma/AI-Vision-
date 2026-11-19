import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, exhaustMap, forkJoin, map, merge, of, timer } from 'rxjs';
import { Api, UiError, apiError } from './api';
import { Auth } from './auth';
import { MonitoringStatus } from './models';

export type SystemHealthLevel = 'checking' | 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthPayload {
  status?: string | null;
  database?: string | null;
  mqtt?: string | null;
}

export interface SystemHealthInput {
  authorized: boolean;
  loading: boolean;
  hasCompletedCheck: boolean;
  liveness: HealthPayload | null;
  readiness: HealthPayload | null;
  monitoring: MonitoringStatus | null;
  livenessError: UiError | null;
  readinessError: UiError | null;
  monitoringError: UiError | null;
  lastCheckedAt: string | null;
  lastAttemptedAt: string | null;
}

export interface SystemHealthState {
  overallStatus: SystemHealthLevel;
  apiStatus: SystemHealthLevel;
  databaseStatus: SystemHealthLevel;
  mqttStatus: SystemHealthLevel;
  mqttDisabled: boolean;
  liveDataStatus: SystemHealthLevel;
  liveDataMessageKey: string | null;
  reasonKey: string | null;
  errorMessage: string | null;
  lastCheckedAt: string | null;
  lastAttemptedAt: string | null;
  isOutdated: boolean;
}

function norm(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export function evaluateSystemHealth(input: SystemHealthInput): SystemHealthState {
  if (!input.authorized) {
    return {
      overallStatus: 'unknown',
      apiStatus: 'unknown',
      databaseStatus: 'unknown',
      mqttStatus: 'unknown',
      mqttDisabled: false,
      liveDataStatus: 'unknown',
      liveDataMessageKey: null,
      reasonKey: 'health.restricted',
      errorMessage: null,
      lastCheckedAt: null,
      lastAttemptedAt: null,
      isOutdated: false,
    };
  }

  if (input.loading && !input.hasCompletedCheck) {
    return {
      overallStatus: 'checking',
      apiStatus: 'checking',
      databaseStatus: 'checking',
      mqttStatus: 'checking',
      mqttDisabled: false,
      liveDataStatus: 'checking',
      liveDataMessageKey: null,
      reasonKey: 'health.checking',
      errorMessage: null,
      lastCheckedAt: input.lastCheckedAt,
      lastAttemptedAt: input.lastAttemptedAt,
      isOutdated: false,
    };
  }

  const liveReachable = input.liveness !== null && !input.livenessError;
  const readyReachable = input.readiness !== null;
  const apiReachable = liveReachable || readyReachable;

  // Scenario 4: Backend API unreachable (never show green from cached data)
  if (!apiReachable) {
    const err = input.readinessError ?? input.livenessError ?? input.monitoringError;
    return {
      overallStatus: 'unhealthy',
      apiStatus: 'unhealthy',
      databaseStatus: 'unknown',
      mqttStatus: 'unknown',
      mqttDisabled: false,
      liveDataStatus: 'unknown',
      liveDataMessageKey: null,
      reasonKey: 'health.backendUnavailable',
      errorMessage: err?.message ?? null,
      lastCheckedAt: input.lastCheckedAt,
      lastAttemptedAt: input.lastAttemptedAt,
      isOutdated: input.lastCheckedAt !== null,
    };
  }

  const apiStatus: SystemHealthLevel =
    liveReachable && norm(input.liveness?.status) === 'unhealthy' ? 'unhealthy' : 'healthy';

  // Database evaluation
  const dbRaw = norm(input.readiness?.database);
  let databaseStatus: SystemHealthLevel = 'unknown';
  if (dbRaw === 'ready' || dbRaw === 'healthy') {
    databaseStatus = 'healthy';
  } else if (
    dbRaw === 'unavailable' ||
    dbRaw === 'unhealthy' ||
    dbRaw === 'migrationrequired' ||
    dbRaw === 'failed'
  ) {
    databaseStatus = 'unhealthy';
  } else if (dbRaw === 'degraded') {
    databaseStatus = 'degraded';
  }

  // MQTT evaluation (distinguishing intentionally disabled from disconnected)
  const mqttRaw = norm(input.readiness?.mqtt);
  const monitoringFresh = input.monitoring && !input.monitoringError ? input.monitoring : null;
  const mqttDisabled = monitoringFresh?.mqttEnabled === false || mqttRaw === 'disabled';

  let mqttStatus: SystemHealthLevel = 'unknown';
  if (mqttDisabled) {
    mqttStatus = 'unknown';
  } else if (mqttRaw === 'subscribed' || mqttRaw === 'healthy' || mqttRaw === 'connected') {
    mqttStatus =
      monitoringFresh && monitoringFresh.mqttEnabled && !monitoringFresh.mqttSubscribed
        ? 'degraded'
        : 'healthy';
  } else if (
    mqttRaw === 'disconnected' ||
    mqttRaw === 'degraded' ||
    mqttRaw === 'unhealthy' ||
    (monitoringFresh && monitoringFresh.mqttEnabled && !monitoringFresh.mqttSubscribed)
  ) {
    mqttStatus = 'degraded';
  } else if (monitoringFresh?.mqttEnabled && monitoringFresh.mqttSubscribed) {
    mqttStatus = 'healthy';
  }

  // Live camera data freshness (evaluated separately from MQTT/DB readiness)
  let liveDataStatus: SystemHealthLevel = 'unknown';
  let liveDataMessageKey: string | null = null;
  if (monitoringFresh) {
    if (monitoringFresh.registeredCameras === 0) {
      liveDataStatus = 'unknown';
      liveDataMessageKey = 'health.noCamerasRegistered';
    } else if (monitoringFresh.activeCameras > 0 && monitoringFresh.fresh === 0) {
      liveDataStatus = 'degraded';
      liveDataMessageKey = 'health.noFreshCameras';
    } else if (
      monitoringFresh.fresh > 0 &&
      (monitoringFresh.stale > 0 || monitoringFresh.noRecentData > 0)
    ) {
      liveDataStatus = 'degraded';
      liveDataMessageKey = 'health.partialFreshCameras';
    } else if (monitoringFresh.fresh > 0) {
      liveDataStatus = 'healthy';
    }
  }

  // Overall status evaluation
  const readyRaw = norm(input.readiness?.status);
  let overallStatus: SystemHealthLevel = 'unknown';
  let reasonKey: string | null = null;

  if (apiStatus === 'unhealthy' || databaseStatus === 'unhealthy' || readyRaw === 'unhealthy') {
    overallStatus = 'unhealthy';
    reasonKey =
      databaseStatus === 'unhealthy' ? 'health.databaseUnavailable' : 'health.backendNotReady';
  } else if (mqttStatus === 'degraded' || databaseStatus === 'degraded' || readyRaw === 'degraded') {
    overallStatus = 'degraded';
    reasonKey = mqttStatus === 'degraded' ? 'health.mqttDisconnected' : 'health.systemDegraded';
  } else if (
    readyRaw === 'healthy' &&
    databaseStatus === 'healthy' &&
    (mqttStatus === 'healthy' || mqttDisabled)
  ) {
    overallStatus = 'healthy';
    reasonKey = mqttDisabled ? 'health.mqttDisabled' : null;
  } else {
    overallStatus = 'unknown';
    reasonKey = 'health.statusUnknown';
  }

  const isOutdated = Boolean(input.livenessError || input.readinessError || input.monitoringError) &&
    input.lastCheckedAt !== null;

  const errorMessage =
    input.readinessError?.message ??
    input.livenessError?.message ??
    input.monitoringError?.message ??
    null;

  return {
    overallStatus,
    apiStatus,
    databaseStatus,
    mqttStatus,
    mqttDisabled,
    liveDataStatus,
    liveDataMessageKey,
    reasonKey,
    errorMessage,
    lastCheckedAt: input.lastCheckedAt,
    lastAttemptedAt: input.lastAttemptedAt,
    isOutdated,
  };
}

@Injectable({ providedIn: 'root' })
export class SystemHealthStore {
  private readonly api = inject(Api);
  private readonly auth = inject(Auth);
  private readonly destroy = inject(DestroyRef);

  readonly loading = signal(true);
  readonly hasCompletedCheck = signal(false);
  readonly liveness = signal<HealthPayload | null>(null);
  readonly readiness = signal<HealthPayload | null>(null);
  readonly monitoring = signal<MonitoringStatus | null>(null);
  readonly livenessError = signal<UiError | null>(null);
  readonly readinessError = signal<UiError | null>(null);
  readonly monitoringError = signal<UiError | null>(null);
  readonly lastCheckedAt = signal<string | null>(null);
  readonly lastAttemptedAt = signal<string | null>(null);

  private readonly trigger = new Subject<void>();
  private requestSeq = 0;

  readonly state = computed<SystemHealthState>(() =>
    evaluateSystemHealth({
      authorized: this.auth.administrator(),
      loading: this.loading(),
      hasCompletedCheck: this.hasCompletedCheck(),
      liveness: this.liveness(),
      readiness: this.readiness(),
      monitoring: this.monitoring(),
      livenessError: this.livenessError(),
      readinessError: this.readinessError(),
      monitoringError: this.monitoringError(),
      lastCheckedAt: this.lastCheckedAt(),
      lastAttemptedAt: this.lastAttemptedAt(),
    }),
  );

  constructor() {
    merge(timer(0, this.api.config.refreshIntervalSeconds * 1000), this.trigger)
      .pipe(
        exhaustMap(() => {
          if (!this.auth.administrator()) {
            this.loading.set(false);
            this.hasCompletedCheck.set(true);
            return of(null);
          }

          const seq = ++this.requestSeq;
          if (!this.hasCompletedCheck()) this.loading.set(true);

          const fetchHealth = (path: string) =>
            this.api.get<HealthPayload>(path).pipe(
              map((data) => ({ data, error: null as UiError | null })),
              catchError((error) =>
                of({
                  data:
                    error instanceof HttpErrorResponse &&
                    error.status === 503 &&
                    error.error &&
                    typeof error.error === 'object'
                      ? (error.error as HealthPayload)
                      : null,
                  error: apiError(error),
                }),
              ),
            );

          const fetchMonitoring = this.api.get<MonitoringStatus>('monitoring/status').pipe(
            map((data) => ({ data, error: null as UiError | null })),
            catchError((error) => of({ data: null, error: apiError(error) })),
          );

          return forkJoin({
            live: fetchHealth('health/live'),
            ready: fetchHealth('health/ready'),
            monitoring: fetchMonitoring,
          }).pipe(map((res) => ({ ...res, seq })));
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((res) => {
        if (!res || res.seq < this.requestSeq) return;

        const now = new Date().toISOString();
        this.loading.set(false);
        this.hasCompletedCheck.set(true);
        this.lastAttemptedAt.set(now);

        this.livenessError.set(res.live.error);
        this.readinessError.set(res.ready.error);
        this.monitoringError.set(res.monitoring.error);

        // Preserve structured 503 readiness payload; clear stale liveness/readiness when unreachable
        this.liveness.set(res.live.data);
        this.readiness.set(res.ready.data);
        // Preserve last known monitoring counts for diagnostics while marking outdated via monitoringError
        if (res.monitoring.data) {
          this.monitoring.set(res.monitoring.data);
        }

        const anySuccess = Boolean(res.live.data || res.ready.data || res.monitoring.data);
        if (anySuccess && !res.live.error && !res.ready.error && !res.monitoring.error) {
          this.lastCheckedAt.set(now);
        } else if (anySuccess && !this.lastCheckedAt()) {
          this.lastCheckedAt.set(now);
        }
      });
  }

  refresh(): void {
    this.trigger.next();
  }
}
