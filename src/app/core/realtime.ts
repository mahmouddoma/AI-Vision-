import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import {
  Observable,
  Subject,
  Subscription,
  auditTime,
  catchError,
  exhaustMap,
  merge,
  of,
  timer,
} from 'rxjs';
import { Api, UiError, apiError } from './api';
import { LiveCamera, LiveSite } from './models';
import { AlertChanged } from './smart-models';
import { Auth } from './auth';

export interface CameraEvent {
  cameraId: string;
  siteId: string;
  sessionId: string;
  stateVersion: number;
  receivedAtUtc: string;
  sequence?: number;
  sourceType?: string;
  analyticsStatus?: string;
  dataFreshness?: string;
  processingFps?: number | null;
  staffCount?: number | null;
}
export interface ZoneEvent {
  cameraId: string;
  zoneId: string;
  sessionId: string;
  sequence: number;
  stateVersion: number;
  occupancy: number | null;
  arrivals: number | null;
  departures: number | null;
  entry: number | null;
  exit: number | null;
  wrongWayIn: number | null;
  wrongWayOut: number | null;
  reportedAverageDwellSeconds: number | null;
  activeVisitorsCount: number | null;
  longestActiveDwellSeconds: number | null;
  receivedAtUtc: string;
}
export function applyCameraEvent(cameras: LiveCamera[], event: CameraEvent): LiveCamera[] {
  return cameras.map((camera) => {
    if (camera.cameraId !== event.cameraId || event.stateVersion <= (camera.stateVersion ?? -1))
      return camera;
    const changedSession = camera.sessionId !== event.sessionId;
    const nextFreshness = event.dataFreshness ?? camera.dataFreshness;
    const freshnessDegraded = event.dataFreshness !== undefined && event.dataFreshness !== 'Fresh';
    return {
      ...camera,
      sessionId: event.sessionId,
      stateVersion: event.stateVersion,
      lastSequence: event.sequence ?? camera.lastSequence,
      sourceType: event.sourceType ?? camera.sourceType,
      analyticsStatus: event.analyticsStatus ?? camera.analyticsStatus,
      dataFreshness: nextFreshness,
      processingFps: event.processingFps === undefined ? camera.processingFps : event.processingFps,
      staffCount: event.staffCount === undefined ? camera.staffCount : event.staffCount,
      lastReceivedAtUtc: event.receivedAtUtc,
      zones:
        changedSession || freshnessDegraded
          ? camera.zones.map((zone) => ({
              ...zone,
              previousSession: changedSession ? true : zone.previousSession,
              dataFreshness: freshnessDegraded ? nextFreshness : zone.dataFreshness,
            }))
          : camera.zones,
    };
  });
}
export function applyZoneEvent(cameras: LiveCamera[], event: ZoneEvent): LiveCamera[] {
  return cameras.map((camera) => {
    if (camera.cameraId !== event.cameraId || camera.sessionId !== event.sessionId) return camera;
    return {
      ...camera,
      zones: camera.zones.map((zone) => {
        if (zone.zoneId !== event.zoneId || event.stateVersion <= (zone.stateVersion ?? -1))
          return zone;
        return {
          ...zone,
          sessionId: event.sessionId,
          sequence: event.sequence,
          stateVersion: event.stateVersion,
          previousSession: false,
          dataFreshness: camera.dataFreshness,
          occupancy: event.occupancy,
          zoneArrivals: event.arrivals,
          zoneDepartures: event.departures,
          entry: event.entry,
          exit: event.exit,
          wrongWayIn: event.wrongWayIn,
          wrongWayOut: event.wrongWayOut,
          reportedAverageDwellSeconds: event.reportedAverageDwellSeconds,
          activeVisitorsCount: event.activeVisitorsCount,
          longestActiveDwellSeconds: event.longestActiveDwellSeconds,
          lastUpdatedAtUtc: event.receivedAtUtc,
          utilizationPercent: null,
          capacityStatus: null,
        };
      }),
    };
  });
}
export function mergeSnapshot(previous: LiveCamera[], incoming: LiveCamera[]): LiveCamera[] {
  return incoming.map((camera) => {
    const old = previous.find((item) => item.cameraId === camera.cameraId);
    if (!old) return camera;
    const latest =
      (old.stateVersion ?? -1) > (camera.stateVersion ?? -1)
        ? { ...old, isActive: camera.isActive }
        : camera;
    return {
      ...latest,
      zones: camera.zones.map((zone) => {
        const oldZone = old.zones.find((item) => item.zoneId === zone.zoneId);
        if (oldZone && latest.sessionId !== camera.sessionId)
          return { ...oldZone, isActive: zone.isActive };
        return oldZone &&
          oldZone.sessionId === zone.sessionId &&
          (oldZone.stateVersion ?? -1) > (zone.stateVersion ?? -1)
          ? { ...oldZone, isActive: zone.isActive }
          : zone;
      }),
    };
  });
}
export const HUB_FACTORY = new InjectionToken<(url: string) => HubConnection>('hub factory', {
  providedIn: 'root',
  factory: () => {
    const auth = inject(Auth);
    return (url) =>
      new HubConnectionBuilder()
        .withUrl(url, { accessTokenFactory: () => auth.token() })
        .withAutomaticReconnect([0, 2000, 10000, 30000])
        .configureLogging(LogLevel.None)
        .build();
  },
});
export interface FeedState {
  cameras: LiveCamera[];
  loading: boolean;
  error: UiError | null;
  refreshedAt: string | null;
}
@Injectable({ providedIn: 'root' })
export class Realtime {
  private readonly api = inject(Api);
  private readonly factory = inject(HUB_FACTORY);
  readonly mode = signal('Polling');
  readonly summaries = new Subject<void>();
  watchAlertChanges(siteId: string): Observable<void> {
    return new Observable((observer) => {
      const hub = this.api.config.signalREnabled ? this.factory(this.api.config.hubPath) : null;
      const changes = new Subject<void>();
      const versions = new Map<string, number>();
      let stopped = false;
      let starting = false;
      const subscribe = async () => {
        await hub!.invoke('SubscribeToSite', siteId);
        if (!stopped) changes.next();
      };
      const connect = async () => {
        if (!hub || stopped || starting || hub.state !== HubConnectionState.Disconnected) return;
        starting = true;
        try {
          await hub.start();
          if (!stopped) await subscribe();
        } catch {
          /* REST synchronization remains available. */
        } finally {
          starting = false;
        }
      };
      hub?.on('AnalyticsAlertChanged', (event: AlertChanged) => {
        if (
          stopped ||
          event.siteId !== siteId ||
          event.stateVersion <= (versions.get(event.alertId) ?? -1)
        )
          return;
        if (versions.size > 1000) versions.clear();
        versions.set(event.alertId, event.stateVersion);
        changes.next();
      });
      hub?.onreconnected(async () => {
        try {
          await subscribe();
        } catch {
          changes.next();
        }
      });
      void connect();
      const interval = this.api.config.refreshIntervalSeconds * 1000;
      const subscription = merge(timer(interval, interval), changes.pipe(auditTime(500))).subscribe(
        () => {
          observer.next();
          void connect();
        },
      );
      return () => {
        stopped = true;
        subscription.unsubscribe();
        changes.complete();
        if (hub) {
          const leave =
            hub.state === HubConnectionState.Connected
              ? hub.invoke('UnsubscribeFromSite', siteId).catch(() => undefined)
              : Promise.resolve();
          void leave.finally(() => hub.stop());
        }
      };
    });
  }
  watch(scope: 'site' | 'camera', id: string): Observable<FeedState> {
    return new Observable((observer) => {
      let state: FeedState = { cameras: [], loading: true, error: null, refreshedAt: null };
      let stopped = false;
      let starting = false;
      const refresh = new Subject<void>();
      const subscription = new Subscription();
      const hub = this.api.config.signalREnabled ? this.factory(this.api.config.hubPath) : null;
      const suffix = scope === 'site' ? 'Site' : 'Camera';
      const publish = () => observer.next(state);
      const resubscribe = async () => {
        await hub!.invoke(`SubscribeTo${suffix}`, id);
        if (!stopped) {
          this.mode.set('Connected');
          refresh.next();
        }
      };
      const connect = async () => {
        if (!hub || stopped || starting || hub.state !== HubConnectionState.Disconnected) return;
        starting = true;
        this.mode.set('Connecting');
        try {
          await hub.start();
          if (!stopped) await resubscribe();
        } catch {
          if (!stopped) this.mode.set('Polling · connection unavailable');
        } finally {
          starting = false;
        }
      };
      if (hub) {
        const handleCameraEvent = (event: CameraEvent) => {
          if (scope === 'site' && event.siteId && event.siteId !== id) return;
          state = { ...state, cameras: applyCameraEvent(state.cameras, event) };
          publish();
        };
        hub.on('CameraSnapshotUpdated', handleCameraEvent);
        hub.on('CameraStatusChanged', handleCameraEvent);
        hub.on('ZoneMetricsUpdated', (event: ZoneEvent) => {
          state = { ...state, cameras: applyZoneEvent(state.cameras, event) };
          publish();
        });
        hub.on('AnalyticsSummaryUpdated', () => this.summaries.next());
        hub.onreconnecting(() => {
          if (!stopped) this.mode.set('Reconnecting · polling active');
        });
        hub.onreconnected(async () => {
          try {
            await resubscribe();
          } catch {
            if (!stopped) this.mode.set('Polling · subscription unavailable');
          }
        });
        hub.onclose(() => {
          if (!stopped) this.mode.set('Polling · disconnected');
        });
      }
      this.mode.set(hub ? 'Connecting' : 'Polling');
      publish();
      subscription.add(
        merge(
          timer(0, this.api.config.refreshIntervalSeconds * 1000),
          refresh,
          this.summaries.pipe(auditTime(2000)),
        )
          .pipe(
            exhaustMap(() =>
              this.api
                .get<LiveSite | LiveCamera>(
                  `${scope === 'site' ? 'sites' : 'cameras'}/${encodeURIComponent(id)}/live`,
                )
                .pipe(
                  catchError((error) => {
                    state = { ...state, loading: false, error: apiError(error) };
                    publish();
                    return of(null);
                  }),
                ),
            ),
          )
          .subscribe((snapshot) => {
            if (snapshot) {
              const cameras = 'cameras' in snapshot ? snapshot.cameras : [snapshot];
              state = {
                cameras: mergeSnapshot(state.cameras, cameras),
                loading: false,
                error: null,
                refreshedAt: new Date().toISOString(),
              };
              publish();
            }
            void connect();
          }),
      );
      return () => {
        stopped = true;
        subscription.unsubscribe();
        refresh.complete();
        this.mode.set('Polling');
        if (hub) {
          const leave =
            hub.state === HubConnectionState.Connected
              ? hub.invoke(`UnsubscribeFrom${suffix}`, id).catch(() => undefined)
              : Promise.resolve();
          void leave.finally(() => hub.stop());
        }
      };
    });
  }
}
